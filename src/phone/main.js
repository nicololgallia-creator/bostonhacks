// The phone remote, screen 1: a name, a seat, and "you are in seat N".
// The stage owns the truth. This page sends join, claim and leave, and draws only the State
// the stage sends back (PLAN.md, "Seats and session"). `?mock=1` swaps the stage for a fake one.
import "../tokens.css";
import "./phone.css";
import { openLink } from "../link.js";

const NAME_MAX = 10; // the longest name that still fits a pad when four people play
const store = {
  get: (k) => { try { return localStorage.getItem(k); } catch { return null; } },
  // Private browsing can refuse storage. The page still works, it only forgets you.
  set: (k, v) => { try { localStorage.setItem(k, v); } catch { /* see above */ } },
};

let id = store.get("pp:clientId");
if (!id) {
  id = Array.from(crypto.getRandomValues(new Uint8Array(6)), (b) => b.toString(16).padStart(2, "0")).join("");
  store.set("pp:clientId", id);
}
let name = store.get("pp:name") || "";
let wantsIn = Boolean(name) && store.get("pp:in") === "1";

let state = null;      // last State from the stage
let stateAt = 0;
let upAt = 0;          // when the link last came up
let downSince = Date.now();
let lastJoinAt = 0;
let choosing = false;  // seated, but looking for another seat
let choosingFrom = null;
let view = null;       // "name" or "seats"
let padsKey = "";
let drawn = "";

const $ = (s) => document.querySelector(s);
const screen = $("#screen");
const statusBox = $("#status");

// ---- Link ----

let link = null;
const send = (msg) => link?.send({ ...msg, clientId: id });
const join = () => { lastJoinAt = Date.now(); send({ type: "join", name }); };

function onStatus(up) {
  if (up) { upAt = Date.now(); if (wantsIn) join(); }
  else if (downSince <= upAt) downSince = Date.now(); // only the first drop counts, retries must not restart the clock
  showStatus();
}
function onMessage(msg) {
  if (msg?.type !== "state" || !Array.isArray(msg.players) || !Array.isArray(msg.layout?.spots)) return;
  state = msg;
  stateAt = Date.now();
  // The stage forgets players when its page reloads. Join again if we are missing.
  if (wantsIn && !me() && Date.now() - lastJoinAt > 1500) join();
  render();
  showStatus();
}
if (new URLSearchParams(location.search).has("mock")) {
  import("./mock.js").then((m) => { link = m.openMockLink(onMessage, onStatus); });
} else {
  link = openLink(onMessage, onStatus);
}

const me = () => state?.players.find((p) => p.clientId === id);

// ---- The one line that says what is wrong ----

function showStatus() {
  const now = Date.now();
  let text = "";
  if (!upAt || downSince > upAt) {
    if (now - downSince > 1500) text = "Lost the connection. Trying again.";
  } else if (now - Math.max(stateAt, upAt) > 3000) {
    text = "No answer from the floor yet. The game must be open on the laptop.";
  } else if (state?.notice) {
    text = state.notice;
  }
  if (text) statusBox.querySelector("p").textContent = text;
  statusBox.toggleAttribute("data-show", Boolean(text));
}
setInterval(showStatus, 1000);

// ---- Screens ----

function render() {
  const want = wantsIn ? "seats" : "name";
  if (want !== view) {
    view = want;
    padsKey = "";
    drawn = "";
    if (want === "name") mountName(); else screen.replaceChildren();
  }
  if (view === "seats") syncSeats();
}

function mountName() {
  const form = document.createElement("form");
  form.className = "name";
  form.noValidate = true;
  form.innerHTML = `
    <h1 class="title" id="name-title">What should the floor call you?</h1>
    <input class="field" id="name" type="text" maxlength="${NAME_MAX}" autocomplete="given-name"
      autocapitalize="words" autocorrect="off" spellcheck="false" enterkeyhint="go"
      placeholder="Your name" aria-labelledby="name-title" aria-describedby="name-hint">
    <p class="hint" id="name-hint">It shows on your pad.</p>
    <button class="btn btn-primary" type="submit">Join</button>`;
  const field = form.querySelector("input");
  const hint = form.querySelector(".hint");
  field.value = name;
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const typed = field.value.replace(/\s+/g, " ").trim();
    if (!typed) {
      hint.textContent = "Type a name first.";
      hint.toggleAttribute("data-error", true);
      field.focus();
      return;
    }
    name = typed;
    wantsIn = true;
    choosing = false;
    store.set("pp:name", name);
    store.set("pp:in", "1");
    join();
    render();
  });
  field.addEventListener("input", () => {
    hint.textContent = "It shows on your pad.";
    hint.toggleAttribute("data-error", false);
  });
  screen.replaceChildren(form);
  field.focus();
}

