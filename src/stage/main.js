// The projected game. Phones join, pick seats and start songs over the link; this page is the one
// source of truth (session.js), draws the floor and plays the sound.
// Keys: F fullscreen, P pause or resume, S skip, Esc stop, C setup (also when a phone sends calibrate).
// URL options: ?feet=mouse (the default; the whole picture is the field) or ?feet=camera (feet from the camera, after setup),
// ?demo=1 (a guest in every seat, Space starts the songs), ?autostart=1 (with demo, starts at once).
import { create as createQr } from "qrcode";
import { mouseFeet } from "../track/mouse.js";
import { createTrackedFeet } from "../track/tracked.js";
import { HIT_V, TRAVEL_MS } from "../game/engine.js";
import { createSynth } from "../game/synth.js";
import { createRenderer } from "../game/render.js";
import { songs } from "../songs/index.js";
import { openLink } from "../link.js";
import { createSession } from "./session.js";
import { feetBySpot } from "./layout.js";
import { applyKeystone } from "./keystone.js";
import { openSetup } from "./setup.js";

const LAYOUT_KEY = "pp:layout";
const GUESTS = ["Ana", "Ben", "Cy", "Dee"];
const DEMO_SONGS = ["twinkle", "greensleeves"];

const params = new URLSearchParams(location.search);
const demo = params.get("demo") === "1";
const canvas = document.createElement("canvas");
document.getElementById("app").append(canvas);
applyKeystone(canvas); // the saved corners from setup straighten the picture on the floor

// The one place that picks where feet come from.
const feetSources = { mouse: () => mouseFeet(canvas), camera: () => createTrackedFeet() };
function pickFeetSource() {
  const name = params.get("feet") ?? "mouse";
  if (!feetSources[name]) throw new Error(`There is no feet source called "${name}". Use ?feet=mouse or ?feet=camera.`);
  return feetSources[name]();
}

function savedLayout() {
  try { return JSON.parse(localStorage.getItem(LAYOUT_KEY)); } catch { return null; } // createSession checks it
}

const session = createSession({ songs, layout: savedLayout() });
const synth = createSynth();
const draw = createRenderer(canvas);
let snap = session.snapshot(0); // the latest State: layout, settings, players
let appliedVolume = null;
const ringing = new Map(); // "spotId:lane" -> the function that stops that held note
let qr = null;
let qrNote = ["Looking for the network..."];

// The session's clock runs offsetMs behind the wall clock, so a foot the camera saw late still lands on its tile.
const clock = () => performance.now() - snap.settings.offsetMs;

// The link: every message from a phone goes to the session, and the phones get the State back.
const link = openLink((message) => apply(message));
const sendState = () => link.send(session.snapshot(clock()));

function publish() {
  snap = session.snapshot(clock());
  localStorage.setItem(LAYOUT_KEY, JSON.stringify(snap.layout));
  sendState();
}
function apply(message) {
  session.apply(message, clock());
  publish();
}
setInterval(sendState, 500);

// The QR code points at the laptop's address on the network. The stage itself runs on localhost,
// which a phone cannot open, so the server lists the addresses.
async function findAddress() {
  try {
    const { urls } = await (await fetch("/lan")).json();
    if (urls.length) { qr = createQr(urls[0], { errorCorrectionLevel: "M" }).modules; return; }
    qr = null;
    qrNote = ["No Wi-Fi found.", "Join Wi-Fi or a hotspot."];
  } catch {
    qr = null;
    qrNote = ["The game server", "is not answering."];
  }
}

function stopSound() {
  ringing.forEach((stop) => stop());
  ringing.clear();
  synth.stopAll?.();
}

function playSounds(events) {
  for (const e of events) {
    const key = `${e.spotId}:${e.lane}`;
    if (e.type === "status") {
      if (e.status !== "playing") stopSound();
      if (e.status === "lobby") findAddress();
      sendState();
    } else if (e.type === "hit") synth.note(e.midi);
    else if (e.type === "holdStart") ringing.set(key, synth.noteOn(e.midi));
    else if (e.type === "holdEnd") { ringing.get(key)?.(); ringing.delete(key); }
    else if (e.type === "miss") synth.thud();
    else if (e.type === "calibrate") setup();
  }
}

