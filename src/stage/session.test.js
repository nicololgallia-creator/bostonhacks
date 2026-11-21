import { test } from "node:test";
import assert from "node:assert/strict";
import { createSession, COUNTDOWN_MS, RESULTS_MS } from "./session.js";
import { makeLayout } from "./layout.js";
import { TRAVEL_MS } from "../game/engine.js";

// 120 bpm: taps at 0, 500 and 1000 ms, song length 1.5 s. On a 3 lane pad they sit in lanes 0, 1, 2.
const tiny = { id: "tiny", title: "Tiny Tune", bpm: 120, notes: [{ beat: 0, midi: 60, beats: 1 }, { beat: 1, midi: 64, beats: 1 }, { beat: 2, midi: 67, beats: 1 }] };
const other = { id: "other", title: "Other Tune", bpm: 120, notes: [{ beat: 0, midi: 62, beats: 1 }, { beat: 1, midi: 65, beats: 1 }] };
const songs = [tiny, other];
const LANE_U = [1 / 6, 0.5, 5 / 6]; // the middle of each of 3 lanes
const START = COUNTDOWN_MS + TRAVEL_MS; // wall time (a start at 0) when the first beat is due

const NOTE_AT = [0, 500, 1000];
// Feet for every tile of the tiny song, played in every listed seat: a foot lands on each note's lane at its time.
const playTiny = (seats, base = 0) => (wall) => {
  const feet = {};
  NOTE_AT.forEach((ms, i) => {
    const d = wall - (base + START + ms);
    if (d >= 0 && d < 100) for (const id of seats) feet[id] = [{ u: LANE_U[i], v: 0.9 }];
  });
  return feet;
};

// Ticks every 20 ms from `from` to `to` and returns the last view.
function run(s, from, to, feetAt = () => ({})) {
  let v;
  for (let t = from; t <= to; t += 20) v = s.tick(t, feetAt(t));
  return v;
}

// A session with Ann in seat 1 and Ben in seat 2.
function twoSeated() {
  const s = createSession({ songs });
  s.apply({ type: "join", clientId: "ann", name: "Ann" }, 0);
  s.apply({ type: "join", clientId: "ben", name: "Ben" }, 0);
  s.apply({ type: "claim", clientId: "ann", spotId: 1 }, 0);
  s.apply({ type: "claim", clientId: "ben", spotId: 2 }, 0);
  return s;
}
const start = (s, songIds = ["tiny"], extra = {}) => s.apply({ type: "start", clientId: "ann", songIds, ...extra }, 0);
const player = (s, id, now = 0) => s.snapshot(now).players.find((p) => p.clientId === id);

test("a new session is a lobby with the State message's exact shape", () => {
  const snap = createSession({ songs }).snapshot(0);
  assert.deepEqual(snap, {
    type: "state", status: "lobby", notice: null, layout: makeLayout({ posture: "seated", seats: 3 }), players: [],
    song: null, queue: [], secondsLeft: 0, transit: null, ready: { camera: false, calibrated: false },
    settings: { volume: 0.8, offsetMs: 120 },
  });
});

test("snapshots are copies: changing one changes nothing inside", () => {
  const s = createSession({ songs });
  s.snapshot(0).layout.spots.length = 0;
  assert.equal(s.snapshot(0).layout.spots.length, 3);
});

test("join: a name is needed, trimmed, and short enough", () => {
  const s = createSession({ songs });
  s.apply({ type: "join", clientId: "a", name: "   " }, 0);
  assert.equal(s.snapshot(0).notice, "Type a name to join.");
  s.apply({ type: "join", clientId: "a", name: "x".repeat(21) }, 0);
  assert.match(s.snapshot(0).notice, /too long.*20/);
  assert.equal(s.snapshot(0).players.length, 0);
  s.apply({ type: "join", clientId: "a", name: "  Ann  " }, 0);
  assert.deepEqual(s.snapshot(0).players.map((p) => [p.clientId, p.name, p.spotId]), [["a", "Ann", null]]);
  assert.equal(s.snapshot(0).notice, null); // the next accepted command cleared it
  s.apply({ type: "join", clientId: "a", name: "Annie" }, 0); // joining again renames
  assert.deepEqual(s.snapshot(0).players.map((p) => p.name), ["Annie"]);
});

