// The phone app. The QR code in the train car opens it with the train in the address; it asks where you are getting
// off, recommends a song, takes your seats and starts the game on the floor. The stage owns the truth: this page sends
// join, here, claim, release, start, pause, resume and stop over the link, and draws only the State the stage sends back
// (PLAN.md, "Data shapes" and "Wave 5"). `?mock=1` swaps the stage for a small fake one inside the page.
// A screen is one file in screens/, registered in screens/index.js.
import { openLink } from "../link.js";
import { lineOf, BUTTER } from "./lines.js";
import { trainFromQuery, trainFromState, sameTrain, DEFAULT_TRAIN } from "./train.js";
import { rest } from "./parts.js";
import { playOpening } from "./opening.js";
import { SCREENS, FIRST, LANDING, LIVE } from "./screens/index.js";
import { keepResults, setResults } from "./after.js";

const HERE_MS = 3000;       // the stage frees the seats of a phone it has not heard from in 10 s
const FLOOR_WAIT_MS = 3000; // no State for this long: no floor is connected
const RECLAIM_MS = 4000;    // after coming back, how long the seats this phone chose are asked for again if they were dropped
const ARRIVE_WAIT_MS = 1500; // with no train in the address, how long to wait for the stage to say which train this is

const store = {
  get: (k) => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k, v) => { try { localStorage.setItem(k, v); } catch { /* private browsing can refuse storage; the app still works, it only forgets you */ } },
};
let id = store.get("pp:clientId");
if (!id) {
  id = Array.from(crypto.getRandomValues(new Uint8Array(6)), (b) => b.toString(16).padStart(2, "0")).join("");
  store.set("pp:clientId", id);
}

const $ = (s) => document.querySelector(s);
const main = $("#screen");
const track = $("#track");
const back = $("#back");
const status = $("#status");
const registry = new Map(SCREENS.map((s) => [s.id, s]));
const startedAt = Date.now();

// ---- the train, and the colour it sets ----
const fromAddress = trainFromQuery(location.search);
let trainFrom = fromAddress ? "address" : "default";
// An app opened with no room and no train (typed, or from a home screen) starts at the code reader. A phone's own camera
// brings a room and a train in the address and never sees it. `mock`, `screen` and `link` are for testing and skip it.
const query = new URLSearchParams(location.search);
const landing = query.get("screen") === "scan" || !["room", "line", "dir", "at", "car", "mock", "screen", "link"].some((k) => query.has(k));
const first = landing ? LANDING : FIRST;
const memos = new Map();
const wants = new Set();

const app = {
  id,
  train: fromAddress ?? { ...DEFAULT_TRAIN },
  line: null,
  state: null,       // the last State from the stage
  trip: {},          // what the person has picked so far: { stop, ride, song }
  send: (msg) => (link ? link.send({ ...msg, clientId: id }) : false),
  go,
  restart,
  mine: () => (app.state?.players ?? []).filter((p) => p.clientId === id).map((p) => p.spotId),
  want: (spotId, on) => wants[on ? "add" : "delete"](spotId), // the seats this person chose, asked for again if the stage drops them
  floorGone: () => !floorOn() && Date.now() - Math.max(upAt, startedAt) > FLOOR_WAIT_MS,
  // One question asked once: the same answer for the same key, and a failed one is asked again.
  memo(key, make) {
    if (!memos.has(key)) memos.set(key, make().catch((e) => { memos.delete(key); throw e; }));
    return memos.get(key);
  },
};

function paintLine() {
  const line = (app.line = lineOf(app.train.line));
  const root = document.documentElement.style;
  root.setProperty("--c", line.hero);           // the hero colour: this line's
  root.setProperty("--butter", BUTTER);
  root.setProperty("--badge", line.badge);      // the true line colour, for the round badge only
  root.setProperty("--badge-ink", line.badgeInk);
  $("#theme-colour").setAttribute("content", line.hero);
}
paintLine();

// ---- link ----
let link = null;
let linkUp = false;
let upAt = 0;
let downSince = Date.now();
let stateAt = 0;
const floorOn = () => stateAt > 0 && Date.now() - stateAt < FLOOR_WAIT_MS;

function onStatus(up) {
  linkUp = up;
  if (up) { upAt = Date.now(); app.send({ type: "join" }); reclaimUntil = Date.now() + RECLAIM_MS; } else downSince = Date.now();
  showBanner();
}
function onMessage(msg) {
  if (msg?.type !== "state" || !Array.isArray(msg.players) || !Array.isArray(msg.layout?.spots)) return;
  app.state = msg;
  stateAt = Date.now();
  keepResults(msg, id); // the results State lasts 8 s; the screens after the song are drawn from this copy
  reclaim();
  if (!began) return void ready.finally(begin);
  adoptTrain(msg.train);
  sync();
  active?.update?.(msg);
  showBanner();
}
if (new URLSearchParams(location.search).has("mock")) import("./mock.js").then((m) => { link = m.openMockLink(onMessage, onStatus); });
else link = openLink(onMessage, onStatus);

setInterval(() => app.send({ type: "here" }), HERE_MS);
document.addEventListener("visibilitychange", () => { // a phone that was locked says it is back
  if (document.hidden) return;
  app.send({ type: "join" });
  app.send({ type: "here" });
  reclaimUntil = Date.now() + RECLAIM_MS;
  showBanner();
});

