// Records the walkthrough video of the real app: a phone and a floor, playing one whole duel, cut to 1920x1080 with a big cursor and no sound.
//
//   npm.cmd run build            (once, and again after any change to the app)
//   node tools/walkthrough.mjs   (from PowerShell; it starts its own `vite preview` on port 4180 and stops it)
//   node tools/walkthrough.mjs --assemble   (skip the recording, cut the files again from the last raw recording)
//
// The files land in C:\Users\<you>\Downloads\ttiles-walkthrough (set WALKTHROUGH_OUT to change it): ttiles-walkthrough.mp4 and
// shot-list.md. The video is H.264, 30 frames a second, with no audio track.
// How it works: a floor page (1920x1080) and a phone page (432x768 at 2.5x, so 1080x1920) run in two separate browsers.
// Both are recorded at the same time (the browser's screencast, piped to ffmpeg). A script clicks the phone like a person and presses
// the mouse on the floor like feet. A spy on the link reads the stage's State so the feet land on the beat.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn, spawnSync } from "node:child_process";
import WebSocket from "ws";
import { launch } from "./browser.mjs";
import { songs } from "../src/songs/index.js";
import { splitParts } from "../src/game/parts.js";
import { isHold, TRAVEL_MS } from "../src/game/engine.js";

const PORT = 4180;
const BASE = `http://localhost:${PORT}`;
const ROOM = "GREENB22";
const SONG_ID = "greensleeves"; // traditional, 38.8 s, 29 tiles for each of two duel players
const OUT = process.env.WALKTHROUGH_OUT ?? path.join(os.homedir(), "Downloads", "ttiles-walkthrough");
const RAW = path.join(os.tmpdir(), "ttiles-walkthrough-raw"); // the raw recordings and the marks, kept so --assemble can cut again
const GREEN = "0x4FAF79"; // the Green Line's half-way green, HERO.green in src/app/lines.js
const FLOOR = { width: 1920, height: 1080, deviceScaleFactor: 1 };
// The phone browser is launched with --force-device-scale-factor=2.5, and the viewport leaves the scale alone (0), because the
// recorder only gets full-size frames (1080x1920) from a real scale factor, not from an emulated one.
const PHONE = { width: 432, height: 768, deviceScaleFactor: 0, isMobile: true, hasTouch: true };
const BIAS_MS = Number(process.env.WALKTHROUGH_BIAS ?? 0); // how early (negative) or late a foot lands against the tile's time

const open = []; // recordings still running, stopped in the `finally` if a scene fails
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const marks = {}; // name -> wall clock ms, for each moment the shot list needs
const mark = (name) => { marks[name] = Date.now(); console.log(`  mark ${name}`); };
const say = (s) => console.log(s);

// ---------- waiting ----------

async function until(what, fn, ms = 10000) {
  const t0 = Date.now();
  let last;
  while (Date.now() - t0 < ms) {
    try { last = await fn(); if (last) return last; } catch (e) { last = e.message; }
    await sleep(80);
  }
  throw new Error(`Timed out after ${ms / 1000} s waiting for ${what}${typeof last === "string" ? ` (last: ${last})` : ""}`);
}

// ---------- the server ----------

// Uses a preview server already answering on the port, or starts one. Returns a function that stops it.
async function ensureServer() {
  const up = () => fetch(BASE).then((r) => r.ok, () => false);
  if (await up()) { say("Using the server already on port " + PORT); return () => {}; }
  const vite = path.resolve("node_modules/vite/bin/vite.js");
  const child = spawn(process.execPath, [vite, "preview", "--port", String(PORT), "--strictPort"], { stdio: "ignore" });
  await until("the preview server", up, 15000);
  say("Started vite preview on port " + PORT);
  return () => child.kill();
}

// ---------- the cursor and the repaint tick (run inside every page) ----------

