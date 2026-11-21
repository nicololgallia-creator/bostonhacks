// The demo path, start to finish, with two real browser pages: a stage and a phone.
// Run it before every demo:  node qa/e2e/demo-path.mjs [--base http://localhost:4173]
// It prints one line per step (PASS or FAIL and why) and exits 0 when every step passed, else 1.
// Use the built copy (vite preview), not the dev server: the dev server reloads pages whenever a builder saves a file.
//
// How it reads the game: a small listener on the link (ws://<base>/link) keeps the stage's latest State.
// How it plays: the stage runs with ?feet=mouse, so a mouse press on the stage is a foot landing.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import WebSocket from "ws";
import { launch } from "../../tools/browser.mjs";

const arg = process.argv.indexOf("--base");
const BASE = (arg > 0 ? process.argv[arg + 1] : "http://localhost:4173").replace(/\/$/, "");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const t = { errors: [], seen: [] }; // t.errors: every console or page error; t.seen: the steps' results

// ---------- small helpers ----------

// Waits until fn() gives something true, then returns it. On timeout it says what it was waiting for and the last answer.
async function until(what, fn, ms = 8000) {
  const t0 = Date.now();
  let last;
  while (Date.now() - t0 < ms) {
    try { last = await fn(); if (last) return last; } catch (e) { last = e.message; }
    await sleep(100);
  }
  throw new Error(`Timed out after ${ms / 1000} s waiting for ${what}${typeof last === "string" ? ` (last: ${last})` : ""}`);
}

const pageText = (page) => page.evaluate(() => document.body.innerText.replace(/\s+/g, " ").trim().slice(0, 200));
const shot = (page, n, name) => page.screenshot({ path: path.resolve("shots", `e2e-${n}-${name}.png`) });

// Listens on the link and keeps the stage's latest State and the list of statuses it has been through.
function openSpy() {
  const spy = { state: null, statuses: [], ids: new Set(), ws: new WebSocket(`${BASE.replace(/^http/, "ws")}/link`) };
  spy.ws.on("message", (data) => {
    let m;
    try { m = JSON.parse(data.toString()); } catch { return; }
    if (m.type !== "state") return;
    spy.state = m;
    for (const p of m.players) spy.ids.add(p.clientId);
    if (spy.statuses.at(-1) !== m.status) spy.statuses.push(m.status);
  });
  spy.ws.on("error", () => {});
  spy.send = (m) => spy.ws.readyState === 1 && spy.ws.send(JSON.stringify(m));
  return spy;
}

async function newPage(browser, who, viewport) {
  const page = await (await browser.createBrowserContext()).newPage(); // its own context: its own storage and its own phone id
  await page.setViewport(viewport);
  page.on("console", (m) => { if (m.type() === "error") t.errors.push(`${who}: ${m.text()}`); });
  page.on("pageerror", (e) => t.errors.push(`${who} (page error): ${e.message}`));
  return page;
}
const newStage = (browser) => newPage(browser, "stage", { width: 1280, height: 720 });
const newPhone = (browser, who) => newPage(browser, who, { width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 1 });

// Clicks the first button whose text contains `text`.
async function clickButton(page, text) {
  await until(`a button that says "${text}"`, async () => {
    const found = await page.evaluateHandle((s) => [...document.querySelectorAll("button")].find((b) => b.textContent.includes(s) && !b.disabled) ?? null, text);
    const el = found.asElement();
    if (!el) return false;
    await el.click(); // a screen that redraws between the find and the click throws here, and the retry finds the new button
    return true;
  });
}

// Clicks the first element that matches the selector, finding it again if the screen redraws under the click.
const clickSelector = (page, selector) => until(`"${selector}" to click`, async () => {
  const el = await page.$(selector);
  if (!el) return false;
  await el.click();
  return true;
}, 15000);

const heading = (page) => page.evaluate(() => document.querySelector("h1.ask")?.textContent.replace(/\s+/g, " ").trim() ?? "");
const hits = (state) => state.players.reduce((n, p) => n + p.counts.perfect + p.counts.good, 0);
const phoneScore = (page) => page.evaluate(() => {
  const stat = [...document.querySelectorAll(".stat")].find((s) => s.querySelector("small")?.textContent === "Team score");
  return stat ? Number(stat.querySelector("b").textContent.replace(/,/g, "")) : null;
});

