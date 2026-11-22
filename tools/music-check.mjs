// Plays songs on the BUILT stage with no foot ever on a tile, and counts the backing the synth hands to the audio clock.
// Shows: sound is reported locked (and nothing is queued) until a key press; the backing runs through a whole song, through a
// pause and a resume, and through the second song of a queue; and that a song with tiles made from its backing (Sweet Caroline)
// schedules the backing minus those tiles.
//
//   npm.cmd run build ; node tools/music-check.mjs [http://localhost:4173]     (vite preview serves dist on 4173; takes about 3 minutes)
import { readFileSync } from "node:fs";
import WebSocket from "ws";
import { launch } from "./browser.mjs";
import { backingLeft } from "../src/game/chart.js";
import { splitParts } from "../src/game/parts.js";

const origin = process.argv[2] || "http://localhost:4173";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const song = (id) => JSON.parse(readFileSync(new URL(`../songs/${id}.json`, import.meta.url), "utf8"));
let failed = false;
const say = (ok, text) => { if (!ok) failed = true; console.log(`${ok ? "ok  " : "FAIL"} ${text}`); };

// What the stage should schedule for a song played by `seats` seats in team mode: its backing minus the notes that became tiles.
const expected = (id, seats) => {
  const s = song(id);
  return { all: s.backing.length, left: backingLeft(s, splitParts(s, seats)).length, tune: s.notes.length };
};

const browser = await launch({ protocolTimeout: 300000 });
try {
  const errors = [];
  const open = async (query) => {
    const page = await browser.newPage();
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("console", (m) => { if (m.type() === "error" && !/favicon|404/.test(m.text())) errors.push(m.text()); });
    await page.goto(`${origin}/stage.html?${query}`);
    return { page, read: () => page.evaluate(() => ({ locked: window.synth.locked(), ...window.synth.scheduled() })) };
  };

  // ---- 1. twinkle, then greensleeves (the demo queue), with a key press to unlock, and a pause in the middle of twinkle.
  const demo = await open("seats=2&demo=1&autostart=1&facing=0");
  await sleep(4000); // the stage started on its own; nobody has pressed a key
  const before = await demo.read();
  say(before.locked && before.backing === 0, `before any key: locked ${before.locked}, backing scheduled ${before.backing} (silent, says so, queues nothing)`);
  await demo.page.keyboard.press("KeyX"); // a key with no job in the game: it only unlocks sound
  await sleep(500);
  say(!(await demo.read()).locked, "after one key press: sound is unlocked");

  const series = [];
  const started = Date.now();
  let paused = null;
  while (Date.now() - started < 150000) {
    const t = (Date.now() - started) / 1000;
    const now = await demo.read();
    series.push({ t, ...now });
    if (!paused && now.backing > 60) { await demo.page.keyboard.press("KeyP"); paused = { press: t, at: now }; } // twinkle is under way: pause
    else if (paused && !paused.to && t > paused.press + 4) { paused.during = now; await demo.page.keyboard.press("KeyP"); paused.to = t; } // resume
    const flat = series.filter((s) => s.t > t - 25);
    if (paused?.to && t > paused.to + 60 && flat.at(0).backing === now.backing) break; // nothing new for 25 s: the queue is over
    await sleep(1000);
  }
  const last = series.at(-1);
  say(paused.during.backing - series.find((s) => s.t > paused.press + 1).backing <= 0, `paused for 4 s: backing scheduled stayed at ${paused.during.backing} (nothing new while the song is frozen)`);
  const after = series.find((s) => s.t > paused.to + 3);
  say(after.backing > paused.during.backing, `3 s after resume: ${paused.during.backing} -> ${after.backing} (the backing carries on)`);

  // The break between songs is the first stretch of 6 s with nothing new after the resume (the 8 s results screen): the counts either side belong to each song.
  let flat = 0, end = -1;
  for (let i = 1; i < series.length && end < 0; i++) {
    flat = series[i].backing === series[i - 1].backing ? flat + 1 : 0;
    if (flat >= 6 && series[i].t > paused.to + 3) end = i - flat;
  }
  const firstSong = series[end];
  const tw = expected("twinkle", 2), gs = expected("greensleeves", 2);
  const near = (got, want) => got >= want - 4 && got <= want + 12; // a pause starts the scan over, which can schedule a few entries twice
  say(near(firstSong.backing, tw.left), `first song (twinkle): ${firstSong.backing} backing entries scheduled, its file gives ${tw.left}; tune notes ${firstSong.guide} of ${tw.tune}`);
  say(near(last.backing - firstSong.backing, gs.left), `second song (greensleeves): ${last.backing - firstSong.backing} backing entries scheduled, its file gives ${gs.left}; tune notes ${last.guide - firstSong.guide} of ${gs.tune}`);
  await demo.page.close();

  // ---- 2. Sweet Caroline, started from a "phone" on the link: tiles made from its backing must not also play in it.
  const sc = await open("seats=2&demo=1&facing=0");
  await sleep(2500);
  await sc.page.keyboard.press("KeyX");
  const phone = new WebSocket(`${origin.replace(/^http/, "ws")}/link`);
  await new Promise((r, j) => { phone.on("open", r); phone.on("error", j); });
  const send = (m) => phone.send(JSON.stringify({ clientId: "music-check", ...m }));
  send({ type: "join" });
  await sleep(500);
  send({ type: "start", songIds: ["sweet-caroline"], transit: null });
  const t0 = Date.now();
  let top = 0, flatSince = Date.now();
  while (Date.now() - t0 < 150000) {
    await sleep(1000);
    const now = await sc.read();
    if (now.backing > top) { top = now.backing; flatSince = Date.now(); }
    if (top > 100 && Date.now() - flatSince > 12000) break; // the song has ended
  }
  phone.close();
  const sw = expected("sweet-caroline", 2);
  const final = await sc.read();
  say(final.backing >= sw.left - 3 && final.backing <= sw.left && sw.left < sw.all, `sweet caroline: ${final.backing} backing entries scheduled; its backing holds ${sw.all}, ${sw.all - sw.left} of them became tiles, so ${sw.left} are left`);
  say(final.guide > 0, `sweet caroline: ${final.guide} tune notes scheduled (its file has ${sw.tune})`);

  say(errors.length === 0, errors.length ? `page errors: ${errors.slice(0, 3).join(" | ")}` : "no page errors");
} finally {
  await browser.close();
}
process.exit(failed ? 1 : 0);