test("claim: a taken seat is refused, claiming another seat moves the player and frees the first", () => {
  const s = twoSeated();
  s.apply({ type: "claim", clientId: "ben", spotId: 1 }, 0);
  assert.equal(s.snapshot(0).notice, "That seat is taken.");
  assert.equal(player(s, "ben").spotId, 2);
  s.apply({ type: "claim", clientId: "ann", spotId: 3 }, 0);
  assert.equal(player(s, "ann").spotId, 3);
  s.apply({ type: "claim", clientId: "ben", spotId: 1 }, 0); // seat 1 is free now
  assert.equal(player(s, "ben").spotId, 1);
  assert.equal(s.snapshot(0).notice, null);
});

test("claim: you must have joined, and the seat must exist", () => {
  const s = createSession({ songs });
  s.apply({ type: "claim", clientId: "ghost", spotId: 1 }, 0);
  assert.match(s.snapshot(0).notice, /join/);
  s.apply({ type: "join", clientId: "a", name: "Ann" }, 0);
  s.apply({ type: "claim", clientId: "a", spotId: 4 }, 0); // the default layout has 3 seats
  assert.equal(s.snapshot(0).notice, "That seat does not exist.");
  assert.equal(player(s, "a").spotId, null);
});

test("leave frees the seat, and an unknown phone leaving does nothing", () => {
  const s = twoSeated();
  s.apply({ type: "leave", clientId: "ann" }, 0);
  assert.deepEqual(s.snapshot(0).players.map((p) => p.clientId), ["ben"]);
  s.apply({ type: "join", clientId: "cat", name: "Cat" }, 0);
  s.apply({ type: "claim", clientId: "cat", spotId: 1 }, 0);
  assert.equal(player(s, "cat").spotId, 1);
  s.apply({ type: "leave", clientId: "nobody" }, 0);
  assert.equal(s.snapshot(0).players.length, 2);
});

test("layout: changes the pads, frees seats that no longer exist, refused while a song plays", () => {
  const s = twoSeated();
  s.apply({ type: "claim", clientId: "ben", spotId: 3 }, 0);
  s.apply({ type: "layout", clientId: "ann", posture: "standing", seats: 2 }, 0);
  const snap = s.snapshot(0);
  assert.equal(snap.layout.spots.length, 2);
  assert.equal(snap.layout.lanes, 4);
  assert.equal(snap.layout.posture, "standing");
  assert.equal(player(s, "ann").spotId, 1);
  assert.equal(player(s, "ben").spotId, null); // seat 3 is gone
  s.apply({ type: "claim", clientId: "ben", spotId: 2 }, 0);
  start(s);
  s.apply({ type: "layout", clientId: "ann", posture: "seated", seats: 4 }, 100);
  assert.equal(s.snapshot(100).notice, "The seats cannot change while a song is playing.");
  assert.equal(s.snapshot(100).layout.spots.length, 2);
  s.apply({ type: "stop" }, 200);
  s.apply({ type: "layout", clientId: "ann", posture: "seated", seats: 4 }, 200);
  assert.equal(s.snapshot(200).layout.spots.length, 4);
});

test("layout: 0 or 5 seats are refused with the reason, wrong types are ignored", () => {
  const s = createSession({ songs });
  s.apply({ type: "layout", clientId: "a", posture: "seated", seats: 5 }, 0);
  assert.match(s.snapshot(0).notice, /1 to 4/);
  s.apply({ type: "layout", clientId: "a", posture: "seated", seats: 0 }, 0);
  assert.match(s.snapshot(0).notice, /1 to 4/);
  const before = s.snapshot(0);
  s.apply({ type: "layout", clientId: "a", posture: "lying", seats: 2 }, 0);
  s.apply({ type: "layout", clientId: "a", posture: "seated", seats: "2" }, 0);
  assert.deepEqual(s.snapshot(0), before); // ignored: not even the notice changed
});

