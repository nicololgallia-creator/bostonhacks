import test from "node:test";
import assert from "node:assert/strict";
import { makeSlices, padFeet, laneOf, glowFeet, feetMiddle, tappedX, frameReadout, freshSeats, createCalibrator, createSeatSource, CALIBRATE_FROM_WARMUP, LANE_U, ONE_LANE_U, PAD_V, linesMayMove } from "./seatsource.js";
import { readFileSync as readRecording } from "node:fs";
import { createTapDetector as newTapDetector } from "./taps.js";

test("freshSeats: only a seat whose picture counter moved on is fresh, and each picture is fresh once", () => {
  const seen = new Map();
  assert.deepEqual([...freshSeats([{ spotId: 1, n: 1 }, { spotId: 2, n: 1 }], seen)], [1, 2]);
  assert.deepEqual([...freshSeats([{ spotId: 1, n: 1 }, { spotId: 2, n: 1 }], seen)], []); // the same pictures again: nothing new
  assert.deepEqual([...freshSeats([{ spotId: 1, n: 2 }, { spotId: 2, n: 1 }], seen)], [1]); // seats take turns: one new picture
  assert.deepEqual([...freshSeats([], seen)], []);
});

// Why freshSeats exists. The stage asks for feet on every screen frame, the camera gives about 30 pictures a second, so
// before this rule each picture reached the tap detector two or more times. Here the real two-person recording is fed
// both ways while both people rest (5 to 22 s): each picture once must give no taps.
test("on the real recording, each picture once gives no taps at rest (and repeated pictures do, which is the bug)", () => {
  const rec = JSON.parse(readRecording(new URL("../../qa/seats/real-two-1.json", import.meta.url), "utf8"));
  const lanes = Object.fromEntries(rec.slices.map((s) => [s.spotId, 1]));
  const restTaps = (repeatEveryMs) => {
    const det = newTapDetector();
    let taps = 0;
    const feed = (t, fr) => { for (const x of det.update(t, fr.seats.flatMap((s) => s.feet.map((f) => ({ spotId: s.spotId, ...f }))), lanes).taps) if (x.atMs > 5000 && x.atMs < 22000) taps++; };
    rec.frames.forEach((fr, i) => {
      feed(fr.t, fr);
      const next = rec.frames[i + 1]?.t ?? fr.t;
      if (repeatEveryMs) for (let t = fr.t + repeatEveryMs; t < next; t += repeatEveryMs) feed(t, fr); // the same picture again, as a 60 Hz screen saw it
    });
    return taps;
  };
  assert.equal(restTaps(0), 0);
  assert.ok(restTaps(1000 / 60) > 0, "repeats no longer cause taps: this half of the test can go");
});
import { createTapDetector } from "./taps.js";
import { makeLayout } from "../stage/layout.js";
import { createGame } from "../game/engine.js";

const layout = makeLayout({ seats: 3 });
const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, `${a} is not ${b}`);

test("slices: one equal slice for each pad, left to right, across the saved edges", () => {
  const s = makeSlices(layout, { l: 0.1, r: 0.7 });
  assert.deepEqual(s.map((x) => x.spotId), [1, 2, 3]);
  near(s[0].x0, 0.1); near(s[0].x1, 0.3); near(s[1].x1, 0.5); near(s[2].x1, 0.7);
});

test("slices: follow the pads' order on the floor, not the order they are listed", () => {
  const flipped = { ...layout, spots: [...layout.spots].reverse() };
  assert.deepEqual(makeSlices(flipped, null).map((x) => x.spotId), [1, 2, 3]);
});

test("slices: no edges, or bad ones, use the whole picture", () => {
  for (const bad of [null, {}, { l: -1, r: 1 }, { l: 0, r: 1.5 }, { l: 0.5, r: 0.55 }]) {
    const s = makeSlices(layout, bad);
    near(s[0].x0, 0); near(s[2].x1, 1);
  }
});

