// Seats on the field, with no browser calls. Rules are in PLAN.md under "Seats and session".
// Field coordinates: u 0 (left) to 1 (right), v 0 (far edge) to 1 (the players' edge).
export const MAX_SEATS = 4;
const LANES = { seated: 3, standing: 4 };
export const postures = Object.keys(LANES);
const EDGE = 0.04; // empty space at the left and right of the field
const GAP = 0.04; // between two pads
const TOP = 0.1;
const BOTTOM = 0.96;
const MARGIN = 0.1; // a foot this far (as a share of the pad's size) outside a pad still counts as in it

export function lanesFor(posture) {
  if (!postures.includes(posture)) throw new Error(`Posture must be "seated" or "standing", not "${posture}".`);
  return LANES[posture];
}

const round = (x) => Math.round(x * 1e4) / 1e4;

// 1 to 4 pads side by side, even gaps, filling the field's width.
export function makeLayout({ posture, seats }) {
  const lanes = lanesFor(posture);
  if (!Number.isInteger(seats) || seats < 1 || seats > MAX_SEATS) {
    throw new Error(`Seats must be a whole number from 1 to ${MAX_SEATS}.`);
  }
  const w = (1 - 2 * EDGE - (seats - 1) * GAP) / seats;
  const spots = Array.from({ length: seats }, (_, i) => ({
    id: i + 1,
    rect: { u: round(EDGE + i * (w + GAP)), v: TOP, w: round(w), h: round(BOTTOM - TOP) },
  }));
  return { posture, lanes, spots };
}

// True when x can be used as a layout. Guards a layout read back from storage.
export function isLayout(x) {
  if (!x || typeof x !== "object" || !postures.includes(x.posture) || x.lanes !== LANES[x.posture]) return false;
  const { spots } = x;
  if (!Array.isArray(spots) || spots.length < 1 || spots.length > MAX_SEATS) return false;
  const ok = (n) => typeof n === "number" && Number.isFinite(n);
  return spots.every((s, i) => s && Number.isInteger(s.id) && spots.findIndex((o) => o.id === s.id) === i
    && s.rect && ok(s.rect.u) && ok(s.rect.v) && ok(s.rect.w) && ok(s.rect.h) && s.rect.w > 0 && s.rect.h > 0);
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
