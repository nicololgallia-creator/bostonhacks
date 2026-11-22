// A hard case, end to end: a code at 25% of the picture's short side, tilted 50 degrees, half contrast, played to the BUILT
// scan screen as a fake camera.
//   node qa/scan/hard-case.mjs make <folder>   draws the picture, writes <folder>/hard.y4m, and says whether today's reader
//                                              (pipeline A in the bench) and the new one read that picture. Needs port 4183 free.
//   node qa/scan/hard-case.mjs run <folder>    opens the built site on port 4183 (start it first: npx.cmd vite preview --port 4183
//                                              --strictPort) as a phone with that camera, waits for the app to move to its own
//                                              address, and saves screenshots in <folder>. `run <folder> blank` plays a grey wall
//                                              and screenshots the screen after 13 seconds with nothing read.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { createServer } from "vite";
import { launch } from "../../tools/browser.mjs";

const [mode, folder, variant] = process.argv.slice(2);
if (!["make", "run"].includes(mode) || !folder) { console.error("usage: node qa/scan/hard-case.mjs make|run <folder> [blank]"); process.exit(2); }
fs.mkdirSync(folder, { recursive: true });
const CASE = { size: 0.25, tilt: 50, turn: 0, contrast: "half", blur: 0 };
const profile = fs.mkdtempSync(path.join(os.tmpdir(), "scanhard-"));
const y4m = (name) => path.join(folder, name);

async function make() {
  const server = await createServer({ root: path.resolve(import.meta.dirname, "../.."), configFile: false, logLevel: "error", server: { host: "127.0.0.1", port: 4183, strictPort: true, hmr: false, watch: null } });
  await server.listen();
  const browser = await launch({ userDataDir: profile, protocolTimeout: 300000 });
  try {
    const page = await browser.newPage();
    await page.goto("http://127.0.0.1:4183/qa/scan/bench.html");
    await page.waitForFunction("window.benchReady === true", { timeout: 60000 });
    await page.evaluate(() => window.bench.loadZx());
    const { png, r } = await page.evaluate((c) => window.bench.one(1280, 720, c, ["A", "S0", "S1"]), CASE);
    fs.writeFileSync(path.join(folder, "hard.png"), Buffer.from(png.split(",")[1], "base64"));
    console.log("today's reader (shrunk to 480 wide):", r.A.ok ? "READS" : "does not read");
    console.log("new reader, look 0 (whole) :", r.S0.ok ? "reads" : "does not read", `${r.S0.ms.toFixed(0)} ms`);
    console.log("new reader, look 1 (framed):", r.S1.ok ? "reads" : "does not read", `${r.S1.ms.toFixed(0)} ms`);
  } finally { await browser.close().catch(() => {}); await server.close(); }
  const wall = (out, input) => spawnSync("ffmpeg", ["-y", "-loglevel", "error", ...input, "-t", "4", "-r", "15", "-pix_fmt", "yuv420p", out], { encoding: "utf8" });
  const a = wall(y4m("hard.y4m"), ["-loop", "1", "-framerate", "15", "-i", path.join(folder, "hard.png")]);
  const b = wall(y4m("blank.y4m"), ["-f", "lavfi", "-i", "color=c=0x707070:s=1280x720:r=15"]);
  if (a.status || b.status) throw new Error(`ffmpeg failed: ${a.stderr}${b.stderr}`);
  console.log("wrote", y4m("hard.y4m"), "and", y4m("blank.y4m"));
}

async function run() {
  const blank = variant === "blank";
  const clip = y4m(blank ? "blank.y4m" : "hard.y4m");
  const browser = await launch({ userDataDir: profile, defaultViewport: null, args: ["--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream", `--use-file-for-fake-video-capture=${clip}`, "--window-size=432,768"] });
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    const errors = [];
    page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
    page.on("pageerror", (e) => errors.push(e.message));
    const outside = [];
    const wasm = [];
    page.on("request", (r) => { if (!r.url().startsWith("http://127.0.0.1:4183/") && !r.url().startsWith("blob:") && !r.url().startsWith("data:")) outside.push(r.url()); });
    page.on("response", (r) => { if (r.url().endsWith(".wasm")) wasm.push(`${r.url()} ${r.status()}`); });
    await page.goto("http://127.0.0.1:4183/", { waitUntil: "networkidle2" });
    const t0 = Date.now();
    if (blank) {
      await new Promise((r) => setTimeout(r, 13500));
      console.log("line:", JSON.stringify(await page.$eval(".scan-msg", (e) => e.textContent)), "| grey line:", JSON.stringify(await page.$eval(".scan-debug", (e) => (e.hidden ? "(hidden)" : e.textContent))));
      await page.screenshot({ path: path.join(folder, "scan-12s-390.png") });
    } else {
      await page.waitForFunction(() => location.search.includes("room="), { timeout: 30000 }).then(
        () => console.log(`READ: the app moved to ${page.url()} after ${Date.now() - t0} ms`),
        async () => { console.log("NOT READ in 30 s:", await page.$eval(".scan-msg", (e) => e.textContent), "|", await page.$eval(".scan-debug", (e) => e.textContent)); await page.screenshot({ path: path.join(folder, "scan-hard-notread-390.png") }); });
    }
    console.log("wasm fetched:", wasm.join(", ") || "none", "| requests to other hosts:", outside.length ? outside.join(", ") : "none");
    console.log(errors.length ? `console errors:\n- ${errors.join("\n- ")}` : "console errors: none");
  } finally { await browser.close().catch(() => {}); }
}

try { await (mode === "make" ? make() : run()); } finally { fs.rmSync(profile, { recursive: true, force: true }); }