test("pad feet: foot 0 is the left lane, foot 1 the right, both inside the square and carrying lifted", () => {
  const out = padFeet([
    { spotId: 1, foot: 0, lifted: false }, { spotId: 1, foot: 1, lifted: true },
  ], [1, 2, 3]);
  assert.deepEqual(out[1], [{ u: LANE_U[0], v: PAD_V, lifted: false }, { u: LANE_U[1], v: PAD_V, lifted: true }]);
  assert.deepEqual(out[2], []); // every pad has an entry
  assert.deepEqual(out[3], []);
  assert.equal(LANE_U[0], 0.25); assert.equal(LANE_U[1], 0.75);
  assert.ok(PAD_V > 0.55 && PAD_V < 1);
});

test("pad feet: the swap list mirrors only the pads named in it", () => {
  const feet = [{ spotId: 1, foot: 0, lifted: false }, { spotId: 2, foot: 0, lifted: false }];
  const out = padFeet(feet, [1, 2], [2]);
  assert.equal(out[1][0].u, 0.25);
  assert.equal(out[2][0].u, 0.75);
});

test("pad feet: with one lane both feet are in the middle of it, whatever the swap, and a lone player keeps two", () => {
  const feet = [0, 1].flatMap((foot) => [1, 2].map((spotId) => ({ spotId, foot, lifted: foot === 1 })));
  const out = padFeet(feet, [1, 2], [1], { 1: 1, 2: 2 });
  assert.deepEqual(out[1], [{ u: 0.5, v: PAD_V, lifted: false }, { u: 0.5, v: PAD_V, lifted: true }]);
  assert.deepEqual(out[2].map((f) => f.u), [0.25, 0.75]);
  assert.equal(ONE_LANE_U, 0.5);
});

test("lane of a tap: the foot decides in a two-lane pad, the swap list flips it, and a one-lane pad is always lane 0", () => {
  assert.equal(laneOf({ spotId: 1, foot: 0 }), 0);
  assert.equal(laneOf({ spotId: 1, foot: 1 }), 1);
  assert.equal(laneOf({ spotId: 1, foot: 0 }, [1]), 1);
  assert.equal(laneOf({ spotId: 1, foot: 1 }, [1]), 0);
  assert.equal(laneOf({ spotId: 2, foot: 1 }, [1]), 1); // only the pad named in the list is mirrored
  assert.equal(laneOf({ spotId: 1, foot: 1 }, [1], { 1: 1 }), 0);
});

test("pad feet: a single foot keeps its lane, a seat that is not in the layout is dropped, a missing lifted is down", () => {
  const out = padFeet([{ spotId: 2, foot: 1 }, { spotId: 9, foot: 0, lifted: false }], [1, 2]);
  assert.deepEqual(out[2], [{ u: 0.75, v: PAD_V, lifted: false }]);
  assert.deepEqual(Object.keys(out), ["1", "2"]);
});

test("glow: drawn at the pad's lane for a foot that is down, not for a lifted one", () => {
  const pad = layout.spots[1].rect;
  const glow = glowFeet(layout, { 1: [], 2: [{ u: 0.25, v: PAD_V, lifted: false }, { u: 0.75, v: PAD_V, lifted: true }], 3: [] });
  assert.equal(glow.length, 1);
  near(glow[0].u, pad.u + 0.25 * pad.w);
  near(glow[0].v, pad.v + PAD_V * pad.h);
});

// The whole chain on a made-up seat: a foot rests, lifts, lands, through the tap detector, the swap and the engine.
test("a bob in place plays a tap tile through the engine", () => {
  const song = { id: "t", title: "t", by: "t", bpm: 60, notes: [{ beat: 3, midi: 60, beats: 0.4 }] }; // 0.4 s: a tap. From 0.5 s a note is a hold (HOLD_MS)
  const game = createGame({ song, lanes: 2 });
  const detector = createTapDetector();
  const traces = (t) => { // seat 1, foot 0 rests at y 0.8 and is up 0.06 from 2.5 s to 3.0 s; foot 1 rests
    const up = t >= 2500 && t < 3000 ? 0.06 : 0;
    return [{ spotId: 1, foot: 0, x: 0.3, y: 0.8 - up, shin: 0.2 }, { spotId: 1, foot: 1, x: 0.4, y: 0.8, shin: 0.2 }];
  };
  const hits = [];
  for (let t = 0; t <= 6000; t += 33) {
    const pad = padFeet(detector.update(t, traces(t)).feet, [1])[1];
    for (const e of game.update(t, pad).events) if (e.type === "hit") hits.push({ t, lane: e.lane });
  }
  assert.equal(hits.length, 1, JSON.stringify(hits));
  assert.equal(hits[0].lane, 0);
});