// Setup lines the camera up with the projector. The camera source tells the session what is ready.
const tellReady = () => { if (feetSource.ready) session.setReady(feetSource.ready()); };
function setup() {
  openSetup({
    stage: { feet: feetSource },
    layout: snap.layout,
    offsetMs: snap.settings.offsetMs,
    // The pads the setup page dragged. False while a song is playing.
    setLayout: (layout) => { const ok = session.setLayout(layout); publish(); return ok; },
    setOffset: (ms) => apply({ type: "set", offsetMs: ms }),
    onClose: () => { applyKeystone(canvas); tellReady(); },
  });
}

// A tile is drawn further along, so it looks on the line at the moment the player must step.
const shift = () => (snap.settings.offsetMs / TRAVEL_MS) * HIT_V;
const shifted = (tiles) => tiles.map((t) => ({ ...t, v: t.v + shift(), vTail: t.vTail + shift() }));

const feetSource = (() => { try { return pickFeetSource(); } catch (err) { return err; } })();

function frame() {
  const now = clock();
  const fieldFeet = feetSource.read();
  const byPad = feetBySpot(snap.layout, fieldFeet);
  const view = session.tick(now, byPad);
  snap = session.snapshot(now);
  const events = session.drain();
  playSounds(events);
  if (snap.settings.volume !== appliedVolume) { appliedVolume = snap.settings.volume; synth.setVolume?.(appliedVolume); }
  if (view.status === "countdown" || view.status === "playing") synth.backing?.(view.song, view.songMs + snap.settings.offsetMs);
  draw({
    status: view.status,
    layout: snap.layout,
    pads: view.pads.map((p) => ({ ...p, tiles: shifted(p.tiles), feet: byPad[p.spotId] ?? [] })),
    players: snap.players,
    songMs: view.songMs,
    song: view.song,
    transit: snap.transit,
    feet: fieldFeet,
    events,
    qr,
    qrNote,
  });
  requestAnimationFrame(frame);
}

function startDemo() {
  apply({ type: "start", songIds: DEMO_SONGS, transit: null });
}

window.addEventListener("keydown", (e) => {
  if (e.repeat) return;
  synth.unlock(); // browsers keep sound off until a key press or a click
  synth.load?.();
  if (e.code === "KeyF") {
    if (document.fullscreenElement) document.exitFullscreen();
    else document.documentElement.requestFullscreen();
  } else if (e.code === "KeyP") apply({ type: snap.status === "paused" ? "resume" : "pause" });
  else if (e.code === "KeyS") apply({ type: "skip" });
  else if (e.code === "Escape") apply({ type: "stop" });
  else if (e.code === "KeyC") setup();
  else if (e.code === "Space" && demo) { e.preventDefault(); startDemo(); }
});
window.addEventListener("pointerdown", () => { synth.unlock(); synth.load?.(); });

if (feetSource instanceof Error) {
  document.getElementById("app").innerHTML = `<p class="error">${feetSource.message}</p>`;
} else {
  // A camera that will not start opens setup, whose first step says why. Any other failure stops the stage.
  feetSource.start().catch((err) => { if (!feetSource.ready) throw err; setup(); }).then(() => {
    tellReady();
    if (demo) {
      snap.layout.spots.forEach((spot, i) => {
        apply({ type: "join", clientId: `guest-${spot.id}`, name: GUESTS[i % GUESTS.length] });
        apply({ type: "claim", clientId: `guest-${spot.id}`, spotId: spot.id });
      });
      if (params.get("autostart") === "1") startDemo();
    }
    findAddress();
    frame();
  }).catch((err) => {
    document.getElementById("app").innerHTML = `<p class="error">Could not start the game: ${err.message}</p>`;
  });
}
