import test from "node:test";
import assert from "node:assert/strict";
import { makeSlices, padFeet, laneOf, glowFeet, feetMiddle, tappedX, LANE_U, ONE_LANE_U, PAD_V } from "./seatsource.js";
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
  const song = { id: "t", title: "t", by: "t", bpm: 60, notes: [{ beat: 3, midi: 60, beats: 0.5 }] };
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
  const song = { id: "t", title: "t", by: "t", bpm: 60, notes: [{ beat: 3, midi: 60, beats: 0.5 }] };
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
  const song = { id: "t", title: "t", by: "t", bpm: 60, notes: [{ beat: 3, midi: 60, beats: 0.5 }] };
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
  const song = { id: "t", title: "t", by: "t", bpm: 60, notes: [{ beat: 3, midi: 60, beats: 0.5 }] };
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
