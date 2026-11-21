// Clean-up and mapping for camera feet: steps 3 and 4 of "The tracker, step by step" in docs/HOW-IT-WORKS.md.
// update(nowMs, cameraFeet) takes feet from src/track/camera.js ([{ x, y, person }]) and returns
// field feet [{ u, v }] in a stable order, one per tracked foot. Pure logic, no browser calls.
import { apply } from "./homography.js";

const MATCH_DISTANCE = 0.2; // a fifth of the camera picture
const FAR = 0.5; // half a field beyond any edge

// smoothing is the share of the old position kept: 0 follows the camera exactly, 0.5 moves halfway to each new reading.
// A foot may carry a `confidence` from 0 to 1; those below minConfidence are thrown away. Feet without one are kept.
// Feet are matched by distance only. The `person` number is ignored, because the model can renumber people between frames.
export function createPipeline({ cameraToField, smoothing = 0.5, holdMs = 150, minConfidence = 0.5 }) {
  let matrix = cameraToField;
  let tracked = []; // { x, y, seen } in camera coordinates, so a new matrix needs no change here

  function update(nowMs, cameraFeet) {
    const fresh = (Array.isArray(cameraFeet) ? cameraFeet : []).filter((f) =>
      f && Number.isFinite(f.x) && Number.isFinite(f.y) && !(f.confidence < minConfidence));

    // Pair each new foot with a tracked foot, closest pairs first, each foot used once.
    const pairs = [];
    fresh.forEach((f, i) => tracked.forEach((t, j) => {
      const d = Math.hypot(f.x - t.x, f.y - t.y);
      if (d <= MATCH_DISTANCE) pairs.push({ i, j, d });
    }));
    pairs.sort((a, b) => a.d - b.d);
    const newFor = new Map(); // tracked index -> new foot index
    const used = new Set();
    for (const { i, j } of pairs) {
      if (newFor.has(j) || used.has(i)) continue;
      newFor.set(j, i);
      used.add(i);
    }

    tracked.forEach((t, j) => {
      if (!newFor.has(j)) return;
      const f = fresh[newFor.get(j)];
      t.x = t.x * smoothing + f.x * (1 - smoothing);
      t.y = t.y * smoothing + f.y * (1 - smoothing);
      t.seen = nowMs;
    });
    fresh.forEach((f, i) => { if (!used.has(i)) tracked.push({ x: f.x, y: f.y, seen: nowMs }); });
    tracked = tracked.filter((t) => nowMs - t.seen <= holdMs);

    return tracked.flatMap((t) => {
      const p = apply(matrix, t);
      const inside = p && p.x >= -FAR && p.x <= 1 + FAR && p.y >= -FAR && p.y <= 1 + FAR;
      return inside ? [{ u: p.x, v: p.y }] : [];
    });
  }

  return { update, setMatrix(m) { matrix = m; } };
}
