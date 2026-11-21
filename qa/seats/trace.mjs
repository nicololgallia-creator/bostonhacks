// Prints one seat's feet frame by frame with what the detector thinks. node qa/seats/trace.mjs file seat fromMs toMs
import { readFileSync } from "node:fs";
import { createTapDetector } from "../../src/track/taps.js";
const [file, seat, from, to] = process.argv.slice(2);
const rec = JSON.parse(readFileSync(file, "utf8"));
const det = createTapDetector();
const lanes = Object.fromEntries(rec.slices.map((s) => [s.spotId, 1]));
for (const fr of rec.frames) {
  const feet = fr.seats.flatMap((s) => s.feet.map((f) => ({ spotId: s.spotId, ...f })));
  const r = det.update(fr.t, feet, lanes);
  if (fr.t < from || fr.t > to) continue;
  const s = fr.seats.find((x) => x.spotId == seat);
  const ys = s.feet.sort((a, b) => a.x - b.x).map((f) => `${f.x.toFixed(3)},${f.y.toFixed(4)}`).join("  ");
  const d = r.debug.find((x) => x.spotId == seat);
  const f = r.feet.find((x) => x.spotId == seat);
  const tap = r.taps.some((x) => x.spotId == seat) ? " TAP" : "";
  console.log(`${(fr.t / 1000).toFixed(2)}  ${ys.padEnd(30)} g ${d?.ground.toFixed(4)} th ${d?.threshold.toFixed(4)} ${f?.lifted ? "UP" : "  "}${tap}`);
}
