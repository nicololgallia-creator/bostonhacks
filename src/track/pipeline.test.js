import { test } from "node:test";
import assert from "node:assert/strict";
import { createPipeline } from "./pipeline.js";

const near = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) < eps, `${a} is not ${b}`);
const IDENTITY = [1, 0, 0, 0, 1, 0, 0, 0, 1]; // the camera picture is the field
const make = (options = {}) => createPipeline({ cameraToField: IDENTITY, ...options });

test("a foot comes out as a field position", () => {
  const out = make().update(0, [{ x: 0.3, y: 0.7, person: 0 }]);
  assert.equal(out.length, 1);
  near(out[0].u, 0.3);
  near(out[0].v, 0.7);
});

test("the map is applied: a matrix that halves everything halves the foot", () => {
  const out = createPipeline({ cameraToField: [0.5, 0, 0, 0, 0.5, 0, 0, 0, 1] }).update(0, [{ x: 0.8, y: 0.4, person: 0 }]);
  near(out[0].u, 0.4);
  near(out[0].v, 0.2);
});

test("smoothing moves a foot part of the way", () => {
  const p = make({ smoothing: 0.5 });
  p.update(0, [{ x: 0.2, y: 0.2, person: 0 }]);
  const out = p.update(33, [{ x: 0.4, y: 0.2, person: 0 }]);
  near(out[0].u, 0.3);
  const still = make({ smoothing: 0 });
  still.update(0, [{ x: 0.2, y: 0.2, person: 0 }]);
  near(still.update(33, [{ x: 0.4, y: 0.2, person: 0 }])[0].u, 0.4);
});

test("a foot missing for 100 ms is still returned, and gone after 200 ms", () => {
  const p = make();
  p.update(0, [{ x: 0.5, y: 0.5, person: 0 }]);
  const held = p.update(100, []);
  assert.equal(held.length, 1);
  near(held[0].u, 0.5);
  assert.equal(p.update(200, []).length, 0);
});

test("a foot that comes back within the hold time keeps its smoothing", () => {
  const p = make({ smoothing: 0.5 });
  p.update(0, [{ x: 0.2, y: 0.5, person: 0 }]);
  p.update(60, []);
  const out = p.update(100, [{ x: 0.4, y: 0.5, person: 0 }]);
  assert.equal(out.length, 1);
  near(out[0].u, 0.3);
});

test("two feet that cross keep their own histories, even when listed in another order", () => {
  const p = make({ smoothing: 0.5 });
  // A walks left to right along the top, B right to left along the bottom. They swap sides and stay 0.6 apart.
  let a = { x: 0.1, y: 0.2 }, b = { x: 0.9, y: 0.8 };
  let expectA = { ...a }, expectB = { ...b };
  p.update(0, [a, b]);
  for (let step = 1; step <= 8; step++) {
    a = { x: a.x + 0.1, y: a.y };
    b = { x: b.x - 0.1, y: b.y };
    expectA = { x: (expectA.x + a.x) / 2, y: (expectA.y + a.y) / 2 };
    expectB = { x: (expectB.x + b.x) / 2, y: (expectB.y + b.y) / 2 };
    const out = p.update(step * 33, step % 2 ? [b, a] : [a, b]); // the model lists them in a different order every other frame
    assert.equal(out.length, 2);
    near(out[0].u, expectA.x); near(out[0].v, expectA.y);
    near(out[1].u, expectB.x); near(out[1].v, expectB.y);
  }
});

test("a foot farther than a fifth of the picture away is a new foot, not a jump", () => {
  const p = make({ smoothing: 0.5 });
  p.update(0, [{ x: 0.1, y: 0.5, person: 0 }]);
  const out = p.update(33, [{ x: 0.5, y: 0.5, person: 0 }]);
  assert.equal(out.length, 2);
  near(out[1].u, 0.5); // unsmoothed
});

test("feet far outside the field are dropped", () => {
  const p = createPipeline({ cameraToField: [3, 0, 0, 0, 3, 0, 0, 0, 1] });
  const out = p.update(0, [{ x: 0.3, y: 0.3, person: 0 }, { x: 0.6, y: 0.3, person: 1 }, { x: 0.3, y: 0.9, person: 2 }]);
  assert.equal(out.length, 1); // the first lands at 0.9, 0.9 (inside). The others land at 1.8 and at 2.7 on v, past 1.5.
  near(out[0].u, 0.9);
  assert.equal(make().update(0, [{ x: -0.6, y: 0.5, person: 0 }]).length, 0);
  assert.equal(make().update(0, [{ x: -0.4, y: 0.5, person: 0 }]).length, 1); // less than half a field out is kept
});

test("setMatrix swaps the map and keeps the tracked feet", () => {
  const p = make({ smoothing: 0.5 });
  p.update(0, [{ x: 0.2, y: 0.4, person: 0 }]);
  p.setMatrix([0.5, 0, 0, 0, 0.5, 0, 0, 0, 1]);
  const out = p.update(33, [{ x: 0.4, y: 0.4, person: 0 }]); // still the same foot: smoothed to 0.3, then halved
  assert.equal(out.length, 1);
  near(out[0].u, 0.15);
  near(out[0].v, 0.2);
});

test("feet below minConfidence are thrown away, and feet with no confidence are kept", () => {
  const p = make({ minConfidence: 0.5 });
  const out = p.update(0, [
    { x: 0.1, y: 0.5, person: 0, confidence: 0.3 },
    { x: 0.5, y: 0.5, person: 1, confidence: 0.9 },
    { x: 0.8, y: 0.5, person: 2 },
  ]);
  assert.equal(out.length, 2);
  near(out[0].u, 0.5);
});

test("bad input never throws", () => {
  const p = make();
  assert.deepEqual(p.update(0, null), []);
  assert.deepEqual(p.update(33, [null, { x: NaN, y: 0.2 }, { x: "a", y: 1 }, {}]), []);
});
