// Who sits where, the song queue and the game's state, with no browser calls.
// Rules are in PLAN.md under "Seats and session" and "Wave 3b". A phone holds one or more seats; one engine
// runs for each taken seat, and every seat plays its share of the song at the same time.
import { createGame, gradeFor, songSeconds, TRAVEL_MS } from "../game/engine.js";
import { splitParts } from "../game/parts.js";
import { makeLayout, asLayout, MAX_SEATS } from "./layout.js";

export const COUNTDOWN_MS = 3000;
export const RESULTS_MS = 8000;
const SECTION_MAX = 30;
const NOTICE_MS = 4000; // a refusal is shown this long
const HERE_MS = 10000; // a player not heard from for this long is removed
const LIVE = ["countdown", "playing", "paused"];
// Commands that change the game: only a phone that has joined may send them (the stage's own keys are trusted).
const COMMANDS = ["start", "pause", "resume", "skip", "stop", "layout", "set", "calibrate"];

const isId = (x) => typeof x === "string" && x.length > 0 && x.length <= 64;
const isNum = (x) => typeof x === "number" && Number.isFinite(x);
const zeroStats = (total = 0) => ({ score: 0, combo: 0, maxCombo: 0, multiplier: 1, counts: { perfect: 0, good: 0, miss: 0 }, total, grade: null });
const statsOf = (r) => ({ score: r.score, combo: r.combo, maxCombo: r.maxCombo, multiplier: r.multiplier, counts: r.counts, total: r.total, grade: r.grade });
const cleanSection = (x) => (typeof x === "string" && x.trim() && x.trim().length <= SECTION_MAX ? x.trim() : null);
const summary = (s) => ({ id: s.id, title: s.title, seconds: Math.round(songSeconds(s)) });

// A transit is null or { stop, mode, endsAt }. Returns the clean copy, or undefined when it is malformed.
function cleanTransit(t) {
  if (t == null) return null;
  const endsAt = typeof t === "object" ? (t.endsAt ?? null) : undefined;
  const ok = endsAt !== undefined && typeof t.stop === "string" && (t.mode === "platform" || t.mode === "train") && (endsAt === null || isNum(endsAt));
  return ok ? { stop: t.stop, mode: t.mode, endsAt } : undefined;
}

