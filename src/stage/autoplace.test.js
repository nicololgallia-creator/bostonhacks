import test from "node:test";
import assert from "node:assert/strict";
import { fitMap, placePads, easeLayout, createFollower, usableMap, loadMap, saveMap, PAD_GAP, PAD_MIN_W, EASE_RATE, EASE_DEAD } from "./autoplace.js";
import { makeLayout } from "./layout.js";

const near = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) < eps, `${a} is not ${b}`);
const layout3 = makeLayout({ seats: 3 });
const centre = (l, id) => { const r = l.spots.find((s) => s.id === id).rect; return r.u + r.w / 2; };
const rect = (l, id) => l.spots.find((s) => s.id === id).rect;
const sorted = (l) => [...l.spots].sort((p, q) => p.rect.u - q.rect.u);
const noOverlap = (l, gap = 0) => sorted(l).forEach((s, i, all) => { if (i) assert.ok(s.rect.u >= all[i - 1].rect.u + all[i - 1].rect.w + gap - 1e-9, `pad ${s.id} overlaps`); });
const inside = (l) => l.spots.forEach((s) => assert.ok(s.rect.u >= -1e-9 && s.rect.u + s.rect.w <= 1 + 1e-9, `pad ${s.id} is outside`));
const up = { a: 0, b: 1 }; // camera x is floor u
const mirror = { a: 1, b: -1 }; // the camera's left is the players' right

test("fitMap: two points give the line through them, either way round", () => {
  const m = fitMap([{ x: 0.3, u: 0.2 }, { x: 0.6, u: 0.8 }]);
  near(m.b, 2); near(m.a, -0.4);
  const r = fitMap([{ x: 0.3, u: 0.8 }, { x: 0.6, u: 0.2 }]); // facing: the camera's left is the floor's right
  near(r.b, -2); near(r.a, 1.4);
  near(r.a + r.b * 0.45, 0.5);
});

test("fitMap: more than two points give the least-squares line", () => {
  const m = fitMap([{ x: 0, u: 0.1 }, { x: 0.5, u: 0.6 }, { x: 1, u: 1.1 }]);
  near(m.b, 1); near(m.a, 0.1);
  const noisy = fitMap([{ x: 0.2, u: 0.2 }, { x: 0.4, u: 0.5 }, { x: 0.6, u: 0.5 }, { x: 0.8, u: 0.8 }]);
  near(noisy.b, 0.9); // by hand: the sum of (x - 0.5)(u - 0.5) is 0.18 and the sum of (x - 0.5) squared is 0.2
  near(noisy.a + noisy.b * 0.5, 0.5);
});

test("fitMap: refuses points too close in x, too few points, and marks in one place, each with its own sentence", () => {
  assert.throws(() => fitMap([{ x: 0.5, u: 0.2 }, { x: 0.53, u: 0.8 }]), /nearly the same place in the camera/);
  assert.throws(() => fitMap([{ x: 0.5, u: 0.2 }]), /two taps/);
  assert.throws(() => fitMap([]), /two taps/);
  assert.throws(() => fitMap(undefined), /two taps/);
  assert.throws(() => fitMap([{ x: 0.2, u: 0.5 }, { x: 0.7, u: 0.5 }]), /same place on the floor/);
  assert.throws(() => fitMap([{ x: NaN, u: 0.2 }, { x: 0.7, u: 0.8 }]), /two taps/);
  fitMap([{ x: 0.5, u: 0.2 }, { x: 0.56, u: 0.8 }]); // just past the limit is fine
});

test("placePads: each pad is centred on its person, with the map's slope, and keeps size, v, and height", () => {
  const out = placePads(layout3, { 1: 0.2, 2: 0.5, 3: 0.8 }, up);
  near(centre(out, 1), 0.2); near(centre(out, 2), 0.5); near(centre(out, 3), 0.8);
  for (const s of layout3.spots) {
    const r = rect(out, s.id);
    near(r.w, s.rect.w); near(r.v, s.rect.v); near(r.h, s.rect.h);
  }
  assert.deepEqual(out.spots.map((s) => s.id), [1, 2, 3]);
  assert.equal(layout3.spots[0].rect.u, 0.04); // the input is untouched
});

test("placePads: a mirrored map puts the camera's left person on the floor's right, the same pads in the same order", () => {
  // Seat 1 is the pad on the floor's left, so with the mirror its person is on the camera's right.
  const out = placePads(layout3, { 1: 0.8, 2: 0.5, 3: 0.2 }, mirror);
  near(centre(out, 1), 0.2); near(centre(out, 2), 0.5); near(centre(out, 3), 0.8);
  noOverlap(out, PAD_GAP);
  // A mirrored map with the people in the unmirrored order crosses the pads: the order still holds and nothing overlaps.
  const crossed = placePads(layout3, { 1: 0.2, 2: 0.5, 3: 0.8 }, mirror);
  assert.deepEqual(sorted(crossed).map((s) => s.id), [1, 2, 3]);
  noOverlap(crossed, PAD_GAP - 1e-9); inside(crossed);
});

