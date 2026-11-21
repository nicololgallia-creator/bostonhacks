// Who sits where, the song queue and the game's state, with no browser calls.
// Rules are in PLAN.md under "Seats and session". One engine runs for each taken seat.
import { createGame, songSeconds, TRAVEL_MS } from "../game/engine.js";
import { makeLayout, isLayout, postures, MAX_SEATS } from "./layout.js";

export const COUNTDOWN_MS = 3000;
export const RESULTS_MS = 8000;
const NAME_MAX = 20;
const LIVE = ["countdown", "playing", "paused"];

const isId = (x) => typeof x === "string" && x.length > 0 && x.length <= 64;
const isNum = (x) => typeof x === "number" && Number.isFinite(x);
const zeroStats = (total = 0) => ({ score: 0, combo: 0, maxCombo: 0, multiplier: 1, counts: { perfect: 0, good: 0, miss: 0 }, total, grade: null });
const statsOf = (r) => ({ score: r.score, combo: r.combo, maxCombo: r.maxCombo, multiplier: r.multiplier, counts: r.counts, total: r.total, grade: r.grade });
const summary = (s) => ({ id: s.id, title: s.title, seconds: Math.round(songSeconds(s)) });

// A transit is null or { stop, mode, endsAt }. Returns the clean copy, or undefined when it is malformed.
function cleanTransit(t) {
  if (t == null) return null;
  const endsAt = typeof t === "object" ? (t.endsAt ?? null) : undefined;
  const ok = endsAt !== undefined && typeof t.stop === "string" && (t.mode === "platform" || t.mode === "train") && (endsAt === null || isNum(endsAt));
  return ok ? { stop: t.stop, mode: t.mode, endsAt } : undefined;
}

export function createSession({ songs, layout } = {}) {
  const library = Array.isArray(songs) ? songs : [];
  let lay = isLayout(layout) ? structuredClone(layout) : makeLayout({ posture: "seated", seats: 3 });
  let status = "lobby";
  let notice = null;
  const players = new Map(); // clientId -> { name, spotId }
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
  let out = []; // events for drain()

  const setStatus = (s) => {
    if (s === status) return;
    status = s;
    out.push({ type: "status", status: s });
  };
  const seatTaken = (spotId) => [...players.values()].some((p) => p.spotId === spotId);
  const songTime = (nowMs) => (status === "paused" ? pausedAt : nowMs) - origin;

  function useLayout(next) {
    lay = next;
    for (const p of players.values()) if (p.spotId !== null && !lay.spots.some((s) => s.id === p.spotId)) p.spotId = null;
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
    const seated = [...players.values()].filter((p) => p.spotId !== null);
    if (!song || !seated.length) return toLobby();
    current = song;
    engines = new Map(seated.map((p) => {
      const game = createGame({ song, lanes: lay.lanes });
      return [p.spotId, { game, tiles: [], stats: zeroStats(game.total), done: false }];
    }));
    origin = nowMs + COUNTDOWN_MS + TRAVEL_MS;
    setStatus("countdown");
  }

  // Each handler returns undefined when it accepted the message, a sentence when it refused it, or
  // false when the message is malformed and is ignored.
  const handlers = {
    join({ clientId, name }) {
      if (!isId(clientId) || typeof name !== "string") return false;
      const clean = name.trim();
      if (!clean) return "Type a name to join.";
      if (clean.length > NAME_MAX) return `That name is too long. Use ${NAME_MAX} letters or fewer.`;
      const p = players.get(clientId);
      if (p) p.name = clean;
      else players.set(clientId, { name: clean, spotId: null });
    },
    claim({ clientId, spotId }) {
      if (!isId(clientId) || !Number.isInteger(spotId)) return false;
      const p = players.get(clientId);
      if (!p) return "Type your name to join before you pick a seat.";
      if (!lay.spots.some((s) => s.id === spotId)) return "That seat does not exist.";
      if (LIVE.includes(status)) return "A song is playing. Pick a seat when it ends.";
      if (p.spotId === spotId) return;
      if (seatTaken(spotId)) return "That seat is taken.";
      p.spotId = spotId;
    },
    leave({ clientId }) {
      const p = isId(clientId) && players.get(clientId);
      if (!p) return false;
      players.delete(clientId);
      if (p.spotId !== null) engines.delete(p.spotId);
      if (LIVE.includes(status) && !engines.size) toLobby();
    },
    layout({ posture, seats }) {
      if (!postures.includes(posture) || !Number.isInteger(seats)) return false;
      if (seats < 1 || seats > MAX_SEATS) return `Choose from 1 to ${MAX_SEATS} seats.`;
      if (LIVE.includes(status)) return "The seats cannot change while a song is playing.";
      useLayout(makeLayout({ posture, seats }));
    },
    start({ songIds, transit: sent }, nowMs) {
      const t = cleanTransit(sent);
      if (!Array.isArray(songIds) || !songIds.every(isId) || t === undefined) return false;
      if (status !== "lobby") return "A song is already running. Stop it first.";
      if (!songIds.length) return "Pick at least one song.";
      const found = songIds.map((id) => library.find((s) => s.id === id));
      if (found.includes(undefined)) return "One of those songs is not in the library.";
      if (![...players.values()].some((p) => p.spotId !== null)) return "Pick a seat before starting.";
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
      if (isNum(offsetMs)) settings.offsetMs = Math.min(1000, Math.max(-1000, Math.round(offsetMs)));
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
    // A phone's message. Refusals set the notice, the next accepted message clears it.
    apply(message, nowMs) {
      if (!message || typeof message !== "object" || !Object.hasOwn(handlers, message.type)) return;
      const result = handlers[message.type](message, nowMs);
      if (result !== false) notice = typeof result === "string" ? result : null;
    },

    // feetBySpot is { [spotId]: [{ u, v }] } in pad coordinates. Returns what to draw:
    // { status, pads: [{ spotId, lanes, tiles }], songMs, song }. While paused the pads stay as they were.
    tick(nowMs, feetBySpot) {
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
        notice,
        layout: lay,
        players: [...players].map(([clientId, p]) => ({ clientId, name: p.name, spotId: p.spotId, ...(engines.get(p.spotId)?.stats ?? zeroStats()) })),
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
    // Replaces the layout (pads the setup page dragged). False when it is broken or a song is playing.
    setLayout(next) {
      if (!isLayout(next) || LIVE.includes(status)) return false;
      useLayout(structuredClone(next));
      return true;
    },
  };
}
