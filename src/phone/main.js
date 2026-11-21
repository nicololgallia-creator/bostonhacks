// The phone remote: where you are (line, car, section), your seats, then the music.
// There are no names. A seat is known by its number and colour: Open, Taken, or Yours.
// One phone can hold several seats and then controls the game for all of them.
// The stage owns the truth. This page sends join, claim, release, leave and here, and draws only the State
// the stage sends back (PLAN.md, "Seats and session"). `?mock=1` swaps the stage for a fake one.
import "../tokens.css";
import "./phone.css";
import { openLink } from "../link.js";
import { openRide } from "./ride.js";
import { createPlay } from "./play.js";
import { openSettings, settingsGear } from "./settings.js";
import { mountSection } from "./section.js";
import { mountLine, mountCar, lineById, lineLabel } from "./place.js";
import * as nav from "./nav.js";

const TAP_GUARD_MS = 400;     // a tap right after a screen appears is a double tap on the one before
const HERE_MS = 3000;         // the stage frees the seats of a phone it has not heard from in 10 s
const SEATS_KEPT_MS = 600000; // seats are asked for again by themselves for ten minutes
const LINE_KEPT_MS = 10800000; // the line is remembered for three hours
const SETTLE_MS = 1500;       // after giving seats back, an older State must not make us ask for them again
const store = {
  get: (k) => { try { return localStorage.getItem(k); } catch { return null; } },
  // Private browsing can refuse storage. The page still works, it only forgets you.
  set: (k, v) => { try { localStorage.setItem(k, v); } catch { /* see above */ } },
};
const CHEVRON = `<svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><path d="M10 3 5 8l5 5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

let id = store.get("pp:clientId");
if (!id) {
  id = Array.from(crypto.getRandomValues(new Uint8Array(6)), (b) => b.toString(16).padStart(2, "0")).join("");
  store.set("pp:clientId", id);
}

// The seats this phone last held, saved as "1,3:time". If the stage forgets them (it restarted), we ask for them back.
function savedSeats() {
  const [list, at] = (store.get("pp:seats") || "").split(":");
  return list && Date.now() - Number(at) < SEATS_KEPT_MS ? list.split(",").map(Number).filter(Boolean) : [];
}
// The line this phone chose, saved as "Red:time". "Fit my train" uses it to show only that line's stations and trains.
function savedLine() {
  const [lineId, at] = (store.get("pp:line") || "").split(":");
  return Date.now() - Number(at) < LINE_KEPT_MS ? lineById(lineId) : null;
}
let line = savedLine();
let placeLine = null;      // the line picked in this run of the steps
let car = null;            // the car picked in this run (a sample: every car leads to the one real section)
let changing = false;      // "Change" was tapped, so the steps show again even with seats
let wantSeats = savedSeats();
let reclaimAt = 0;
let settleUntil = 0;

let state = null;          // last State from the stage
let stateAt = 0;
let upAt = 0;              // when the link last came up
let downSince = Date.now();
let sectionPicked = false; // the map's real section was tapped, so the seats show
let wizardMark = 0;        // the history depth before the line was picked
let ride = null;           // the pick-the-music flow while it is open (ride.js); it owns the screen
let settings = null;       // the settings screen while it is open (settings.js); it owns the screen too
let view = null;           // "line", "car", "section" or "seats"
let viewAt = 0;            // when that screen appeared
let sectionUi = null;
let padsKey = "";
let drawn = "";

const $ = (s) => document.querySelector(s);
const screen = $("#screen");
const statusBox = $("#status");

// ---- Link ----

let link = null;
const send = (msg) => link?.send({ ...msg, clientId: id });
const join = () => send({ type: "join" });
const play = createPlay({ screen, send, id }); // the screens while a song runs, and its results (play.js)

function onStatus(up) {
  if (up) { upAt = Date.now(); join(); }
  else if (downSince <= upAt) downSince = Date.now(); // only the first drop counts, retries must not restart the clock
  showStatus();
}
function onMessage(msg) {
  if (msg?.type !== "state" || !Array.isArray(msg.players) || !Array.isArray(msg.layout?.spots)) return;
  state = msg;
  stateAt = Date.now();
  ride?.onState(msg);
  settings?.onState(msg);
  keepSeats();
  render();
  showStatus();
}
if (new URLSearchParams(location.search).has("mock")) {
  import("./mock.js").then((m) => { link = m.openMockLink(onMessage, onStatus); });
} else {
  link = openLink(onMessage, onStatus);
}
setInterval(() => send({ type: "here" }), HERE_MS);

// Seats are entries in the State, each with a clientId. Mine are the ones carrying my id.
const mySeats = () => (state?.players ?? []).filter((p) => p.clientId === id && p.spotId).map((p) => p.spotId).sort((a, b) => a - b);

// Remember the seats we hold. If the stage restarted and lost some, join again and ask for them back once;
// when they are not ours any more, give up and the map comes back.
function keepSeats() {
  if (!state) return;
  const mine = mySeats();
  const heldByOthers = (n) => state.players.some((p) => p.spotId === n && p.clientId !== id);
  const exists = (n) => state.layout.spots.some((s) => s.id === n);
  if (Date.now() > settleUntil) wantSeats = [...new Set([...wantSeats, ...mine])].filter((n) => exists(n) && !heldByOthers(n)).sort((a, b) => a - b);
  const missing = wantSeats.filter((n) => !mine.includes(n));
  if (!missing.length || state.status !== "lobby") reclaimAt = 0;
  else if (!reclaimAt) {
    reclaimAt = Date.now();
    join();
    for (const spotId of missing) send({ type: "claim", spotId });
  } else if (Date.now() - reclaimAt > 2500) {
    wantSeats = mine;
    reclaimAt = 0;
  }
  store.set("pp:seats", wantSeats.length ? `${wantSeats}:${Date.now()}` : "");
}

// The settings button in the top bar, shown from the seats screen in the lobby once you hold a seat.
const gear = settingsGear(() => {
  const mark = nav.depth();
  nav.push(() => settings?.close());
  settings = openSettings({ screen, send, state, onClose: () => { nav.release(mark); settings = null; view = null; render(); } });
  syncGear();
});
$(".top").append(gear);
const syncGear = () => { gear.hidden = !(mySeats().length && state?.status === "lobby" && !ride && !settings); };

// ---- The one line that says what is wrong ----

// A refusal is for one phone or for everyone. Another phone's refusal is not shown here.
function noticeText() {
  const n = state?.notice;
  if (!n) return "";
  if (typeof n === "string") return n;
  return n.for == null || n.for === id ? n.text ?? "" : "";
}

function showStatus() {
  const now = Date.now();
  let text = "";
  if (!upAt || downSince > upAt) {
    if (now - downSince > 1500) text = "Lost the connection. Trying again.";
  } else if (now - Math.max(stateAt, upAt) > 3000) {
    text = "No answer from the floor yet. The game must be open on the laptop.";
  } else {
    text = noticeText();
  }
  if (text) statusBox.querySelector("p").textContent = text;
  statusBox.toggleAttribute("data-show", Boolean(text));
}
setInterval(showStatus, 1000);

// ---- Screens ----

function render() {
  syncGear();
  if (ride || settings) return;
  // A song is running or just ended: the stage owns the screen, and the seats come back with the lobby.
  if (state && state.status !== "lobby") { view = null; play.show(state); return; }
  play.hide();
  const want = step();
  if (want !== view) {
    view = want;
    viewAt = Date.now();
    padsKey = "";
    drawn = "";
    sectionUi = null;
    if (want === "line") mountLine({ screen, onPick: pickLine });
    else if (want === "car") mountCar({ screen, line: placeLine, onPick: pickCar });
    else if (want === "section") sectionUi = mountSection({ screen, onPick: pickSection });
    else screen.replaceChildren();
  }
  if (view === "seats") syncSeats();
  else if (view === "section") sectionUi.sync(state);
}

// Someone with seats, or on the way back to them, goes straight to the seats. A new player is asked
// their line, their car and their section, one at a time.
function step() {
  if (!state || sectionPicked) return "seats";
  if (!changing && (mySeats().length || wantSeats.length)) return "seats";
  return !placeLine ? "line" : car == null ? "car" : "section";
}

// Each pick adds a history entry that undoes it, so the phone's own Back steps back through the three.
function pickLine(l) {
  wizardMark = nav.depth();
  line = placeLine = l;
  store.set("pp:line", `${l.id}:${Date.now()}`);
  nav.push(() => { placeLine = null; car = null; render(); });
  render();
}
function pickCar(n) {
  car = n;
  nav.push(() => { car = null; render(); });
  render();
}
function pickSection() {
  sectionPicked = true;
  changing = false;
  nav.push(() => { sectionPicked = false; render(); });
  render();
}

// Back to the first step, for someone who picked the wrong line, car or section.
function change() {
  nav.release(wizardMark);
  placeLine = null;
  car = null;
  sectionPicked = false;
  changing = true;
  render();
}

// The seats are built once for a layout and then changed in place, so a claim lights the
// pad with a transition instead of redrawing the screen. Above the pads sits the bench, one cushion over each.
function mountSeats(layout) {
  const lanes = Math.max(layout.lanes | 0, 1);
  const n = layout.spots.length;
  screen.innerHTML = `
    <section class="seats">
      <div class="seats-top">
        <button class="back" type="button" data-act="back" hidden>${CHEVRON}Back</button>
        <button class="link" type="button" data-act="change">Change</button>
      </div>
      <div><h1 class="title" id="seat-title"></h1><p class="sub"></p></div>
      <div class="bench" aria-hidden="true" data-n="${n}" style="--n:${n}">
        ${layout.spots.map((s) => `<i class="cushion" data-seat="${s.id}"></i>`).join("")}
      </div>
      <div class="pads" role="group" aria-labelledby="seat-title" data-n="${n}" style="--n:${n}; --lanes:${lanes}">
        ${layout.spots.map((s) => `
          <button class="pad" type="button" data-seat="${s.id}">
            <span class="lanes">${"<i></i>".repeat(lanes)}</span>
            <span class="num">${s.id}</span>
            <span class="who"></span>
          </button>`).join("")}
      </div>
      <div class="more"></div>
      <div class="actions"></div>
    </section>`;
}

const FALLBACK_LAYOUT = { lanes: 2, spots: [{ id: 1 }, { id: 2 }, { id: 3 }] };

// "seat 2", "seats 1 and 3", "seats 1, 2, and 3", each number in its own colour
function seatWords(seats) {
  const out = [seats.length === 1 ? "seat " : "seats "];
  seats.forEach((n, i) => {
    const num = document.createElement("span");
    num.dataset.seat = n;
    num.dataset.seatWord = "";
    num.textContent = n;
    if (i) out.push(seats.length === 2 ? " and " : i === seats.length - 1 ? ", and " : ", ");
    out.push(num);
  });
  return out;
}

function syncSeats() {
  const layout = state?.layout ?? FALLBACK_LAYOUT;
  const key = `${layout.lanes}:${layout.spots.map((s) => s.id)}`;
  if (key !== padsKey) { padsKey = key; drawn = ""; mountSeats(layout); }

  const mine = mySeats();
  const players = state?.players ?? [];
  const section = state?.section?.name ?? "";
  const full = players.filter((p) => p.spotId).length >= layout.spots.length;
  const snapshot = `${section}|${sectionPicked}|${state?.status}|${mine}|${full}|${players.map((p) => `${p.spotId}${p.clientId}`)}`;
  if (snapshot === drawn) return;
  drawn = snapshot;

  const title = screen.querySelector(".title");
  const sub = screen.querySelector(".sub");
  if (!state) {
    title.textContent = "Joining the floor";
    sub.textContent = "One moment.";
  } else if (mine.length) {
    title.replaceChildren("You are in ", ...seatWords(mine));
    sub.textContent = "Tap another seat to play it too. Tap one of yours to give it back.";
  } else if (full) {
    title.textContent = "Every seat is taken.";
    sub.textContent = "Watch the next song, then ask for a turn.";
  } else {
    title.textContent = "Pick your seats";
    sub.textContent = [placeLine && lineLabel(placeLine), section].filter(Boolean).join(", ") + ". Same order as the floor.";
  }
  screen.querySelector(".seats-top").hidden = mine.length > 0;
  screen.querySelector(".back").hidden = !sectionPicked;

  for (const el of screen.querySelectorAll(".pad, .cushion")) {
    const n = Number(el.dataset.seat);
    const owner = players.find((p) => p.spotId === n);
    const st = !state ? "idle" : !owner ? "open" : owner.clientId === id ? "mine" : "taken";
    el.dataset.state = st;
    if (el.localName !== "button") continue; // a cushion follows its pad's state and is tapped through it
    el.disabled = st === "idle" || st === "taken";
    el.querySelector(".who").textContent = { open: "Open", mine: "Yours", taken: "Taken", idle: "" }[st];
    el.setAttribute("aria-label", {
      open: `Seat ${n}, open. Tap to take it.`,
      mine: `Seat ${n}, yours. Tap to give it back.`,
      taken: `Seat ${n}, taken.`,
      idle: `Seat ${n}.`,
    }[st]);
  }

  const actions = screen.querySelector(".actions");
  const leave = document.createElement("button");
  leave.type = "button";
  leave.className = "btn btn-quiet";
  leave.dataset.act = "leave";
  leave.textContent = "Leave";
  actions.replaceChildren(...(mine.length ? [leave] : []));

  // Holding a seat in the lobby: the way into ride.js sits in the free space under the pads.
  const more = [];
  if (mine.length && state?.status === "lobby") {
    const music = document.createElement("button");
    music.type = "button";
    music.className = "btn btn-primary";
    music.dataset.act = "music";
    music.textContent = "Pick the music";
    more.push(music);
  }
  screen.querySelector(".more").replaceChildren(...more);
}

// One tap on an open seat takes it, one tap on your own gives it back. A phone can hold several seats.
let lastTapAt = 0;
function tapSeat(n) {
  const pad = screen.querySelector(`.pad[data-seat="${n}"]`);
  if (!pad || pad.disabled || Date.now() - viewAt < TAP_GUARD_MS || Date.now() - lastTapAt < TAP_GUARD_MS / 2) return;
  lastTapAt = Date.now();
  navigator.vibrate?.(12);
  if (pad.dataset.state === "mine") {
    wantSeats = wantSeats.filter((s) => s !== n); // given back on purpose, so it is not asked for again
    settleUntil = Date.now() + SETTLE_MS;
    send({ type: "release", spotId: n });
  } else {
    join(); // the stage may have forgotten a phone with no seat; joining again is harmless
    send({ type: "claim", spotId: n });
  }
}

screen.addEventListener("click", (e) => {
  if (ride || settings) return; // those screens handle their own taps
  const seat = e.target.closest(".pad, .cushion");
  if (seat) return tapSeat(Number(seat.dataset.seat));
  const act = e.target.closest("[data-act]")?.dataset.act;
  if (act === "back") nav.back();
  else if (act === "change") change();
  else if (act === "music") {
    ride = openRide({ screen, send, line: line?.id ?? null, onClose: () => { ride = null; view = null; render(); } });
    syncGear();
  } else if (act === "leave") {
    send({ type: "leave" });
    wantSeats = [];
    settleUntil = Date.now() + SETTLE_MS;
    nav.release(wizardMark);
    placeLine = null;
    car = null;
    sectionPicked = false;
    changing = false;
    drawn = "";
    render();
  }
});

render();
