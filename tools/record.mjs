// Records a silent video of the demo path: the page at a fixed size, driven by a
// short list of steps, saved as an mp4. Needs ffmpeg on PATH and puppeteer-core.
//
//   node tools/record.mjs <steps.json> <out.mp4> [--w 1280] [--h 720] [--mobile]
//
// steps.json is a list. Each item is one of:
//   {"goto": "https://app.vercel.app"}
//   {"click": "button.start"}
//   {"type": ["input[name=q]", "pizza near campus"]}
//   {"scroll": 600}
//   {"wait": 1500}          pause in ms, so the viewer can read
//
// Keep each pause at 1.5 s or more after a screen changes. Record against the live link,
// then play the file back and watch the whole thing before trusting it.
import fs from "node:fs";
import { launch } from "./browser.mjs";

const argv = process.argv.slice(2);
if (argv.length < 2) { console.error("usage: node tools/record.mjs <steps.json> <out.mp4> [--w 1280] [--h 720] [--mobile]"); process.exit(2); }
const [stepsFile, out] = argv;
const opt = (k, d) => { const i = argv.indexOf("--" + k); return i === -1 ? d : argv[i + 1]; };
const mobile = argv.includes("--mobile");
const width = +opt("w", mobile ? 390 : 1280);
const height = +opt("h", mobile ? 844 : 720);
// Windows PowerShell saves files with an invisible marker at the start, so strip it
const steps = JSON.parse(fs.readFileSync(stepsFile, "utf8").replace(/^﻿/, ""));

// The recorder only gets a frame when the screen repaints, and a still page can stop
// sending frames, so the video freezes. A one pixel element that keeps changing colour
// forces steady repaints. Call it again after every page load, since a load removes it.
async function keepRepainting(page) {
  await page.evaluate(() => {
    if (document.getElementById("rec-tick")) return;
    const s = document.createElement("style");
    s.textContent = "@keyframes rec-tick{from{background:#010101}to{background:#020202}}#rec-tick{position:fixed;right:0;bottom:0;width:1px;height:1px;pointer-events:none;z-index:2147483647;animation:rec-tick .05s linear infinite alternate}";
    const d = document.createElement("div");
    d.id = "rec-tick";
    document.head.append(s);
    document.documentElement.append(d);
  });
}

const browser = await launch();
try {
  const page = await browser.newPage();
  await page.setViewport({ width, height, deviceScaleFactor: 1, isMobile: mobile, hasTouch: mobile });
  const first = steps.find((s) => s.goto);
  if (!first) throw new Error("steps.json needs a goto step");
  await page.goto(first.goto, { waitUntil: "networkidle2", timeout: 30000 });
  await keepRepainting(page);
  const rec = await page.screencast({ path: out });
  for (const s of steps) {
    if (s === first) continue;
    if (s.goto) { await page.goto(s.goto, { waitUntil: "networkidle2", timeout: 30000 }); await keepRepainting(page); }
    else if (s.click) { await page.waitForSelector(s.click, { timeout: 10000 }); await page.click(s.click); }
    else if (s.type) { await page.waitForSelector(s.type[0], { timeout: 10000 }); await page.type(s.type[0], s.type[1], { delay: 60 }); }
    else if (s.scroll) await page.evaluate((y) => window.scrollBy({ top: y, behavior: "smooth" }), s.scroll);
    else if (s.wait) await new Promise((r) => setTimeout(r, s.wait));
  }
  await new Promise((r) => setTimeout(r, 1200));
  await rec.stop();
  console.log(`saved ${out} (${width}x${height})`);
} finally {
  await browser.close();
}