export function createSession({ songs, layout, section } = {}) {
  const library = Array.isArray(songs) ? songs : [];
  let place = cleanSection(section) ?? "Car 2, front";
  let lay = asLayout(layout) ?? makeLayout({ seats: 3 });
  let status = "lobby";
  let notice = null; // { for, text }
  let noticeAt = 0;
  const phones = new Map(); // clientId -> when the phone was last heard from
  const owner = new Map(); // spotId -> the clientId that holds the seat (one phone can hold several)
  let current = null; // the song loaded now
  let queue = []; // songs still to come
  let transit = null;
  let engines = new Map(); // spotId -> { game, tiles, stats, done }
  // Song time is nowMs - origin: 0 is when the first beat is due at the hit line. A song starts
  // COUNTDOWN_MS + TRAVEL_MS before that, so the countdown runs first and then the tiles slide in.
  let origin = 0;
  let pausedAt = 0;
  let resultsAt = 0;
  let ready = { camera: false, calibrated: false };
  const settings = { volume: 0.8, offsetMs: 120 };
  // A new lag set mid-song waits for the next song: settings.offsetMs is what was asked for, this is in use.
  let appliedOffset = settings.offsetMs;
  let out = []; // events for drain()

  const setStatus = (s) => {
    if (s === status) return;
    status = s;
    out.push({ type: "status", status: s });
  };
  const songTime = (nowMs) => (status === "paused" ? pausedAt : nowMs) - origin;
  const refuse = (text, forId, nowMs) => { notice = { for: forId, text }; noticeAt = nowMs; };
  // The team's numbers: every seat's part added up. The grade comes once every part is finished.
  function teamStats() {
    const all = [...engines.values()];
    const sum = (f) => all.reduce((n, e) => n + f(e.stats), 0);
    const hits = sum((s) => s.counts.perfect + s.counts.good);
    const total = sum((s) => s.total);
    return { score: sum((s) => s.score), hits, total, grade: all.length && all.every((e) => e.done) ? gradeFor(hits, total) : null };
  }
  // A seat the layout no longer has is given up.
  function useLayout(next) {
    lay = next;
    for (const spotId of owner.keys()) if (!lay.spots.some((s) => s.id === spotId)) owner.delete(spotId);
  }
  function freeSeat(spotId) {
    owner.delete(spotId);
    engines.delete(spotId);
    if (LIVE.includes(status) && !engines.size) toLobby();
  }
  // A phone goes: all of its seats are freed and its parts are left unplayed.
  function drop(clientId) {
    phones.delete(clientId);
    for (const [spotId, id] of owner) if (id === clientId) freeSeat(spotId);
  }
  function toLobby() {
    engines = new Map();
    current = null;
    queue = [];
    transit = null;
    setStatus("lobby");
  }
  // Starts the next queued song on every taken seat, or goes back to the lobby when there is none.
  function loadNext(nowMs) {
    const song = queue.shift();
    const seated = [...owner.keys()].sort((a, b) => a - b);
    if (!song || !seated.length) return toLobby();
    current = song;
    // The taken seats, in seat order, are one keyboard: each plays its own two lanes of the song, all at once.
    const parts = splitParts(song, seated.length);
    engines = new Map(seated.map((spotId, i) => {
      const game = createGame({ song: parts[i], lanes: lay.lanes });
      return [spotId, { game, tiles: [], stats: zeroStats(game.total), done: false }];
    }));
    // The stage's clock runs offsetMs behind the wall clock. A new lag takes over here, and the origin
    // moves by the difference so the song clock does not jump.
    const shift = appliedOffset - settings.offsetMs;
    appliedOffset = settings.offsetMs;
    origin = nowMs + shift + COUNTDOWN_MS + TRAVEL_MS;
    setStatus("countdown");
  }

  // Each handler returns undefined when it accepted the message, a sentence when it refused it, or
  // false when the message is malformed and is ignored.
  const handlers = {
    join({ clientId }, nowMs) {
      if (!isId(clientId)) return false;
      if (!phones.has(clientId)) phones.set(clientId, nowMs);
    },
    // Claiming adds a seat to the phone: a phone can hold several, and claiming never moves it from another.
    claim({ clientId, spotId }) {
      if (!isId(clientId) || !Number.isInteger(spotId)) return false;
      if (!phones.has(clientId)) return "Join before you pick a seat.";
      if (!lay.spots.some((s) => s.id === spotId)) return "That seat does not exist.";
      if (LIVE.includes(status)) return "A song is playing. Pick a seat when it ends.";
      if (owner.get(spotId) === clientId) return;
      if (owner.has(spotId)) return "That seat is taken.";
      owner.set(spotId, clientId);
    },
    // Gives back one seat the phone holds.
    release({ clientId, spotId }) {
      if (!isId(clientId) || !Number.isInteger(spotId) || !phones.has(clientId)) return false;
      if (owner.get(spotId) !== clientId) return "That seat is not yours.";
      freeSeat(spotId);
    },
    leave({ clientId }) {
      if (!phones.has(clientId)) return false;
      drop(clientId);
    },
    here({ clientId }) { // a phone saying it is still there; apply() has already noted the time
      if (!phones.has(clientId)) return false;
    },
    layout({ seats }) {
      if (!Number.isInteger(seats)) return false;
      if (seats < 1 || seats > MAX_SEATS) return `Choose from 1 to ${MAX_SEATS} seats.`;
      if (LIVE.includes(status)) return "The seats cannot change while a song is playing.";
      useLayout(makeLayout({ seats }));
    },
    start({ songIds, transit: sent }, nowMs) {
      const t = cleanTransit(sent);
      if (!Array.isArray(songIds) || !songIds.every(isId) || t === undefined) return false;
      if (status !== "lobby") return "A song is already running. Stop it first.";
      if (!songIds.length) return "Pick at least one song.";
      const found = songIds.map((id) => library.find((s) => s.id === id));
      if (found.includes(undefined)) return "One of those songs is not in the library.";
      if (!owner.size) return "Pick a seat before starting.";
      queue = found;
      transit = t;
      loadNext(nowMs);
    },
    pause(_, nowMs) {
      if (status !== "countdown" && status !== "playing") return "Nothing is playing to pause.";
      pausedAt = nowMs;
      setStatus("paused");
    },
    resume(_, nowMs) {
      if (status !== "paused") return "The song is not paused.";
      const t = pausedAt - origin;
      origin += nowMs - pausedAt; // song time carries on from where it stopped
      setStatus(t < -TRAVEL_MS ? "countdown" : "playing");
    },
    skip(_, nowMs) {
      if (status === "lobby") return "Nothing is playing to skip.";
      loadNext(nowMs);
    },
    stop() {
      if (status === "lobby") return "Nothing is playing to stop.";
      toLobby();
    },
    calibrate() {
      out.push({ type: "calibrate" });
    },
    set({ volume, offsetMs }) {
      if (!isNum(volume) && !isNum(offsetMs)) return false;
      if (isNum(volume)) settings.volume = Math.min(1, Math.max(0, volume));
      if (isNum(offsetMs)) {
        settings.offsetMs = Math.min(1000, Math.max(-1000, Math.round(offsetMs)));
        if (status === "lobby") appliedOffset = settings.offsetMs; // no song to disturb
      }
    },
  };

  // songMs is the song clock: negative in the lead-in, frozen while paused, null when no song is live.
  const view = (nowMs) => ({
    status,
    pads: [...engines].map(([spotId, e]) => ({ spotId, lanes: e.game.lanes, tiles: e.tiles })),
    songMs: LIVE.includes(status) ? songTime(nowMs) : null,
    song: current,
  });

  return {
    // A phone's message (any message counts as the phone being there). A refusal becomes the notice for that
    // phone; an accepted message from the same phone clears it. `stage: true` is for the laptop's own keys,
    // which need no join.
    apply(message, nowMs, { stage = false } = {}) {
      if (!message || typeof message !== "object" || !Object.hasOwn(handlers, message.type)) return;
      const from = isId(message.clientId) ? message.clientId : null;
      const known = phones.has(from);
      if (known) phones.set(from, nowMs);
      if (COMMANDS.includes(message.type) && !stage && !known) {
        if (from) refuse("Join before you use the controls.", from, nowMs);
        return;
      }
      const result = handlers[message.type](message, nowMs);
      if (typeof result === "string") refuse(result, from, nowMs);
      else if (result !== false && from && message.type !== "here" && notice?.for === from) notice = null;
    },

    // feetBySpot is { [spotId]: [{ u, v }] } in pad coordinates. Returns what to draw:
    // { status, pads: [{ spotId, lanes, tiles }], songMs, song }. While paused the pads stay as they were.
    tick(nowMs, feetBySpot) {
      for (const [id, seen] of phones) if (nowMs - seen > HERE_MS) drop(id); // a phone that went quiet frees its seats
      if (status === "results" && nowMs >= resultsAt) loadNext(nowMs);
      else if (status === "countdown" || status === "playing") {
        const t = nowMs - origin;
        setStatus(t < -TRAVEL_MS ? "countdown" : "playing");
        for (const [spotId, e] of engines) {
          const r = e.game.update(t, feetBySpot?.[spotId] ?? []);
          e.tiles = r.tiles;
          e.stats = statsOf(r);
          e.done = r.done;
          for (const event of r.events) out.push({ ...event, spotId });
        }
        if ([...engines.values()].every((e) => e.done)) {
          resultsAt = nowMs + RESULTS_MS;
          setStatus("results");
        }
      }
      return view(nowMs);
    },

    // The State message for the phones.
    snapshot(nowMs) {
      const live = LIVE.includes(status);
      return structuredClone({
        type: "state",
        status,
        notice: notice && nowMs - noticeAt < NOTICE_MS ? notice : null,
        layout: lay,
        section: { name: place },
        // One entry for each taken seat, in seat order. A phone that holds several seats appears in each.
        players: [...owner].sort((a, b) => a[0] - b[0]).map(([spotId, clientId]) => ({ clientId, spotId, ...(engines.get(spotId)?.stats ?? zeroStats()) })),
        team: teamStats(),
        song: current && summary(current),
        queue: queue.map(summary),
        secondsLeft: live ? Math.max(0, Math.ceil((songSeconds(current) * 1000 - songTime(nowMs)) / 1000)) : 0,
        transit,
        ready,
        settings,
      });
    },

    // What happened since the last call, in order: engine events with their spotId,
    // { type: "status", status } on every status change, and { type: "calibrate" }.
    drain() {
      const events = out;
      out = [];
      return events;
    },

    // For the stage, which knows things the phones do not.
    setReady({ camera = ready.camera, calibrated = ready.calibrated } = {}) {
      ready = { camera: !!camera, calibrated: !!calibrated };
    },
    // The lag in use now. A new `set` mid-song takes over at the next song, so the stage's clock reads this.
    offsetMs: () => appliedOffset,
    // Where this floor is ("Car 2, front"). False when the name is empty or longer than 30 characters.
    setSection(name) {
      const clean = cleanSection(name);
      if (clean) place = clean;
      return !!clean;
    },
    // Gives back the seats a reloaded stage had: [{ clientId, spotId }], one entry for each taken seat (saved by
    // the stage). Their phones count as just heard from, so the 10 second rule still applies. wasLive: a song
    // was running, so tell everyone it is gone.
    restore(saved, nowMs, wasLive = false) {
      if (!Array.isArray(saved) || phones.size || status !== "lobby") return;
      for (const p of saved) {
        if (!isId(p?.clientId)) continue;
        phones.set(p.clientId, nowMs);
        if (lay.spots.some((s) => s.id === p.spotId) && !owner.has(p.spotId)) owner.set(p.spotId, p.clientId);
      }
      if (wasLive && phones.size) refuse("The floor restarted. Start the song again.", null, nowMs);
    },
    // Replaces the layout (pads the setup page dragged). False when it is broken or a song is playing.
    setLayout(next) {
      const clean = asLayout(next);
      if (!clean || LIVE.includes(status)) return false;
      useLayout(clean);
      return true;
    },
  };
}
