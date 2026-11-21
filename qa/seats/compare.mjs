// Feet found in each seat of the test pictures, with the extra picture off and on.
//   node qa/seats/compare.mjs [--bounds 0,0.3,1] [picture ...]     (pictures under /qa/seats/, default: the two to four and close ones)
// --bounds saves those dividers (one more than the seats) before the page loads, to put a divider where it cuts a person.
// Prints for each picture and padding: each seat's feet found, and where that person's hips were against the seat's span.
import { launch } from "../../tools/browser.mjs";

const argv = process.argv.slice(2);
const at = argv.indexOf("--bounds");
const bounds = at === -1 ? null : argv.splice(at, 2)[1].split(",").map(Number);
const names = argv.length ? argv : ["two", "three", "four", "close2", "close3", "close4"];
const browser = await launch();
try {
  for (const name of names) {
    const n = +name.match(/\d|two|three|four/)[0].replace("two", 2).replace("three", 3).replace("four", 4);
    for (const pad of [0, 0.15, 0.3]) {
      const page = await browser.newPage();
      await page.setViewport({ width: 1280, height: 720 });
      if (bounds) await page.evaluateOnNewDocument((b) => localStorage.setItem(`seats:slices:${b.length - 1}`, JSON.stringify(b)), bounds);
      await page.goto(`http://localhost:5173/seats.html?src=/qa/seats/${name}.png&seats=${n}&pad=${pad}&pace=0`, { waitUntil: "load" });
      await new Promise((r) => setTimeout(r, 6000));
      const res = JSON.parse(await page.evaluate(() => document.body.dataset.result || "null"));
      console.log(`${name} pad ${pad}: ` + (res ? res.seats.map((s, i) => `seat ${i + 1}: ${s.feet} feet${s.dropped ? " DROPPED" : ""} hips ${s.hipX === null ? "none" : s.hipX.toFixed(2)}`).join(" | ") : "no result"));
      await page.close();
    }
  }
} finally {
  await browser.close();
}
