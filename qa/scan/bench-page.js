// The page the bench runs in. It draws the real TTiles code into camera-like frames (perspective, turn, low contrast, blur,
// noise) over a mid-grey floor and tries each reader on every frame. `window.bench.run(...)` is called by bench.mjs.
import jsQR from "jsqr";
import { create as createQr } from "qrcode";
import { frameCrop, readLook, loadReader } from "/src/app/scanner.js";

export const TEXT = "https://ttiles.us/?room=GREENB22&line=Green-B&dir=1&at=place-bucen&car=2";
const BOX = { w: 390, h: 468 }; // the on-screen viewfinder, 5 to 6, for the frame crop
const FLOOR = 0x70;
const D = 2.5; // camera distance in code sides
const qr = createQr(TEXT, { errorCorrectionLevel: "M" });
const CELLS = qr.modules.size + 8;
const SRC = 720; // the code, drawn big, quiet zone included
const srcLum = new Float32Array(SRC * SRC).fill(1);
for (let r = 0; r < qr.modules.size; r++) for (let c = 0; c < qr.modules.size; c++) {
  if (!qr.modules.get(r, c)) continue;
  const x0 = Math.floor(((c + 4) * SRC) / CELLS), x1 = Math.floor(((c + 5) * SRC) / CELLS);
  const y0 = Math.floor(((r + 4) * SRC) / CELLS), y1 = Math.floor(((r + 5) * SRC) / CELLS);
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) srcLum[y * SRC + x] = 0;
}
const sample = (u, v) => { // u, v in [0,1] across the code; 1 outside
  if (u < 0 || u >= 1 || v < 0 || v >= 1) return FLOOR / 255; // paper ends here; the floor shows
  return srcLum[(v * SRC | 0) * SRC + (u * SRC | 0)];
};

const rng = (seed) => () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const CONTRAST = { full: [0x14, 0xff], half: [0x5a, 0xdc], quarter: [0x6e, 0xaf] };

