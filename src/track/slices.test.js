import test from "node:test";
import assert from "node:assert/strict";
import { assignHips, fitBounds, easeBounds, seenHips, FOLLOW_RATE, FOLLOW_DEAD, LONE_HALF, OUTER_MIN, equalBounds, boundsFor, moveBound, readSaved, writeSaved, slicesKey, EDGES_KEY, MIN_SLICE } from "./slices.js";
import { makeSlices } from "./seatsource.js";
import { makeLayout } from "../stage/layout.js";

const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, `${a} is not ${b}`);
const store = (data = {}) => ({ getItem: (k) => data[k] ?? null, setItem: (k, v) => { data[k] = v; }, data });

test("with nothing saved the span is split evenly, across the old outer edges when they are good", () => {
  assert.deepEqual(equalBounds(2, null), [0, 0.5, 1]);
  const b = equalBounds(3, { l: 0.1, r: 0.7 });
  [0.1, 0.3, 0.5, 0.7].forEach((x, i) => near(b[i], x));
  assert.deepEqual(equalBounds(2, { l: 0.5, r: 0.55 }), [0, 0.5, 1]); // too narrow: the whole picture
});

test("saved dividers are used when they fit the seat count, each on its own", () => {
  assert.deepEqual(boundsFor(3, null, [0.05, 0.2, 0.7, 0.95]), [0.05, 0.2, 0.7, 0.95]);
});

test("bad saved dividers fall back to the even split: wrong count, not rising, too narrow, outside the picture, not numbers", () => {
  for (const bad of [[0, 1], [0, 0.6, 0.5, 1], [0, 0.5, 0.52, 1], [0, 0.5, 1.2, 1.4], [0, "a", 0.5, 1], null, "x"]) {
    assert.deepEqual(boundsFor(3, null, bad), equalBounds(3, null), JSON.stringify(bad));
  }
});

test("moving a divider keeps room for a narrowest seat on each side, and leaves the others", () => {
  const b = [0, 0.3, 0.6, 1];
  const moved = moveBound(b, 1, 0.45);
  assert.deepEqual(moved, [0, 0.45, 0.6, 1]);
  assert.deepEqual(b, [0, 0.3, 0.6, 1]); // a new list
  near(moveBound(b, 1, 0.9)[1], 0.6 - MIN_SLICE);
  near(moveBound(b, 1, 0)[1], MIN_SLICE);
  near(moveBound(b, 0, -1)[0], 0);
  near(moveBound(b, 3, 2)[3], 1);
  near(moveBound(b, 3, 0.1)[3], 0.6 + MIN_SLICE);
});

test("the old outer-edge keys still work when no dividers are saved, and saving dividers keeps them in step", () => {
  const s = store({ [EDGES_KEY]: JSON.stringify({ l: 0.2, r: 0.8 }) });
  const b = readSaved(2, s);
  near(b[0], 0.2); near(b[1], 0.5); near(b[2], 0.8);
  writeSaved([0.1, 0.3, 0.9], s);
  assert.deepEqual(JSON.parse(s.data[slicesKey(2)]), [0.1, 0.3, 0.9]);
  assert.deepEqual(JSON.parse(s.data[EDGES_KEY]), { l: 0.1, r: 0.9 });
  assert.deepEqual(readSaved(2, s), [0.1, 0.3, 0.9]);
  near(readSaved(3, s)[1], 0.1 + 0.8 / 3); // another seat count has no saved dividers: even across the saved edges
});

test("unreadable storage gives the whole picture", () => {
  assert.deepEqual(readSaved(2, store({ [EDGES_KEY]: "{{", [slicesKey(2)]: "nope" })), [0, 0.5, 1]);
});

test("the stage's slices take the saved dividers, in the floor's left to right order, and keep working with edges only", () => {
  const layout = makeLayout({ seats: 3 });
  const s = makeSlices(layout, { l: 0, r: 1 }, [0.05, 0.2, 0.7, 0.95]);
  assert.deepEqual(s.map((x) => [x.spotId, x.x0, x.x1]), [[1, 0.05, 0.2], [2, 0.2, 0.7], [3, 0.7, 0.95]]);
  near(makeSlices(layout, { l: 0.1, r: 0.7 })[1].x1, 0.5); // the old call: edges only
  assert.deepEqual(makeSlices(layout, null, [0, 0.9, 1]).map((x) => x.x1), [1 / 3, 2 / 3, 1]); // a list for the wrong count is ignored
});

test("fit: two people, from the real recording (hips 0.40 and 0.545): the divider half way, the outer edges past their feet", () => {
  const b = fitBounds([0.4, 0.545], { n: 2 });
  near(b[1], 0.4725); // the hand-dragged one was 0.4674
  assert.ok(b[0] < 0.33 && b[2] > 0.6, `edges ${b} must hold the feet at 0.33 to 0.39 and 0.515 to 0.60`);
  assert.ok(b[0] > 0.2 && b[2] < 0.7, "and not be far wider than the people");
});

