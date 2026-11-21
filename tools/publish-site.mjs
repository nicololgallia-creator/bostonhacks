// Publishes the phone page to the web exactly as the last commit has it, so a builder's half-done files never go live.
// Run it from PowerShell at the project root (the build fails from Git Bash on this machine):
//
//   node tools/publish-site.mjs [--work <folder>] [--dry]
//
// What it does:
//   1. Unpacks `git archive HEAD` into a work folder (default: the system temp folder), with this project's
//      node_modules linked in, .env.local copied (the public MBTA key and the site address), and the pose model copied.
//   2. Builds there. The work folder's dist is a clean copy of the whole app: `vite preview` can serve it for demos.
//   3. Copies only the phone page (no stage, no setup pages, no pose model) into .deploy/platform-piano.
//   4. `vercel deploy --prod --yes` there, then checks the live page loads the same script file as the build.
// Needs the Vercel CLI: set VERCEL_BIN, or it uses the one in agent-work. --dry stops before step 4.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execSync } from "node:child_process";

const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf("--" + k); return i === -1 ? d : argv[i + 1]; };
const root = process.cwd();
const work = path.resolve(opt("work", path.join(os.tmpdir(), "platform-piano-site")));
const site = path.join(root, ".deploy", "platform-piano");
const LIVE = "https://platform-piano.vercel.app/";
const NOT_PUBLIC = ["stage.html", "seats.html", "track.html", "floor-pilot.html", "mediapipe", "qa-fixtures"]; // the floor and setup stay on the laptop
const run = (cmd, cwd = root) => execSync(cmd, { cwd, stdio: ["ignore", "pipe", "pipe"], encoding: "utf8" });

if (!fs.existsSync(path.join(root, ".git"))) throw new Error("Run this from the project root.");
const head = run("git rev-parse --short HEAD").trim();
console.log(`Publishing commit ${head}`);

// 1. A clean copy of the commit. Everything goes except the link to node_modules: deleting through it would delete the real one.
fs.mkdirSync(work, { recursive: true });
for (const name of fs.readdirSync(work)) if (name !== "node_modules") fs.rmSync(path.join(work, name), { recursive: true, force: true });
const tarFile = path.join(os.tmpdir(), `platform-piano-${head}.tar`);
run(`git archive --format=tar -o "${tarFile}" HEAD`);
run(`"${path.join(process.env.SystemRoot ?? "C:\\Windows", "System32", "tar.exe")}" -xf "${tarFile}" -C "${work}"`);
fs.rmSync(tarFile, { force: true });
if (!fs.existsSync(path.join(work, "node_modules"))) run(`cmd /c mklink /J "${path.join(work, "node_modules")}" "${path.join(root, "node_modules")}"`);
fs.copyFileSync(path.join(root, ".env.local"), path.join(work, ".env.local"));
fs.cpSync(path.join(root, "public", "mediapipe"), path.join(work, "public", "mediapipe"), { recursive: true });

// 2. Build.
run("npm.cmd run build", work);
const dist = path.join(work, "dist");
const script = /assets\/index-[\w-]+\.js/.exec(fs.readFileSync(path.join(dist, "index.html"), "utf8"))?.[0];
if (!script) throw new Error("The build has no phone page script in index.html.");
console.log(`Built. The whole app is in ${dist}`);

// 3. The phone page only. The .vercel folder there is the link to the Vercel project: keep it.
fs.mkdirSync(site, { recursive: true });
for (const name of fs.readdirSync(site)) if (name !== ".vercel") fs.rmSync(path.join(site, name), { recursive: true, force: true });
fs.cpSync(dist, site, { recursive: true });
for (const name of NOT_PUBLIC) fs.rmSync(path.join(site, name), { recursive: true, force: true });

if (argv.includes("--dry")) { console.log(`Dry run: stopped before the deploy. The site folder is ${site}`); process.exit(0); }

// 4. Deploy and check.
const vercel = process.env.VERCEL_BIN ?? "C:\\Users\\nicol\\agent-work\\tools\\shot\\node_modules\\.bin\\vercel.cmd";
run(`"${vercel}" deploy --prod --yes`, site);
let live = "";
for (let i = 0; i < 20 && !live.includes(script); i++) {
  await new Promise((r) => setTimeout(r, 3000));
  try { live = await (await fetch(LIVE, { cache: "no-store" })).text(); } catch { /* try again */ }
}
if (!live.includes(script)) throw new Error(`The live page at ${LIVE} does not load ${script} yet. Check the Vercel dashboard.`);
console.log(`Live: ${LIVE} serves commit ${head} (${script})`);