// Opens the phone on the address the QR code holds, with this run's host. Stops screen, then the song screen.
async function openPhoneAt(page, joinUrl) {
  const u = new URL(joinUrl); // the QR code holds the laptop's network address; the path and query are what matter
  await page.goto(`${BASE}${u.pathname}${u.search}`, { waitUntil: "load" });
  await until('the question "Where are you getting off?"', async () => {
    if ((await heading(page)) !== "Where are you getting off?") throw new Error(`the page shows: ${await pageText(page)}`);
    return true;
  });
}
async function walkToSeats(page, how) {
  await until("a stop to pick", () => page.$(".stops-body .map li button.row"), 15000);
  await clickSelector(page, ".stops-body .map li button.row"); // the first stop ahead: the shortest ride
  await until("the recommended song", () => page.$(".ticket h2"), 15000);
  how.title = await page.$eval(".ticket h2", (e) => e.textContent);
  how.recommended = how.title;
}

// Presses the mouse on each pad in turn (a foot landing on the square, 70 ms down) while `playing()` is true.
async function playWithFeet(stage, spy, until_ms) {
  const [w, h] = [1280, 720];
  const spots = spy.state.layout.spots;
  const t0 = Date.now();
  let i = 0;
  while (spy.state.status !== "results" && Date.now() - t0 < until_ms) {
    if (spy.state.status === "playing") {
      const { rect } = spots[i++ % spots.length];
      await stage.mouse.move((rect.u + rect.w / 2) * w, (rect.v + rect.h * 0.82) * h); // inside the pad's foot square
      await stage.mouse.down();
      await sleep(70);
      await stage.mouse.up();
    }
    await sleep(200);
  }
}

// ---------- the steps ----------

// 1. The stage opens, shows the lobby, and its QR code holds an address with the train in it.
async function step1(c) {
  // The local link has no rooms: every page on this server hears every other. Another stage open here would spoil the run.
  await sleep(1500);
  if (c.spy.state) throw new Error("another stage page is already open on this server (its State was heard before this run opened one). Close it, or run against a server nobody else uses (--base)");
  c.stage = await newStage(c.browser);
  await c.stage.goto(`${BASE}/stage.html?feet=mouse&seats=2`, { waitUntil: "load" });
  await until("the stage's State (the lobby)", () => c.spy.state?.status === "lobby");
  c.joinUrl = await until("the QR code's address (canvas.dataset.joinUrl)", () => c.stage.$eval("canvas", (e) => e.dataset.joinUrl), 10000);
  const q = new URL(c.joinUrl).searchParams;
  for (const k of ["line", "dir", "at", "car"]) if (!q.has(k)) throw new Error(`the QR address has no "${k}": ${c.joinUrl}`);
  await sleep(500);
  await shot(c.stage, 1, "stage-lobby");
  return `lobby with ${c.spy.state.layout.spots.length} seats, QR holds ${new URL(c.joinUrl).search}`;
}

// 2. The phone opens the QR address on this base and asks where you are getting off, with real stops.
async function step2(c) {
  c.phone = await newPhone(c.browser, "phone");
  await openPhoneAt(c.phone, c.joinUrl);
  const stops = await until("real stops from the MBTA", () => c.phone.$$eval(".stops-body .map li button.row", (rows) => (rows.length ? rows.map((r) => r.textContent.trim()) : null)), 15000);
  if (stops.length < 3) throw new Error(`only ${stops.length} stops ahead: ${stops.join(" | ")}`);
  await sleep(600);
  await shot(c.phone, 2, "phone-stops");
  return `"${await heading(c.phone)}" with ${stops.length} stops ahead, first: ${stops[0]}`;
}

