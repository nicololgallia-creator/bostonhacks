import { test } from "node:test";
import assert from "node:assert/strict";
import { solve, apply, invert } from "./homography.js";

const near = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) < eps, `${a} is not ${b}`);
const nearPoint = (p, q, eps) => { near(p.x, q.x, eps); near(p.y, q.y, eps); };

// A camera looking at the floor at a slant: the far edge of the field is the short edge at the top.
const camera = [{ x: 0.3, y: 0.2 }, { x: 0.7, y: 0.2 }, { x: 0.95, y: 0.9 }, { x: 0.05, y: 0.9 }];
const field = [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }];

// The same formula written out by hand, for a known matrix, to check solve against something outside itself.
const KNOWN = [1.2, 0.1, 0.05, 0.2, 0.9, 0.1, 0.3, 0.2, 1];
const byHand = ({ x, y }) => {
  const w = KNOWN[6] * x + KNOWN[7] * y + KNOWN[8];
  return { x: (KNOWN[0] * x + KNOWN[1] * y + KNOWN[2]) / w, y: (KNOWN[3] * x + KNOWN[4] * y + KNOWN[5]) / w };
};

test("the four corners go exactly to their matches", () => {
  const m = solve(camera, field);
  camera.forEach((p, i) => nearPoint(apply(m, p), field[i]));
});

test("a middle point lands in the right place on a tilted view", () => {
  // The two diagonals of the camera's quad cross at one point. A straight-on field has its diagonals cross at 0.5, 0.5.
  const m = solve(camera, field);
  const a = camera[0], b = camera[2], c = camera[1], d = camera[3];
  const t = ((c.x - a.x) * (d.y - c.y) - (c.y - a.y) * (d.x - c.x)) / ((b.x - a.x) * (d.y - c.y) - (b.y - a.y) * (d.x - c.x));
  const crossing = { x: a.x + t * (b.x - a.x), y: a.y + t * (b.y - a.y) };
  nearPoint(apply(m, crossing), { x: 0.5, y: 0.5 });
});

test("solve matches a known matrix at a point it was not given", () => {
  const from = [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }];
  const m = solve(from, from.map(byHand));
  for (const p of [{ x: 0.5, y: 0.5 }, { x: 0.2, y: 0.8 }, { x: 0.9, y: 0.3 }, { x: 1.4, y: -0.2 }]) {
    nearPoint(apply(m, p), byHand(p));
  }
});

test("invert undoes apply", () => {
  const m = solve(camera, field);
  const back = invert(m);
  for (const p of [{ x: 0.5, y: 0.5 }, { x: 0.1, y: 0.9 }, { x: 0.6, y: 0.3 }]) {
    nearPoint(apply(back, apply(m, p)), p);
  }
  camera.forEach((p, i) => nearPoint(apply(back, field[i]), p));
});

test("three points in a line throw a plain sentence", () => {
  const line = [{ x: 0.1, y: 0.1 }, { x: 0.5, y: 0.5 }, { x: 0.9, y: 0.9 }, { x: 0.2, y: 0.8 }];
  assert.throws(() => solve(line, field), /Three of the camera points are in a line/);
  assert.throws(() => solve(camera, line), /Three of the field points are in a line/);
});

test("a repeated point also throws, and so does a wrong number of points", () => {
  const twice = [camera[0], camera[0], camera[2], camera[3]];
  assert.throws(() => solve(twice, field), /in a line/);
  assert.throws(() => solve(camera.slice(0, 3), field), /Four points/);
  assert.throws(() => solve(null, field), /Four points/);
  assert.throws(() => solve([{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: "a", y: 1 }], field), /Four points/);
});

test("apply returns null for a point on the horizon, and invert refuses a flat matrix", () => {
  assert.equal(apply([1, 0, 0, 0, 1, 0, 1, 0, -0.5], { x: 0.5, y: 0.2 }), null);
  assert.throws(() => invert([1, 2, 3, 2, 4, 6, 0, 0, 1]), /cannot be reversed/);
});