test("a foot that rests on the square the whole song hits nothing", () => {
  const song = { id: "t", title: "t", by: "t", bpm: 60, notes: [{ beat: 3, midi: 60, beats: 0.4 }] }; // 0.4 s: a tap. From 0.5 s a note is a hold (HOLD_MS)
  const game = createGame({ song, lanes: 2 });
  const detector = createTapDetector();
  let hits = 0;
  for (let t = 0; t <= 6000; t += 33) {
    const pad = padFeet(detector.update(t, [{ spotId: 1, foot: 0, x: 0.3, y: 0.8, shin: 0.2 }]).feet, [1])[1];
    hits += game.update(t, pad).events.filter((e) => e.type === "hit").length;
  }
  assert.equal(hits, 0);
});

test("one lane: one foot lifting and landing while the other stays down is an arrival on the one square", () => {
  const song = { id: "t", title: "t", by: "t", bpm: 60, notes: [{ beat: 3, midi: 60, beats: 0.4 }] }; // 0.4 s: a tap. From 0.5 s a note is a hold (HOLD_MS)
  const game = createGame({ song, lanes: 1 });
  const detector = createTapDetector();
  const hits = [];
  for (let t = 0; t <= 6000; t += 33) {
    const up = t >= 2500 && t < 3000 ? 0.06 : 0;
    const feet = [{ spotId: 1, foot: 0, x: 0.3, y: 0.8 - up, shin: 0.2 }, { spotId: 1, foot: 1, x: 0.4, y: 0.8, shin: 0.2 }];
    const pad = padFeet(detector.update(t, feet).feet, [1], [], { 1: 1 })[1];
    for (const e of game.update(t, pad).events) if (e.type === "hit") hits.push(t);
  }
  assert.equal(hits.length, 1, JSON.stringify(hits));
});

test("one lane with the seat-mode detector: feet that swap names every frame play nothing until one really lifts and lands", () => {
  const song = { id: "t", title: "t", by: "t", bpm: 60, notes: [{ beat: 3, midi: 60, beats: 0.4 }] }; // 0.4 s: a tap. From 0.5 s a note is a hold (HOLD_MS)
  const game = createGame({ song, lanes: 1 });
  const detector = createTapDetector();
  const hits = [];
  for (let t = 0; t <= 6000; t += 33) {
    const up = t >= 2500 && t < 3000 ? 0.09 : 0; // the lower foot rises past the other
    const ys = [0.8, 0.84 - up];
    const names = (t / 33) % 2 ? [1, 0] : [0, 1]; // names flip on every frame
    const feet = ys.map((y, i) => ({ spotId: 1, foot: names[i], x: 0.3 + 0.1 * i, y, shin: 0.2 }));
    const pad = padFeet(detector.update(t, feet, { 1: 1 }).feet, [1], [], { 1: 1 })[1];
    for (const e of game.update(t, pad).events) if (e.type === "hit") hits.push(t);
  }
  assert.equal(hits.length, 1, JSON.stringify(hits));
});

// ---- Facing: the camera stands across from the players (src/facing.js, the saved switch pp:facing) ----
const facing = (on, run) => {
  const before = globalThis.localStorage;
  globalThis.localStorage = { getItem: (k) => (k === "pp:facing" && on ? "1" : null), setItem() {} };
  try { run(); } finally { globalThis.localStorage = before; }
};