// A solid yellow disc with an ink outline that follows the mouse, a yellow ring (ink on both edges) that grows and fades on a click, and a nearly invisible
// one pixel element that keeps changing so the recorder keeps getting frames from a page that sits still.
function overlayInPage({ size, ring }) {
  const KEY = "__wwpos";
  const add = () => {
    const style = document.createElement("style");
    style.textContent = `
#ww-cursor{position:fixed;left:0;top:0;width:${size}px;height:${size}px;margin:${-size / 2}px 0 0 ${-size / 2}px;border-radius:50%;background:#FFD84D;border:${ring}px solid #141414;box-shadow:0 4px 14px rgba(0,0,0,.35);box-sizing:border-box;z-index:2147483647;pointer-events:none;transition:scale 90ms ease-out}
#ww-cursor[data-down]{scale:.8}
.ww-ripple{position:fixed;left:0;top:0;width:${size}px;height:${size}px;margin:${-size / 2}px 0 0 ${-size / 2}px;border-radius:50%;border:${ring}px solid #FFD84D;box-shadow:0 0 0 ${ring * 0.6}px #141414,inset 0 0 0 ${ring * 0.6}px #141414;box-sizing:border-box;z-index:2147483646;pointer-events:none}
@keyframes ww-tick{from{background:rgba(0,0,0,.02)}to{background:rgba(0,0,0,.03)}}
#ww-tick{position:fixed;right:0;bottom:0;width:1px;height:1px;pointer-events:none;z-index:2147483647;animation:ww-tick .05s linear infinite alternate}`;
    const cursor = document.createElement("div");
    cursor.id = "ww-cursor";
    const tick = document.createElement("div");
    tick.id = "ww-tick";
    document.head.append(style);
    document.documentElement.append(cursor, tick);
    const place = (x, y) => { cursor.style.transform = `translate(${x}px,${y}px)`; };
    const saved = sessionStorage.getItem(KEY);
    place(...(saved ? JSON.parse(saved) : [-200, -200]));
    let at = saved ? JSON.parse(saved) : [-200, -200];
    window.addEventListener("mousemove", (e) => { at = [e.clientX, e.clientY]; place(...at); sessionStorage.setItem(KEY, JSON.stringify(at)); }, true);
    window.addEventListener("mousedown", (e) => {
      cursor.dataset.down = "1";
      const r = document.createElement("div");
      r.className = "ww-ripple";
      r.style.transform = `translate(${e.clientX}px,${e.clientY}px)`;
      document.documentElement.append(r);
      const grow = r.animate([{ scale: 1, opacity: 0.95 }, { scale: 3, opacity: 0 }], { duration: 350, easing: "ease-out" });
      grow.onfinish = () => r.remove();
    }, true);
    window.addEventListener("mouseup", () => { delete cursor.dataset.down; }, true);
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", add); else add();
}

// A page of its own in a new browser window: cursor, recorder, and no cover art (the covers come from commercial
// recordings, and this video is public, so the app falls back to its plain tile).
async function openPage(browser, viewport, cursorPx, ringPx) {
  const page = await browser.newPage();
  await page.setViewport(viewport);
  await page.evaluateOnNewDocument(overlayInPage, { size: cursorPx, ring: ringPx });
  await page.setRequestInterception(true);
  page.on("request", (r) => (/itunes\.apple\.com|mzstatic\.com/.test(r.url()) ? r.abort() : r.continue()));
  page.on("pageerror", (e) => say(`  page error: ${e.message}`));
  return page;
}

// ---------- the mouse ----------

// The middle of an element, after scrolling it to the middle of the screen.
const centre = async (el) => {
  await el.evaluate((e) => e.scrollIntoView({ block: "center" }));
  await sleep(200);
  const b = await el.boundingBox();
  return [b.x + b.width / 2, b.y + b.height / 2];
};

// The cursor glides to a point (steps = how many small moves) and clicks it with real mouse events.
async function glideClick(page, [x, y], { steps = 24, press = 120 } = {}) {
  await page.mouse.move(x, y, { steps });
  await sleep(250); // the cursor rests on the control for a moment, so a viewer sees where it is going to click
  await page.mouse.down();
  await sleep(press);
  await page.mouse.up();
}

async function findButton(page, text) {
  const found = await until(`a button that says "${text}"`, async () => {
    const h = await page.evaluateHandle((s) => [...document.querySelectorAll("button")].find((b) => b.textContent.includes(s) && !b.disabled && b.offsetParent) ?? null, text);
    return h.asElement();
  });
  return found;
}
const clickButton = async (page, text, opts) => glideClick(page, await centre(await findButton(page, text)), opts);
const clickSelector = async (page, selector, opts) => {
  const el = await until(`"${selector}"`, () => page.$(selector), 15000);
  await glideClick(page, await centre(el), opts);
};

// ---------- the link spy: the stage's latest State, and a way to act as a phone ----------

function openSpy() {
  const spy = { state: null, flips: {}, ws: new WebSocket(`${BASE.replace(/^http/, "ws")}/link`) };
  spy.ws.on("message", (data) => {
    let m;
    try { m = JSON.parse(data.toString()); } catch { return; }
    if (m.type !== "state") return;
    if (m.status !== spy.state?.status) spy.flips[m.status] = Date.now(); // when the stage changed to this status
    spy.state = m;
  });
  spy.ws.on("error", () => {});
  spy.send = (m) => spy.ws.readyState === 1 && spy.ws.send(JSON.stringify(m));
  return spy;
}
const status = (spy, name, ms) => until(`the stage to be "${name}"`, () => spy.state?.status === name, ms);

// ---------- the recorder ----------

// Records a page with the browser's own screencast (the same frames puppeteer's page.screencast() gets) and feeds them to ffmpeg,
// which writes H.264 straight away. page.screencast() encodes VP9 on one thread, and on this laptop it fell minutes behind a
// 1080p page, so stopping it took longer than the take. Frame times are the moment each frame arrives; ffmpeg fills the
// gaps to a steady 30 frames a second. A page that does not repaint sends nothing, so every page carries the repaint tick.
async function record(page, name) {
  const file = path.join(RAW, `${name}.mp4`);
  const client = await page.createCDPSession();
  const ffmpeg = spawn("ffmpeg", ["-loglevel", "error", "-y", "-use_wallclock_as_timestamps", "1", "-f", "image2pipe", "-c:v", "mjpeg", "-i", "pipe:0",
    "-vf", "fps=30", "-c:v", "libx264", "-preset", "ultrafast", "-crf", "18", "-pix_fmt", "yuv420p", "-an", "-movflags", "frag_keyframe+empty_moov", file], { stdio: ["pipe", "ignore", "inherit"] });
  ffmpeg.stdin.on("error", () => {});
  const closed = new Promise((r) => ffmpeg.on("close", r));
  client.on("Page.screencastFrame", ({ data, sessionId }) => {
    client.send("Page.screencastFrameAck", { sessionId }).catch(() => {});
    ffmpeg.stdin.write(Buffer.from(data, "base64"));
  });
  await client.send("Page.startScreencast", { format: "jpeg", quality: 92, maxWidth: 1920, maxHeight: 1920, everyNthFrame: 1 });
  const made = {
    file, t0: Date.now(), stopped: false,
    stop: async () => {
      if (made.stopped) return;
      made.stopped = true;
      await client.send("Page.stopScreencast").catch(() => {});
      ffmpeg.stdin.end();
      await closed;
    },
  };
  open.push(made);
  return made;
}

// ---------- the poster, as seen by a phone camera ----------

// Makes the video the fake camera plays: a grey wall for 3 seconds, then the poster slides into the frame and stays
// still, whole and straight. The camera loops it. 720x960, 30 frames a second, written as .y4m.
async function makeCameraClip(browser) {
  const png = path.join(RAW, "poster.png");
  const page = await browser.newPage();
  await page.setViewport({ width: 1000, height: 1300, deviceScaleFactor: 2 });
  await page.goto(`${BASE}/poster.html?room=${ROOM}&line=Green-B&dir=1&at=place-bucen&car=2`, { waitUntil: "networkidle0" });
  await sleep(800);
  await (await page.$("#poster")).screenshot({ path: png });
  await page.close();
  const y4m = path.join(RAW, "poster-camera.y4m");
  const slide = "clip((t-3)/1.5,0,1)";
  const x = `28+(720-28)*(1-(${slide}*${slide}*(3-2*${slide})))`;
  const run = spawnSync("ffmpeg", ["-y", "-loglevel", "error",
    "-f", "lavfi", "-i", "color=c=0x4b525c:s=720x960:r=30:d=9",
    "-loop", "1", "-framerate", "30", "-i", png,
    "-filter_complex", `[1:v]scale=664:-2:flags=lanczos[p];[0:v]vignette=PI/3.5[w];[w][p]overlay=x='${x}':y=48:eval=frame,format=yuv420p`,
    "-t", "9", "-r", "30", y4m], { encoding: "utf8" });
  if (run.status !== 0) throw new Error(`ffmpeg could not make the camera clip: ${run.stderr}`);
  return y4m;
}

// ---------- the floor ----------

// Where a foot goes in a seat's pad: inside its foot square, on the page's pixels.
const padPoint = (spy, seat) => {
  const { rect } = spy.state.layout.spots.find((s) => s.id === seat);
  return [(rect.u + rect.w / 2) * FLOOR.width, (rect.v + rect.h * 0.82) * FLOOR.height];
};

// One foot lands (mouse down for `down` ms) in a seat's pad, the cursor gliding there first.
async function step(floor, spy, seat, down = 90, steps = 8) {
  const [x, y] = padPoint(spy, seat);
  await floor.mouse.move(x, y, { steps });
  await floor.mouse.down();
  await sleep(down);
  await floor.mouse.up();
}

// The warm-up: both pads tap, one after the other, about one tap a second each, until the stage ends the warm-up.
async function warmUpTaps(floor, spy) {
  const t0 = Date.now();
  while (spy.state.status === "warmup" && Date.now() - t0 < 14000) {
    for (const seat of spy.state.players.map((p) => p.spotId)) {
      if (spy.state.status !== "warmup") return;
      await step(floor, spy, seat);
      await sleep(430);
    }
  }
}

// Plays a song on the floor by landing feet on the beat. `plan` is a list of { seat, at, hold } (times in ms of song
// clock; hold = how long to stay down, 0 for a tap). `origin` is the wall clock time of song time 0. The mouse is one
// pointer, so a tile that would need the pointer while it is busy is skipped.
async function playPlan(floor, spy, plan, origin) {
  for (const e of plan) {
    const target = origin + e.at + BIAS_MS;
    const lead = 150; // arrive at the pad this long before the beat
    if (Date.now() > target - 60) continue; // too late to land on this one
    if (target - Date.now() > lead + 20) await sleep(target - Date.now() - lead);
    const [x, y] = padPoint(spy, e.seat);
    await floor.mouse.move(x, y, { steps: 5 });
    while (Date.now() < target) await sleep(1);
    await floor.mouse.down();
    await sleep(e.hold ? e.hold + 60 : 90);
    await floor.mouse.up();
  }
}

// The duel's plan: the first seat plays every tile (holds too), the second plays about half of its tiles and none of its holds.
function duelPlan(song, seats, good, weak) {
  const parts = splitParts(song, seats.length, { mode: "versus" });
  const beatMs = 60000 / song.bpm;
  const plan = [];
  parts.forEach((part, i) => {
    let k = 0;
    for (const n of part.notes) {
      const hold = isHold(n, part.bpm);
      if (seats[i] === good) plan.push({ seat: good, at: n.beat * beatMs, hold: hold ? n.beats * beatMs : 0 });
      else if (seats[i] === weak && !hold && k++ % 2 === 0) plan.push({ seat: weak, at: n.beat * beatMs, hold: 0 });
    }
  });
  return plan.sort((a, b) => a.at - b.at);
}

// ---------- the scenes ----------

// The floor opens first and sits in its lobby with the QR code. Pressing a key takes the "Press any key for sound" banner away.
async function sceneFloorLobby(c) {
  c.floor = await openPage(c.floorBrowser, FLOOR, 64, 5);
  await c.floor.goto(`${BASE}/stage.html?feet=mouse&seats=4&facing=0&room=${ROOM}`, { waitUntil: "load" });
  await status(c.spy, "lobby", 15000);
  await sleep(500);
  await c.floor.keyboard.press("ShiftLeft");
  await until("the floor's sound to unlock (the banner must be gone before recording)", () => c.floor.evaluate(() => !window.synth.locked()), 8000);
  const joinUrl = await until("the QR code's address", () => c.floor.$eval("canvas", (e) => e.dataset.joinUrl), 20000);
  if (!joinUrl.startsWith("https://ttiles.us")) throw new Error(`the QR code holds ${joinUrl}, not https://ttiles.us. The relay may be down.`);
  say(`  QR holds ${joinUrl}`);
  await c.floor.mouse.move(960, 1000, { steps: 2 }); // park the cursor low, away from the QR code
  await sleep(1500);
}

// a. The phone opens the bare address: the welcome scanner. The fake camera shows the wall, then the poster slides in.
async function sceneWelcome(c) {
  // The phone is shown 1.4 times larger in the video (768 css px become 1080), so 46 and 3.5 come out at 64 and 5 px wide.
  c.phone = await openPage(c.phoneBrowser, PHONE, 46, 3.5);
  await c.phone.goto(`${BASE}/`, { waitUntil: "load" });
  await until("the welcome screen", () => c.phone.evaluate(() => /Welcome/.test(document.body.innerText)), 10000);
  await c.phone.mouse.move(216, 600, { steps: 2 });
  c.phoneRec = await record(c.phone, "phone"); // the recording opens on the welcome screen
  mark("a");
  await until("the scanner to read the poster", () => c.phone.evaluate(() => /Car 2/.test(document.body.innerText) || /getting off/i.test(document.body.innerText)), 25000);
  mark("a-read");
}

// b. "Where are you getting off?": glide down the list, click the stop three ahead.
async function sceneStops(c) {
  await until("the stops question", () => c.phone.evaluate(() => /Where are you getting off/.test(document.body.innerText)), 15000);
  await until("live stops", () => c.phone.$(".stops-body .map li button.row"), 20000);
  await sleep(300);
  mark("b");
  await sleep(2800);
  const rows = await c.phone.$$(".stops-body .map li button.row");
  if (rows.length < 3) throw new Error(`only ${rows.length} stops ahead`);
  for (const row of rows.slice(0, 3)) { // glide down the list
    const [x, y] = await centre(row);
    await c.phone.mouse.move(x, y, { steps: 18 });
    await sleep(250);
  }
  mark("b-click");
  await glideClick(c.phone, await centre(rows[2]), { steps: 6 });
  await sleep(1200);
}

// c. The recommended song, then "See more songs", then the chosen song.
async function sceneSong(c) {
  await until("the recommended ticket", () => c.phone.$(".ticket h2"), 20000);
  await sleep(300);
  c.recommended = await c.phone.$eval(".ticket h2", (e) => e.textContent.trim());
  mark("c");
  await sleep(5000); // talk-track line 5
  await clickButton(c.phone, "See more songs");
  mark("c-more");
  await until("the song sheet", () => c.phone.$("dialog.sheet button.row"), 5000);
  await sleep(3000);
  const want = songs.find((s) => s.id === SONG_ID).title;
  const rows = await c.phone.$$("dialog.sheet button.row");
  const names = await Promise.all(rows.map((r) => r.$eval(".name", (e) => e.textContent.trim())));
  const at = names.indexOf(want);
  if (at === -1) throw new Error(`"${want}" is not in the song list: ${names.join(", ")}`);
  mark("c-pick");
  await glideClick(c.phone, await centre(rows[at]), { steps: 20 });
  await sleep(1200);
  c.song = await c.phone.$eval(".ticket h2", (e) => e.textContent.trim());
  if (c.song !== want) throw new Error(`the ticket says "${c.song}", not "${want}"`);
  mark("c-chosen");
  await sleep(1500);
  await clickButton(c.phone, "Play this song");
  await sleep(1000);
}

// d. Seats: Team is selected, click Duel, take seat 2 and seat 4, click Ready.
async function sceneSeats(c) {
  await until("the seats screen", () => c.phone.$(".pad"), 10000);
  await sleep(300);
  mark("d");
  await sleep(2200);
  await clickButton(c.phone, "Duel");
  mark("d-duel");
  await sleep(1000);
  for (const seat of [2, 4]) {
    await clickSelector(c.phone, `.pad[data-seat="${seat}"]`, { steps: 20 });
    await until(`seat ${seat} to be yours`, () => c.phone.$eval(`.pad[data-seat="${seat}"]`, (e) => e.dataset.state === "mine"), 4000);
    await sleep(900);
  }
  mark("d-seats");
  await sleep(3000);
  mark("d-ready");
  await clickButton(c.phone, "Ready!");
}

// The yellow "Press any key for sound" banner must never be on the floor while recording.
const noBanner = async (c, when) => {
  if (await c.floor.evaluate(() => window.synth.locked())) throw new Error(`the floor's sound locked again (${when}), so its banner is in the video`);
};

// e and f. The warm-up and the game: the phone watches while the floor's feet do the work.
async function sceneGame(c) {
  await status(c.spy, "warmup", 8000);
  mark("e");
  await noBanner(c, "warm-up");
  await sleep(2600); // the warm-up screens are held still before anyone moves
  await warmUpTaps(c.floor, c.spy);
  await status(c.spy, "countdown", 8000);
  mark("e-count");
  await noBanner(c, "countdown");
  await status(c.spy, "playing", 8000);
  mark("f");
  await noBanner(c, "game");
  const origin = c.spy.flips.playing + TRAVEL_MS; // song time 0: the first beat is due at the line TRAVEL_MS after the tiles appear
  c.song = songs.find((s) => s.id === SONG_ID);
  const seats = c.spy.state.players.map((p) => p.spotId);
  if (seats.join() !== "2,4") throw new Error(`the stage lists seats ${seats}, not 2 and 4`);
  await playPlan(c.floor, c.spy, duelPlan(c.song, seats, 2, 4), origin);
  c.songOrigin = origin;
  await status(c.spy, "results", 20000);
  mark("g-floor");
}

// g. The floor's board, then the phone: leaderboard, Next, share screen, skip, Play again.
async function sceneResults(c) {
  await c.floor.mouse.move(960, 1040, { steps: 6 }); // the feet leave the floor
  await sleep(500);
  await until("the leaderboard on the phone", () => c.phone.evaluate(() => /Winner/.test(document.body.innerText)), 12000);
  await sleep(300);
  mark("g-board");
  await sleep(4200);
  await clickButton(c.phone, "Next");
  await until("the share screen", () => c.phone.$("button.x"), 8000);
  mark("g-share");
  await sleep(4200);
  await clickSelector(c.phone, "button.x");
  await until("Play again?", () => c.phone.evaluate(() => /Play again/i.test(document.body.innerText)), 8000);
  mark("g-again");
  await sleep(4500);
  if (c.spy.state.status !== "lobby") await status(c.spy, "lobby", 15000);
  mark("g-lobby");
  await sleep(4000);
}

// ---------- cutting the files ----------

const ff = (args) => {
  const run = spawnSync("ffmpeg", ["-y", "-loglevel", "error", ...args], { encoding: "utf8" });
  if (run.status !== 0) throw new Error(`ffmpeg failed: ${run.stderr}`);
};
// The recorder's frames are full-range JPEG colour. Players and phones expect the usual limited range, so every first cut converts it.
const RANGE = "scale=in_range=full:out_range=limited,format=yuv420p";
const ENCODE = ["-c:v", "libx264", "-preset", "medium", "-crf", "17", "-pix_fmt", "yuv420p", "-r", "30", "-an", "-movflags", "+faststart"];
const clock = (s) => `${Math.floor(s / 60)}:${(s % 60).toFixed(1).padStart(4, "0")}`;

// Builds the delivered video from the raw recordings and the marks. Times in the shot list come from the marks.
function assemble(m, t0, titles) {
  fs.mkdirSync(OUT, { recursive: true });
  const P = (k) => (m[k] - t0.phone) / 1000; // seconds into the phone recording
  const F = (k) => (m[k] - t0.floor) / 1000; // seconds into the floor recording
  const playAt = (songMs) => (m.songOrigin + songMs - t0.floor) / 1000;

  // Two steady 1920x1080 sources to cut from: the phone centred on the Green Line green (from a moment before the welcome screen
  // settles), and the floor full frame (from just before the phone starts). They stay in the temp folder.
  const startP = Math.max(0, P("a") - 0.2);
  const startF = Math.max(0, F("a") - 5);
  const phoneFile = path.join(RAW, "phone-1080.mp4");
  const floorFile = path.join(RAW, "floor-1080.mp4");
  ff(["-ss", String(startP), "-i", path.join(RAW, "phone.mp4"), "-vf", `scale=-2:1080:flags=lanczos,${RANGE},pad=1920:1080:(ow-iw)/2:0:color=${GREEN}`, ...ENCODE, phoneFile]);
  ff(["-ss", String(startF), "-i", path.join(RAW, "floor.mp4"), "-vf", `scale=1920:1080:flags=lanczos,${RANGE}`, ...ENCODE, floorFile]);

  // The walkthrough: hard cuts, in the order of the talk track (lines 3 to 7 of docs/DEMO-VIDEO-SCRIPT.md).
  const fAt = (k) => F(k) - startF; // seconds into the floor source
  const pAt = (k) => P(k) - startP; // seconds into the phone source
  const cuts = [
    { what: "Floor: the lobby with its QR code and four seats. The cursor is parked low.", line: "3 (the poster and its QR code)", src: floorFile, from: fAt("a") - 3.6, len: 3.0 },
    { what: `Phone: the welcome scanner, the poster slides into the camera and is read. Then "Where are you getting off?" with the live Green Line B stops: the cursor glides down the list and clicks the stop three ahead.`, line: "3 (scan, pick your stop)", src: phoneFile, from: pAt("a"), len: P("b-click") - P("a") + 2.2 },
    { what: "Floor: the warm-up (both pads, one tap a second each), the 3, 2, 1, then the first tiles slide in.", line: "4 (a projector puts tiles at your feet)", src: floorFile, from: fAt("e") + 1.5, len: F("f") + 9 - F("e") - 1.5 },
    { what: `Phone: the recommended-song ticket, "${titles.recommended}", with its length and the ride time.`, line: "5 (the song fits your ride)", src: phoneFile, from: pAt("c"), len: 6.0 },
    { what: `Floor: the game, ${titles.song}. Seat 2 hits every tile and builds a streak, seat 4 misses about half. Points fly to the score.`, line: "6 (the best of the game)", src: floorFile, from: playAt(9000) - startF, len: 12.0 },
    { what: "Floor: the duel board with Winner.", line: "6 (the floor shows who won)", src: floorFile, from: fAt("g-floor") + 0.8, len: 4.2 },
    { what: "Phone: the leaderboard with Winner on top.", line: "6", src: phoneFile, from: pAt("g-board"), len: 4.2 },
    { what: "Floor: back to the lobby with its QR code.", line: "7 (this is TTiles)", src: floorFile, from: fAt("g-lobby") + 0.3, len: 3.0 },
  ];
  const parts = [];
  let at = 0;
  const list = cuts.map(({ src, from, len, ...rest }, i) => {
    const part = path.join(RAW, `cut-${i}.mp4`);
    ff(["-ss", from.toFixed(3), "-i", src, "-t", len.toFixed(3), "-vf", "fps=30", ...ENCODE, part]);
    parts.push(`file '${part.replace(/\\/g, "/")}'`);
    const start = at;
    at += len;
    return { ...rest, start, len };
  });
  const listFile = path.join(RAW, "cuts.txt");
  fs.writeFileSync(listFile, parts.join("\n"));
  ff(["-f", "concat", "-safe", "0", "-i", listFile, ...ENCODE, path.join(OUT, "ttiles-walkthrough.mp4")]);
  return list;
}

// shot-list.md: the time ranges of ttiles-walkthrough.mp4, what is on screen, and the talk-track line.
function writeShotList(list, titles) {
  const rows = list.map((c) => `| ${clock(c.start)} to ${clock(c.start + c.len)} | ${c.what} | ${c.line} |`).join("\n");
  const md = `# TTiles walkthrough: shot list

ttiles-walkthrough.mp4 is 1920x1080, H.264, 30 frames a second, no audio track, with hard cuts. The talk-track lines are 3 to 7 of docs/DEMO-VIDEO-SCRIPT.md.
Times are minutes:seconds into the file. The song is ${titles.song} (traditional). The phone and the floor are one real duel, recorded at the same time.

| Time | On screen | Talk-track line |
|---|---|---|
${rows}
`;
  fs.writeFileSync(path.join(OUT, "shot-list.md"), md);
}

// ---------- run ----------

fs.mkdirSync(RAW, { recursive: true });
const dirs = [];
const dir = (name) => { const d = fs.mkdtempSync(path.join(os.tmpdir(), `ww-${name}-`)); dirs.push(d); return d; };

if (process.argv.includes("--assemble")) {
  const saved = JSON.parse(fs.readFileSync(path.join(RAW, "marks.json"), "utf8"));
  writeShotList(assemble(saved.marks, saved.t0, saved.titles), saved.titles);
  say("Assembled from the last recording.");
  process.exit(0);
}

const stopServer = await ensureServer();
const c = { dir };
const spy = openSpy();
c.spy = spy;
try {
  const clipBrowser = await launch({ userDataDir: dir("clip") });
  const clip = await makeCameraClip(clipBrowser).finally(() => clipBrowser.close());
  c.floorBrowser = await launch({ userDataDir: dir("floor"), defaultViewport: null, args: ["--hide-scrollbars", "--autoplay-policy=no-user-gesture-required"] });
  c.phoneBrowser = await launch({ userDataDir: dir("phone"), defaultViewport: null, args: ["--hide-scrollbars", "--autoplay-policy=no-user-gesture-required", "--force-device-scale-factor=2.5", "--window-size=432,768", "--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream", `--use-file-for-fake-video-capture=${clip}`] });

  await sceneFloorLobby(c);
  const floorRec = await record(c.floor, "floor");
  say("Recording the floor");
  await sleep(4000); // the lobby and its QR code, held
  await sceneWelcome(c);
  await sceneStops(c);
  await sceneSong(c);
  await sceneSeats(c);
  await sceneGame(c);
  await sceneResults(c);
  await c.phoneRec.stop();
  await floorRec.stop();
  const t0 = { phone: c.phoneRec.t0, floor: floorRec.t0 };
  marks.songOrigin = c.songOrigin;
  const titles = { recommended: c.recommended, song: c.song.title };
  fs.writeFileSync(path.join(RAW, "marks.json"), JSON.stringify({ marks, t0, titles }));
  writeShotList(assemble(marks, t0, titles), titles);
  say(`Done. Files are in ${OUT}`);
} catch (e) {
  console.error(`FAILED: ${e.message}`);
  process.exitCode = 1;
} finally {
  spy.ws.close();
  for (const r of open) await r.stop().catch(() => {});
  for (const b of [c.floorBrowser, c.phoneBrowser]) await b?.close().catch(() => {});
  stopServer();
  for (const d of dirs) fs.rmSync(d, { recursive: true, force: true, maxRetries: 3 });
}
