// The projected game. Phones join, pick seats and start songs over the link; this page is the one
// source of truth (session.js), draws the floor and plays the sound.
// Keys: F fullscreen, P pause or resume, S skip, Esc stop, C setup (also when a phone sends calibrate).
// URL options: ?feet=mouse (the default; the whole picture is the field) ?feet=camera (feet from the camera, after setup) or ?feet=seats (seated play: tap in place, one slice of the picture for each seat),
// ?demo=1 (a guest in every seat, Space starts the songs), ?autostart=1 (with demo, starts at once).
import { create as createQr } from "qrcode";
import { mouseFeet } from "../track/mouse.js";
import { createTrackedFeet } from "../track/tracked.js";
import { createSeatSource, glowFeet } from "../track/seatsource.js";
import { HIT_V, TRAVEL_MS } from "../game/engine.js";
import { createSynth } from "../game/synth.js";
import { createRenderer } from "../game/render.js";
import { createRenderer as createTileRenderer } from "../game/tiles.js";
import { songs } from "../songs/index.js";
import { openLink } from "../link.js";
import { createSession, trainFromAddress, trainQuery } from "./session.js";
import { listStops } from "../mbta/api.js";
import { feetBySpot, makeLayout } from "./layout.js";
import { applyKeystone } from "./keystone.js";
import { openSetup } from "./setup.js";

const LAYOUT_KEY = "pp:layout";
const TRAIN_KEY = "pp:train"; // the train this floor is in: line, direction, stop, car
const PLAYERS_KEY = "pp:players"; // who is seated where, so a reloaded stage keeps everyone
const DEMO_SONGS = ["twinkle", "greensleeves"];

const params = new URLSearchParams(location.search);
const demo = params.get("demo") === "1";
const canvas = document.createElement("canvas");
document.getElementById("app").append(canvas);
applyKeystone(canvas); // the saved corners from setup straighten the picture on the floor

// The one place that picks where feet come from.
// ?feet=seats is seated play: one pose for each seat, tapping in place. ?src=<video url> plays a recording instead of the camera,
// ?model=lite|full and ?perframe=N (how many seats run on each camera frame) tune its speed.
const feetSources = {
  mouse: () => mouseFeet(canvas),
  camera: () => createTrackedFeet(),
  seats: () => createSeatSource({ layout: snap.layout, src: params.get("src"), model: params.get("model") ?? "lite", perFrame: +params.get("perframe") || Infinity }),
};
function pickFeetSource() {
  const name = params.get("feet") ?? "mouse";
  if (!feetSources[name]) throw new Error(`There is no feet source called "${name}". Use ?feet=mouse, ?feet=camera or ?feet=seats.`);
  return feetSources[name]();
}

function saved(key) {
  try { return JSON.parse(localStorage.getItem(key)); } catch { return null; } // the session checks what it is given
}

// The train comes from the address (the poster's QR code leads here), else from the last one saved, else the default.
// ?seats=1..4 sets the number of seats from the address, for a quick test without the phone or setup.
const seatsParam = Number(params.get("seats"));
const session = createSession({ songs, layout: seatsParam >= 1 && seatsParam <= 4 ? makeLayout({ seats: seatsParam }) : saved(LAYOUT_KEY), train: trainFromAddress(location.search) ?? saved(TRAIN_KEY) });
const synth = createSynth();
// The falling-tiles floor (first drawn by Zohayb) is the look while a song plays. ?look=pads brings back the old pads.
const draw = (params.get("look") === "pads" ? createRenderer : createTileRenderer)(canvas);
let snap = session.snapshot(0); // the latest State: layout, settings, players
let appliedVolume = null;
const ringing = new Map(); // "spotId:lane" -> the function that stops that held note
let qr = null;
let qrNote = ["Looking for the network..."];

// The session's clock runs offsetMs behind the wall clock, so a foot the camera saw late still lands on its tile.
// A new lag set during a song waits for the next song, so the clock reads the one in use.
const clock = () => performance.now() - session.offsetMs();

// A reloaded stage gives back the players and their seats; a song that was running is gone, and the phones are told.
const before = saved(PLAYERS_KEY);
session.restore(before?.players, clock(), before?.live === true);

// The link: every message from a phone goes to the session, and the phones get the State back.
const link = openLink((message) => apply(message));
const LIVE = ["countdown", "playing", "paused"];
function sendState() {
  const state = session.snapshot(clock());
  link.send(state);
  localStorage.setItem(TRAIN_KEY, JSON.stringify(state.train));
  localStorage.setItem(PLAYERS_KEY, JSON.stringify({ players: state.players.map(({ clientId, spotId }) => ({ clientId, spotId })), live: LIVE.includes(state.status) }));
}

function publish() {
  snap = session.snapshot(clock());
  localStorage.setItem(LAYOUT_KEY, JSON.stringify(snap.layout));
  sendState();
}
// `local` is the laptop's own keys, which need no join. Phones must have joined to use the controls.
function apply(message, local = false) {
  session.apply(message, clock(), { stage: local });
  publish();
}
setInterval(sendState, 500);

