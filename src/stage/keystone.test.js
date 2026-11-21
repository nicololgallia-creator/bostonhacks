import test from "node:test";
import assert from "node:assert/strict";
import { matrix3dFor, loadCalibration, saveCalibration } from "./keystone.js";

// localStorage for Node.
const store = new Map();
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
};
const FULL = [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }];
const W = 1280, H = 720;

// Where a 16-number matrix3d string sends a point, the way the browser works it out.
function through(css, x, y) {
  const m = css.match(/^matrix3d\((.*)\)$/)[1].split(",").map(Number);
  assert.equal(m.length, 16);
  const w = m[3] * x + m[7] * y + m[15];
  return { x: (m[0] * x + m[4] * y + m[12]) / w, y: (m[1] * x + m[5] * y + m[13]) / w };
}
const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-6, `${a} is not ${b}`);

test("the full window gives the identity", () => {
  const m = matrix3dFor(FULL, W, H).match(/\((.*)\)/)[1].split(",").map(Number);
  const identity = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
  m.forEach((n, i) => near(n, identity[i]));
});

test("each corner of the element lands on its corner", () => {
  const quad = [{ x: 0.1, y: 0.05 }, { x: 0.9, y: 0.12 }, { x: 0.8, y: 0.95 }, { x: 0.2, y: 0.9 }];
  const css = matrix3dFor(quad, W, H);
  [[0, 0], [W, 0], [W, H], [0, H]].forEach(([x, y], i) => {
    const p = through(css, x, y);
    near(p.x, quad[i].x * W);
    near(p.y, quad[i].y * H);
  });
});

test("the middle of the element lands below the halfway line of a trapezoid that is narrow at the top", () => {
  const quad = [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0.8, y: 1 }, { x: 0.2, y: 1 }]; // a trapezoid
  const p = through(matrix3dFor(quad, W, H), W / 2, H / 2);
  near(p.x, W / 2);
  assert.ok(p.y > H / 2 && p.y < H, "the middle of a far-narrow trapezoid sits below the halfway line");
});

test("three corners in a line throw a plain sentence", () => {
  const line = [{ x: 0, y: 0 }, { x: 0.5, y: 0 }, { x: 1, y: 0 }, { x: 0.5, y: 1 }];
  assert.throws(() => matrix3dFor(line, W, H), /in a line/);
});

test("nothing saved gives the defaults", () => {
  store.clear();
  assert.deepEqual(loadCalibration(), { cameraId: null, corners: FULL, cameraToField: null });
});

test("a saved calibration comes back", () => {
  store.clear();
  const quad = [{ x: 0.1, y: 0.1 }, { x: 0.9, y: 0.1 }, { x: 0.9, y: 0.9 }, { x: 0.1, y: 0.9 }];
  const map = [1, 0, 0, 0, 1, 0, 0, 0, 1];
  saveCalibration({ cameraId: "cam-1", corners: quad, cameraToField: map });
  assert.deepEqual(loadCalibration(), { cameraId: "cam-1", corners: quad, cameraToField: map });
});

test("saving one part keeps the others", () => {
  store.clear();
  saveCalibration({ cameraId: "cam-1" });
  saveCalibration({ cameraToField: [1, 0, 0, 0, 1, 0, 0, 0, 1] });
  assert.equal(loadCalibration().cameraId, "cam-1");
  assert.equal(loadCalibration().cameraToField.length, 9);
});

test("broken saved values are ignored, one part at a time", () => {
  const bad = [
    "not json at all",
    "null",
    "42",
    JSON.stringify({ corners: [{ x: 0, y: 0 }], cameraToField: [1, 2], cameraId: 7 }),
    JSON.stringify({ corners: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: "a", y: 1 }], cameraToField: [1, 2, 3, 4, 5, 6, 7, 8, null] }),
    JSON.stringify({ corners: [{ x: 0, y: 0 }, { x: 0.5, y: 0 }, { x: 1, y: 0 }, { x: 0.5, y: 1 }] }), // three in a line
    JSON.stringify({ corners: [{ x: -1, y: 0 }, { x: 9, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }] }), // outside the window
  ];
  for (const text of bad) {
    store.set("pp:calibration", text);
    assert.deepEqual(loadCalibration(), { cameraId: null, corners: FULL, cameraToField: null }, text);
  }
  store.set("pp:calibration", JSON.stringify({ cameraId: "cam-2", corners: "nope", cameraToField: [1, 0, 0, 0, 1, 0, 0, 0, 1] }));
  const c = loadCalibration();
  assert.equal(c.cameraId, "cam-2");
  assert.deepEqual(c.corners, FULL);
  assert.equal(c.cameraToField.length, 9);
});

// The projector faces the players: the picture is turned half way round.
test("turned() swaps opposite corners only when the gear faces the players, and the switch is saved", async () => {
  const { isFacing, setFacing, turned } = await import("../facing.js");
  assert.equal(isFacing(), false);
  assert.deepEqual(turned(FULL), FULL);
  setFacing(true);
  assert.equal(isFacing(), true);
  assert.deepEqual(turned(FULL), [FULL[2], FULL[3], FULL[0], FULL[1]]);
  // A full window turned half way round: every point (x, y) goes to (width - x, height - y).
  const m = matrix3dFor(turned(FULL), 100, 50).match(/-?[\d.e-]+/g).slice(1).map(Number); // the first number is the "3" of matrix3d
  const close = (a, b) => assert.ok(Math.abs(a - b) < 1e-6, `${a} is not ${b}`);
  [-1, 0, 0, 0, 0, -1, 0, 0, 0, 0, 1, 0, 100, 50, 0, 1].forEach((want, i) => close(m[i] / m[15], want));
  setFacing(false);
  assert.equal(isFacing(), false);
});