test("start is refused with a plain reason when it cannot work", () => {
  const s = createSession({ songs });
  s.apply({ type: "join", clientId: "a", name: "Ann" }, 0);
  start(s);
  assert.equal(s.snapshot(0).notice, "Pick a seat before starting.");
  s.apply({ type: "claim", clientId: "a", spotId: 1 }, 0);
  start(s, []);
  assert.equal(s.snapshot(0).notice, "Pick at least one song.");
  start(s, ["tiny", "nope"]);
  assert.match(s.snapshot(0).notice, /not in the library/);
  assert.equal(s.snapshot(0).status, "lobby");
  start(s);
  assert.equal(s.snapshot(0).status, "countdown");
  start(s);
  assert.match(s.snapshot(0).notice, /already running/);
});

test("start needs a seated player: a joined player with no seat is not enough", () => {
  const s = createSession({ songs });
  s.apply({ type: "join", clientId: "a", name: "Ann" }, 0);
  s.apply({ type: "join", clientId: "b", name: "Ben" }, 0);
  s.apply({ type: "claim", clientId: "b", spotId: 2 }, 0);
  s.apply({ type: "leave", clientId: "b" }, 0);
  start(s);
  assert.equal(s.snapshot(0).status, "lobby");
});

test("start loads the first song, queues the rest, keeps the transit, counts down 3 seconds, then plays", () => {
  const s = twoSeated();
  start(s, ["tiny", "other"], { transit: { stop: "Kenmore", mode: "platform", endsAt: 1795300000000 } });
  let snap = s.snapshot(0);
  assert.equal(snap.status, "countdown");
  assert.deepEqual(snap.song, { id: "tiny", title: "Tiny Tune", seconds: 2 }); // 1.5 s rounds to 2
  assert.deepEqual(snap.queue, [{ id: "other", title: "Other Tune", seconds: 1 }]);
  assert.deepEqual(snap.transit, { stop: "Kenmore", mode: "platform", endsAt: 1795300000000 });
  assert.equal(snap.secondsLeft, Math.ceil((START + 1500) / 1000));
  assert.equal(s.tick(2900, {}).status, "countdown");
  assert.equal(s.tick(COUNTDOWN_MS, {}).status, "playing");
  snap = s.snapshot(COUNTDOWN_MS);
  assert.equal(snap.status, "playing");
  assert.equal(snap.secondsLeft, Math.ceil((TRAVEL_MS + 1500) / 1000));
  assert.deepEqual(s.drain().filter((e) => e.type === "status").map((e) => e.status), ["countdown", "playing"]);
});

test("a transit that is not null or { stop, mode, endsAt } makes start ignored", () => {
  const s = twoSeated();
  start(s, ["tiny"], { transit: { stop: "Kenmore", mode: "bus", endsAt: 1 } });
  start(s, ["tiny"], { transit: "Kenmore" });
  start(s, ["tiny"], { transit: { stop: 5, mode: "train", endsAt: null } });
  assert.equal(s.snapshot(0).status, "lobby");
  start(s, ["tiny"], { transit: null });
  assert.equal(s.snapshot(0).transit, null);
  assert.equal(s.snapshot(0).status, "countdown");
});

test("two seats score separately on the same song", () => {
  const s = twoSeated();
  start(s);
  run(s, 0, START + 1400, playTiny([1])); // only seat 1 steps
  const ann = player(s, "ann", START + 1400);
  const ben = player(s, "ben", START + 1400);
  assert.deepEqual(ann.counts, { perfect: 3, good: 0, miss: 0 });
  assert.equal(ann.combo, 3);
  assert.ok(ann.score > 0);
  assert.equal(ann.total, 3);
  assert.equal(ben.counts.perfect, 0);
  assert.equal(ben.counts.miss, 3);
  assert.equal(ben.score, 0);
  const hits = s.drain().filter((e) => e.type === "hit");
  assert.equal(hits.length, 3);
  assert.ok(hits.every((e) => e.spotId === 1));
});