// The seats are built once for a layout and then changed in place, so a claim lights the
// pad with a transition instead of redrawing the screen.
function mountSeats(layout) {
  const lanes = Math.min(Math.max(layout.lanes | 0, 3), 4);
  screen.innerHTML = `
    <section class="seats">
      <div><h1 class="title" id="seat-title"></h1><p class="sub"></p></div>
      <div class="pads" role="group" aria-labelledby="seat-title" data-n="${layout.spots.length}" style="--n:${layout.spots.length}; --lanes:${lanes}">
        ${layout.spots.map((s) => `
          <button class="pad" type="button" data-seat="${s.id}">
            <span class="lanes">${"<i></i>".repeat(lanes)}</span>
            <span class="num">${s.id}</span>
            <span class="who"></span>
          </button>`).join("")}
      </div>
      <span></span>
      <div class="actions"></div>
    </section>`;
}

const FALLBACK_LAYOUT = { lanes: 3, spots: [{ id: 1 }, { id: 2 }, { id: 3 }] };

function syncSeats() {
  const layout = state?.layout ?? FALLBACK_LAYOUT;
  const key = `${layout.lanes}:${layout.spots.map((s) => s.id)}`;
  if (key !== padsKey) { padsKey = key; drawn = ""; mountSeats(layout); }

  const mine = me();
  const seat = mine?.spotId ?? null;
  if (choosing && seat !== choosingFrom) choosing = false; // moved, so done choosing
  const players = state?.players ?? [];
  const snapshot = `${mine?.name}|${seat}|${choosing}|${players.map((p) => `${p.spotId}${p.name}`)}`;
  if (snapshot === drawn) return;
  drawn = snapshot;

  const seated = seat != null && !choosing;
  const title = screen.querySelector(".title");
  const sub = screen.querySelector(".sub");
  title.removeAttribute("style");
  if (!mine) {
    title.textContent = "Joining the floor";
    sub.textContent = "One moment.";
  } else if (seated) {
    const word = document.createElement("span");
    word.dataset.seatWord = "";
    word.textContent = `seat ${seat}`;
    title.style.setProperty("--c", `var(--seat-${seat})`);
    title.replaceChildren("You are in ", word);
    sub.textContent = "Look at the floor. Your name is on your pad.";
  } else {
    title.textContent = "Pick your seat";
    sub.textContent = "Same order as the floor, left to right.";
  }

  for (const pad of screen.querySelectorAll(".pad")) {
    const n = Number(pad.dataset.seat);
    const owner = players.find((p) => p.spotId === n);
    const own = owner?.clientId === id;
    const open = !owner && mine && !seated;
    const st = own ? "mine" : owner ? "taken" : open ? "open" : "idle";
    pad.dataset.state = st;
    pad.disabled = !(st === "open" || (own && choosing));
    const who = pad.querySelector(".who");
    who.textContent = st === "open" ? "Sit here" : (owner?.name ?? "");
    who.style.setProperty("--len", Math.max(who.textContent.length, 4)); // the CSS sizes the name to fit
    pad.setAttribute("aria-label", {
      open: `Seat ${n}, free. Sit here.`,
      mine: choosing ? `Seat ${n}, yours. Keep it.` : `Seat ${n}, yours.`,
      taken: `Seat ${n}, taken by ${owner?.name}.`,
      idle: `Seat ${n}, free.`,
    }[st]);
  }

  const actions = screen.querySelector(".actions");
  const btn = (act, label) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "btn btn-quiet";
    b.dataset.act = act;
    b.textContent = label;
    return b;
  };
  if (choosing) actions.replaceChildren(btn("stay", "Keep my seat"));
  else if (seated) actions.replaceChildren(btn("change", "Change seat"), btn("leave", "Leave"));
  else actions.replaceChildren(btn("leave", "Change name"));
}

let lastClaimAt = 0;
screen.addEventListener("click", (e) => {
  const pad = e.target.closest(".pad");
  if (pad && !pad.disabled) {
    const n = Number(pad.dataset.seat);
    if (pad.dataset.state === "mine") choosing = false;
    else if (Date.now() - lastClaimAt > 400) {
      lastClaimAt = Date.now();
      navigator.vibrate?.(12);
      send({ type: "claim", spotId: n });
    }
    drawn = "";
    syncSeats();
    return;
  }
  const act = e.target.closest("[data-act]")?.dataset.act;
  if (act === "change") { choosing = true; choosingFrom = me()?.spotId ?? null; }
  else if (act === "stay") choosing = false;
  else if (act === "leave") {
    send({ type: "leave" });
    wantsIn = false;
    choosing = false;
    store.set("pp:in", "0");
    render();
    return;
  }
  if (act) { drawn = ""; syncSeats(); }
});

render();
