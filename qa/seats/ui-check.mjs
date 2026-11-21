// Clicks through seats.html the way a person does: drags a divider, records, saves, then replays the saved file.
//   node qa/seats/ui-check.mjs <out folder>
import fs from "node:fs";
import path from "node:path";
import { launch } from "../../tools/browser.mjs";

const out = process.argv[2] || "shots";
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await launch();
try {
  const errors = [];
  const watch = (page) => { page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); }); page.on("pageerror", (e) => errors.push(e.message)); };

  // 1. three people, drag the first divider, check it saved and the slices moved
  let page = await browser.newPage();
  watch(page);
  await page.setViewport({ width: 1280, height: 720 });
  await page.evaluateOnNewDocument(() => { HTMLAnchorElement.prototype.click = function () { window.__saved = fetch(this.href).then((r) => r.text()); window.__name = this.download; }; });
  await page.goto("http://localhost:5173/seats.html?src=/qa/seats/three.png&seats=3&pace=0", { waitUntil: "load" });
  await wait(5000);
  const box = await page.$eval("#stage canvas", (c) => { const r = c.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; });
  const at = (share) => box.x + box.w * share;
  await page.mouse.move(at(1 / 3), box.y + box.h / 2);
  await page.mouse.down();
  await page.mouse.move(at(0.25), box.y + box.h / 2, { steps: 5 });
  await page.mouse.up();
  const saved = await page.evaluate(() => [localStorage.getItem("seats:slices:3"), localStorage.getItem("seats:edges")]);
  console.log("dragged divider 1 to 0.25; saved:", saved.join("  "));

  // 2. record a few seconds, stop, read the file the page saved
  await page.click("#rec");
  await wait(3000);
  const label = await page.$eval("#rec", (b) => b.textContent);
  await page.click("#rec");
  await wait(500);
  const text = await page.evaluate(() => window.__saved);
  const name = await page.evaluate(() => window.__name);
  const file = JSON.parse(text);
  console.log(`button while recording: "${label}"; saved ${name}: version ${file.version}, ${file.frames.length} frames, ${file.slices.length} slices, seat 1 span ${file.slices[0].x0.toFixed(2)}-${file.slices[0].x1.toFixed(2)}, first frame ${JSON.stringify(file.frames[0]).slice(0, 160)}`);
  fs.writeFileSync(path.join(out, "recorded-from-three.json"), text);
  await page.screenshot({ path: path.join(out, "track-two-seats-1280.png") });
  await page.close();

  // 3. replay it
  page = await browser.newPage();
  watch(page);
  await page.setViewport({ width: 1280, height: 720 });
  await page.goto("http://localhost:5173/seats.html?replay=/shots/recorded-from-three.json", { waitUntil: "load" });
  await wait(3000);
  console.log("replay stats:", await page.$eval("#stats", (e) => e.textContent), "| cards:", await page.$$eval(".seat .info", (es) => es.map((e) => e.textContent).join(" || ")));
  await page.screenshot({ path: path.join(out, "track-two-replay-1280.png") });
  await page.close();

  // 4. a replay file that is not one
  page = await browser.newPage();
  watch(page);
  await page.goto("http://localhost:5173/seats.html?replay=/qa/seats/bench.mjs", { waitUntil: "load" });
  await wait(1500);
  console.log("bad replay shows:", await page.$eval("#error", (e) => e.textContent));
  await page.goto("http://localhost:5173/seats.html?replay=/nope.json", { waitUntil: "load" });
  await wait(1500);
  console.log("missing replay shows:", await page.$eval("#error", (e) => e.textContent));
  await page.close();
  console.log(errors.length ? `console errors:\n- ${errors.join("\n- ")}` : "console errors: none");
} finally {
  await browser.close();
}