test("drain gives engine events with their seat, status changes, and is empty after a call", () => {
  const s = twoSeated();
  start(s);
  run(s, 0, START + 120, playTiny([2]));
  const events = s.drain();
  const hit = events.find((e) => e.type === "hit");
  assert.equal(hit.spotId, 2);
  assert.equal(hit.midi, 60);
  assert.equal(hit.grade, "perfect");
  assert.deepEqual(s.drain(), []);
});

test("when every engine is done the status is results, grades are in, and 8 seconds later the queue moves on", () => {
  const s = twoSeated();
  start(s, ["tiny", "other"]);
  run(s, 0, START + 1700, playTiny([1, 2]));
  assert.equal(s.snapshot(START + 1700).status, "results");
  assert.equal(player(s, "ann", START + 1700).grade, "S");
  const resultsFrom = s.drain().find((e) => e.type === "status" && e.status === "results");
  assert.ok(resultsFrom);
  const began = START + 1500; // the first tick at or after the song's end
  assert.equal(s.tick(began + RESULTS_MS - 20, {}).status, "results");
  assert.equal(s.snapshot(began).song.id, "tiny"); // the song stays up for the results
  assert.equal(s.tick(began + RESULTS_MS, {}).status, "countdown");
  const snap = s.snapshot(began + RESULTS_MS);
  assert.equal(snap.song.id, "other");
  assert.deepEqual(snap.queue, []);
  assert.equal(player(s, "ann", began + RESULTS_MS).score, 0); // fresh engines for the next song
});

test("after the last song the results end in the lobby, and the transit is cleared", () => {
  const s = twoSeated();
  start(s, ["tiny"], { transit: { stop: "Kenmore", mode: "train", endsAt: null } });
  run(s, 0, START + 1700);
  const at = START + 1500;
  assert.equal(s.tick(at + RESULTS_MS, {}).status, "lobby");
  const snap = s.snapshot(at + RESULTS_MS);
  assert.equal(snap.transit, null);
  assert.equal(snap.song, null);
  assert.equal(snap.players.length, 2); // everyone keeps their seat
  assert.equal(snap.players[0].spotId, 1);
});

test("pause freezes every clock and tile, resume carries on from the same place", () => {
  const s = twoSeated();
  start(s, ["tiny"]);
  const before = run(s, 0, START - 600); // tiles are sliding in
  assert.ok(before.pads[0].tiles.length > 0);
  s.apply({ type: "pause" }, START - 600);
  assert.equal(s.snapshot(START - 600).status, "paused");
  const secondsLeft = s.snapshot(START - 600).secondsLeft;
  const paused = s.tick(START + 9000, {}); // a long time later, still paused
  assert.equal(paused.status, "paused");
  assert.deepEqual(paused.pads, before.pads);
  assert.equal(s.snapshot(START + 9000).secondsLeft, secondsLeft);
  s.apply({ type: "resume" }, START + 9000);
  assert.equal(s.snapshot(START + 9000).status, "playing");
  const after = s.tick(START + 9000 + 20, {});
  const t0 = before.pads[0].tiles[0];
  const t1 = after.pads[0].tiles.find((t) => t.id === t0.id);
  assert.ok(t1.v > t0.v && t1.v - t0.v < 0.02, `tile moved ${t1.v - t0.v}`); // only one 20 ms frame later
});

