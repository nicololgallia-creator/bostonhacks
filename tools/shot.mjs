// Screenshot a page the way a person sees it, and list any console errors.
// The lead copies this folder into the project's tools/ at kickoff, so it uses
// the project's own puppeteer-core.
//
//   node tools/shot.mjs <url-or-file> <out.png> [options]
//
//   --w 1440 --h 900     viewport (default 1440x900, or 390x844 with --mobile)
//   --mobile             phone size with touch
//   --full               the whole page, not only the first screen
//   --theme dark|light   emulate prefers-color-scheme
//   --wait 1200          ms to settle after load
//   --as file.json       load the page as a signed-in user. The file holds the browser
//                        storage the app checks, for example
//                        {"localStorage": {"app:profile": {"name": "Sam", "onboarded": true}},
//                         "sessionStorage": {}}
//                        Objects are saved as JSON text. It opens the site's origin first,
//                        writes the storage, then loads the page.
import path from "node:path";
import { pathToFileURL } from "node:url";
import { launch, seedStorage } from "./browser.mjs";

const argv = process.argv.slice(2);
if (argv.length < 2) { console.error("usage: node tools/shot.mjs <url-or-file> <out.png> [options]"); process.exit(2); }
const [target, out] = argv;
const opt = (k, d) => { const i = argv.indexOf("--" + k); return i === -1 ? d : argv[i + 1]; };
const flag = (k) => argv.includes("--" + k);

const mobile = flag("mobile");
const width = +opt("w", mobile ? 390 : 1440);
const height = +opt("h", mobile ? 844 : 900);
const url = /^(https?|file):/.test(target) ? target : pathToFileURL(path.resolve(target)).href;

const browser = await launch();
try {
  const page = await browser.newPage();
  await page.setViewport({ width, height, deviceScaleFactor: mobile ? 2 : 1, isMobile: mobile, hasTouch: mobile });
  if (opt("theme")) await page.emulateMediaFeatures([{ name: "prefers-color-scheme", value: opt("theme") }]);

  if (opt("as")) await seedStorage(page, url, opt("as"));

  const errors = [];
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  page.on("pageerror", (e) => errors.push(e.message));

  await page.goto(url, { waitUntil: "networkidle2", timeout: 30000 });
  await new Promise((r) => setTimeout(r, +opt("wait", 1200)));
  await page.screenshot({ path: out, fullPage: flag("full") });

  console.log(`saved ${out} (${width}x${height}${mobile ? ", mobile" : ""})`);
  console.log(errors.length ? `console errors:\n- ${errors.join("\n- ")}` : "console errors: none");
} finally {
  await browser.close();
}
