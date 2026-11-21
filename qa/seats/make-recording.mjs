// Makes qa/seats/sample-recording.json: a made-up seat recording (version 2) of three seated people, so ?replay= can be tried
// with no camera. Seat 1 taps its left foot twice a second, seat 2 taps both feet in turn, seat 3 sits still. A frame every 33 ms
// for 12 seconds. A real recording comes from the Record button on seats.html.
//   node qa/seats/make-recording.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const slices = [0, 1, 2].map((i) => ({ spotId: i + 1, x0: i / 3, x1: (i + 1) / 3 }));
const up = (t, period, start = 0) => ((t - start) % period >= 100 && (t - start) % period < 300 && t >= start ? 0.06 : 0);
const frames = [];
for (let t = 0; t <= 12000; t += 33) {
  const seat = (i, [a, b]) => ({
    spotId: i + 1,
    hipX: +(i / 3 + 1 / 6).toFixed(4),
    dropped: false,
    feet: [{ foot: 0, x: i / 3 + 0.13, y: 0.8 - a, shin: 0.2 }, { foot: 1, x: i / 3 + 0.2, y: 0.81 - b, shin: 0.2 }],
  });
  frames.push({ t, seats: [seat(0, [up(t, 500), 0]), seat(1, [up(t, 1000), up(t, 1000, 500)]), seat(2, [0, 0])] });
}
fs.writeFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), "sample-recording.json"), JSON.stringify({ version: 2, model: "made up", pad: 0.15, delegate: "none", slices, frames }));
console.log(`${frames.length} frames`);
