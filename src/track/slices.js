// Where the camera picture is cut for each seat. One list of n + 1 dividers across the picture (shares of its width, 0 to 1,
// rising): the outer edges and every divider between two seats, each dragged on its own on seats.html and saved for that
// seat count. With none saved, the span between the old outer-edge keys is split evenly, as before.
export const EDGES_KEY = "seats:edges"; // the old keys: { l, r }
export const slicesKey = (n) => `seats:slices:${n}`; // [b0, b1, ... bn]
export const MIN_WIDTH = 0.12; // the smallest span the outer edges may close to
export const MIN_SLICE = 0.06; // the narrowest one seat may be, a share of the picture's width

const validEdges = (e) => e && e.l >= 0 && e.r <= 1 && e.r - e.l >= MIN_WIDTH;

export function equalBounds(n, edges) {
  const { l, r } = validEdges(edges) ? edges : { l: 0, r: 1 };
  return Array.from({ length: n + 1 }, (_, i) => l + ((r - l) * i) / n);
}

// The dividers for n seats: the saved list when it fits, else an even split. Neither bad edges nor a bad list can break it.
export function boundsFor(n, edges, bounds) {
  const ok = Array.isArray(bounds) && bounds.length === n + 1
    && bounds.every((b, i) => Number.isFinite(b) && b >= 0 && b <= 1 && (i === 0 || b - bounds[i - 1] >= MIN_SLICE - 1e-9));
  return ok ? bounds : equalBounds(n, edges);
}

// Moves divider `i`, kept between its neighbours with room for a narrowest seat on each side. Returns a new list.
export function moveBound(bounds, i, x) {
  const lo = i === 0 ? 0 : bounds[i - 1] + MIN_SLICE, hi = i === bounds.length - 1 ? 1 : bounds[i + 1] - MIN_SLICE;
  return bounds.map((b, k) => (k === i ? Math.min(hi, Math.max(lo, x)) : b));
}

// ---- Fitting the dividers to the people ----
export const LONE_HALF = 0.15; // a lone person's slice reaches this far each side of the hips (a guess: a seated person spans about 0.07 each side of the hips, and the crop adds more)
export const OUTER_MIN = 0.08; // an outer edge sits at least this far beyond the outer hips, so the outer person's feet stay inside (a guess)
export const FOLLOW_RATE = 0.02; // the most a divider moves, in shares of the picture a second
export const FOLLOW_DEAD = 0.01; // a divider that is this close to its fit does not move

// The n + 1 dividers for n seats from where each person's hips are, left to right (`hipXs[i]` is seat i's, null when not seen).
// A divider between two seen people sits half way between their hips. An outer edge sits beyond the outer hips by half the gap to the
// neighbour (at least OUTER_MIN), or LONE_HALF for a lone person. A divider next to a missing person keeps its `current` place.
// A hip that does not rise past the one before it is the same person seen twice: it counts as missing. Dividers stay in 0 to 1, each
// seat at least `minSlice` wide, and never cross a seen person's hips.
export function fitBounds(hipXs, { n = hipXs.length, minSlice = MIN_SLICE, current = equalBounds(n) } = {}) {
  const hip = seenHips(hipXs, n);
  const out = current.slice(0, n + 1);
  for (let i = 1; i < n; i++) if (hip[i - 1] !== null && hip[i] !== null) out[i] = (hip[i - 1] + hip[i]) / 2;
  if (hip[0] !== null) out[0] = hip[0] - margin(hip[1] === null ? null : hip[1] - hip[0], n);
  if (hip[n - 1] !== null) out[n] = hip[n - 1] + margin(n > 1 && hip[n - 2] !== null ? hip[n - 1] - hip[n - 2] : null, n);
  return keepApart(out, hip, minSlice);
}

// How far an outer edge sits beyond its outer person: half the gap to the neighbour, at least OUTER_MIN. A lone person gets
// LONE_HALF. A neighbour that is not seen gives OUTER_MIN.
const margin = (gap, n) => (Number.isFinite(gap) ? Math.max(OUTER_MIN, gap / 2) : n === 1 ? LONE_HALF : OUTER_MIN);

// The hips that count: a hip that does not rise past the one before it is the same person seen twice, so it counts as missing.
export function seenHips(hipXs, n = hipXs.length) {
  let last = -Infinity;
  return Array.from({ length: n }, (_, i) => {
    const h = hipXs[i];
    if (!Number.isFinite(h) || h <= last) return null;
    return (last = h);
  });
}

// Hands people found in the whole picture (hips, sorted) to seats. With one person for each seat, left to right. With fewer, each person
// goes to the seat whose slice in `current` is nearest, and the other seats get null (their dividers stay). Returns n hips or nulls.
export function assignHips(found, current) {
  const n = current.length - 1;
  if (found.length >= n) return found.slice(0, n);
  const out = Array(n).fill(null);
  for (const h of found) {
    let best = -1;
    for (let i = 0; i < n; i++) if (out[i] === null && (best < 0 || Math.abs(h - (current[i] + current[i + 1]) / 2) < Math.abs(h - (current[best] + current[best + 1]) / 2))) best = i;
    out[best] = h;
  }
  return out;
}

// Inside 0 to 1, rising by at least `minSlice`, and no divider past a seen person's hips.
function keepApart(b, hip, minSlice) {
  const n = b.length - 1;
  b = b.map((x) => Math.min(1, Math.max(0, x)));
  b.forEach((x, i) => { // the divider i lies between seat i - 1 and seat i
    if (i > 0 && hip[i - 1] !== null) b[i] = Math.max(b[i], hip[i - 1]);
    if (i < n && hip[i] !== null) b[i] = Math.min(b[i], hip[i]);
  });
  for (let i = 1; i <= n; i++) b[i] = Math.max(b[i], b[i - 1] + minSlice);
  b[n] = Math.min(b[n], 1);
  for (let i = n - 1; i >= 0; i--) b[i] = Math.min(b[i], b[i + 1] - minSlice);
  b[0] = Math.max(0, b[0]);
  return b;
}

// One step of following. Each divider moves toward its fit by at most FOLLOW_RATE a second, and not at all while within FOLLOW_DEAD.
// Returns the new list, or null when nothing moved.
export function easeBounds(current, target, dtMs, hipXs = [], minSlice = MIN_SLICE) {
  const room = (FOLLOW_RATE * Math.max(0, dtMs)) / 1000;
  let moved = false;
  const next = current.map((b, i) => {
    const d = target[i] - b;
    if (Math.abs(d) < FOLLOW_DEAD) return b;
    moved = true;
    return b + Math.sign(d) * Math.min(Math.abs(d), room);
  });
  return moved ? keepApart(next, seenHips(hipXs, current.length - 1), minSlice) : null;
}

export function readSaved(n, storage = localStorage) {
  const get = (key) => { try { return JSON.parse(storage.getItem(key)); } catch { return null; } };
  return boundsFor(n, get(EDGES_KEY), get(slicesKey(n)));
}

// Saves the dividers for this seat count, and keeps the old outer-edge key in step so older readers still see them.
export function writeSaved(bounds, storage = localStorage) {
  const n = bounds.length - 1;
  storage.setItem(slicesKey(n), JSON.stringify(bounds));
  storage.setItem(EDGES_KEY, JSON.stringify({ l: bounds[0], r: bounds[n] }));
}