test("facing: the pad on the canvas left takes the rightmost slice, and the dividers stay in camera order", () => {
  const ids = (s) => s.map((x) => x.spotId);
  assert.deepEqual(ids(makeSlices(layout, null)), [1, 2, 3]);
  facing(true, () => {
    const s = makeSlices(layout, null, [0.05, 0.2, 0.7, 0.95]);
    assert.deepEqual(ids(s), [3, 2, 1]);
    assert.deepEqual(s.map((x) => [x.x0, x.x1]), [[0.05, 0.2], [0.2, 0.7], [0.7, 0.95]]);
  });
  facing(false, () => assert.deepEqual(ids(makeSlices(layout, null)), [1, 2, 3]));
});

test("facing: a lone player's camera-left foot plays the right lane, and Swap feet flips it back; one lane is always lane 0", () => {
  const left = { spotId: 1, foot: 0 }, right = { spotId: 1, foot: 1 };
  facing(true, () => {
    assert.equal(laneOf(left), 1);
    assert.equal(laneOf(right), 0);
    assert.equal(laneOf(left, [1]), 0);
    assert.equal(laneOf(left, [2]), 1);
    assert.equal(laneOf(left, [], { 1: 1 }), 0);
  });
  facing(false, () => { assert.equal(laneOf(left), 0); assert.equal(laneOf(left, [1]), 1); });
});

test("feetMiddle: the middle of each seat's feet, null for a seat with no person, no feet, or a neighbour's pose", () => {
  const out = feetMiddle([
    { spotId: 1, dropped: false, feet: [{ x: 0.3 }, { x: 0.4 }] },
    { spotId: 2, dropped: false, feet: [{ x: 0.6 }] },
    { spotId: 3, dropped: false, feet: [] },
    { spotId: 4, dropped: true, feet: [{ x: 0.9 }] },
  ]);
  near(out[1], 0.35); near(out[2], 0.6);
  assert.equal(out[3], null);
  assert.equal(out[4], null);
  assert.deepEqual(feetMiddle([]), {});
});

test("tappedX: two lanes know the foot by name, one lane takes the foot that came down furthest, and a seat not seen gives null", () => {
  const feet = [{ spotId: 1, foot: 0, x: 0.3, y: 0.9 }, { spotId: 1, foot: 1, x: 0.4, y: 0.9 }, { spotId: 2, foot: 0, x: 0.7, y: 0.9 }];
  assert.equal(tappedX({ spotId: 1, foot: 1 }, feet), 0.4);
  assert.equal(tappedX({ spotId: 1, foot: 0 }, feet, { 1: 2 }), 0.3);
  const drop = (f) => (f.x === 0.4 ? 0.05 : 0.01);
  assert.equal(tappedX({ spotId: 1, foot: 0 }, feet, { 1: 1 }, drop), 0.4); // one lane: the tap says foot 0, but foot 1 came down
  assert.equal(tappedX({ spotId: 3, foot: 0 }, feet), null);
  assert.equal(tappedX({ spotId: 3, foot: 0 }, feet, { 3: 1 }), null);
});

test("read-out: the lifted map has every seat, true when any of its feet is in the air", () => {
  const poses = [{ spotId: 1 }, { spotId: 2 }, { spotId: 3 }];
  const feet = [{ spotId: 1, foot: 0, lifted: true }, { spotId: 2, foot: 0, lifted: false }];
  const r = frameReadout(12.5, [{ spotId: 1 }], feet, [{ spotId: 1 }], [{ spotId: 1, foot: 0, atMs: 12.5, x: 0.4 }], poses);
  assert.deepEqual(r.lifted, { 1: true, 2: false, 3: false });
  assert.equal(r.t, 12.5);
  assert.equal(r.taps[0].x, 0.4);
  assert.equal(r.poses, poses);
});

