// Pads that follow the people. The camera cannot know where the projector's picture lands on the floor, so one short
// calibration (two taps on two marks) gives a line map from the camera's x to the floor's u: u = a + b * x.
// The map's own slope carries the mirror (the projector and camera stand across from the players, see facing.js), so
// nothing here asks isFacing() except to check that a saved map was made the way the picture is turned now.
import { isFacing } from "../facing.js";

export const MAP_KEY = "pp:floor-map"; // { a, b, facing }
export const FOLLOW_KEY = "pp:floor-follow"; // false when the operator turned following off (on by default once a map exists)
export const MARK_U = [0.2, 0.8]; // where the two calibration marks sit on the floor
export const MIN_SPREAD = 0.05; // the two taps must be this far apart in the camera's x, or the line is a guess
export const PAD_GAP = 0.02; // empty floor between two pads that were pressed together (a guess)
export const PAD_MIN_W = 0.1; // the narrowest a pad gets when two people sit close (the same floor as setup's smallest pad)
export const EASE_RATE = 0.05; // the most a pad edge moves, in shares of the picture a second (a guess)
export const EASE_DEAD = 0.015; // an edge this close to where it should be does not move, so a still person does not make a pad shake
const TICK_MS = 150; // how often the follower looks (the stage's timer fires every 200 ms, setup's frame loop faster)
const WINDOW_MS = 1000; // a seat's feet are the middle value of what was seen this long, so one lost foot does not jerk the pad
const MAX_DT = 500; // a long gap (a hidden tab) moves the pads no further than this long a gap would

const clamp01 = (x) => Math.min(1, Math.max(0, x));
const median = (xs) => { const s = [...xs].sort((p, q) => p - q); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };

// The least-squares line u = a + b * x through two or more { x, u } points. Throws a sentence when the points cannot make a line.
export function fitMap(points) {
  const p = (points ?? []).filter((q) => Number.isFinite(q?.x) && Number.isFinite(q?.u));
  if (p.length < 2) throw new Error("The map needs two taps, one on each mark.");
  const xs = p.map((q) => q.x), us = p.map((q) => q.u);
  if (Math.max(...xs) - Math.min(...xs) < MIN_SPREAD) throw new Error("Both taps landed in nearly the same place in the camera picture. Move your foot to the other mark and tap again.");
  if (Math.max(...us) - Math.min(...us) < MIN_SPREAD) throw new Error("Both marks are in the same place on the floor, so there is nothing to map.");
  const mx = xs.reduce((s, x) => s + x, 0) / p.length, mu = us.reduce((s, u) => s + u, 0) / p.length;
  const b = p.reduce((s, q) => s + (q.x - mx) * (q.u - mu), 0) / p.reduce((s, q) => s + (q.x - mx) ** 2, 0);
  return { a: mu - b * mx, b };
}

// Pads left to right as { l, w }: pushed right and then back left until none overlaps another (by `gap`) and all lie inside 0 to 1.
// They keep their widths and their order. Changes the objects it is given.
function separate(pads, gap) {
  let edge = 0;
  for (const p of pads) { p.l = Math.max(p.l, edge); edge = p.l + p.w + gap; }
  let limit = 1;
  for (let i = pads.length - 1; i >= 0; i--) { pads[i].l = Math.min(pads[i].l, limit - pads[i].w); limit = pads[i].l - gap; }
}

// A new layout where each seat's pad is centred on map(that seat's feet). `feetX` is { [spotId]: camera x, or null when the seat's
// feet are not seen }: a seat with no feet keeps its place. Pads keep their order on the floor and never overlap: two people closer
// than a pad is wide make both pads narrow to meet half way (down to `minW`), and stay inside 0 to 1. `widths` is { [spotId]: the pad's
// normal width }, which a pad grows back to once there is room; without it each pad's width now is its normal one. Height and v stay.
export function placePads(layout, feetX, map, { gap = PAD_GAP, minW = PAD_MIN_W, widths = {} } = {}) {
  const pads = [...layout.spots].sort((p, q) => p.rect.u - q.rect.u).map(({ id, rect }) => {
    const x = feetX[id];
    const w = Math.min(1, widths[id] ?? rect.w);
    return { id, w, c: Number.isFinite(x) ? clamp01(map.a + map.b * x) : rect.u + rect.w / 2, half: w / 2 };
  });
  pads.forEach((p, i) => {
    for (const q of [pads[i - 1], pads[i + 1]]) if (q) p.half = Math.min(p.half, (Math.abs(q.c - p.c) - gap) / 2);
    p.half = Math.max(p.half, Math.min(minW, p.w) / 2);
    p.l = p.c - p.half;
    p.w = 2 * p.half;
  });
  separate(pads, gap);
  const placed = Object.fromEntries(pads.map((p) => [p.id, p]));
  return { ...layout, spots: layout.spots.map((s) => ({ ...s, rect: { ...s.rect, u: placed[s.id].l, w: placed[s.id].w } })) };
}

