// Runs a list of questions through the app's AI endpoint and checks each answer, so a
// prompt change that breaks answers shows up in a minute instead of by hand.
//
//   node tools/ai-check.mjs <cases.json> [--base http://localhost:3000]
//
// cases.json (see ai-cases.example.json):
//   { "endpoint": "/api/ask", "body": { "question": "{q}" },
//     "cases": [ { "q": "How do I appeal a parking ticket?",
//                  "expect": { "topic": "parking", "steps.length": ">=4" } } ] }
//
// {q} is replaced in every string of body, at any depth. Each case may also carry other
// fields; any "{name}" in body is filled from the case field of that name.
// Expect keys are dotted paths into the JSON answer ("steps.0.title"); ".length" works
// on arrays and strings. Expect values:
//   "text"      case-insensitive regex the value must match
//   "!text"     must NOT match
//   ">=4"  "<=1"  ">2"  "<9"  "==3"   number checks
//   "exists"    present and not null or empty
// Exit code 1 if any check fails. Each request has a 60 s limit.
import fs from "node:fs";

const argv = process.argv.slice(2);
if (!argv.length || argv[0].startsWith("--")) { console.error("usage: node tools/ai-check.mjs <cases.json> [--base http://localhost:3000]"); process.exit(2); }
const opt = (k, d) => { const i = argv.indexOf("--" + k); return i === -1 ? d : argv[i + 1]; };
const spec = JSON.parse(fs.readFileSync(argv[0], "utf8").replace(/^\uFEFF/, ""));
const base = opt("base", "http://localhost:3000").replace(/\/$/, "");
const target = /^https?:/.test(spec.endpoint) ? spec.endpoint : base + (spec.endpoint.startsWith("/") ? "" : "/") + spec.endpoint;

// Replaces {name} in every string, however deep.
function fill(node, vars) {
  if (typeof node === "string") return node.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k]) : m));
  if (Array.isArray(node)) return node.map((n) => fill(n, vars));
  if (node && typeof node === "object") return Object.fromEntries(Object.entries(node).map(([k, v]) => [k, fill(v, vars)]));
  return node;
}

const getPath = (obj, p) => p.split(".").reduce((o, k) => (o == null ? undefined : o[k]), obj);
const show = (v) => {
  if (v === undefined) return "undefined";
  const s = typeof v === "string" ? JSON.stringify(v) : JSON.stringify(v) ?? String(v);
  return s.length > 80 ? s.slice(0, 77) + "..." : s;
};

function check(actual, want) {
  if (typeof want === "number") return Number(actual) === want;
  if (typeof want === "boolean") return actual === want;
  const w = String(want).trim();
  if (w === "exists") return !(actual === undefined || actual === null || actual === "" || (Array.isArray(actual) && !actual.length));
  const n = w.match(/^(>=|<=|==|>|<)\s*(-?\d+(?:\.\d+)?)$/);
  if (n) {
    const a = Number(actual), b = Number(n[2]);
    if (actual === undefined || actual === null || Number.isNaN(a)) return false;
    return { ">=": a >= b, "<=": a <= b, "==": a === b, ">": a > b, "<": a < b }[n[1]];
  }
  const text = typeof actual === "string" ? actual : actual === undefined ? "" : JSON.stringify(actual);
  if (w.startsWith("!")) return !new RegExp(w.slice(1), "i").test(text);
  return actual !== undefined && new RegExp(w, "i").test(text);
}

let pass = 0, total = 0;
for (const c of spec.cases) {
  const body = fill(spec.body, c);
  const t0 = Date.now();
  let status = "ERR", json, note = "";
  try {
    const res = await fetch(target, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(60000),
    });
    status = res.status;
    const text = await res.text();
    try { json = JSON.parse(text); } catch { note = "answer is not JSON: " + show(text); }
  } catch (e) {
    note = e.name === "TimeoutError" ? "no answer in 60 s" : e.message;
  }
  console.log(`${c.q ?? JSON.stringify(c)}\n  status=${status} ${Date.now() - t0}ms${note ? "  " + note : ""}`);
  for (const [path, want] of Object.entries(c.expect || {})) {
    total++;
    const actual = json === undefined ? undefined : getPath(json, path);
    const ok = json !== undefined && check(actual, want);
    if (ok) pass++;
    console.log(`  ${ok ? "PASS" : "FAIL"} ${path} ${JSON.stringify(want)}  got ${show(actual)}`);
  }
}
console.log(`\n${pass}/${total} passed`);
process.exit(pass === total ? 0 : 1);