// 3. Pick a stop, get a recommended song, play it, claim two seats, press Ready: lobby, countdown, playing.
// To keep the run short the phone swaps the recommended song for the shortest one in "See more songs".
async function step3(c) {
  const how = {};
  await walkToSeats(c.phone, how);
  await shot(c.phone, 3, "phone-recommended");
  await clickButton(c.phone, "See more songs");
  await c.phone.evaluate(() => { // the sheet lists songs with their lengths: tap the shortest
    const secs = (b) => { const [m, s] = b.querySelector(".chip").textContent.split(":"); return +m * 60 + +s; };
    [...document.querySelectorAll("dialog.sheet button.row")].sort((a, b) => secs(a) - secs(b))[0].click();
  });
  await until("the ticket to show the new song", async () => (await c.phone.$eval(".ticket h2", (e) => e.textContent)) !== how.title, 3000);
  c.song = await c.phone.$eval(".ticket h2", (e) => e.textContent);
  await clickButton(c.phone, "Play this song");
  await until("the seats screen", () => c.phone.$(".pad"));
  for (const seat of [1, 2]) {
    await clickSelector(c.phone, `.pad[data-seat="${seat}"]`);
    await until(`seat ${seat} to be yours`, async () => {
      if (await c.phone.$eval(`.pad[data-seat="${seat}"]`, (e) => e.dataset.state === "mine")) return true;
      throw new Error(`the stage lists seats ${JSON.stringify(c.spy.state.players.map((p) => [p.spotId, p.clientId]))}, notice ${JSON.stringify(c.spy.state.notice)}`);
    }, 4000);
  }
  await shot(c.phone, 3, "phone-seats");
  const mark = c.spy.statuses.length;
  await clickButton(c.phone, "Ready!");
  await until("the stage to count down", () => c.spy.statuses.slice(mark).includes("countdown"), 6000);
  await shot(c.stage, 3, "stage-countdown");
  await until("the stage to play", () => c.spy.state.status === "playing", 8000);
  const s = c.spy.state;
  c.clientId = s.players[0]?.clientId; // the phone's id, to count its seats after the lobby comes back
  if (s.song?.title !== c.song) throw new Error(`the stage is playing "${s.song?.title}", the phone chose "${c.song}"`);
  return `recommended "${how.recommended}", played "${c.song}" (${s.song.seconds} s) with seats ${s.players.map((p) => p.spotId)}; stage went ${c.spy.statuses.slice(mark - 1).join(" > ")}`;
}

// 4. Feet on the stage hit tiles, and the score rises on the stage and on the phone.
async function step4(c) {
  const before = c.spy.state.team.score;
  const phoneBefore = await phoneScore(c.phone);
  const playing = playWithFeet(c.stage, c.spy, (c.spy.state.song.seconds + 15) * 1000); // keeps going until results
  c.playing = playing.catch(() => {}); // a failed run must not leave this loop throwing after the browser closes
  await until("3 tiles hit", () => hits(c.spy.state) >= 3, 25000);
  await sleep(1200);
  const state = c.spy.state;
  const phoneNow = await phoneScore(c.phone);
  await shot(c.stage, 4, "stage-playing");
  await shot(c.phone, 4, "phone-playing");
  if (!(state.team.score > before)) throw new Error(`the stage's team score did not rise (${before} then ${state.team.score})`);
  if (phoneNow === null) throw new Error(`the phone shows no team score. It shows: ${await pageText(c.phone)}`);
  if (!(phoneNow > (phoneBefore ?? 0))) throw new Error(`the phone's score did not rise (${phoneBefore} then ${phoneNow}); the stage says ${state.team.score}`);
  return `${hits(state)} hits, stage score ${before} to ${state.team.score}, phone score ${phoneBefore} to ${phoneNow}`;
}

// 5. The song ends, results show, the lobby comes back, and the phone still holds both seats.
async function step5(c) {
  await until("the results", () => c.spy.state.status === "results", (c.spy.state.song.seconds + 20) * 1000);
  await c.playing;
  await sleep(1500); // let the board count up
  const results = c.spy.state;
  await shot(c.stage, 5, "stage-results");
  const phoneText = await pageText(c.phone);
  await shot(c.phone, 5, "phone-results");
  await until("the lobby to come back", () => c.spy.state.status === "lobby", 16000);
  const mine = c.spy.state.players.filter((p) => p.clientId === c.clientId).length;
  if (mine !== 2) throw new Error(`the stage lists ${mine} seats for the phone after the lobby came back, not 2`);
  await shot(c.phone, 5, "phone-back-in-lobby");
  const phoneShows = await heading(c.phone);
  return `results (team grade ${results.team.grade ?? "none"}, score ${results.team.score}), phone said "${phoneText.slice(0, 60)}", lobby back with both seats kept; the phone shows "${phoneShows}"`;
}

