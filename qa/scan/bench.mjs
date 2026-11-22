// How well each way of reading the TTiles code does on camera-like pictures: the real code, drawn tilted, turned, small, faint,
// blurred and noisy over a grey floor. Prints reads out of total per reader, by size and by contrast, and the time per read.
//   node qa/scan/bench.mjs [--pipes A,B,C,DB,DC,S0,S1] [--quick] [--sample] [--sizes 1280x720,720x1280]
// Pipelines: A today's (shrunk to 480 wide), B whole picture, C framed part, DB and DC the same with attemptBoth,
// S0 and S1 the shipped looks (framed, whole), E the zxing-wasm reader. "frames a real phone's camera app would read" =
// code side 20% or more, tilt 50 degrees or less, contrast half or more, blur 1.5 or less.
// It serves the page itself on port 4183 (--port to change) (vite, no config file) and stops it at the end.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createServer } from "vite";
import { launch } from "../../tools/browser.mjs";

const args = process.argv.slice(2);
const arg = (k, d) => (args.includes(k) ? args[args.indexOf(k) + 1] : d);
const pipes = arg("--pipes", "A,B,C,DB,DC,S0,S1").split(",");
const quick = args.includes("--quick");
const PORT = Number(arg("--port", 4183));
const ORIENT = arg("--sizes", "1280x720,720x1280").split(",").map((s) => s.split("x").map(Number));
const root = path.resolve(import.meta.dirname, "../..");

const server = await createServer({ root, configFile: false, logLevel: "error", server: { host: "127.0.0.1", port: PORT, strictPort: true, hmr: false, watch: null } });
await server.listen();
const profile = fs.mkdtempSync(path.join(os.tmpdir(), "scanbench-"));
const browser = await launch({ userDataDir: profile, protocolTimeout: 600000 });
try {
  const page = await browser.newPage();
  page.on("pageerror", (e) => console.error("page error:", e.message));
  await page.goto(`http://127.0.0.1:${PORT}/qa/scan/bench.html`, { waitUntil: "load" });
  await page.waitForFunction("window.benchReady === true", { timeout: 60000 });
  if (pipes.some((p) => p === "E" || p.startsWith("Z") || p.startsWith("S"))) await page.evaluate(() => window.bench.loadZx());

  if (args.includes("--sample")) {
    const dir = path.join(import.meta.dirname, "samples");
    fs.mkdirSync(dir, { recursive: true });
    const cfgs = [{ size: 0.25, tilt: 50, turn: 20, contrast: "half", blur: 1.5 }, { size: 0.2, tilt: 30, turn: 0, contrast: "quarter", blur: 0 }];
    for (const [i, cfg] of cfgs.entries()) {
      const url = await page.evaluate((c) => window.bench.sample(1280, 720, c), cfg);
      fs.writeFileSync(path.join(dir, `sample-${i}.png`), Buffer.from(url.split(",")[1], "base64"));
    }
    console.log("samples written to", dir);
  } else {
    const total = await page.evaluate(() => window.bench.grid());
    const rows = [];
    for (const [W, H] of ORIENT) {
      for (let from = 0; from < total; from += 12) {
        if (quick && (from / 12) % 4) continue;
        for (const row of await page.evaluate((a, b, c, d, e) => window.bench.run(a, b, c, d, e), W, H, from, 12, pipes)) rows.push({ W, ...row });
      }
      process.stderr.write(`done ${W}x${H}\n`);
    }
    const good = (c) => c.size >= 0.2 && c.tilt <= 50 && c.contrast !== "quarter" && c.blur <= 1.5;
    const pct = (a, b) => (b ? `${a}/${b} ${Math.round((100 * a) / b)}%`.padEnd(14) : "n/a".padEnd(14));
    const count = (name, keep) => { const s = rows.filter((r) => keep(r.cfg)); return [s.filter((r) => r.r[name].ok).length, s.length]; };
    const ms = (name) => (rows.reduce((t, r) => t + r.r[name].ms, 0) / rows.length).toFixed(0);
    const msHit = (name) => { const h = rows.filter((r) => r.r[name].ok); return h.length ? (h.reduce((t, r) => t + r.r[name].ms, 0) / h.length).toFixed(0) : "-"; };
    const cols = [["all", () => true], ["good", good], ["size 60%", (c) => c.size === 0.6], ["35%", (c) => c.size === 0.35], ["20%", (c) => c.size === 0.2], ["12%", (c) => c.size === 0.12],
      ["full", (c) => c.contrast === "full"], ["half", (c) => c.contrast === "half"], ["quarter", (c) => c.contrast === "quarter"]];
    console.log(`\n${rows.length} frames (${quick ? "quick, one in four" : "full grid"}), both orientations`);
    console.log(["pipe".padEnd(5), ...cols.map(([n]) => n.padEnd(14)), "ms/frame", "ms/hit"].join(" "));
    for (const name of pipes) console.log([name.padEnd(5), ...cols.map(([, k]) => pct(...count(name, k))), ms(name).padStart(8), msHit(name).padStart(6)].join(" "));
    // the shipped reader sees look 0 then look 1 on a still picture: a frame counts when either reads
    if (pipes.includes("S0") && pipes.includes("S1")) {
      const either = (keep) => { const s = rows.filter((r) => keep(r.cfg)); return [s.filter((r) => r.r.S0.ok || r.r.S1.ok).length, s.length]; };
      console.log(["S0|S1".padEnd(5), ...cols.map(([, k]) => pct(...either(k))), "".padStart(8), "".padStart(6)].join(" "));
    }
    // --union S0,S1,B: a frame counts when any of these reads it (a still picture looked at in turn)
    if (arg("--union", "")) {
      const names = arg("--union", "").split(",");
      const any = (keep) => { const s = rows.filter((r) => keep(r.cfg)); return [s.filter((r) => names.some((n) => r.r[n].ok)).length, s.length]; };
      console.log([names.join("|").padEnd(5), ...cols.map(([, k]) => pct(...any(k)))].join(" "));
    }
    // where the good frames are missed, by tilt and turn, for the last pipeline
    const last = pipes[pipes.length - 1];
    const missed = rows.filter((r) => good(r.cfg) && !(pipes.includes("S0") && pipes.includes("S1") ? r.r.S0.ok || r.r.S1.ok : r.r[last].ok));
    const by = {};
    for (const r of missed) { const k = `${r.W}x${r.cfg.size * 100}% tilt${r.cfg.tilt} turn${r.cfg.turn} ${r.cfg.contrast} blur${r.cfg.blur}`; by[k] = 1; }
    console.log(`\ngood frames missed by ${pipes.includes("S0") && pipes.includes("S1") ? "S0|S1" : last}: ${missed.length}`);
    for (const k of Object.keys(by).slice(0, 25)) console.log("  " + k);
  }
} finally {
  await browser.close().catch(() => {});
  await server.close();
  fs.rmSync(profile, { recursive: true, force: true });
}






