// Kickoff check. Finds the problems that otherwise show up mid-build: a bad API key
// value, a Vercel login that expired, a deploy that 404s, an AI route that is too slow.
// One line per check: PASS, FAIL or SKIP. Exit code 1 if anything fails.
// It prints key NAMES only, never values.
//
//   node tools/preflight.mjs [--env web/.env.local] [--keys KEY1,KEY2]
//                            [--url https://x.vercel.app]
//                            [--ai http://localhost:3000/api/ask] [--ai-body '{"question":"test"}']
//
//   --env / --keys    the env file and the keys that must be in it, clean
//   --url             the live link: must answer 200 and not be a Vercel login wall
//   --ai / --ai-body  POST to the AI route: must answer 200 in under 15 s
//
// The Vercel CLI is found from VERCEL_BIN, then node_modules/.bin up the folder tree,
// then npx.
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf("--" + k); return i === -1 ? d : argv[i + 1]; };
let failed = false;
const line = (state, name, why = "") => {
  if (state === "FAIL") failed = true;
  console.log(`${state.padEnd(4)}  ${name}${why ? " - " + why : ""}`);
};
const INVISIBLE = new RegExp("[\\uFEFF\\u200B-\\u200D\\u2060]", "g"); // byte-order mark, zero-width characters
const INVISIBLE_START = new RegExp("^\uFEFF");
const run = (cmd, args, o = {}) => spawnSync(cmd, args, { encoding: "utf8", timeout: 60000, ...o });

// Node 20 or newer
const major = +process.versions.node.split(".")[0];
major >= 20 ? line("PASS", "node", "v" + process.versions.node) : line("FAIL", "node", `v${process.versions.node}, need 20 or newer`);

// A browser, for screenshots
try {
  const { browserPath } = await import("./browser.mjs");
  line("PASS", "browser", path.basename(browserPath()));
} catch (e) {
  line("FAIL", "browser", e.code === "ERR_MODULE_NOT_FOUND" ? "puppeteer-core is not installed here" : e.message);
}

// Git repo and remote
const inRepo = run("git", ["rev-parse", "--is-inside-work-tree"]);
if (inRepo.status !== 0) line("FAIL", "git repo", "not inside a git repository");
else {
  line("PASS", "git repo");
  const remotes = run("git", ["remote"]).stdout.trim();
  remotes ? line("PASS", "git remote", remotes.split(/\s+/).join(", ")) : line("FAIL", "git remote", "no remote set");
}

// Env file and keys
const envFile = opt("env");
const keys = (opt("keys", "") || "").split(",").map((k) => k.trim()).filter(Boolean);
if (!envFile) line("SKIP", "env file", "no --env given");
else if (!fs.existsSync(envFile)) line("FAIL", "env file", envFile + " does not exist");
else {
  const raw = fs.readFileSync(envFile, "utf8");
  line("PASS", "env file", envFile);
  const startsWithBom = raw.charCodeAt(0) === 0xfeff;
  const vars = new Map();
  for (const l of raw.replace(INVISIBLE_START, "").split(/\r?\n/)) {
    const m = l.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (m) vars.set(m[1], m[2]);
  }
  if (!keys.length) line("SKIP", "env keys", "no --keys given");
  for (const k of keys) {
    if (!vars.has(k)) { line("FAIL", "key " + k, "missing from " + envFile); continue; }
    const v = vars.get(k);
    const bad = [];
    if (!v.trim()) bad.push("empty");
    const plain = v.replace(INVISIBLE, "");
    if (plain !== v) bad.push("has an invisible character (byte-order mark)");
    if (plain !== plain.trim()) bad.push("has spaces around it");
    if (/^["']|["']$/.test(v.trim())) bad.push("has quotes around it");
    if (/\\n$|\\r$|[\r\n]/.test(v)) bad.push("has a line break");
    if (startsWithBom && [...vars.keys()][0] === k) bad.push("file starts with a byte-order mark");
    bad.length ? line("FAIL", "key " + k, bad.join(", ")) : line("PASS", "key " + k, "present and clean");
  }
  if (startsWithBom) line("FAIL", "env file BOM", "file starts with an invisible byte-order mark; resave as UTF-8 without BOM");
}

// Vercel CLI: VERCEL_BIN, then node_modules/.bin up the tree, then npx
function vercelCommand() {
  if (process.env.VERCEL_BIN) return `"${process.env.VERCEL_BIN}"`;
  const name = process.platform === "win32" ? "vercel.cmd" : "vercel";
  for (let d = process.cwd(); ; d = path.dirname(d)) {
    const p = path.join(d, "node_modules", ".bin", name);
    if (fs.existsSync(p)) return `"${p}"`;
    if (path.dirname(d) === d) break;
  }
  return (process.platform === "win32" ? "npx.cmd" : "npx") + " vercel";
}
{
  const r = run(vercelCommand() + " whoami", [], { shell: true });
  const who = (r.stdout || "").trim().split(/\r?\n/).filter(Boolean).pop();
  if (r.status === 0 && who) line("PASS", "vercel login", "logged in as " + who);
  else line("FAIL", "vercel login", "not logged in or CLI not found. Run `vercel login`, or set VERCEL_BIN");
}

// Live link
const url = opt("url");
if (!url) line("SKIP", "live url", "no --url given");
else {
  try {
    const res = await fetch(url, { redirect: "follow", signal: AbortSignal.timeout(15000) });
    const body = (await res.text()).slice(0, 200000);
    if (res.status === 401 || /Authentication Required|vercel\.com\/login/i.test(body) || /vercel\.com\/(login|sso)/i.test(res.url))
      line("FAIL", "live url", `${res.status}, Vercel login wall. Turn off Deployment Protection for this project`);
    else if (res.status !== 200) line("FAIL", "live url", "answered " + res.status);
    else line("PASS", "live url", "200");
  } catch (e) {
    line("FAIL", "live url", e.name === "TimeoutError" ? "no answer in 15 s" : e.message);
  }
}

// AI route
const ai = opt("ai");
if (!ai) line("SKIP", "ai route", "no --ai given");
else {
  const t0 = Date.now();
  try {
    const res = await fetch(ai, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: opt("ai-body", '{"question":"test"}'),
      signal: AbortSignal.timeout(15000),
    });
    await res.text();
    const ms = Date.now() - t0;
    if (res.status !== 200) line("FAIL", "ai route", `answered ${res.status} in ${ms}ms`);
    else line("PASS", "ai route", `200 in ${ms}ms`);
  } catch (e) {
    line("FAIL", "ai route", e.name === "TimeoutError" ? "no answer in 15 s" : e.message);
  }
}

process.exit(failed ? 1 : 0);