// 6. The phone page closes with no goodbye: its seats free themselves after the quiet time.
async function step6(c) {
  const t0 = Date.now();
  await c.phone.close(); // no "leave" message is sent
  await until("the seats to free themselves", () => c.spy.state.players.length === 0, 20000);
  const secs = (Date.now() - t0) / 1000;
  if (secs < 3) throw new Error(`the seats freed after only ${secs.toFixed(1)} s, so the page said goodbye or the rule is too short`);
  return `seats freed ${secs.toFixed(1)} s after the page closed (rule: 10 s without a "here")`;
}

// 7. Another phone holds a seat; a second phone page asks for it and gets the stage's refusal.
async function step7(c) {
  c.spy.send({ type: "join", clientId: "e2e-holder" });
  c.spy.send({ type: "claim", clientId: "e2e-holder", spotId: 1 });
  c.holder = setInterval(() => c.spy.send({ type: "here", clientId: "e2e-holder" }), 3000);
  await until("the holder to sit in seat 1", () => c.spy.state.players.some((p) => p.spotId === 1 && p.clientId === "e2e-holder"), 4000);
  const second = await newPhone(c.browser, "phone 2");
  await openPhoneAt(second, c.joinUrl);
  await walkToSeats(second, {});
  await clickButton(second, "Play this song");
  await until("the seats screen", () => second.$('.pad[data-seat="1"][data-state="taken"]'), 5000);
  // The taken pad is switched off, so a tap cannot ask for it. A phone with a stale picture could, so ask the way it would.
  await second.evaluate(() => { const pad = document.querySelector('.pad[data-seat="1"]'); pad.disabled = false; pad.click(); });
  const text = await until("the refusal on the phone", async () => {
    const banner = await second.$eval("#status", (e) => (e.hasAttribute("data-show") ? e.textContent.trim() : ""));
    return banner;
  }, 4000);
  await shot(second, 7, "phone2-refused");
  if (text !== "That seat is taken.") throw new Error(`the phone said "${text}"`);
  await second.close();
  return `second phone was told "${text}"`;
}

// 8. No console errors on either page across the run.
async function step8(c) {
  const strangers = [...c.spy.ids].filter((id) => id !== c.clientId && id !== "e2e-holder");
  if (strangers.length) throw new Error(`the run is not trustworthy: another page used this link (phone ids ${strangers.join(", ")}). Run again with nothing else open on this server`);
  if (t.errors.length) throw new Error(`${t.errors.length} error(s): ${[...new Set(t.errors)].slice(0, 6).join(" || ")}`);
  return "no console errors on the stage or the phones";
}

// ---------- run ----------

const STEPS = [
  [1, "stage lobby and QR address", step1],
  [2, "phone asks where you are getting off", step2],
  [3, "stop, song, seats, Ready", step3],
  [4, "feet hit tiles and the score rises", step4],
  [5, "results, then the lobby with seats kept", step5],
  [6, "closed phone frees its seats", step6],
  [7, "taken seat is refused", step7],
  [8, "no console errors", step8],
];

fs.mkdirSync("shots", { recursive: true });
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "pp-e2e-"));
const browser = await launch({ userDataDir: dir });
const spy = openSpy();
const c = { browser, spy };
let failed = 0;
try {
  console.log(`Demo path against ${BASE}`);
  for (const [n, name, fn] of STEPS) {
    try {
      const detail = await fn(c);
      console.log(`PASS  ${n}. ${name}: ${detail}`);
    } catch (e) {
      failed++;
      console.log(`FAIL  ${n}. ${name}: ${e.message}`);
      if (n === 1) { console.log("Stopping: every later step needs the stage from step 1."); break; }
      for (const page of [c.stage, c.phone]) if (page && !page.isClosed()) await shot(page, n, `FAIL-${page === c.stage ? "stage" : "phone"}`).catch(() => {});
    }
  }
} finally {
  clearInterval(c.holder);
  spy.ws.close();
  await browser.close().catch(() => {});
  fs.rmSync(dir, { recursive: true, force: true, maxRetries: 3 });
}
console.log(failed ? `${failed} of ${STEPS.length} steps FAILED` : `All ${STEPS.length} steps passed`);
process.exitCode = failed ? 1 : 0;