// One frame: a code `side` pixels wide (quiet zone included), tilted like a floor seen from a seat, turned in its plane.
function makeFrame(W, H, cfg, seed) {
  const rand = rng(seed);
  const short = Math.min(W, H);
  const side = cfg.size * short;
  const th = (cfg.tilt * Math.PI) / 180, ph = (cfg.turn * Math.PI) / 180;
  const F = side * D, st = Math.sin(th), ct = Math.cos(th), sp = Math.sin(ph), cp = Math.cos(ph);
  const cx = W / 2 + (rand() - 0.5) * 0.1 * short, cy = H / 2 + (rand() - 0.5) * 0.1 * short;
  const [lo, hi] = CONTRAST[cfg.contrast];
  const canvas = document.createElement("canvas");
  canvas.width = W; canvas.height = H;
  const g = canvas.getContext("2d", { willReadFrequently: true });
  const img = g.createImageData(W, H);
  const px = img.data;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const grad = FLOOR + (y / H - 0.5) * 12; // a floor that is a little lighter at one end
    let v = 0, hit = 0;
    for (let sy = 0; sy < 2; sy++) for (let sx = 0; sx < 2; sx++) {
      const X = x + 0.25 + sx * 0.5 - cx, Y = y + 0.25 + sy * 0.5 - cy;
      const b = (Y * D) / (F * ct - Y * st);
      const a = (X * (D + b * st)) / F;
      const a0 = a * cp + b * sp, b0 = -a * sp + b * cp; // undo the turn
      const u = a0 + 0.5, w = b0 + 0.5;
      if (u < 0 || u >= 1 || w < 0 || w >= 1 || F * ct - Y * st <= 0) v += (grad - lo) / (hi - lo);
      else { v += sample(u, w); hit++; }
    }
    const L = lo + (hi - lo) * (v / 4);
    const i = (y * W + x) * 4;
    px[i] = px[i + 1] = px[i + 2] = L; px[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  let out = canvas;
  if (cfg.blur > 0) {
    out = document.createElement("canvas"); out.width = W; out.height = H;
    const g2 = out.getContext("2d", { willReadFrequently: true });
    g2.filter = `blur(${cfg.blur}px)`; g2.drawImage(canvas, 0, 0);
  }
  const g3 = out.getContext("2d", { willReadFrequently: true });
  const d = g3.getImageData(0, 0, W, H);
  for (let i = 0; i < d.data.length; i += 4) { const n = (rand() + rand() + rand() - 1.5) * 8; d.data[i] += n; d.data[i + 1] += n; d.data[i + 2] += n; }
  g3.putImageData(d, 0, 0);
  return out;
}

const scratch = document.createElement("canvas");
const sg = scratch.getContext("2d", { willReadFrequently: true });
function grab(src, sx, sy, sw, sh, dw, dh) {
  scratch.width = dw; scratch.height = dh;
  sg.drawImage(src, sx, sy, sw, sh, 0, 0, dw, dh);
  return sg.getImageData(0, 0, dw, dh);
}
const readJs = (img, both) => jsQR(img.data, img.width, img.height, { inversionAttempts: both ? "attemptBoth" : "dontInvert" })?.data ?? "";

// ---- the pipelines under test. Each takes the frame (a canvas standing in for the video) and returns the text read ----
const PIPES = {
  // today's: shrink to 480 wide, never invert
  A: (v) => { const k = Math.min(1, 480 / v.width); const i = grab(v, 0, 0, v.width, v.height, Math.round(v.width * k), Math.round(v.height * k)); return readJs(i, false); },
  B: (v) => readJs(grab(v, 0, 0, v.width, v.height, v.width, v.height), false),
  C: (v) => { const r = frameCrop(v.width, v.height, BOX.w, BOX.h); return readJs(grab(v, r.x, r.y, r.w, r.h, r.w, r.h), false); },
  DB: (v) => readJs(grab(v, 0, 0, v.width, v.height, v.width, v.height), true),
  DC: (v) => { const r = frameCrop(v.width, v.height, BOX.w, BOX.h); return readJs(grab(v, r.x, r.y, r.w, r.h, r.w, r.h), true); },
  // the shipped reader: look 0 is the frame, look 1 the whole picture (see scanner.js)
  S0: (v) => readLook(ours, v, v.width, v.height, BOX.w, BOX.h, 0),
  S1: (v) => readLook(ours, v, v.width, v.height, BOX.w, BOX.h, 1),
};
let zx = null, ours = null;
async function loadZx() {
  ours = await loadReader();
  const { BarcodeDetector } = await import("barcode-detector/ponyfill");
  const det = new BarcodeDetector({ formats: ["qr_code"] });
  PIPES.E = async (v) => (await det.detect(v))[0]?.rawValue ?? "";
  zx = det;
  const { readBarcodes } = await import("zxing-wasm/reader");
  const direct = (opts) => async (v) => {
    const g = v.getContext("2d", { willReadFrequently: true });
    const r = await readBarcodes(g.getImageData(0, 0, v.width, v.height), { formats: ["QRCode"], ...opts });
    return r[0]?.text ?? "";
  };
  const onCrop = (k, inset) => async (v) => {
    const r = frameCrop(v.width, v.height, BOX.w, BOX.h, inset);
    const i = grab(v, r.x, r.y, r.w, r.h, Math.round(r.w * k), Math.round(r.h * k));
    const out = await readBarcodes(i, { formats: ["QRCode"] });
    return out[0]?.text ?? "";
  };
  PIPES.ZC = onCrop(1, 0.14);
  PIPES.ZC2 = onCrop(2, 0.14);
  PIPES.ZC3 = onCrop(1.5, 0.07);
  // sharpen: grey = in + amount * (in - 3x3 mean), then stretch the 2nd to 98th percentile to the full range
  const sharpen = (img, amount, stretch) => {
    const { width: w, height: h, data } = img;
    const g = new Float32Array(w * h);
    for (let i = 0; i < g.length; i++) g[i] = data[i * 4];
    const o = new Float32Array(w * h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      let s = 0, c = 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const xx = x + dx, yy = y + dy; if (xx >= 0 && yy >= 0 && xx < w && yy < h) { s += g[yy * w + xx]; c++; } }
      o[y * w + x] = g[y * w + x] + amount * (g[y * w + x] - s / c);
    }
    let lo = 0, hi = 255;
    if (stretch) { const hist = new Uint32Array(256); for (const v of o) hist[Math.max(0, Math.min(255, v | 0))]++; let a = 0; const n = o.length; while (a + hist[lo] < n * 0.02) a += hist[lo++]; a = 0; while (a + hist[hi] < n * 0.02) a += hist[hi--]; if (hi - lo < 20) { lo = 0; hi = 255; } }
    for (let i = 0; i < o.length; i++) { const v = Math.max(0, Math.min(255, ((o[i] - lo) * 255) / (hi - lo))); data[i * 4] = data[i * 4 + 1] = data[i * 4 + 2] = v; }
    return img;
  };
  const onCropSharp = (k, inset, amount, stretch) => async (v) => {
    const r = frameCrop(v.width, v.height, BOX.w, BOX.h, inset);
    const i = sharpen(grab(v, r.x, r.y, r.w, r.h, Math.round(r.w * k), Math.round(r.h * k)), amount, stretch);
    const out = await readBarcodes(i, { formats: ["QRCode"] });
    return out[0]?.text ?? "";
  };
  PIPES.ZS = onCropSharp(1.5, 0.07, 1.5, false);
  PIPES.ZST = onCropSharp(1.5, 0.07, 1.5, true);
  PIPES.ZT = onCropSharp(1.5, 0.07, 0, true);
  PIPES.Z0 = direct({});
  PIPES.ZD = direct({ tryDenoise: true });
  PIPES.ZG = direct({ binarizer: "GlobalHistogram" });
  PIPES.ZDG = direct({ tryDenoise: true, binarizer: "GlobalHistogram" });
  PIPES.ZNR = direct({ tryDownscale: false });
}