// ---- Each player's own calibration from the warm-up (createCalibrator) ----
// A tap detector stand-in that only remembers setSeat calls: { [spotId]: options | null }.
const fakeDetector = () => { const own = {}; return { own, setSeat: (id, o) => { own[id] = o; } }; };
const lifts = (peaks) => peaks.map((peak) => ({ peak, liftMs: 200 }));
const tapsOf = (spotId, n) => Array.from({ length: n }, (_, i) => ({ spotId, foot: 0, atMs: i * 600 }));
const people = (...ids) => ids.map((spotId) => ({ spotId, clientId: "phone" + spotId }));
// One warm-up: seat 1 taps heavily (0.06) four times, seat 2 lightly (0.025) four times, seat 3 only twice.
function warmup(c, ids = [1, 2, 3]) {
  c.round("lobby", people(...ids));
  c.round("warmup", people(...ids));
  c.record([...tapsOf(1, 4), ...tapsOf(2, 4), ...tapsOf(3, 2)], [...lifts([0.06, 0.06, 0.06, 0.06]), ...lifts([0.025, 0.025, 0.025, 0.025]), ...lifts([0.05, 0.05])]);
  c.round("countdown", people(...ids));
}

test("calibration: each seat with 3 or more warm-up taps gets its own numbers, the others keep the defaults", () => {
  const det = fakeDetector();
  const c = createCalibrator(() => det, true);
  warmup(c);
  const r = c.result();
  assert.deepEqual(Object.keys(r), ["1", "2"]); // seat 3 made 2 taps
  assert.ok(Math.abs(r[1].minLift - 0.024) < 1e-9 && Math.abs(r[2].minLift - 0.010) < 1e-9);
  assert.deepEqual(Object.keys(r[1]), ["taps", "medianPeak", "medianLiftMs", "minLift"]);
  assert.deepEqual(det.own[1], { minLift: r[1].minLift, liftRatio: 0 });
  assert.equal(det.own[3], undefined, "seat 3 was never set");
});

test("calibration: taps outside the warm-up count for nothing, and with apply off the numbers are kept but nothing is set", () => {
  const det = fakeDetector();
  const c = createCalibrator(() => det, false);
  c.round("lobby", people(1));
  c.record(tapsOf(1, 5), lifts([0.06, 0.06, 0.06, 0.06, 0.06])); // lobby: not recorded
  c.round("warmup", people(1));
  c.round("countdown", people(1));
  assert.deepEqual(c.result(), {}); // a warm-up with no taps
  warmup(c, [1, 2, 3]);
  assert.deepEqual(Object.keys(c.result()), ["1", "2"]);
  assert.deepEqual(det.own, {}, "apply is off: the detector is not touched");
  assert.equal(CALIBRATE_FROM_WARMUP, false);
});

test("calibration: it lasts through the song and a play again (the lobby between), and ends for a seat that is let go or changes hands", () => {
  const det = fakeDetector();
  const c = createCalibrator(() => det, true);
  warmup(c);
  for (const status of ["playing", "paused", "playing", "results", "lobby"]) c.round(status, people(1, 2, 3));
  assert.deepEqual(Object.keys(c.result()), ["1", "2"]);
  // seat 1's phone leaves and another takes it: seat 1 is dropped, seat 2 stays
  c.round("lobby", [{ spotId: 1, clientId: "someone-else" }, ...people(2, 3).slice(0)]);
  assert.deepEqual(Object.keys(c.result()), ["2"]);
  assert.equal(det.own[1], null, "the detector is put back on the defaults for seat 1");
  // seat 2 is released
  c.round("lobby", people(3));
  assert.deepEqual(c.result(), {});
});

test("calibration: a new warm-up starts from the defaults, and a pause in the warm-up does not end it", () => {
  const det = fakeDetector();
  const c = createCalibrator(() => det, true);
  warmup(c);
  c.round("lobby", people(1, 2, 3));
  c.round("warmup", people(1, 2, 3));
  assert.deepEqual(c.result(), {});
  assert.equal(det.own[1], null);
  c.record(tapsOf(1, 2), lifts([0.06, 0.06]));
  c.round("paused", people(1, 2, 3));
  c.round("warmup", people(1, 2, 3)); // resumed: still the same warm-up
  c.record(tapsOf(1, 2).map((t) => ({ ...t, atMs: t.atMs + 5000 })), lifts([0.06, 0.06]));
  c.round("countdown", people(1, 2, 3));
  assert.equal(c.result()[1].taps, 4);
});