test("pause in the countdown resumes into the countdown", () => {
  const s = twoSeated();
  start(s);
  s.tick(1000, {});
  s.apply({ type: "pause" }, 1000);
  s.apply({ type: "resume" }, 5000);
  assert.equal(s.snapshot(5000).status, "countdown");
  assert.equal(s.tick(5000 + 1900, {}).status, "countdown");
  assert.equal(s.tick(5000 + 2000, {}).status, "playing");
});

test("pause and resume are refused when they make no sense", () => {
  const s = twoSeated();
  s.apply({ type: "pause" }, 0);
  assert.match(s.snapshot(0).notice, /Nothing is playing/);
  start(s);
  s.apply({ type: "resume" }, 0);
  assert.match(s.snapshot(0).notice, /not paused/);
});

test("skip jumps to the next queued song, or ends in the lobby", () => {
  const s = twoSeated();
  s.apply({ type: "skip" }, 0);
  assert.match(s.snapshot(0).notice, /Nothing is playing/);
  start(s, ["tiny", "other"]);
  run(s, 0, 4000);
  s.apply({ type: "skip" }, 4000);
  assert.equal(s.snapshot(4000).song.id, "other");
  assert.equal(s.snapshot(4000).status, "countdown");
  s.apply({ type: "skip" }, 4100);
  assert.equal(s.snapshot(4100).status, "lobby");
  assert.equal(s.snapshot(4100).song, null);
});

test("stop ends everything and empties the queue", () => {
  const s = twoSeated();
  start(s, ["tiny", "other"]);
  run(s, 0, 1000);
  s.apply({ type: "stop" }, 1000);
  const snap = s.snapshot(1000);
  assert.deepEqual([snap.status, snap.song, snap.queue, snap.secondsLeft], ["lobby", null, [], 0]);
  assert.equal(s.tick(2000, {}).pads.length, 0);
  assert.deepEqual(s.drain().filter((e) => e.type === "status").map((e) => e.status), ["countdown", "lobby"]);
});

test("a player who leaves mid-song loses their pad, and the last one leaving ends the song", () => {
  const s = twoSeated();
  start(s);
  run(s, 0, START);
  s.apply({ type: "leave", clientId: "ben" }, START);
  assert.deepEqual(s.tick(START + 20, {}).pads.map((p) => p.spotId), [1]);
  assert.equal(s.snapshot(START + 20).status, "playing");
  s.apply({ type: "leave", clientId: "ann" }, START + 40);
  assert.equal(s.snapshot(START + 40).status, "lobby");
});

test("seat changes are refused while a song plays and accepted once the results show", () => {
  const s = twoSeated();
  s.apply({ type: "join", clientId: "cat", name: "Cat" }, 0);
  start(s);
  s.apply({ type: "claim", clientId: "cat", spotId: 3 }, 100);
  assert.match(s.snapshot(100).notice, /song is playing/);
  assert.equal(player(s, "cat", 100).spotId, null);
  run(s, 0, START + 1700);
  s.apply({ type: "claim", clientId: "cat", spotId: 3 }, START + 1700);
  assert.equal(player(s, "cat", START + 1700).spotId, 3);
});

test("calibrate changes nothing and is passed on as an event", () => {
  const s = twoSeated();
  const before = s.snapshot(0);
  s.apply({ type: "calibrate" }, 0);
  assert.deepEqual(s.snapshot(0), before);
  assert.deepEqual(s.drain(), [{ type: "calibrate" }]);
});

test("set changes volume and the delay, clamps wild values, ignores the wrong type", () => {
  const s = createSession({ songs });
  s.apply({ type: "set", volume: 0.3 }, 0);
  assert.deepEqual(s.snapshot(0).settings, { volume: 0.3, offsetMs: 120 });
  s.apply({ type: "set", volume: 7, offsetMs: 87.6 }, 0);
  assert.deepEqual(s.snapshot(0).settings, { volume: 1, offsetMs: 88 });
  s.apply({ type: "set", volume: -2, offsetMs: -99999 }, 0);
  assert.deepEqual(s.snapshot(0).settings, { volume: 0, offsetMs: -1000 });
  s.apply({ type: "set", volume: "loud", offsetMs: NaN }, 0);
  assert.deepEqual(s.snapshot(0).settings, { volume: 0, offsetMs: -1000 });
});

