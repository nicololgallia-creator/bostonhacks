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
