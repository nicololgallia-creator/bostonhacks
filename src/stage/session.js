// Who sits where, the song queue and the game's state, with no browser calls.
// Rules are in PLAN.md under "Seats and session" and "Wave 3b". A phone holds one or more seats; one engine
// runs for each taken seat, and every seat plays its share of the song at the same time.
import { createGame, gradeFor, songSeconds, TRAVEL_MS, FLICKER_MS } from "../game/engine.js";
import { splitParts, lanesInPad } from "../game/parts.js";
import { DIFFICULTIES, difficultyOf } from "../game/chart.js";
import { makeLayout, asLayout, MAX_SEATS, DEFAULT_SEATS } from "./layout.js";

export const COUNTDOWN_MS = 3000;
export const RESULTS_MS = 8000;
// The warm-up before the first song: every taken seat taps WARM_TAPS times, or WARM_MAX_MS passes, whichever is first.
export const WARM_TAPS = 4;
export const WARM_BEAT_MS = 600; // the beat the floor pulses at, counted from startedAtMs
export const WARM_MAX_MS = 15000;
const MAX_TAP_LOG = 32; // taps kept in tapAtMs for the tracker
const NOTICE_MS = 4000; // a refusal is shown this long
const HERE_MS = 10000; // a player not heard from for this long is removed, but never while a song is on
const AFTER_SONG_MS = 30000; // after a song a quiet phone keeps its seats this long: it locked itself while its player looked at the floor
const LIVE = ["warmup", "countdown", "playing", "paused"];
// Commands that change the game: only a phone that has joined may send them (the stage's own keys are trusted).
const COMMANDS = ["start", "pause", "resume", "skip", "stop", "layout", "set", "calibrate", "mode", "difficulty"];
const modeOf = (x) => (x === "versus" ? "versus" : "team");

const isId = (x) => typeof x === "string" && x.length > 0 && x.length <= 64;
const isNum = (x) => typeof x === "number" && Number.isFinite(x);
const zeroStats = (total = 0) => ({ score: 0, combo: 0, maxCombo: 0, multiplier: 1, counts: { perfect: 0, good: 0, miss: 0 }, total, grade: null });
// Paid out to the seat (or every seat tied) with the most of something once a song ends. A seat with none gets nothing.
const BONUSES = [
  { label: "Best combo", points: 50, value: (s) => s.maxCombo },
  { label: "Most perfects", points: 25, value: (s) => s.counts.perfect },
];

// The train this floor is in, from the poster's QR code. The headsign for each line and direction is the MBTA's
// own (direction_destinations, read from the live API on 2026-11-21).
const HEADSIGNS = {
  Red: ["Ashmont/Braintree", "Alewife"], Mattapan: ["Mattapan", "Ashmont"], Orange: ["Forest Hills", "Oak Grove"],
  Blue: ["Bowdoin", "Wonderland"], "Green-B": ["Boston College", "Government Center"], "Green-C": ["Cleveland Circle", "Government Center"],
  "Green-D": ["Riverside", "Union Square"], "Green-E": ["Heath Street", "Medford/Tufts"],
};
const MAX_CAR = 12;
export const DEFAULT_TRAIN = { line: "Green-B", directionId: 1, headsign: "Government Center", atStopId: "place-bucen", atStopName: "Boston University Central", car: 2 };

// The clean copy of a train, or null when any part is missing or wrong.
function cleanTrain(t) {
  const ok = t && typeof t === "object" && Object.hasOwn(HEADSIGNS, t.line) && (t.directionId === 0 || t.directionId === 1)
    && isId(t.headsign) && isId(t.atStopId) && isId(t.atStopName) && Number.isInteger(t.car) && t.car >= 1 && t.car <= MAX_CAR;
  return ok ? { line: t.line, directionId: t.directionId, headsign: t.headsign, atStopId: t.atStopId, atStopName: t.atStopName, car: t.car } : null;
}

