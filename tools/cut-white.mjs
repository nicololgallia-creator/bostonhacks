// Makes a picture's white background see-through, for the train and mascot art.
//
//   node tools/cut-white.mjs <in.png or in.jpg> <out.png> [--width 900]
//
// It fills in from the picture's edges only, so white inside the outline (a roof, a stripe,
// the shine in an eye) stays. Then it fades the cut edge so no white rim shows on a dark page,
// and shrinks the picture to the given width.
import fs from "node:fs";
import path from "node:path";
import { PNG } from "pngjs";
import jpeg from "jpeg-js";

const [input, output] = process.argv.slice(2);
const widthFlag = process.argv.indexOf("--width");
const outWidth = widthFlag === -1 ? 900 : Number(process.argv[widthFlag + 1]);
if (!input || !output || !(outWidth > 0)) {
  console.error("usage: node tools/cut-white.mjs <in.png or in.jpg> <out.png> [--width 900]");
  process.exit(2);
}
if (!fs.existsSync(input)) {
  console.error(`There is no file at ${input}. Check the path.`);
  process.exit(1);
}

const WHITE = 232; // a pixel this bright in red, green and blue counts as background

// Both JPG and PNG are read, told apart by the file's first bytes and not its name:
// Canva saved a PNG under a .jpg name on Sat 21 Nov.
const bytes = fs.readFileSync(input);
const isJpeg = bytes[0] === 0xff && bytes[1] === 0xd8;
const src = isJpeg ? jpeg.decode(bytes, { useTArray: true, maxMemoryUsageInMB: 1024 }) : PNG.sync.read(bytes);
const { width: w, height: h, data } = src;
const isWhite = (i) => data[i] >= WHITE && data[i + 1] >= WHITE && data[i + 2] >= WHITE;

// Flood fill from every edge pixel over white pixels.
const outside = new Uint8Array(w * h);
const stack = [];
const visit = (x, y) => {
  if (x < 0 || y < 0 || x >= w || y >= h) return;
  const p = y * w + x;
  if (outside[p] || !isWhite(p * 4)) return;
  outside[p] = 1;
  stack.push(p);
};
for (let x = 0; x < w; x++) { visit(x, 0); visit(x, h - 1); }
for (let y = 0; y < h; y++) { visit(0, y); visit(w - 1, y); }
while (stack.length) {
  const p = stack.pop();
  const x = p % w, y = (p - x) / w;
  visit(x + 1, y); visit(x - 1, y); visit(x, y + 1); visit(x, y - 1);
}

for (let p = 0; p < w * h; p++) {
  const i = p * 4;
  if (outside[p]) { data[i + 3] = 0; continue; }
  // An edge pixel is a blend of the outline and the white behind it: fade it by how pale it is.
  const x = p % w, y = (p - x) / w;
  const touchesOutside =
    (x > 0 && outside[p - 1]) || (x < w - 1 && outside[p + 1]) || (y > 0 && outside[p - w]) || (y < h - 1 && outside[p + w]);
  if (touchesOutside) {
    const pale = Math.min(data[i], data[i + 1], data[i + 2]) / 255;
    data[i + 3] = Math.round(255 * (1 - pale * 0.85));
  }
}

// Crop to what is left, with a small margin, so every train sits the same way on its track.
let minX = w, minY = h, maxX = -1, maxY = -1;
for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
  if (data[(y * w + x) * 4 + 3] > 8) { if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y; }
}
if (maxX < 0) {
  console.error("Nothing was left after cutting the white out. Is the whole picture white?");
  process.exit(1);
}
const cw = maxX - minX + 1, ch = maxY - minY + 1;

// Shrink by averaging blocks of pixels (never enlarge).
const scale = Math.min(1, outWidth / cw);
const ow = Math.max(1, Math.round(cw * scale)), oh = Math.max(1, Math.round(ch * scale));
const out = new PNG({ width: ow, height: oh });
for (let oy = 0; oy < oh; oy++) for (let ox = 0; ox < ow; ox++) {
  const x0 = minX + Math.floor(ox / scale), x1 = Math.min(maxX + 1, minX + Math.max(Math.floor((ox + 1) / scale), Math.floor(ox / scale) + 1));
  const y0 = minY + Math.floor(oy / scale), y1 = Math.min(maxY + 1, minY + Math.max(Math.floor((oy + 1) / scale), Math.floor(oy / scale) + 1));
  let r = 0, g = 0, b = 0, a = 0;
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
    const i = (y * w + x) * 4, alpha = data[i + 3];
    r += data[i] * alpha; g += data[i + 1] * alpha; b += data[i + 2] * alpha; a += alpha;
  }
  const n = (x1 - x0) * (y1 - y0), o = (oy * ow + ox) * 4;
  out.data[o] = a ? r / a : 0; out.data[o + 1] = a ? g / a : 0; out.data[o + 2] = a ? b / a : 0; out.data[o + 3] = a / n;
}

fs.mkdirSync(path.dirname(path.resolve(output)), { recursive: true });
fs.writeFileSync(output, PNG.sync.write(out));
console.log(`saved ${output} (${ow}x${oh}), background cut from ${w}x${h}`);
