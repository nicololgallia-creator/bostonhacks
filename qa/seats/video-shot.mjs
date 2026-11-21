// A video keeps the page busy, so tools/shot.mjs never sees it settle. This takes a shot
// of seats.html on a video, a few seconds in, and prints what the page says.
//   node qa/seats/video-shot.mjs "<seats.html url>" <out.png> [wait ms]
import { launch } from "../../tools/browser.mjs";

const [url, out, wait = "8000"] = process.argv.slice(2);
const browser = await launch();
try {
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 720 });
  const errors = [];
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(url, { waitUntil: "load" });
  await new Promise((r) => setTimeout(r, +wait));
  await page.screenshot({ path: out });
  console.log(await page.evaluate(() => document.getElementById("stats").textContent));
  console.log(errors.length ? `console errors:\n- ${errors.join("\n- ")}` : "console errors: none");
} finally {
  await browser.close();
}
