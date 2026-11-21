// Makes a line's train from another line's picture by changing only the colour of its band.
//
//   node tools/recolor.mjs <in.png> <out.png> <hue 0-360> [--from <hue>] [--width <degrees>]
//
// The Red, Orange and Blue Line trains are the same kind of car with a different coloured band,
// so the Orange and Blue trains are the Red train with its red turned to orange or blue.
// Only strongly coloured pixels near the source hue change. The outline, the silver body,
// the windows and the rosy cheeks stay as they are.
import fs from "node:fs";
import path from "node:path";
import { PNG } from "pngjs";

const args = process.argv.slice(2);
const [input, output, hueArg] = args;
const opt = (name, fallback) => { const i = args.indexOf("--" + name); return i === -1 ? fallback : Number(args[i + 1]); };
const toHue = Number(hueArg), fromHue = opt("from", 4), width = opt("width", 16);
if (!input || !output || !(toHue >= 0 && toHue <= 360)) {
  console.error("usage: node tools/recolor.mjs <in.png> <out.png> <hue 0-360> [--from <hue>] [--width <degrees>]");
  process.exit(2);
}
if (!fs.existsSync(input)) { console.error(`There is no file at ${input}. Check the path.`); process.exit(1); }

const png = PNG.sync.read(fs.readFileSync(input));
const d = png.data;
let changed = 0;
for (let i = 0; i < d.length; i += 4) {
  if (d[i + 3] === 0) continue;
  const r = d[i] / 255, g = d[i + 1] / 255, b = d[i + 2] / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), delta = max - min;
  if (delta === 0) continue;
  let h = max === r ? ((g - b) / delta) % 6 : max === g ? (b - r) / delta + 2 : (r - g) / delta + 4;
  h = (h * 60 + 360) % 360;
  const s = delta / max, v = max;
  const away = Math.min(Math.abs(h - fromHue), 360 - Math.abs(h - fromHue));
  // Strong colour only: the cheeks are pale (low s) and the outline is dark (low v).
  if (away > width || s < 0.55 || v < 0.4) continue;
  const c = v * s, x = c * (1 - Math.abs(((toHue / 60) % 2) - 1)), m = v - c;
  const [r2, g2, b2] = toHue < 60 ? [c, x, 0] : toHue < 120 ? [x, c, 0] : toHue < 180 ? [0, c, x] : toHue < 240 ? [0, x, c] : toHue < 300 ? [x, 0, c] : [c, 0, x];
  d[i] = Math.round((r2 + m) * 255); d[i + 1] = Math.round((g2 + m) * 255); d[i + 2] = Math.round((b2 + m) * 255);
  changed++;
}
if (!changed) { console.error("No pixels matched the source colour. Try --from with the hue of the band."); process.exit(1); }
fs.mkdirSync(path.dirname(path.resolve(output)), { recursive: true });
fs.writeFileSync(output, PNG.sync.write(png));
console.log(`saved ${output}, ${changed} pixels recoloured to hue ${toHue}`);