test("placePads: order is kept and pads stay inside 0 to 1 when a person is at the edge or off the picture", () => {
  const out = placePads(layout3, { 1: -0.3, 2: 0.5, 3: 1.4 }, up);
  assert.deepEqual(sorted(out).map((s) => s.id), [1, 2, 3]);
  noOverlap(out); inside(out);
  near(rect(out, 1).u, 0); near(rect(out, 3).u + rect(out, 3).w, 1);
});

test("placePads: close people narrow both pads to meet half way, and never below the minimum", () => {
  const w = layout3.spots[0].rect.w; // about 0.27
  const out = placePads(layout3, { 1: 0.4, 2: 0.55, 3: 0.9 }, up); // 0.15 apart, closer than a pad is wide
  const a = rect(out, 1), b = rect(out, 2);
  assert.ok(a.w < w && b.w < w, "both narrowed");
  near(a.w, b.w);
  near(a.u + a.w, 0.475 - PAD_GAP / 2); // the meeting point is half way between the two people
  near(b.u, 0.475 + PAD_GAP / 2);
  near((a.u + a.w / 2), 0.4); near(b.u + b.w / 2, 0.55); // each still centred on its person
  noOverlap(out, PAD_GAP);
  const tight = placePads(layout3, { 1: 0.5, 2: 0.52, 3: 0.54 }, up); // everyone on top of each other
  for (const s of tight.spots) assert.ok(s.rect.w >= PAD_MIN_W - 1e-9);
  assert.deepEqual(sorted(tight).map((s) => s.id), [1, 2, 3]);
  noOverlap(tight); inside(tight);
});

test("placePads: a seat with no feet seen keeps its place, and the others still avoid it", () => {
  const out = placePads(layout3, { 1: 0.15, 2: null, 3: 0.85 }, up);
  near(rect(out, 2).u, layout3.spots[1].rect.u); near(rect(out, 2).w, layout3.spots[1].rect.w);
  near(centre(out, 1), 0.15 < rect(out, 1).w / 2 ? rect(out, 1).w / 2 : 0.15);
  noOverlap(out, PAD_GAP - 1e-9);
  const none = placePads(layout3, {}, up);
  none.spots.forEach((s, i) => { near(s.rect.u, layout3.spots[i].rect.u); near(s.rect.w, layout3.spots[i].rect.w); });
  const crowd = placePads(layout3, { 1: 0.45, 2: undefined, 3: 0.55 }, up); // the seen two crowd the unseen middle pad: nothing overlaps
  noOverlap(crowd); inside(crowd);
});

test("placePads: pads grow back to their normal width when the people move apart", () => {
  const widths = { 1: 0.27, 2: 0.27, 3: 0.27 };
  const close = placePads(layout3, { 1: 0.4, 2: 0.55, 3: 0.9 }, up, { widths });
  const apart = placePads(close, { 1: 0.2, 2: 0.5, 3: 0.8 }, up, { widths });
  near(rect(apart, 1).w, 0.27); near(rect(apart, 2).w, 0.27);
  const stuck = placePads(close, { 1: 0.2, 2: 0.5, 3: 0.8 }, up); // with no normal width the narrow pads stay narrow
  assert.ok(rect(stuck, 1).w < 0.27);
});

test("placePads: works with a single pad and with four", () => {
  const one = placePads(makeLayout({ seats: 1 }), { 1: 0.3 }, up);
  near(centre(one, 1), 0.3 < rect(one, 1).w / 2 ? rect(one, 1).w / 2 : 0.3);
  const four = placePads(makeLayout({ seats: 4 }), { 1: 0.1, 2: 0.35, 3: 0.6, 4: 0.85 }, up);
  noOverlap(four, PAD_GAP - 1e-9); inside(four);
});

test("easeLayout: moves each pad toward its target no faster than the rate, and arrives", () => {
  const target = placePads(layout3, { 1: 0.3, 2: 0.5, 3: 0.8 }, up);
  const dist = centre(target, 1) - centre(layout3, 1); // pad 1 has a way to go
  const step = easeLayout(layout3, target, 1000);
  near(rect(step, 1).u - layout3.spots[0].rect.u, Math.min(dist, EASE_RATE));
  assert.ok(Math.abs(rect(step, 1).u - rect(layout3, 1).u) <= EASE_RATE + 1e-9);
  const half = easeLayout(layout3, target, 500);
  near(rect(half, 1).u - rect(layout3, 1).u, EASE_RATE / 2);
  let l = layout3;
  for (let i = 0; i < 100; i++) l = easeLayout(l, target, 200);
  for (const s of l.spots) assert.ok(Math.abs(s.rect.u - rect(target, s.id).u) < EASE_DEAD);
  noOverlap(l);
});

test("easeLayout: a pad already close to its target does not move at all, and no time is no move", () => {
  const near1 = { ...layout3, spots: layout3.spots.map((s) => ({ ...s, rect: { ...s.rect, u: s.rect.u + EASE_DEAD * 0.9 } })) };
  assert.deepEqual(easeLayout(layout3, near1, 1000).spots, layout3.spots);
  const far = placePads(layout3, { 1: 0.9, 2: 0.5, 3: 0.1 }, up);
  assert.deepEqual(easeLayout(layout3, far, 0).spots, layout3.spots);
  assert.deepEqual(easeLayout(layout3, far, -50).spots, layout3.spots);
});

