// Counts the taps the detector finds on the two-person recording for a grid of liftRatio and minLift (one lane a seat), against
// the targets: rest 5-22 s 0 taps, tapping 22-39.6 s seat 1 27-35, seat 2 36-44, seat 1 alone 40.7-42.2 s 0.
// node qa/seats/sweep-taps.mjs qa/seats/real-two-1.json
import { readFileSync } from "node:fs";
import { createTapDetector } from "../../src/track/taps.js";
const rec = JSON.parse(readFileSync(process.argv[2], "utf8"));
const lanes = Object.fromEntries(rec.slices.map((s) => [s.spotId, 1]));
for (const liftRatio of [0.04, 0.05, 0.055, 0.06, 0.065, 0.07]) {
  for (const minLift of [0.01, 0.012, 0.014]) {
    const det = createTapDetector({ liftRatio, minLift });
    const taps = [];
    for (const fr of rec.frames) taps.push(...det.update(fr.t, fr.seats.flatMap((s) => s.feet.map((f) => ({ spotId: s.spotId, ...f }))), lanes).taps);
    const n = (id, a, b) => taps.filter((x) => x.spotId === id && x.atMs >= a && x.atMs < b).length;
    console.log(`liftRatio ${liftRatio} minLift ${minLift}: rest ${n(1, 5000, 22000)}/${n(2, 5000, 22000)}, tapping seat 1 ${n(1, 22000, 39600)} seat 2 ${n(2, 22000, 39600)}, seat 1 alone ${n(1, 40700, 42200)}`);
  }
}
