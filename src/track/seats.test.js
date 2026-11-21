import test from "node:test";
import assert from "node:assert/strict";
import { cropOf, hipsX, ownsPerson, seenFeet, nameFeet, PAD_SHARE } from "./seats.js";

const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, `${a} is not ${b}`);
const point = (x, y = 0.5, visibility = 1) => ({ x, y, visibility });
// 33 landmarks, all unseen, then the ones a test names: { 23: point(...) }
const pose = (named) => Array.from({ length: 33 }, (_, k) => named[k] ?? point(0, 0, 0));

test("crop: a share of the slice's width on each side, kept inside the picture", () => {
  const c = cropOf({ x0: 0.3, x1: 0.5 }, 0.15);
  near(c.x0, 0.27); near(c.x1, 0.53);
  assert.deepEqual(cropOf({ x0: 0, x1: 0.5 }, 0.15), { x0: 0, x1: 0.575 });
  assert.deepEqual(cropOf({ x0: 0.5, x1: 1 }, 0.15), { x0: 0.425, x1: 1 });
  assert.deepEqual(cropOf({ x0: 0.2, x1: 0.4 }, 0), { x0: 0.2, x1: 0.4 });
  assert.equal(PAD_SHARE, 0.15);
});

test("hips: the middle of the two hip landmarks, one hip alone, shoulders when no hip, null when nothing", () => {
  near(hipsX(pose({ 23: point(0.4), 24: point(0.5) })), 0.45);
  near(hipsX(pose({ 23: point(0.4), 24: point(0.9, 0.5, 0.2) })), 0.4); // the unseen hip does not count
  near(hipsX(pose({ 11: point(0.6), 12: point(0.8) })), 0.7);
  assert.equal(hipsX(pose({})), null);
});

test("ownership: a person belongs to the slice that holds their hips, edges included, no hips gets the benefit of the doubt", () => {
  const slice = { x0: 0.3, x1: 0.5 };
  assert.equal(ownsPerson(0.4, slice), true);
  assert.equal(ownsPerson(0.3, slice), true);
  assert.equal(ownsPerson(0.5, slice), true);
  assert.equal(ownsPerson(0.55, slice), false); // the neighbour on the right
  assert.equal(ownsPerson(0.1, slice), false);
  assert.equal(ownsPerson(null, slice), true);
});

// A person whose feet are at (0.30, 0.8) and (0.40, 0.8) as the model sees them: its left foot (29, 31) is on the right of the picture
const standing = (extra = {}) => pose({
  25: point(0.40, 0.6), 27: point(0.40, 0.78), 29: point(0.39, 0.8), 31: point(0.41, 0.8), // model's left leg, picture right
  26: point(0.30, 0.6), 28: point(0.30, 0.78), 30: point(0.29, 0.8), 32: point(0.31, 0.8), // model's right leg, picture left
  ...extra,
});

test("seen feet: the middle of heel and toe, the shin length from the knee, both feet", () => {
  const feet = seenFeet(standing(), 1000, 1000);
  assert.equal(feet.length, 2);
  const left = feet.find((f) => f.side === 0);
  near(left.x, 0.40); near(left.y, 0.8); near(left.shin, 0.18);
});

test("seen feet: a foot with a low-visibility heel or no leg at all is left out", () => {
  assert.equal(seenFeet(standing({ 29: point(0.39, 0.8, 0.1) }), 1000, 1000).length, 1);
  assert.equal(seenFeet(standing({ 25: point(0, 0, 0), 27: point(0, 0, 0), 26: point(0, 0, 0), 28: point(0, 0, 0) }), 1000, 1000).length, 0);
});

test("names with no history: two feet are named by position, a lone foot by the model's side", () => {
  const two = nameFeet([{ side: 0, x: 0.4, y: 0.8 }, { side: 1, x: 0.3, y: 0.8 }]);
  assert.deepEqual(two.map((f) => [f.foot, f.x]), [[0, 0.3], [1, 0.4]]);
  assert.equal(nameFeet([{ side: 1, x: 0.3, y: 0.8 }])[0].foot, 0); // the model's right foot is on the picture's left
  assert.equal(nameFeet([{ side: 0, x: 0.4, y: 0.8 }])[0].foot, 1);
});

test("names keep to the nearest foot of the frame before: feet that cross do not swap", () => {
  // foot 0 was on the right at 0.385 and foot 1 on the left at 0.345 (they had crossed); sorting by position would call the
  // left one foot 0 now, and the history says it is foot 1
  const crossed = nameFeet([{ side: 0, x: 0.34, y: 0.8 }, { side: 1, x: 0.38, y: 0.8 }], [{ x: 0.385, y: 0.8 }, { x: 0.345, y: 0.8 }], 1);
  assert.equal(crossed.find((f) => f.x === 0.38).foot, 0);
  assert.equal(crossed.find((f) => f.x === 0.34).foot, 1);
});

test("names: a lone foot takes the name of the nearer foot of the frame before, even against the model's side", () => {
  const prev = [{ x: 0.30, y: 0.8 }, { x: 0.40, y: 0.8 }];
  assert.equal(nameFeet([{ side: 0, x: 0.31, y: 0.8 }], prev, 1)[0].foot, 0);
  assert.equal(nameFeet([{ side: 1, x: 0.41, y: 0.8 }], prev, 1)[0].foot, 1);
});

test("names: a foot raised in the air stays its own foot, since height counts as distance", () => {
  const prev = [{ x: 0.35, y: 0.8 }, { x: 0.36, y: 0.8 }];
  const now = nameFeet([{ side: 1, x: 0.35, y: 0.74 }, { side: 0, x: 0.36, y: 0.8 }], prev, 1);
  assert.equal(now.find((f) => f.y === 0.74).foot, 0);
});
