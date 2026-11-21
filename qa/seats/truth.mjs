// A rough count of real lifts in a seats recording, to judge the detector against: each foot by its place in the picture
// (left or right), its height against its own running middle value, a lift is two frames in a row higher by `min`.
// node qa/seats/truth.mjs file [min=0.012]
import { readFileSync } from "node:fs";
const [file, minArg = "0.012"] = process.argv.slice(2);
const min = Number(minArg);
const rec = JSON.parse(readFileSync(file, "utf8"));
const med = (xs) => [...xs].sort((a, b) => a - b)[xs.length >> 1];
for (const s of rec.slices) {
  for (const side of [0, 1]) {
    const pts = [];
    for (const fr of rec.frames) {
      const feet = [...fr.seats.find((x) => x.spotId === s.spotId).feet].sort((a, b) => a.x - b.x);
      if (feet.length === 2 && feet[1].x - feet[0].x > 0.02) pts.push({ t: fr.t, y: feet[side].y });
    }
    const lifts = [];
    let run = 0, start = 0, peak = 0;
    pts.forEach((p, i) => {
      const win = pts.filter((q) => Math.abs(q.t - p.t) < 1500).map((q) => q.y);
      const up = med(win) - p.y;
      if (up > min) { if (!run) start = p.t; run++; peak = Math.max(peak, up); }
      else { if (run >= 2) lifts.push({ t: start, peak }); run = 0; peak = 0; }
    });
    const inRest = lifts.filter((l) => l.t > 5000 && l.t < 22000), inTap = lifts.filter((l) => l.t >= 22000 && l.t < 39600);
    console.log(`seat ${s.spotId} ${side ? "right" : "left "} foot: rest 5-22 s ${inRest.length} lifts, tapping 22-39.6 s ${inTap.length} lifts, peaks median ${med(inTap.map((l) => l.peak))?.toFixed(3)} smallest ${Math.min(...inTap.map((l) => l.peak)).toFixed(3)}`);
    console.log(`   ${inTap.map((l) => (l.t / 1000).toFixed(1)).join(" ")}`);
    if (inRest.length) console.log(`   rest: ${inRest.map((l) => (l.t / 1000).toFixed(1) + ":" + l.peak.toFixed(3)).join(" ")}`);
  }
}
