// Taps per seat and per foot name with TWO lanes a seat (each foot its own track), on a seats recording.
// node qa/seats/two-lanes-count.mjs qa/seats/real-two-1.json
import { readFileSync } from "node:fs";
import { createTapDetector } from "../../src/track/taps.js";
const rec = JSON.parse(readFileSync(process.argv[2], "utf8"));
const det = createTapDetector(), taps = [];
for (const fr of rec.frames) taps.push(...det.update(fr.t, fr.seats.flatMap((s) => s.feet.map((f) => ({ spotId: s.spotId, ...f }))), {}).taps);
for (const s of rec.slices) for (const foot of [0, 1]) {
  const n = (a, b) => taps.filter((x) => x.spotId === s.spotId && x.foot === foot && x.atMs >= a && x.atMs < b).length;
  console.log(`seat ${s.spotId} foot ${foot}: tapping 22-39.6 s ${n(22000, 39600)}, rest 5-22 s ${n(5000, 22000)}, before 5 s ${n(0, 5000)}`);
}
