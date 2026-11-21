// The projected game. Space starts a song, F toggles fullscreen.
// URL options: ?feet=mouse (the only source so far; click a tile, hold the button on a hold tile), ?players=1..4,
// ?autostart=1 (no sound, for screenshots).
import { mouseFeet } from "../track/mouse.js";
import { createGame, lanesFor } from "../game/engine.js";
import { createSynth } from "../game/synth.js";
import { createRenderer } from "../game/render.js";
import twinkle from "../../songs/twinkle.json";

const LEAD_IN_MS = 2500; // the first tile needs this long to slide in

const params = new URLSearchParams(location.search);
const players = Math.min(4, Math.max(1, parseInt(params.get("players"), 10) || 1));
const canvas = document.createElement("canvas");
document.getElementById("app").append(canvas);

// The one place that picks where feet come from. The camera tracker plugs in here later.
const feetSource = mouseFeet(canvas);

const synth = createSynth();
const draw = createRenderer(canvas);
let game = null;
let t0 = 0;
let status = "idle";
let result = { tiles: [], score: 0, combo: 0, multiplier: 1, grade: null };
const ringing = new Map(); // lane -> the function that stops that lane's held note

function start() {
  game = createGame({ song: twinkle, players });
  t0 = performance.now() + LEAD_IN_MS;
  status = "playing";
}

function frame() {
  const feet = feetSource.read();
  let events = [];
  if (status === "playing") {
    result = game.update(performance.now() - t0, feet);
    events = result.events;
    for (const e of events) {
      if (e.type === "hit") synth.note(e.midi);
      else if (e.type === "holdStart") ringing.set(e.lane, synth.noteOn(e.midi));
      else if (e.type === "holdEnd") { ringing.get(e.lane)?.(); ringing.delete(e.lane); }
      else synth.thud();
    }
    if (result.done) status = "done";
  }
  draw({ ...result, events, status, feet, lanes: game ? game.lanes : lanesFor(players) });
  requestAnimationFrame(frame);
}

window.addEventListener("keydown", (e) => {
  if (e.repeat) return;
  if (e.code === "Space") {
    e.preventDefault();
    if (status !== "playing") { synth.unlock(); ringing.forEach((stop) => stop()); ringing.clear(); start(); }
  } else if (e.code === "KeyF") {
    if (document.fullscreenElement) document.exitFullscreen();
    else document.documentElement.requestFullscreen();
  }
});

feetSource.start().then(() => {
  if (params.get("autostart") === "1") start();
  frame();
}).catch((err) => {
  document.getElementById("app").innerHTML = `<p class="error">Could not start the game: ${err.message}</p>`;
});
