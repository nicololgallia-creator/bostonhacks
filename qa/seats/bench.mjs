// Frames a second of each seat for 1 to 4 slices, lite and full, on pictures with that many people.
//   node qa/seats/bench.mjs [--cpu] [--perframe N] [--pad 0.15]
// The rates are for this computer and this browser, headless. A real laptop with a GPU is faster.
import { launch } from "../../tools/browser.mjs";

const argv = process.argv.slice(2);
const cpu = argv.includes("--cpu");
const perframe = argv.includes("--perframe") ? argv[argv.indexOf("--perframe") + 1] : "";
const pad = argv.includes("--pad") ? argv[argv.indexOf("--pad") + 1] : "";
const pictures = { 1: "/qa/person.jpg", 2: "/qa/seats/two.png", 3: "/qa/seats/three.png", 4: "/qa/seats/four.png" };

const browser = await launch();
try {
  for (const model of ["lite", "full"]) {
    for (const n of [1, 2, 3, 4]) {
      const page = await browser.newPage();
      await page.setViewport({ width: 1280, height: 720 });
      const url = `http://localhost:5173/seats.html?src=${pictures[n]}&seats=${n}&model=${model}&pace=0${cpu ? "&delegate=cpu" : ""}${perframe ? "&perframe=" + perframe : ""}${pad ? "&pad=" + pad : ""}`;
      await page.goto(url, { waitUntil: "load" });
      await new Promise((r) => setTimeout(r, 6000)); // load the models and warm up
      const samples = [];
      for (let k = 0; k < 6; k++) {
        await new Promise((r) => setTimeout(r, 1000));
        samples.push(JSON.parse(await page.evaluate(() => document.body.dataset.result || "null")));
      }
      const ok = samples.filter(Boolean);
      const last = ok.at(-1);
      const mean = last ? last.rates.map((_, i) => (ok.reduce((sum, s) => sum + s.rates[i], 0) / ok.length).toFixed(1)) : [];
      console.log(`${model} ${n} slice${n > 1 ? "s" : ""} ${last ? last.delegate : "no result"}: each seat ${mean.join(", ")} fps, ${last ? last.feet : 0} feet`);
      await page.close();
    }
  }
} finally {
  await browser.close();
}