test("fit: the outer edge is half the gap past the hips, but at least OUTER_MIN", () => {
  const wide = fitBounds([0.2, 0.8], { n: 2 });
  assert.deepEqual(wide.map((x) => +x.toFixed(3)), [0, 0.5, 1]); // half the gap is 0.3, past the picture: clamped
  near(fitBounds([0.4, 0.5], { n: 2 })[0], 0.4 - OUTER_MIN); // a small gap: the floor
  const three = fitBounds([0.2, 0.5, 0.8], { n: 3 });
  assert.deepEqual(three.map((x) => +x.toFixed(3)), [0.05, 0.35, 0.65, 0.95]);
});

test("fit: one person gets LONE_HALF each side, inside the picture", () => {
  const b = fitBounds([0.5], { n: 1 });
  near(b[0], 0.5 - LONE_HALF); near(b[1], 0.5 + LONE_HALF);
  assert.deepEqual(fitBounds([0.05], { n: 1 }).map((x) => +x.toFixed(3)), [0, 0.2]);
  assert.deepEqual(fitBounds([null], { n: 1, current: [0.1, 0.9] }), [0.1, 0.9]);
});

test("fit: a missing hip keeps that seat's own bounds", () => {
  const current = [0, 0.3, 0.7, 1];
  const b = fitBounds([0.15, null, 0.85], { n: 3, current });
  near(b[1], 0.3); near(b[2], 0.7); // both dividers touch the missing seat
  const c = fitBounds([0.2, 0.6, null], { n: 3, current });
  near(c[1], 0.4); near(c[2], 0.7); near(c[3], 1);
});

test("fit: always rising, minSlice apart, inside 0 to 1, and never past a seen person's hips", () => {
  const cases = [[0.5, 0.52], [0.1, 0.12, 0.14, 0.9], [0.99], [0.02, 0.5], [0.5, 0.3], [null, null], [0.3, 0.3, 0.3]];
  for (const h of cases) {
    const n = h.length, b = fitBounds(h, { n });
    assert.equal(b.length, n + 1);
    assert.ok(b[0] >= 0 && b[n] <= 1 + 1e-9, JSON.stringify([h, b]));
    for (let i = 1; i <= n; i++) assert.ok(b[i] - b[i - 1] >= MIN_SLICE - 1e-9, JSON.stringify([h, b]));
  }
  const b = fitBounds([0.2, 0.5, 0.8], { n: 3, current: [0, 0.6, 0.7, 1] }); // a kept divider that cuts a person is pulled back
  assert.ok(b[1] <= 0.5 && b[2] >= 0.5);
});

test("fit: two seats that see the same person do not both count", () => {
  assert.deepEqual(seenHips([0.4, 0.4, 0.8]), [0.4, null, 0.8]);
  assert.deepEqual(seenHips([0.4, 0.3]), [0.4, null]);
  assert.deepEqual(seenHips([NaN, undefined, "x"]), [null, null, null]);
});

test("follow: no faster than the rate, and not at all inside the dead zone", () => {
  assert.equal(easeBounds([0, 0.5, 1], [0, 0.505, 1], 1000), null); // 0.005 off: still
  assert.equal(easeBounds([0, 0.5, 1], [0, 0.5 + FOLLOW_DEAD - 1e-6, 1], 1000), null);
  const one = easeBounds([0, 0.5, 1], [0, 0.6, 1], 100);
  near(one[1], 0.5 + FOLLOW_RATE * 0.1); // 100 ms: 0.002
  const sec = easeBounds([0, 0.5, 1], [0, 0.4, 1], 1000);
  near(sec[1], 0.5 - FOLLOW_RATE);
  near(easeBounds([0, 0.5, 1], [0, 0.52, 1], 5000)[1], 0.52); // never overshoots
});

test("follow: ten seconds of a person walking toward the neighbour never takes the divider past the neighbour's hip", () => {
  let b = [0, 0.5, 1];
  for (let t = 0; t < 600; t++) { // 60 frames a second, seat 1's hip goes from 0.25 to 0.7 and then sits on seat 2's at 0.72
    const h1 = Math.min(0.72, 0.25 + t * 0.002), hips = [h1, 0.72];
    const next = easeBounds(b, fitBounds(hips, { n: 2, current: b }), 1000 / 60, hips);
    if (next) b = next;
    assert.ok(b[1] <= 0.72 && b[1] >= h1 - 1e-9 || h1 > 0.72, `step ${t}: ${b}`);
  }
});

test("assign: with fewer people than seats, each goes to the seat whose slice is nearest", () => {
  const even = [0, 1 / 3, 2 / 3, 1];
  assert.deepEqual(assignHips([0.2, 0.5, 0.8], even), [0.2, 0.5, 0.8]);
  assert.deepEqual(assignHips([0.5, 0.77], even), [null, 0.5, 0.77]);
  assert.deepEqual(assignHips([0.15], even), [0.15, null, null]);
  assert.deepEqual(assignHips([0.1, 0.2, 0.9, 0.95], even), [0.1, 0.2, 0.9]); // too many: the leftmost n
  assert.deepEqual(assignHips([0.5, 0.52], [0, 0.5, 1]), [0.5, 0.52]);
});
