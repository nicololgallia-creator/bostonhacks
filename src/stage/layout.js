// Seats on the field, with no browser calls. Rules are in PLAN.md under "Seats and session" and "Wave 3b".
// Field coordinates: u 0 (left) to 1 (right), v 0 (far edge) to 1 (the players' edge).
export const MAX_SEATS = 4;
export const LANES = 1; // every seat is one lane, so four seats make four lanes at most
const EDGE = 0.04; // empty space at the left and right of the field
const GAP = 0.04; // between two pads
const TOP = 0.1;
const BOTTOM = 0.96;
const MARGIN = 0.1; // a foot this far (as a share of the pad's size) outside a pad still counts as in it

const round = (x) => Math.round(x * 1e4) / 1e4;

// 1 to 4 pads side by side, even gaps, filling the field's width.
export function makeLayout({ seats }) {
  if (!Number.isInteger(seats) || seats < 1 || seats > MAX_SEATS) {
    throw new Error(`Seats must be a whole number from 1 to ${MAX_SEATS}.`);
  }
  const w = (1 - 2 * EDGE - (seats - 1) * GAP) / seats;
  const spots = Array.from({ length: seats }, (_, i) => ({
    id: i + 1,
    rect: { u: round(EDGE + i * (w + GAP)), v: TOP, w: round(w), h: round(BOTTOM - TOP) },
  }));
  return { lanes: LANES, spots };
}

// A layout read back from storage or from setup, as a clean copy with 2 lanes, or null when its pads are broken.
// An older saved layout that still carries a posture or 3 or 4 lanes loads as 2 lanes with the same pads.
export function asLayout(x) {
  const spots = x && typeof x === "object" ? x.spots : null;
  if (!Array.isArray(spots) || spots.length < 1 || spots.length > MAX_SEATS) return null;
  const ok = (n) => typeof n === "number" && Number.isFinite(n);
  const good = spots.every((s, i) => s && Number.isInteger(s.id) && spots.findIndex((o) => o.id === s.id) === i
    && s.rect && ok(s.rect.u) && ok(s.rect.v) && ok(s.rect.w) && ok(s.rect.h) && s.rect.w > 0 && s.rect.h > 0);
  if (!good) return null;
  return { lanes: LANES, spots: spots.map(({ id, rect: { u, v, w, h } }) => ({ id, rect: { u, v, w, h } })) };
}

const clamp01 = (x) => Math.min(1, Math.max(0, x));

// Field feet in, each spot's feet out in that pad's own coordinates: { [spotId]: [{ u, v }] }.
// A foot belongs to a pad when it is inside it or within a tenth of the pad's size outside it.
// A foot in two pads' margins goes to the nearer centre. Edge feet are pulled onto the pad's edge.
export function feetBySpot(layout, feet) {
  const out = Object.fromEntries(layout.spots.map((s) => [s.id, []]));
  for (const f of feet) {
    let best = null;
    let bestDistance = Infinity;
    for (const spot of layout.spots) {
      const r = spot.rect;
      const inside = f.u >= r.u - MARGIN * r.w && f.u <= r.u + r.w * (1 + MARGIN)
        && f.v >= r.v - MARGIN * r.h && f.v <= r.v + r.h * (1 + MARGIN);
      const distance = Math.hypot(f.u - (r.u + r.w / 2), f.v - (r.v + r.h / 2));
      if (inside && distance < bestDistance) { best = spot; bestDistance = distance; }
    }
    if (best) out[best.id].push({ u: clamp01((f.u - best.rect.u) / best.rect.w), v: clamp01((f.v - best.rect.v) / best.rect.h) });
  }
  return out;
}