// The train named in an address: ?line=Green-B&dir=1&at=place-bucen&car=2. Null when the address names none of
// the four. A part that is missing or wrong falls back to the default's. The stop's name is not in the address, so
// it is the stop's id until something looks it up and calls setTrain.
export function trainFromAddress(search) {
  const q = new URLSearchParams(search);
  if (!["line", "dir", "at", "car"].some((k) => q.has(k))) return null;
  const line = Object.hasOwn(HEADSIGNS, q.get("line")) ? q.get("line") : DEFAULT_TRAIN.line;
  const directionId = q.get("dir") === "0" ? 0 : q.get("dir") === "1" ? 1 : DEFAULT_TRAIN.directionId;
  const atStopId = isId(q.get("at")) ? q.get("at") : DEFAULT_TRAIN.atStopId;
  const car = /^\d{1,2}$/.test(q.get("car")) && +q.get("car") >= 1 && +q.get("car") <= MAX_CAR ? +q.get("car") : DEFAULT_TRAIN.car;
  return { line, directionId, headsign: HEADSIGNS[line][directionId], atStopId, atStopName: atStopId === DEFAULT_TRAIN.atStopId ? DEFAULT_TRAIN.atStopName : atStopId, car };
}

// The part of a phone's address that carries the train: "?line=Green-B&dir=1&at=place-bucen&car=2".
export const trainQuery = (t) => `?${new URLSearchParams({ line: t.line, dir: t.directionId, at: t.atStopId, car: t.car })}`;
const statsOf = (r) => ({ score: r.score, combo: r.combo, maxCombo: r.maxCombo, multiplier: r.multiplier, counts: r.counts, total: r.total, grade: r.grade });
const summary = (s) => ({ id: s.id, title: s.title, seconds: Math.round(songSeconds(s)) });

// A transit is null or { stop, mode, endsAt }. Returns the clean copy, or undefined when it is malformed.
function cleanTransit(t) {
  if (t == null) return null;
  const endsAt = typeof t === "object" ? (t.endsAt ?? null) : undefined;
  const ok = endsAt !== undefined && typeof t.stop === "string" && (t.mode === "platform" || t.mode === "train") && (endsAt === null || isNum(endsAt));
  return ok ? { stop: t.stop, mode: t.mode, endsAt } : undefined;
}

