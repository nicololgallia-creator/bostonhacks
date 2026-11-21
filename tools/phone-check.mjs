// Finds pages that scroll sideways on a phone. Loads the page at each phone width and
// reports how wide the page really is, which elements stick out past the right edge,
// and any console errors. Exit code 1 if any width overflows.
//
//   node tools/phone-check.mjs <url> [--as file.json] [--widths 390,360]
//
//   --as file.json   load as a signed-in user (same file format as shot.mjs)
//   --widths 390,360 phone widths to test (default 390,360)
//   --wait 1000      ms to settle after load
//
// Check every screen of the demo path, not only the home page.
import { launch, seedStorage } from "./browser.mjs";

const argv = process.argv.slice(2);
if (!argv.length || argv[0].startsWith("--")) { console.error("usage: node tools/phone-check.mjs <url> [--as file.json] [--widths 390,360]"); process.exit(2); }
const url = argv[0];
const opt = (k, d) => { const i = argv.indexOf("--" + k); return i === -1 ? d : argv[i + 1]; };
const widths = opt("widths", "390,360").split(",").map(Number).filter(Boolean);

// Runs inside the page. Lists elements whose right edge passes the viewport, skipping
// ones hidden or clipped by a scrolling parent, since those do not widen the page.
function measure(vw) {
  const clipped = (el) => {
    for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
      if (getComputedStyle(p).overflowX !== "visible") return true;
    }
    return false;
  };
  const out = [];
  for (const el of document.body.querySelectorAll("*")) {
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0 || r.right <= vw + 0.5) continue;
    const cs = getComputedStyle(el);
    if (cs.display === "none" || cs.visibility === "hidden") continue;
    if (clipped(el)) continue;
    const cls = typeof el.className === "string" ? el.className.trim().split(/\s+/).filter(Boolean).slice(0, 3).join(".") : "";
    out.push({ name: el.tagName.toLowerCase() + (el.id ? "#" + el.id : "") + (cls ? "." + cls : ""), right: Math.round(r.right), w: Math.round(r.width) });
  }
  out.sort((a, b) => b.right - a.right);
  return { scrollWidth: document.documentElement.scrollWidth, bodyScrollWidth: document.body.scrollWidth, list: out.slice(0, 10), total: out.length };
}

const browser = await launch();
let failed = false;
try {
  for (const width of widths) {
    const page = await browser.newPage();
    await page.setViewport({ width, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    if (opt("as")) await seedStorage(page, url, opt("as"));
    const errors = [];
    page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(url, { waitUntil: "networkidle2", timeout: 30000 });
    await new Promise((r) => setTimeout(r, +opt("wait", 1000)));
    const m = await page.evaluate(measure, width);
    const wide = Math.max(m.scrollWidth, m.bodyScrollWidth);
    const over = wide > width;
    if (over) failed = true;
    console.log(`${over ? "FAIL" : "PASS"} ${width}px  scrollWidth=${wide}${over ? ` (+${wide - width})` : ""}`);
    for (const e of m.list) console.log(`  ${e.name} right=${e.right} w=${e.w}`);
    if (m.total > m.list.length) console.log(`  ...and ${m.total - m.list.length} more`);
    console.log(errors.length ? `  console errors:\n  - ${errors.slice(0, 5).join("\n  - ")}` : "  console errors: none");
    await page.close();
  }
} finally {
  await browser.close();
}
process.exit(failed ? 1 : 0);
