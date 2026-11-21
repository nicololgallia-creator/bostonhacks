// Runs a seats.html recording through the tap detector and prints what it finds.
// node qa/seats/replay-taps.mjs qa/seats/real-two-1.json [lanesPerSeat=1] [key=value ...]
import { readFileSync } from "node:fs";
import { createTapDetector } from "../../src/track/taps.js";
const [file, lanesArg = "1", ...opts] = process.argv.slice(2);
const options = Object.fromEntries(opts.map((o) => o.split("=")).map(([k, v]) => [k, Number(v)]));
const rec = JSON.parse(readFileSync(file, "utf8"));
const det = createTapDetector(options);
const lanes = Object.fromEntries(rec.slices.map((s) => [s.spotId, Number(lanesArg)]));
const taps = [], dbg = [];
let liftedFrames = {}, frames = 0;
for (const fr of rec.frames) {
  const feet = fr.seats.flatMap((s) => s.feet.map((f) => ({ spotId: s.spotId, ...f })));
  const r = det.update(fr.t, feet, lanes);
  taps.push(...r.taps);
  for (const d of r.debug) dbg.push({ t: fr.t, ...d });
  for (const f of r.feet) if (f.lifted) liftedFrames[`${f.spotId}:${f.foot}:${Math.floor(fr.t / 1000)}`] = 1;
  frames++;
}
const last = rec.frames.at(-1).t;
console.log(`${frames} frames, ${(last / 1000).toFixed(1)} s, ${(frames / (last / 1000)).toFixed(1)} fps, options ${JSON.stringify(options)}`);
for (const s of rec.slices) {
  const mine = taps.filter((x) => x.spotId === s.spotId);
  const row = [];
  for (let sec = 0; sec <= last / 1000; sec++) row.push(mine.filter((x) => Math.floor(x.atMs / 1000) === sec).length);
  console.log(`seat ${s.spotId}: ${mine.length} taps. per second: ${row.join("")}`);
  const d = dbg.filter((x) => x.spotId === s.spotId && x.t > 5000 && x.t < 22000);
  const mid = (xs) => xs.length ? [...xs].sort((a, b) => a - b)[xs.length >> 1].toFixed(4) : "-";
  console.log(`   at rest 5-22 s: shake median ${mid(d.map((x) => x.shake))}, threshold median ${mid(d.map((x) => x.threshold))}, max ${Math.max(...d.map((x) => x.threshold)).toFixed(4)}`);
  console.log(`   tap times (s): ${mine.map((x) => (x.atMs / 1000).toFixed(1)).join(" ")}`);
}
