// Finds a Chrome or Edge already on this computer and opens it with puppeteer-core.
// shot.mjs, phone-check.mjs and the tester's scripts use it. Set BROWSER_PATH to override.
import fs from "node:fs";
import puppeteer from "puppeteer-core";

const CANDIDATES = [
  process.env.BROWSER_PATH,
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "C:/Program Files/Microsoft/Edge/Application/msedge.exe",
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
  "/usr/bin/chromium-browser",
];

export function browserPath() {
  const found = CANDIDATES.find((p) => p && fs.existsSync(p));
  if (!found) throw new Error("No Chrome or Edge found. Set BROWSER_PATH to your browser's program file.");
  return found;
}

// Always close what this returns, even when a script fails, or browsers pile up.
export function launch(opts = {}) {
  return puppeteer.launch({ executablePath: browserPath(), headless: true, ...opts });
}

// Reads a --as file: {"localStorage": {"key": "string or object"}, "sessionStorage": {...}}.
// Objects are stored as JSON text. Windows PowerShell adds an invisible marker at the
// start of files, so it is stripped.
export function readStorageFile(file) {
  const data = JSON.parse(fs.readFileSync(file, "utf8").replace(/^\uFEFF/, ""));
  const out = { localStorage: {}, sessionStorage: {} };
  for (const area of Object.keys(out)) {
    for (const [k, v] of Object.entries(data[area] || {})) {
      out[area][k] = typeof v === "string" ? v : JSON.stringify(v);
    }
  }
  return out;
}

// Seeds localStorage and sessionStorage so a page behind onboarding loads as a signed-in
// user. Storage belongs to an origin, so this opens a light page on the target's origin
// first, writes the values, and the caller then loads the real URL in the same tab.
// Call it before attaching console listeners, since the light page may 404.
export async function seedStorage(page, targetUrl, file) {
  const data = readStorageFile(file);
  const u = new URL(targetUrl);
  const first = u.protocol === "file:" ? targetUrl : u.origin + "/robots.txt";
  await page.goto(first, { waitUntil: "domcontentloaded", timeout: 30000 }).catch(() => {});
  await page.evaluate((d) => {
    for (const [k, v] of Object.entries(d.localStorage)) localStorage.setItem(k, v);
    for (const [k, v] of Object.entries(d.sessionStorage)) sessionStorage.setItem(k, v);
  }, data);
  return Object.keys(data.localStorage).length + Object.keys(data.sessionStorage).length;
}
