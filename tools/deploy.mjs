// Deploys exactly the last commit to Vercel production, ignoring half-done files on disk.
// Takes `git archive HEAD` of the app folder into a fresh temp folder, copies in .vercel,
// runs `vercel deploy --prod --yes` there, then checks the live link. The temp folder is
// always deleted.
//
//   node tools/deploy.mjs [--dir web] [--url https://x.vercel.app] [--dry]
//
//   --dir web   the app folder, relative to where you run this (default web)
//   --url       poll this link for up to 60 s until it answers 200
//   --dry       do everything except the deploy, and print the command it would run
//
// Needs <dir>/.vercel (run `vercel link` inside <dir> once). The Vercel CLI is found from
// VERCEL_BIN, then node_modules/.bin up the folder tree, then npx.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn, spawnSync } from "node:child_process";

const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf("--" + k); return i === -1 ? d : argv[i + 1]; };
const dry = argv.includes("--dry");
const dir = opt("dir", "web");
const liveUrl = opt("url");
const git = (args, o = {}) => spawnSync("git", args, { encoding: "utf8", ...o });

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

let tmp;
let ok = true;
try {
  const top = git(["rev-parse", "--show-toplevel"]);
  if (top.status !== 0) throw new Error("not inside a git repository");
  const root = top.stdout.trim();
  const abs = path.resolve(dir);
  const rel = path.relative(root, abs).split(path.sep).join("/");
  if (!rel || rel.startsWith("..")) throw new Error(`${dir} is not a folder inside this repository`);
  if (!fs.existsSync(path.join(abs, ".vercel"))) throw new Error(`${dir}/.vercel is missing: run \`vercel link\` inside ${dir} first`);

  const commit = git(["log", "-1", "--format=%h %s", "HEAD"], { cwd: root }).stdout.trim();
  if (!commit) throw new Error("the repository has no commits yet");

  const dirty = git(["status", "--porcelain", "--", rel], { cwd: root }).stdout.split(/\r?\n/).filter(Boolean);
  if (dirty.length) {
    console.log(`WARNING: ${dirty.length} uncommitted change(s) under ${dir} will NOT ship:`);
    for (const l of dirty.slice(0, 10)) console.log("  " + l);
    if (dirty.length > 10) console.log(`  ...and ${dirty.length - 10} more`);
  }

  tmp = fs.mkdtempSync(path.join(os.tmpdir(), "deploy-"));
  const arc = git(["archive", "--format=tar", "HEAD", rel], { cwd: root, encoding: "buffer", maxBuffer: 1 << 30 });
  if (arc.status !== 0) throw new Error("git archive failed: " + String(arc.stderr).trim());
  // cwd plus stdin keeps drive letters out of tar's arguments (GNU tar reads "C:" as a host)
  const untar = spawnSync("tar", ["-xf", "-"], { cwd: tmp, input: arc.stdout });
  if (untar.status !== 0) throw new Error("tar failed: " + String(untar.stderr).trim());
  const appDir = path.join(tmp, ...rel.split("/"));
  fs.cpSync(path.join(abs, ".vercel"), path.join(appDir, ".vercel"), { recursive: true });
  console.log(`archived HEAD ${commit}\nbuild folder ${appDir}`);

  const cmd = vercelCommand() + " deploy --prod --yes";
  if (dry) {
    console.log(`DRY RUN: would run in ${appDir}:\n  ${cmd}`);
  } else {
    const code = await new Promise((resolve) => {
      const child = spawn(cmd, { cwd: appDir, shell: true });
      const seen = (buf) => {
        for (const l of buf.toString().split(/\r?\n/)) {
          if (/https?:\/\/\S+|ready|error|fail/i.test(l)) console.log(l.trim());
        }
      };
      child.stdout.on("data", seen);
      child.stderr.on("data", seen);
      child.on("close", resolve);
    });
    if (code !== 0) throw new Error("vercel deploy exited with code " + code);
  }

  if (liveUrl && !dry) {
    const t0 = Date.now();
    let status = "no answer";
    while (Date.now() - t0 < 60000) {
      try {
        const res = await fetch(liveUrl, { redirect: "follow", signal: AbortSignal.timeout(10000) });
        status = res.status;
        if (res.status === 200) break;
      } catch (e) { status = e.message; }
      await new Promise((r) => setTimeout(r, 3000));
    }
    if (status === 200) console.log(`live check: ${liveUrl} answers 200`);
    else { ok = false; console.log(`live check FAILED: ${liveUrl} gave ${status} after 60 s`); }
  } else if (liveUrl) {
    console.log("dry run: live check skipped");
  }
  console.log(`${dry ? "would ship" : "shipped"} commit ${commit}`);
} catch (e) {
  ok = false;
  console.error("deploy failed: " + e.message);
} finally {
  if (tmp) fs.rmSync(tmp, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
}
process.exit(ok ? 0 : 1);