test("easeLayout: pads keep their order and do not overlap on the way", () => {
  const target = placePads(layout3, { 1: 0.8, 2: 0.82, 3: 0.84 }, up); // everyone crowds to the right
  let l = layout3;
  for (let i = 0; i < 60; i++) {
    l = easeLayout(l, target, 200);
    noOverlap(l); inside(l);
    assert.deepEqual(sorted(l).map((s) => s.id), [1, 2, 3]);
  }
});

test("easeLayout: height and v never change", () => {
  const out = easeLayout(layout3, placePads(layout3, { 1: 0.7, 2: 0.2, 3: 0.4 }, up), 1000);
  out.spots.forEach((s, i) => { assert.equal(s.rect.v, layout3.spots[i].rect.v); assert.equal(s.rect.h, layout3.spots[i].rect.h); });
});

test("usableMap: a map made with the picture turned the other way is not used", () => {
  assert.equal(usableMap({ a: 0, b: 1, facing: false }, false)?.b, 1);
  assert.equal(usableMap({ a: 0, b: 1, facing: false }, true), null);
  assert.equal(usableMap({ a: 1, b: -1, facing: true }, true)?.b, -1);
  assert.equal(usableMap(null, false), null);
});

test("saved map: round trip, and bad data reads as no map", () => {
  const store = (() => { const d = {}; return { getItem: (k) => d[k] ?? null, setItem: (k, v) => { d[k] = v; } }; })();
  assert.equal(loadMap(store), null);
  saveMap({ a: 0.1, b: -2 }, true, store);
  assert.deepEqual(loadMap(store), { a: 0.1, b: -2, facing: true });
  store.setItem("pp:floor-map", "not json");
  assert.equal(loadMap(store), null);
  store.setItem("pp:floor-map", JSON.stringify({ a: 1, b: 0 }));
  assert.equal(loadMap(store), null); // a flat line maps every foot to one place
});

// The follower, on a fake clock.
function follow({ layout = layout3, x = { 1: 0.2, 2: 0.5, 3: 0.8 }, moveOk = true, map = up, on = true } = {}) {
  let t = 0, lay = layout, refuse = false, calls = 0;
  const f = createFollower({
    feetX: () => x, getLayout: () => lay, canMove: () => moveOk, now: () => t,
    setLayout: (l) => { calls++; if (refuse) return false; lay = l; return true; }, map: () => map, on: () => on,
  });
  return { run(ms) { for (let i = 0; i < ms / 200; i++) { t += 200; f.tick(); } }, layout: () => lay, setX: (v) => { x = v; }, refuse: (v) => { refuse = v; }, calls: () => calls };
}

test("follower: moves the pads to the people over a few seconds, in small steps", () => {
  const s = follow({ x: { 1: 0.3, 2: 0.5, 3: 0.8 } });
  s.run(200);
  assert.ok(Math.abs(rect(s.layout(), 1).u - layout3.spots[0].rect.u) <= EASE_RATE * 0.2 + 1e-9, "one tick is a small step");
  s.run(10000);
  near(centre(s.layout(), 1), 0.3, EASE_DEAD);
  noOverlap(s.layout());
});

test("follower: never moves when canMove is false, there is no map, or following is off", () => {
  for (const opts of [{ moveOk: false }, { map: null }, { on: false }]) {
    const s = follow({ ...opts, x: { 1: 0.4, 2: 0.5, 3: 0.6 } });
    s.run(5000);
    assert.equal(s.calls(), 0);
    assert.deepEqual(s.layout().spots, layout3.spots);
  }
});

test("follower: a layout the session refuses does not break it, and it tries again", () => {
  const s = follow({ x: { 1: 0.3, 2: 0.5, 3: 0.8 } });
  s.refuse(true);
  s.run(1000);
  assert.deepEqual(s.layout().spots, layout3.spots);
  s.refuse(false);
  s.run(10000);
  near(centre(s.layout(), 1), 0.3, EASE_DEAD);
});

test("follower: one frame with a foot lost does not jerk the pad (the middle value of the last second)", () => {
  const s = follow();
  s.run(10000);
  const before = rect(s.layout(), 2).u;
  s.setX({ 1: 0.2, 2: 0.8, 3: 0.8 }); // one wild sample
  s.run(200);
  s.setX({ 1: 0.2, 2: 0.5, 3: 0.8 });
  s.run(2000);
  near(rect(s.layout(), 2).u, before, 0.01);
});

test("follower: people who walk close make the pads narrow, and walking apart widens them again", () => {
  const s = follow();
  s.run(10000);
  s.setX({ 1: 0.4, 2: 0.55, 3: 0.9 });
  s.run(15000);
  assert.ok(rect(s.layout(), 1).w < 0.27 - 0.02);
  s.setX({ 1: 0.2, 2: 0.5, 3: 0.8 });
  s.run(15000);
  near(rect(s.layout(), 1).w, 0.27, 0.03);
});