test("bad messages are ignored and never throw", () => {
  const s = twoSeated();
  const before = s.snapshot(0);
  const bad = [undefined, null, 5, "start", [], {}, { type: 7 }, { type: "nope" }, { type: "__proto__" }, { type: "constructor" },
    { type: "join" }, { type: "join", clientId: "z", name: 5 }, { type: "join", clientId: 5, name: "Z" }, { type: "join", clientId: "", name: "Z" },
    { type: "join", clientId: "x".repeat(65), name: "Z" }, { type: "claim" }, { type: "claim", clientId: "ann", spotId: "1" },
    { type: "claim", clientId: "ann", spotId: 1.5 }, { type: "leave" }, { type: "leave", clientId: {} }, { type: "layout" },
    { type: "start" }, { type: "start", songIds: "tiny" }, { type: "start", songIds: [1, 2] }, { type: "start", songIds: [null] },
    { type: "set" }, { type: "set", volume: null }];
  for (const m of bad) assert.doesNotThrow(() => s.apply(m, 0));
  assert.deepEqual(s.snapshot(0), before);
  assert.deepEqual(s.drain(), []);
  assert.doesNotThrow(() => s.tick(0, null));
  assert.doesNotThrow(() => s.tick(10, { 1: "nonsense" }));
});

test("bad messages mid-song do not disturb the game", () => {
  const s = twoSeated();
  start(s);
  run(s, 0, START - 100);
  for (const m of [null, { type: "start", songIds: ["tiny"] }, { type: "join" }, { type: "resume" }, { type: "layout", clientId: "a", posture: "seated", seats: 1 }]) s.apply(m, START);
  assert.equal(s.snapshot(START).status, "playing");
  assert.equal(s.tick(START, {}).pads.length, 2);
});

test("setReady and setLayout are the stage's own controls", () => {
  const s = createSession({ songs });
  s.setReady({ camera: true });
  assert.deepEqual(s.snapshot(0).ready, { camera: true, calibrated: false });
  s.setReady({ calibrated: true });
  assert.deepEqual(s.snapshot(0).ready, { camera: true, calibrated: true });
  const dragged = makeLayout({ posture: "standing", seats: 2 });
  dragged.spots[0].rect.u = 0.2;
  assert.equal(s.setLayout(dragged), true);
  assert.equal(s.snapshot(0).layout.spots[0].rect.u, 0.2);
  assert.equal(s.setLayout({ posture: "standing" }), false);
  assert.equal(createSession({ songs, layout: dragged }).snapshot(0).layout.spots[0].rect.u, 0.2);
  assert.equal(createSession({ songs, layout: "junk" }).snapshot(0).layout.spots.length, 3);
});

test("tick returns the song clock and the song: negative in the lead-in, frozen while paused, null when idle", () => {
  const s = twoSeated();
  assert.deepEqual([s.tick(0, {}).songMs, s.tick(0, {}).song], [null, null]);
  start(s, ["tiny"]);
  const lead = s.tick(1000, {});
  assert.equal(lead.status, "countdown");
  assert.equal(lead.songMs, 1000 - START);
  assert.equal(lead.song, tiny); // the full song, with its notes
  assert.equal(s.tick(START, {}).songMs, 0); // the first beat is due now
  assert.equal(s.tick(START + 400, {}).songMs, 400);
  s.apply({ type: "pause" }, START + 400);
  assert.equal(s.tick(START + 9000, {}).songMs, 400);
  s.apply({ type: "resume" }, START + 9000);
  assert.equal(s.tick(START + 9100, {}).songMs, 500);
  s.apply({ type: "stop" }, START + 9100);
  assert.deepEqual([s.tick(START + 9200, {}).songMs, s.tick(START + 9200, {}).song], [null, null]);
});