const SIZES = [0.6, 0.35, 0.2, 0.12], TILTS = [0, 30, 50, 65], TURNS = [0, 20, 180], CONTRASTS = ["full", "half", "quarter"], BLURS = [0, 1.5, 3];
const grid = [];
for (const size of SIZES) for (const tilt of TILTS) for (const turn of TURNS) for (const contrast of CONTRASTS) for (const blur of BLURS) grid.push({ size, tilt, turn, contrast, blur });

window.bench = {
  grid: () => grid.length,
  async loadZx() { await loadZx(); return true; },
  // Runs frames [from, from+count) of the grid at W x H with the named pipelines.
  async run(W, H, from, count, names) {
    const rows = [];
    for (let n = from; n < Math.min(grid.length, from + count); n++) {
      const cfg = grid[n];
      const frame = makeFrame(W, H, cfg, n * 7 + W);
      const r = {};
      for (const name of names) {
        const t = performance.now();
        let text = "";
        try { text = await PIPES[name](frame); } catch (e) { text = `ERR ${e.message}`; }
        r[name] = { ok: text === TEXT, ms: performance.now() - t };
      }
      rows.push({ cfg, r });
    }
    return rows;
  },
  // One frame of any config: the picture as a PNG, and whether each named pipeline reads it.
  async one(W, H, cfg, names) {
    const frame = makeFrame(W, H, cfg, 1);
    const r = {};
    for (const name of names) { const t = performance.now(); let text = ""; try { text = await PIPES[name](frame); } catch (e) { text = `ERR ${e.message}`; } r[name] = { ok: text === TEXT, ms: performance.now() - t }; }
    return { png: frame.toDataURL("image/png"), r };
  },
  // The first frame of a config as a PNG, to look at.
  sample(W, H, cfg) { return makeFrame(W, H, cfg, 1).toDataURL("image/png"); },
};
window.benchReady = true;