test("calibration: clear() throws everything away (the seats were turned round)", () => {
  const det = fakeDetector();
  const c = createCalibrator(() => det, true);
  warmup(c);
  c.clear();
  assert.deepEqual(c.result(), {});
});

// ---- Only the seats in play are tracked (setActive), on the source as the stage runs it ----
// The recording replays on a clock the test moves. At 30 s both seats are tapping.
test("setActive: a seat left out shows no feet, makes no taps and its picture counter stands still, and a seat put back starts clean", async () => {
  const rec = JSON.parse(readRecording(new URL("../../qa/seats/real-two-1.json", import.meta.url), "utf8"));
  const real = { fetch: globalThis.fetch, perf: Object.getOwnPropertyDescriptor(globalThis, "performance") };
  let clock = 0;
  globalThis.fetch = async () => ({ ok: true, json: async () => rec });
  Object.defineProperty(globalThis, "performance", { value: { now: () => clock }, configurable: true, writable: true });
  try {
    const source = createSeatSource({ layout: makeLayout({ seats: 2 }), replay: "recording" });
    await source.start();
    const lanes = { 1: 1, 2: 1 };
    const run = (from, to) => { const frames = []; for (clock = from; clock < to; clock += 33) { source.bySpot(lanes); frames.push(source.lastFrame()); } return frames; };
    const both = run(30000, 33000);
    assert.ok(both.every((f) => f.poses.every((p) => p.active)));
    assert.ok(both.some((f) => f.read.some((x) => x.spotId === 2)));
    assert.ok(both.flatMap((f) => f.taps).some((t) => t.spotId === 2), "seat 2 taps while it is tracked");
    source.setActive([1]);
    source.setActive([1]); // again: nothing changes
    const alone = run(33000, 36000);
    assert.ok(alone.every((f) => f.poses[1].active === false && f.poses[1].feet.length === 0 && f.poses[1].hipX === null));
    assert.ok(alone.every((f) => f.read.every((x) => x.spotId === 1) && f.taps.every((t) => t.spotId === 1) && f.debug.every((d) => d.spotId === 1)));
    assert.ok(alone.some((f) => f.read.length), "seat 1 is still read");
    assert.ok(alone.every((f) => f.poses[1].n === both.at(-1).poses[1].n), "seat 2's counter did not move");
    assert.equal(source.detections(), null); // a recording runs no pose model
    assert.ok(Number.isFinite(source.fps()));
    // Seat 2 comes back after a gap far shorter than the detector's own 500 ms: its tracks must still start over, so each ground is
    // where its foot is now (without the reset, a foot in the air would keep the ground it had before).
    source.setActive(null);
    const nowBack = run(36000, 36100);
    assert.ok(nowBack.every((f) => f.poses.every((p) => p.active)));
    let at = 36100;
    for (; at < 40000 && !source.lastFrame().lifted[2]; at += 33) run(at, at + 33); // wait for a foot of seat 2 to be in the air
    assert.ok(source.lastFrame().lifted[2], "seat 2 has a foot in the air");
    source.setActive([1]);
    run(at, at + 33);
    source.setActive(null);
    const first = run(at + 33, at + 66)[0];
    const seat2 = first.read.filter((f) => f.spotId === 2);
    const grounds = first.debug.filter((x) => x.spotId === 2);
    assert.ok(grounds.length && grounds.every((d) => seat2.some((f) => Math.abs(f.y - d.ground) < 1e-9)), "each ground is where its foot is now");
    assert.ok(first.lifted[2] === false, "and nothing is lifted from before");
  } finally {
    globalThis.fetch = real.fetch;
    Object.defineProperty(globalThis, "performance", real.perf);
  }
});

test("seat lines: they follow people in the lobby and hold still from the warm-up to the results", () => {
  assert.equal(linesMayMove("lobby"), true);
  for (const status of ["warmup", "countdown", "playing", "paused", "results"]) assert.equal(linesMayMove(status), false, status);
  assert.equal(linesMayMove(null), true); // a page with no game (seats.html)
  assert.equal(linesMayMove(undefined), true);
});
