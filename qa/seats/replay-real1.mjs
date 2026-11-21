// Taps per foot on the one-person recording (qa/feet/real-taps-1.json) from 3 s to 39.5 s, and at 30 to 32 s.
import { readFileSync } from "node:fs";
import { createTapDetector } from "../../src/track/taps.js";
const rec = JSON.parse(readFileSync("qa/feet/real-taps-1.json", "utf8"));
const det = createTapDetector(), taps = [];
for (const fr of rec.frames) {
  if (fr.feet.length !== 2) continue;
  const [a, b] = [...fr.feet].sort((p, q) => p.x - q.x);
  taps.push(...det.update(fr.t, [{ spotId: 1, foot: 0, x: a.x, y: a.y }, { spotId: 1, foot: 1, x: b.x, y: b.y }]).taps);
}
for (const foot of [0, 1]) console.log(`foot ${foot}: ${taps.filter((x) => x.foot === foot && x.atMs >= 3000 && x.atMs <= 39500).length} taps, ${taps.filter((x) => x.foot === foot && x.atMs >= 30000 && x.atMs <= 32000).length} at 30-32 s`);
