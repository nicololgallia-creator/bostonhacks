import test from "node:test";
import assert from "node:assert/strict";
import { equalBounds, boundsFor, moveBound, readSaved, writeSaved, slicesKey, EDGES_KEY, MIN_SLICE } from "./slices.js";
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