// The stage frees the seats of a phone it has not heard from in 10 s, and a locked phone says nothing. When the phone is back
// (or the link is), the seats it chose are asked for again, once the stage's own State says they are free.
let reclaimUntil = 0;
function reclaim() {
  const state = app.state;
  for (const n of [...wants]) if (!state.layout.spots.some((s) => s.id === n) || state.players.some((p) => p.spotId === n && p.clientId !== id)) wants.delete(n); // gone, or another phone has it
  const missing = [...wants].filter((n) => !app.mine().includes(n));
  if (Date.now() > reclaimUntil || state.status !== "lobby" || !missing.length) return;
  reclaimUntil = 0;
  app.send({ type: "join" });
  for (const spotId of missing) app.send({ type: "claim", spotId });
}

// The train: the address wins. With none, the stage's train, as long as the person has not got past the first question.
function adoptTrain(sent) {
  const next = trainFromState(sent);
  if (!next) return;
  if (sameTrain(app.train, next)) { // the stage's names fill the gaps
    app.train.headsign ??= next.headsign;
    app.train.atStopName ??= next.atStopName;
    return;
  }
  if (trainFrom !== "default" || active?.id !== FIRST) return;
  app.train = next;
  trainFrom = "stage";
  paintLine();
  render(FIRST);
}

// ---- the banner: one plain line about the link, or the stage's refusal ----
// A refusal is for one phone or for everyone. Another phone's refusal is not shown here.
function noticeText() {
  const n = app.state?.notice;
  if (!n) return "";
  if (typeof n === "string") return n;
  return n.for == null || n.for === id ? n.text ?? "" : "";
}
function showBanner() {
  let text = "";
  if (active?.id === LANDING) text = ""; // the code reader comes before any floor is known
  else if (!linkUp) { if (Date.now() - downSince > 1500) text = "Lost the connection to the floor. Trying again."; }
  else if (!floorOn()) { if (app.floorGone()) text = "No floor is connected. Check the code on the floor."; }
  else text = noticeText();
  if (text) status.firstElementChild.textContent = text;
  status.toggleAttribute("data-show", Boolean(text));
}
setInterval(() => { showBanner(); if (!floorOn()) active?.update?.(app.state); }, 1000); // a screen shows "no floor" once the State stops coming

// ---- screens ----
let active = null; // { id, update?, destroy? }
let began = false;
const stack = []; // the flow so far, newest last. The browser's Back button walks it.

// What to show: the game's screen while this phone holds a seat in a game on the floor, else where the flow is.
// A screen with `lands` (the leaderboard) is where a finished song puts the person once, and the flow goes on from it:
// its Next button moves the stack on while the floor's results State is still there, and that must not pull the person back.
let landed = false;
function wanted() {
  const live = app.state && app.mine().length ? LIVE[app.state.status] : null;
  if (!live) { landed = false; return stack.at(-1); }
  if (!registry.get(live).lands) return live;
  if (!landed) {
    landed = true;
    if (stack.at(-1) !== live) { stack.push(live); history.pushState({ pp: stack.length }, ""); }
  }
  return stack.at(-1);
}
function sync() {
  const next = wanted();
  if (next !== active?.id) render(next);
}
function render(screenId) {
  active?.destroy?.();
  const screen = registry.get(screenId);
  const made = screen.mount(app);
  made.el.classList.add("enter");
  main.replaceChildren(made.el);
  active = { id: screenId, update: made.update, destroy: made.destroy };
  rest(); // shown while the tab is away, or just after it came back: at rest, nothing replays
  track.style.setProperty("--p", `${screen.step * 25}%`);
  track.setAttribute("aria-valuenow", screen.step);
  showBack();
}
const showBack = () => { back.hidden = stack.length < 2 || active.id !== stack.at(-1) || Boolean(registry.get(active.id).lands); };
function go(screenId) {
  stack.push(screenId);
  history.pushState({ pp: stack.length }, "");
  sync();
}
// Back to the first question. The browser's own history keeps its old entries, which the popstate below ignores once the stack is short.
function restart() {
  stack.length = 0;
  stack.push(FIRST);
  app.trip = {};
  history.replaceState({ pp: 1 }, "");
  sync();
}
back.onclick = () => history.back();
addEventListener("popstate", () => {
  if (stack.length < 2) return;
  stack.pop();
  sync();
  showBack();
});

// The first screen. With a train in the address it comes at once; without one it waits a moment for the stage to say
// which train this is, then uses the default. The opening plays over it and never blocks a tap.
function begin() {
  if (began) return;
  began = true;
  const sent = trainFromState(app.state?.train);
  if (trainFrom === "default" && sent) { app.train = sent; trainFrom = "stage"; }
  paintLine();
  stack.push(first);
  history.replaceState({ pp: 1 }, "");
  render(first);
  if (!landing) playOpening(app.line, app.train.car, app.train.headsign); // the reader knows no train yet: no train to pull in
  if (registry.has(jump) && jump !== first) stack.push(jump); // `?screen=board` opens that screen directly
  sync();
  showBanner();
}

// `?mock=1&screen=board|share|again` opens a screen after a song directly, with a song the fake floor has just played.
const jump = new URLSearchParams(location.search).get("screen");
const ready = jump && new URLSearchParams(location.search).has("mock")
  ? import("./mock.js").then((m) => {
    const kept = m.demoResults(id, m.mockOptions());
    setResults(kept);
    for (const spotId of kept.mine) wants.add(spotId); // the seats are asked for when the State shows them free, as after a lock
  })
  : Promise.resolve();
if (fromAddress || landing) ready.finally(begin);
else setTimeout(() => ready.finally(begin), ARRIVE_WAIT_MS);
