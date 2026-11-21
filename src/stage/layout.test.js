import { test } from "node:test";
import assert from "node:assert/strict";
import { makeLayout, feetBySpot, asLayout, LANES } from "./layout.js";

const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-3, `${a} is not near ${b}`);

test("every pad has 2 lanes, one for each foot", () => {
  assert.equal(LANES, 2);
  for (const seats of [1, 2, 3, 4]) assert.equal(makeLayout({ seats }).lanes, 2);
  assert.equal("posture" in makeLayout({ seats: 2 }), false);
});

test("1 to 4 pads fill the field's width with even gaps, v from 0.1 to 0.96", () => {
  for (const seats of [1, 2, 3, 4]) {
    const l = makeLayout({ seats });
    assert.equal(l.spots.length, seats);
    assert.deepEqual(l.spots.map((s) => s.id), Array.from({ length: seats }, (_, i) => i + 1));
    near(l.spots[0].rect.u, 0.04);
    const last = l.spots[seats - 1].rect;
    near(last.u + last.w, 0.96);
    const gaps = l.spots.slice(1).map((s, i) => s.rect.u - (l.spots[i].rect.u + l.spots[i].rect.w));
    gaps.forEach((g) => near(g, gaps[0]));
    l.spots.forEach((s) => { near(s.rect.v, 0.1); near(s.rect.h, 0.86); near(s.rect.w, l.spots[0].rect.w); });
  }
  assert.deepEqual(makeLayout({ seats: 3 }).spots[0].rect, { u: 0.04, v: 0.1, w: 0.28, h: 0.86 });
});

test("a bad seat count is refused in plain words", () => {
  for (const seats of [0, 5, 2.5, "3", undefined]) assert.throws(() => makeLayout({ seats }), /1 to 4/);
});

test("a foot inside a pad comes back in that pad's own coordinates", () => {
  const l = makeLayout({ seats: 2 });
  const r = l.spots[1].rect;
  const out = feetBySpot(l, [{ u: r.u + r.w * 0.25, v: r.v + r.h * 0.5 }]);
  assert.deepEqual(out[1], []);
  assert.equal(out[2].length, 1);
  near(out[2][0].u, 0.25);
  near(out[2][0].v, 0.5);
});

test("every spot id is in the result, empty when nobody is there", () => {
  const out = feetBySpot(makeLayout({ seats: 3 }), []);
  assert.deepEqual(out, { 1: [], 2: [], 3: [] });
});

test("a foot within a tenth outside a pad counts, further out does not", () => {
  const l = makeLayout({ seats: 1 }); // one pad: u 0.04 to 0.96, v 0.1 to 0.96
  const r = l.spots[0].rect;
  const justOutside = feetBySpot(l, [{ u: r.u - 0.09 * r.w, v: 0.5 }]);
  assert.equal(justOutside[1].length, 1);
  assert.equal(justOutside[1][0].u, 0); // pulled onto the pad's edge
  assert.equal(feetBySpot(l, [{ u: r.u - 0.12 * r.w, v: 0.5 }])[1].length, 0);
  assert.equal(feetBySpot(l, [{ u: 0.5, v: r.v - 0.12 * r.h }])[1].length, 0);
  const below = feetBySpot(l, [{ u: 0.5, v: r.v + r.h * 1.09 }]);
  assert.equal(below[1][0].v, 1);
  assert.equal(feetBySpot(l, [{ u: 0.5, v: r.v + r.h * 1.12 }])[1].length, 0);
});

test("a foot in two pads' margins goes to one pad only, the nearer centre", () => {
  const l = makeLayout({ seats: 3 });
  const [a, b] = l.spots.map((s) => s.rect);
  const gapMid = (a.u + a.w + b.u) / 2; // the middle of the gap is inside both margins
  const out = feetBySpot(l, [{ u: gapMid - 0.003, v: 0.5 }, { u: gapMid + 0.003, v: 0.5 }]);
  assert.equal(out[1].length, 1);
  assert.equal(out[2].length, 1);
  assert.equal(out[3].length, 0);
  assert.equal(out[1].length + out[2].length + out[3].length, 2);
});

test("feet outside every pad are ignored", () => {
  const l = makeLayout({ seats: 2 });
  const out = feetBySpot(l, [{ u: 0.5, v: 0 }, { u: 0.5, v: 0.01 }, { u: -0.3, v: 0.5 }]);
  assert.deepEqual(out, { 1: [], 2: [] });
});

test("asLayout gives back a made layout and refuses broken ones", () => {
  const good = makeLayout({ seats: 4 });
  assert.deepEqual(asLayout(good), good);
  assert.notEqual(asLayout(good), good); // a copy
  for (const bad of [null, "x", {}, { ...good, spots: [] }, { ...good, spots: "no" },
    { ...good, spots: [good.spots[0], good.spots[0]] }, { ...good, spots: [{ id: 1, rect: { u: 0, v: 0, w: 0, h: 1 } }] },
    { ...good, spots: [{ id: 1, rect: { u: "a", v: 0, w: 1, h: 1 } }] }, { ...good, spots: [null] },
    { ...good, spots: [...good.spots, { id: 5, rect: good.spots[0].rect }] }]) {
    assert.equal(asLayout(bad), null);
  }
});

test("a saved layout that still has a posture and 3 or 4 lanes loads as 2 lanes with the same pads", () => {
  const pads = makeLayout({ seats: 3 }).spots;
  for (const old of [{ posture: "seated", lanes: 3, spots: pads }, { posture: "standing", lanes: 4, spots: pads }]) {
    assert.deepEqual(asLayout(old), { lanes: 2, spots: pads });
  }
});