// One step from `current` toward `target`: each pad edge moves at most EASE_RATE of the picture a second, and not at all while it
// is within EASE_DEAD of where it should be. Pads still never overlap. A pad the target does not name stays.
export function easeLayout(current, target, dtMs) {
  const room = (EASE_RATE * Math.max(0, dtMs)) / 1000;
  const step = (from, to) => (Math.abs(to - from) < EASE_DEAD ? from : from + Math.sign(to - from) * Math.min(Math.abs(to - from), room));
  const pads = current.spots.map(({ id, rect }) => {
    const t = target.spots.find((s) => s.id === id)?.rect ?? rect;
    const l = step(rect.u, t.u), r = step(rect.u + rect.w, t.u + t.w);
    return { id, l, w: r - l };
  }).sort((p, q) => p.l - q.l);
  separate(pads, 0);
  const placed = Object.fromEntries(pads.map((p) => [p.id, p]));
  return { ...current, spots: current.spots.map((s) => ({ ...s, rect: { ...s.rect, u: placed[s.id].l, w: placed[s.id].w } })) };
}

// ---- The saved map and the switch ----
export function loadMap(storage = localStorage) {
  try {
    const m = JSON.parse(storage.getItem(MAP_KEY));
    return Number.isFinite(m?.a) && Number.isFinite(m?.b) && m.b !== 0 ? { a: m.a, b: m.b, facing: !!m.facing } : null;
  } catch { return null; }
}
export const saveMap = (map, facing = isFacing(), storage = localStorage) => storage.setItem(MAP_KEY, JSON.stringify({ a: map.a, b: map.b, facing }));
export const isFollowing = (storage = localStorage) => { try { return JSON.parse(storage.getItem(FOLLOW_KEY)) !== false; } catch { return true; } };
export const setFollowing = (on, storage = localStorage) => storage.setItem(FOLLOW_KEY, JSON.stringify(on));
// The map to use now: the saved one, only if it was made with the picture turned the way it is turned now (else it would be backwards).
export const usableMap = (map = loadMap(), facing = isFacing()) => (map && map.facing === facing ? map : null);

// Keeps the pads at the people's feet. Call tick() often (a timer or the setup's frame); it looks every TICK_MS.
//   feetX()      { [spotId]: camera x or null }, the middle of each seat's feet now (seatsource.feetX)
//   getLayout()  the layout now
//   setLayout(l) applies a layout; returns false when it is refused (a song is playing)
//   canMove()    false while pads must stay put (a song, or someone placing them by hand)
export function createFollower({ feetX, getLayout, setLayout, canMove, now = () => performance.now(), map = usableMap, on = isFollowing }) {
  let last = now();
  let natural = {}; // each pad's normal width, taken whenever the layout is one this follower did not make
  let applied = "";
  let seen = {}; // { [spotId]: [{ t, x }] }
  const key = (l) => JSON.stringify(l.spots.map((s) => [s.id, s.rect.u, s.rect.w]));
  return {
    tick() {
      const t = now();
      if (t - last < TICK_MS) return;
      const dt = Math.min(t - last, MAX_DT);
      last = t;
      const m = map();
      if (!m || !on() || !canMove()) { seen = {}; return; }
      const xs = {};
      for (const [id, x] of Object.entries(feetX())) {
        seen[id] = (seen[id] ?? []).filter((p) => t - p.t < WINDOW_MS);
        if (Number.isFinite(x)) seen[id].push({ t, x });
        xs[id] = seen[id].length ? median(seen[id].map((p) => p.x)) : null;
      }
      const layout = getLayout();
      if (key(layout) !== applied) natural = Object.fromEntries(layout.spots.map((s) => [s.id, s.rect.w]));
      const next = easeLayout(layout, placePads(layout, xs, m, { widths: natural }), dt);
      if (key(next) !== key(layout) && setLayout(next) !== false) applied = key(next);
    },
  };
}