// The QR code points at the laptop's address on the network and carries the train, so the phone knows where it is
// the moment it opens. The stage itself runs on localhost, which a phone cannot open, so the server lists the addresses.
let lanUrl = null;
function drawQr() {
  const href = lanUrl + trainQuery(snap.train);
  qr = createQr(href, { errorCorrectionLevel: "M" }).modules;
  canvas.dataset.joinUrl = href; // for checks: the address the QR code holds
}
async function findAddress() {
  try {
    const { urls } = await (await fetch("/lan")).json();
    lanUrl = urls[0] ?? null;
    if (lanUrl) return drawQr();
    qr = null;
    qrNote = ["No Wi-Fi found.", "Join Wi-Fi or a hotspot."];
  } catch {
    lanUrl = qr = null;
    qrNote = ["The game server", "is not answering."];
  }
}
// The address holds the stop's id only (and so does the QR code); the MBTA has its name.
function nameStop() {
  const { atStopId, atStopName } = snap.train;
  if (atStopName !== atStopId) return;
  listStops()
    .then((all) => {
      const stop = all.find((s) => s.id === atStopId);
      if (stop && session.setTrain({ ...snap.train, atStopName: stop.name })) publish();
    })
    .catch((err) => console.warn("Could not find the stop's name:", err.message));
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
      if (e.status === "countdown") setupHandle?.close(); // a song is starting, so setup gives the floor back
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
let setupHandle = null;
function setup() {
  setupHandle = openSetup({
    stage: { feet: feetSource },
    layout: snap.layout,
    offsetMs: snap.settings.offsetMs,
    section: snap.train.atStopName, // setup's "Where is this?" field has no job now; delete these two lines when setup drops it
    setSection: () => true,
    // The pads the setup page dragged. False while a song is playing.
    // The seated source gets the same layout, so its slices follow the seats at once.
    setLayout: (layout) => { const ok = session.setLayout(layout); if (ok) feetSource.setLayout?.(layout); publish(); return ok; },
    isPlaying: () => LIVE.includes(snap.status), // so setup can drop a "song is playing" refusal when the song ends
    setOffset: (ms) => apply({ type: "set", offsetMs: ms }, true),
    onClose: () => { setupHandle = null; applyKeystone(canvas); tellReady(); },
  }) ?? setupHandle; // already open: keep the handle we have
}

// A tile is drawn further along, so it looks on the line at the moment the player must step.
const shift = () => (session.offsetMs() / TRAVEL_MS) * HIT_V;
const shifted = (tiles) => tiles.map((t) => ({ ...t, v: t.v + shift(), vTail: t.vTail + shift() }));

const feetSource = (() => { try { return pickFeetSource(); } catch (err) { return err; } })();

let padLanes = {}; // how many lanes each pad had on the last frame, for a seated source
function frame() {
  const now = clock();
  // A seated source already gives each seat's feet in pad coordinates; the others give field feet that are sorted into pads.
  const seated = !!feetSource.bySpot;
  const read = seated ? null : feetSource.read();
  const byPad = seated ? feetSource.bySpot(padLanes) : feetBySpot(snap.layout, read);
  const fieldFeet = seated ? glowFeet(snap.layout, byPad) : read;
  const view = session.tick(now, byPad);
  padLanes = Object.fromEntries(view.pads.map((p) => [p.spotId, p.lanes])); // a lone player has 2 lanes, one for each foot; with more players each has 1
  snap = session.snapshot(now);
  const events = session.drain();
  playSounds(events);
  if (snap.settings.volume !== appliedVolume) { appliedVolume = snap.settings.volume; synth.setVolume?.(appliedVolume); }
  if (view.status === "countdown" || view.status === "playing") synth.backing?.(view.song, view.songMs + session.offsetMs());
  draw({
    status: view.status,
    layout: snap.layout,
    pads: view.pads.map((p) => ({ ...p, tiles: shifted(p.tiles), feet: (byPad[p.spotId] ?? []).filter((f) => !f.lifted) })), // a foot in the air does not light its lane
    players: snap.players,
    songMs: view.songMs,
    song: view.song,
    transit: snap.transit,
    train: snap.train, // the tiles floor takes the line's colour and names the stop from it
    team: snap.team,
    feet: fieldFeet,
    events,
    qr,
    qrNote,
  });
  requestAnimationFrame(frame);
}

function startDemo() {
  apply({ type: "start", songIds: DEMO_SONGS, transit: null }, true);
}

window.addEventListener("keydown", (e) => {
  if (e.repeat) return;
  synth.unlock(); // browsers keep sound off until a key press or a click
  synth.load?.();
  if (e.code === "KeyF") {
    if (document.fullscreenElement) document.exitFullscreen();
    else document.documentElement.requestFullscreen();
  } else if (e.code === "KeyP") apply({ type: snap.status === "paused" ? "resume" : "pause" }, true);
  else if (e.code === "KeyS") apply({ type: "skip" }, true);
  else if (e.code === "Escape") apply({ type: "stop" }, true);
  else if (e.code === "KeyC") setup();
  else if (e.code === "Space" && demo) { e.preventDefault(); startDemo(); }
});
window.addEventListener("pointerdown", () => { synth.unlock(); synth.load?.(); });

if (feetSource instanceof Error) {
  document.getElementById("app").innerHTML = `<p class="error">${feetSource.message}</p>`;
} else {
  // A camera that will not start opens setup, whose first step says why. Any other failure stops the stage.
  // Only a source with a camera picture (the camera map, or the seats) opens setup; its first step shows the reason and a camera picker.
  feetSource.start().catch((err) => { if (!feetSource.raw) throw err; setup(); }).then(() => {
    tellReady();
    if (demo) {
      snap.layout.spots.forEach((spot) => {
        apply({ type: "join", clientId: `guest-${spot.id}` });
        apply({ type: "claim", clientId: `guest-${spot.id}`, spotId: spot.id });
      });
      // Guests are not phones, so they say they are still there for themselves.
      setInterval(() => snap.layout.spots.forEach((spot) => session.apply({ type: "here", clientId: `guest-${spot.id}` }, clock())), 3000);
      if (params.get("autostart") === "1") startDemo();
    }
    findAddress();
    nameStop();
    frame();
  }).catch((err) => {
    document.getElementById("app").innerHTML = `<p class="error">Could not start the game: ${err.message}</p>`;
  });
}
