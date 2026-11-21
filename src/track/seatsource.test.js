import test from "node:test";
import assert from "node:assert/strict";
import { makeSlices, padFeet, glowFeet, LANE_U, ONE_LANE_U, PAD_V } from "./seatsource.js";
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