export function createSession({ songs, layout, train } = {}) {
  const library = Array.isArray(songs) ? songs : [];
  let where = cleanTrain(train) ?? { ...DEFAULT_TRAIN };
  let lay = asLayout(layout) ?? makeLayout({ seats: DEFAULT_SEATS });
  let status = "lobby";
  let notice = null; // { for, text }
  let noticeAt = 0;
  const phones = new Map(); // clientId -> when the phone was last heard from
  const owner = new Map(); // spotId -> the clientId that holds the seat (one phone can hold several)
  let current = null; // the song loaded now
  let queue = []; // songs still to come
  let transit = null;
  let engines = new Map(); // spotId -> { game, tiles, stats, done, bonus, bonusFor }
  let songLanes = 2; // lanes in a pad for the song loaded now
  let chosen = "team"; // the mode last chosen in the lobby
  let songMode = "team"; // the mode of the song loaded now: versus needs two or more seats, else it runs as team
  let chosenLevel = "normal"; // the level ("easy", "normal" or "hard") last chosen in the lobby: one for the whole game
  let songLevel = "normal"; // the level of the song loaded now
  let warmAt = 0; // when the warm-up began (the stage's clock); moves forward by the time spent paused
  let pausedFrom = null; // "warmup", "countdown" or "playing": where a pause began
  let warmedKey = null; // the seats (and who holds them) that last finished a warm-up: the same people need no second one
  // The lanes in a pad: the song's own while one is loaded, else what the seats taken in the lobby will get.
  const padLanes = () => (status === "lobby" ? lanesInPad(owner.size) : songLanes);
  // Song time is nowMs - origin: 0 is when the first beat is due at the hit line. A song starts
  // COUNTDOWN_MS + TRAVEL_MS before that, so the countdown runs first and then the tiles slide in.
  let origin = 0;
  let pausedAt = 0;
  let resultsAt = 0;
  let ready = { camera: false, calibrated: false };
  const settings = { volume: 0.8, offsetMs: 120, warmup: true };
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
  // The team's numbers: every seat's part added up, bonuses included. The grade comes once every part is finished.
  function teamStats() {
    const all = [...engines.values()];
    const sum = (f) => all.reduce((n, e) => n + f(e), 0);
    const hits = sum((e) => e.stats.counts.perfect + e.stats.counts.good);
    const total = sum((e) => e.stats.total);
    return { score: sum((e) => e.stats.score + e.bonus), hits, total, grade: all.length && all.every((e) => e.done) ? gradeFor(hits, total) : null };
  }
  // The warm-up is on, or a pause that began in it.
  const warming = () => status === "warmup" || (status === "paused" && pausedFrom === "warmup");
  // Versus: 1 is best, equal scores share a rank (1, 1, 3). Empty in team mode.
  function ranks() {
    if (songMode !== "versus") return new Map();
    const scores = [...engines].map(([spotId, e]) => [spotId, e.stats.score + e.bonus]);
    return new Map(scores.map(([spotId, s]) => [spotId, 1 + scores.filter(([, other]) => other > s).length]));
  }
  // The one seat that won a versus song, only once the results show. Null for a tie, team mode, or fewer than two seats left.
  function winner() {
    if (status !== "results" || songMode !== "versus" || engines.size < 2) return null;
    const top = [...ranks()].filter(([, rank]) => rank === 1);
    if (top.length !== 1) return null;
    const [spotId] = top[0];
    return { spotId, score: engines.get(spotId).stats.score };
  }
  // The song is over: the best of each kind among the seats still playing gets its bonus. Versus pays none: it would
  // break "the same top score for everyone".
  function awardBonuses() {
    if (songMode === "versus") return;
    const seats = [...engines.values()];
    for (const { label, points, value } of BONUSES) {
      const top = Math.max(...seats.map((e) => value(e.stats)));
      if (top <= 0) continue;
      for (const e of seats.filter((e) => value(e.stats) === top)) {
        e.bonus += points;
        e.bonusFor = e.bonusFor ? `${e.bonusFor}, ${label}` : label;
      }
    }
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
  // Who holds which seat, as one string: the same string means the same people in the same seats.
  const seatKey = () => [...owner].sort((a, b) => a[0] - b[0]).map(([spotId, id]) => `${spotId}:${id}`).join(",");
  // Starts the next queued song on every taken seat, or goes back to the lobby when there is none. `warm`: begin with
  // the warm-up (only the first song after the lobby, see the start handler) instead of the countdown.
  function loadNext(nowMs, warm = false) {
    const song = queue.shift();
    const seated = [...owner.keys()].sort((a, b) => a - b);
    if (!song || !seated.length) return toLobby();
    current = song;
    // Versus needs two or more seats; one seat runs as team for this song.
    songMode = chosen === "versus" && seated.length >= 2 ? "versus" : "team";
    // The taken seats, in seat order, are one keyboard: each plays its own lanes of the song, all at once.
    // The lanes in a pad are fixed for the song: a seat released part way does not change them.
    songLevel = chosenLevel;
    const parts = splitParts(song, seated.length, { mode: songMode, difficulty: songLevel });
    songLanes = lanesInPad(seated.length);
    engines = new Map(seated.map((spotId, i) => {
      const game = createGame({ song: parts[i], lanes: songLanes });
      const warmth = warm ? { tapAtMs: [], seen: [], level: null } : null;
      return [spotId, { game, tiles: [], stats: zeroStats(game.total), done: false, bonus: 0, bonusFor: null, warm: warmth }];
    }));
    if (!warm) return beginCountdown(nowMs);
    warmAt = nowMs;
    setStatus("warmup");
  }
  function beginCountdown(nowMs) {
    // The stage's clock runs offsetMs behind the wall clock. A new lag takes over here, and the origin
    // moves by the difference so the song clock does not jump.
    const shift = appliedOffset - settings.offsetMs;
    appliedOffset = settings.offsetMs;
    origin = nowMs + shift + COUNTDOWN_MS + TRAVEL_MS;
    setStatus("countdown");
  }
  function endWarmup(nowMs) {
    warmedKey = seatKey();
    for (const e of engines.values()) e.warm = null;
    beginCountdown(nowMs);
  }
  // One foot count a frame in, a tap out. An arrival is the number of feet standing in the pad going up; a foot with
  // `lifted: true` does not stand. As in the engine, a foot that drops out for under FLICKER_MS has not left, so
  // flicker is not a second tap. The first frame only sets the level: a foot already standing is not a tap.
  function noteTap(spotId, e, nowMs, feet) {
    const w = e.warm;
    const standing = Array.isArray(feet) ? feet.filter((f) => f && !f.lifted).length : 0;
    w.seen = w.seen.filter((s) => nowMs - s.t <= FLICKER_MS);
    w.seen.push({ t: nowMs, n: standing });
    const level = Math.max(...w.seen.map((s) => s.n));
    if (w.level !== null && level > w.level && w.tapAtMs.length < MAX_TAP_LOG) {
      w.tapAtMs.push(nowMs);
      out.push({ type: "warmupTap", spotId, taps: w.tapAtMs.length, atMs: nowMs });
    }
    w.level = level;
  }
  function warmUp(nowMs, feetBySpot) {
    for (const [spotId, e] of engines) noteTap(spotId, e, nowMs, feetBySpot?.[spotId]);
    const unready = [...engines].filter(([, e]) => e.warm.tapAtMs.length < WARM_TAPS);
    if (!unready.length) return endWarmup(nowMs);
    if (nowMs - warmAt < WARM_MAX_MS) return;
    // Out of time: the seats that never got ready play anyway, and their phones are told why. One phone gets its own
    // notice; with several phones the single notice slot is for everyone.
    const phoneIds = [...new Set(unready.map(([spotId]) => owner.get(spotId)))];
    refuse("The floor did not see your taps. Lift your foot higher.", phoneIds.length === 1 ? phoneIds[0] : null, nowMs);
    endWarmup(nowMs);
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
    // The mode of the lobby, for the floor and every phone to show. Changed here or by a start that carries one.
    mode({ mode }) {
      if (mode !== "team" && mode !== "versus") return false;
      if (status !== "lobby") return "A song is running. Change the mode when it ends.";
      chosen = mode;
    },
    // The level of the lobby, like the mode: one for the whole game, shown on the floor and every phone.
    difficulty({ difficulty }) {
      if (!DIFFICULTIES.includes(difficulty)) return false;
      if (status !== "lobby") return "A song is running. Change the level when it ends.";
      chosenLevel = difficulty;
    },
    // `mode` in a start: "versus" is versus, any other value is team, and none keeps what the lobby shows. `difficulty` the same:
    // a level that is not one of the three is "normal", and none keeps what the lobby shows.
    start({ songIds, transit: sent, mode, difficulty }, nowMs) {
      const t = cleanTransit(sent);
      if (!Array.isArray(songIds) || !songIds.every(isId) || t === undefined) return false;
      if (status !== "lobby") return "A song is already running. Stop it first.";
      if (!songIds.length) return "Pick at least one song.";
      const found = songIds.map((id) => library.find((s) => s.id === id));
      if (found.includes(undefined)) return "One of those songs is not in the library.";
      if (!owner.size) return "Pick a seat before starting.";
      if (mode !== undefined) chosen = modeOf(mode);
      if (difficulty !== undefined) chosenLevel = difficultyOf(difficulty);
      queue = found;
      transit = t;
      // Warm up first, unless it is off or these same people in these same seats already did (play again).
      loadNext(nowMs, settings.warmup && seatKey() !== warmedKey);
    },
    // A phone that holds a seat, or the stage, ends the warm-up and starts the countdown now.
    skipWarmup({ clientId }, nowMs, stage) {
      if (!stage && !isId(clientId)) return false;
      if (status !== "warmup") return false; // too late or too early: nothing to say
      if (!stage && !new Set(owner.values()).has(clientId)) return "Take a seat to skip the warm-up.";
      endWarmup(nowMs);
    },
    pause(_, nowMs) {
      if (status !== "warmup" && status !== "countdown" && status !== "playing") return "Nothing is playing to pause.";
      pausedFrom = status;
      pausedAt = nowMs;
      setStatus("paused");
    },
    resume(_, nowMs) {
      if (status !== "paused") return "The song is not paused.";
      if (pausedFrom === "warmup") { // the warm-up clock carries on from where it stopped
        warmAt += nowMs - pausedAt;
        return setStatus("warmup");
      }
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
    set({ volume, offsetMs, warmup }) {
      if (!isNum(volume) && !isNum(offsetMs) && typeof warmup !== "boolean") return false;
      if (typeof warmup === "boolean") settings.warmup = warmup; // read at the next start
      if (isNum(volume)) settings.volume = Math.min(1, Math.max(0, volume));
      if (isNum(offsetMs)) {
        settings.offsetMs = Math.min(1000, Math.max(-1000, Math.round(offsetMs)));
        if (status === "lobby") appliedOffset = settings.offsetMs; // no song to disturb
      }
    },
  };

  // The song clock runs from the countdown on: not in the warm-up, not in a pause that began there.
  const clocked = () => LIVE.includes(status) && !warming();
  // songMs is the song clock: negative in the lead-in, frozen while paused, null when no song is live or in the warm-up.
  const view = (nowMs) => ({
    status,
    pads: [...engines].map(([spotId, e]) => ({ spotId, lanes: e.game.lanes, tiles: e.tiles })),
    songMs: clocked() ? songTime(nowMs) : null,
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
      const result = handlers[message.type](message, nowMs, stage);
      if (typeof result === "string") refuse(result, from, nowMs);
      else if (result !== false && from && message.type !== "here" && notice?.for === from) notice = null;
    },

    // feetBySpot is { [spotId]: [{ u, v }] } in pad coordinates. Returns what to draw:
    // { status, pads: [{ spotId, lanes, tiles }], songMs, song }. While paused the pads stay as they were.
    tick(nowMs, feetBySpot) {
      // A phone that went quiet frees its seats. Not during a song: everyone is looking at the floor, so phones lock and
      // stop talking, and freeing their seats would end the game under their feet. The wait starts when the song ends.
      if (LIVE.includes(status)) for (const id of phones.keys()) phones.set(id, nowMs + AFTER_SONG_MS - HERE_MS);
      else for (const [id, seen] of phones) if (nowMs - seen > HERE_MS) drop(id);
      if (status === "results" && nowMs >= resultsAt) loadNext(nowMs);
      else if (status === "warmup") warmUp(nowMs, feetBySpot);
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
          awardBonuses();
          resultsAt = nowMs + RESULTS_MS;
          setStatus("results");
        }
      }
      return view(nowMs);
    },

    // The State message for the phones.
    snapshot(nowMs) {
      const rank = ranks();
      return structuredClone({
        type: "state",
        status,
        mode: status === "lobby" ? chosen : songMode, // a song that runs as team (one seat) says team
        difficulty: status === "lobby" ? chosenLevel : songLevel,
        winner: winner(),
        warmup: !warming() ? null : {
          need: WARM_TAPS, beatMs: WARM_BEAT_MS, maxMs: WARM_MAX_MS, startedAtMs: warmAt,
          players: Object.fromEntries([...engines].map(([spotId, e]) => [spotId, { taps: e.warm.tapAtMs.length, ready: e.warm.tapAtMs.length >= WARM_TAPS, tapAtMs: e.warm.tapAtMs }])),
        },
        notice: notice && nowMs - noticeAt < NOTICE_MS ? notice : null,
        layout: { ...lay, lanes: padLanes() },
        train: where,
        // One entry for each taken seat, in seat order. A phone that holds several seats appears in each.
        // The seat's total for the song is score + bonus.
        players: [...owner].sort((a, b) => a[0] - b[0]).map(([spotId, clientId]) => {
          const e = engines.get(spotId);
          return { clientId, spotId, ...(e?.stats ?? zeroStats()), bonus: e?.bonus ?? 0, bonusFor: e?.bonusFor ?? null, rank: rank.get(spotId) ?? null };
        }),
        team: teamStats(),
        song: current && summary(current),
        queue: queue.map(summary),
        // In the warm-up nothing has begun: the length of the song plus the lead-in the countdown will add, held still.
        secondsLeft: warming() ? Math.ceil((songSeconds(current) * 1000 + COUNTDOWN_MS + TRAVEL_MS) / 1000)
          : clocked() ? Math.max(0, Math.ceil((songSeconds(current) * 1000 - songTime(nowMs)) / 1000)) : 0,
        transit,
        ready,
        settings,
      });
    },

    // What happened since the last call, in order: engine events with their spotId,
    // { type: "status", status } on every status change, { type: "warmupTap", spotId, taps, atMs } on each warm-up tap,
    // and { type: "calibrate" }.
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
    // The train this floor is in: { line, directionId, headsign, atStopId, atStopName, car }. False when any part is wrong.
    setTrain(next) {
      const clean = cleanTrain(next);
      if (clean) where = clean;
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
