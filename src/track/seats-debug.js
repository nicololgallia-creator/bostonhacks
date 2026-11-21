// Seat tracking check: the live camera cut into one slice for each seat, a dot on every foot,
// each seat's frames a second, and a graph of each foot's height so a tap shows as a bump.
// seats.html?src=/qa/seats/three.png&seats=3 runs on a picture or video file instead of the camera.
// seats.html?replay=/qa/seats/<recording>.json runs from a recording made with the Record button, no camera.
// Other settings in the address: model=lite|full, mode=whole (the old whole-picture tracker), pad=0.15 (the extra picture each
// seat's model sees on both sides, as a share of the slice), perframe=N (slices run in turn), delegate=cpu (skip the GPU),
// pace=ms (wait between frames on a still picture).
import { createSeatFeet, PAD_SHARE } from "./seats.js";
import { createCameraFeet } from "./camera.js";
import { createTapDetector } from "./taps.js";
import { frameOf, loadSeatRecording, createReplayFeet } from "./seatreplay.js";
import { readSaved, writeSaved, moveBound } from "./slices.js";

const $ = (id) => document.getElementById(id);
const stage = $("stage"), cameraSelect = $("camera"), countSelect = $("count"), modelSelect = $("model"), modeSelect = $("mode"), padSelect = $("pad"), recButton = $("rec");
const params = new URLSearchParams(location.search);
const src = params.get("src"), replayUrl = params.get("replay");
const CAMERA_KEY = "seats:camera";
const COLORS = ["#ff6b6b", "#4dd2ff", "#7dff7d", "#ffd23f"];
const HISTORY_MS = 5000, LIFT = 0.08; // a lift counts above this share of a shin

const isImage = src && /\.(jpe?g|png|webp)(\?|$)/i.test(src);
// A recording has no picture, so a plain dark box of the camera's shape stands in for it.
const el = replayUrl ? Object.assign(document.createElement("div"), { className: "blank" }) : isImage ? new Image() : document.createElement("video");
if (!replayUrl) {
  el.muted = true;
  el.playsInline = true;
}
const canvas = document.createElement("canvas");
stage.append(el, canvas);

let bounds = [0, 1]; // the dividers across the picture: both outer edges and every one between two seats, shares of its width
let slices = [];
let tracker = null, stream = null, run = 0, mode = "sliced", delegate = "";
let history = []; // history[seat][foot] = [{ t, y }]
let detector = null, taps = [], dropped = [], seen = ""; // taps and dropped frames counted for each seat since the tracker started
let recording = null; // { began, frames } while the Record button is on
let recorded = null; // the recording loaded for ?replay=

function showError(message) {
  $("error").hidden = !message;
  $("error").textContent = message || "";
}

function cameraReason(e) {
  if (!navigator.mediaDevices) return "The browser only allows the camera on localhost or https. Open this page at http://localhost:5173 on the laptop.";
  if (e.name === "NotAllowedError") return "The browser blocked the camera. Click the camera icon in the address bar, choose Allow, and reload.";
  if (e.name === "NotFoundError") return "No camera found. Plug the camera in and reload. The DJI must be in webcam mode.";
  if (e.name === "NotReadableError") return "Another app is using this camera. Close it (Zoom, the DJI app, another browser tab) and reload.";
  return e.message;
}

// Opens the picture source once. The video stays on the page the whole time, because a browser
// pauses a video taken off the page and a paused camera hands out one frozen frame.
async function openSource() {
  if (replayUrl) {
    recorded = await loadSeatRecording(replayUrl);
    return;
  }
  if (isImage) {
    el.src = src;
    return el.decode().catch(() => { throw new Error(`The image ${src} could not be loaded.`); });
  }
  if (src) {
    el.src = src;
    el.loop = true;
    return el.play().catch(() => { throw new Error(`The video ${src} could not be played.`); });
  }
  try {
    if (!navigator.mediaDevices) throw new Error();
    const open = (id) => navigator.mediaDevices.getUserMedia({ video: { deviceId: id ? { exact: id } : undefined, width: { ideal: 1280 }, height: { ideal: 720 } } });
    if (stream) stream.getTracks().forEach((t) => t.stop());
    try {
      stream = await open(localStorage.getItem(CAMERA_KEY));
    } catch (e) {
      if (e.name !== "OverconstrainedError") throw e;
      localStorage.removeItem(CAMERA_KEY); // the remembered camera is unplugged
      stream = await open();
    }
    el.srcObject = stream;
    await el.play();
    const cameras = (await navigator.mediaDevices.enumerateDevices()).filter((d) => d.kind === "videoinput");
    const current = stream.getVideoTracks()[0].getSettings().deviceId;
    cameraSelect.replaceChildren(...cameras.map((d, i) => new Option(d.label || `Camera ${i + 1}`, d.deviceId, false, d.deviceId === current)));
  } catch (e) {
    throw new Error(cameraReason(e));
  }
}

function setBounds(next) {
  bounds = next;
  slices.forEach((s, i) => { s.x0 = bounds[i]; s.x1 = bounds[i + 1]; }); // the tracker reads these same objects, so it follows at once
  writeSaved(bounds);
}

function buildCards(n) {
  $("seats").replaceChildren(...Array.from({ length: n }, (_, i) => {
    const card = document.createElement("div");
    card.className = "seat";
    card.style.setProperty("--c", COLORS[i]);
    card.innerHTML = `<b>Player ${i + 1}</b> <span class="info">starting</span><canvas></canvas>`;
    return card;
  }));
}

function draw(feet, poses) {
  const w = (canvas.width = el.clientWidth), h = (canvas.height = el.clientHeight);
  const g = canvas.getContext("2d");
  g.font = "14px system-ui";
  if (mode === "sliced") {
    slices.forEach((s, i) => {
      g.fillStyle = COLORS[i] + "22";
      g.fillRect(s.x0 * w, 0, (s.x1 - s.x0) * w, h);
      g.fillStyle = COLORS[i];
      g.fillRect(s.x0 * w, 0, 2, h);
      g.fillText(`Player ${s.spotId}`, s.x0 * w + 8, 20);
    });
    if (!replayUrl) { // a handle on every divider, outer edges too, each dragged on its own
      g.fillStyle = "#fff";
      for (const x of bounds) { g.fillRect(x * w - 3, 0, 6, h); g.fillRect(x * w - 10, h / 2 - 24, 20, 48); }
    }
    for (const p of poses) {
      g.fillStyle = p.dropped ? "rgba(255, 90, 90, 0.7)" : "rgba(0, 220, 255, 0.55)"; // red: a neighbour's pose, dropped
      for (const q of p.landmarks) { g.beginPath(); g.arc(q.x * w, q.y * h, 3, 0, 7); g.fill(); }
      if (p.hipX !== null) { // a tick where the person's hips are
        g.fillStyle = p.dropped ? "#ff5a5a" : "#fff";
        g.fillRect(p.hipX * w - 2, h - 16, 4, 16);
      }
    }
  } else {
    g.fillStyle = "rgba(0, 220, 255, 0.55)";
    for (const lm of poses) for (const q of lm) { g.beginPath(); g.arc(q.x * w, q.y * h, 3, 0, 7); g.fill(); }
  }
  g.strokeStyle = "#000";
  g.lineWidth = 2;
  for (const f of feet) {
    g.fillStyle = mode === "sliced" ? COLORS[f.spotId - 1] : "#ffd23f";
    g.beginPath(); g.arc(f.x * w, f.y * h, 10, 0, 7); g.fill(); g.stroke();
    if (mode === "sliced") { g.fillStyle = "#fff"; g.fillText(`${f.spotId}.${f.foot}`, f.x * w + 14, f.y * h + 5); }
  }
}

// One seat's graph: each foot's height above its lowest point in the last 5 seconds, in shins.
function drawGraph(i, now) {
  const c = $("seats").children[i].querySelector("canvas");
  const w = (c.width = c.clientWidth), h = (c.height = c.clientHeight);
  const g = c.getContext("2d");
  const top = 0.5; // shins at the top of the graph
  g.strokeStyle = "#666";
  g.setLineDash([4, 4]);
  g.beginPath(); g.moveTo(0, h - (LIFT / top) * h); g.lineTo(w, h - (LIFT / top) * h); g.stroke();
  g.setLineDash([]);
  history[i].forEach((points, foot) => {
    if (points.length < 2) return;
    const ground = Math.max(...points.map((p) => p.y));
    g.strokeStyle = foot ? "#fff" : COLORS[i];
    g.lineWidth = 2;
    g.beginPath();
    points.forEach((p, k) => {
      const x = w - ((now - p.t) / HISTORY_MS) * w, y = h - Math.min(1, (ground - p.y) / p.shin / top) * h;
      k ? g.lineTo(x, y) : g.moveTo(x, y);
    });
    g.stroke();
  });
}

function record(feet, now) {
  for (const f of feet) {
    const list = history[f.spotId - 1][f.foot];
    list.push({ t: now, y: f.y, shin: f.shin });
  }
  for (const seat of history) for (const list of seat) while (list.length && now - list[0].t > HISTORY_MS) list.shift();
}

// A new result from the tracker (not the same one read again): the taps, the dropped neighbours, and the recording.
function onNewFrame(feet, poses, now) {
  const lanes = Object.fromEntries(slices.map((s) => [s.spotId, slices.length >= 2 ? 1 : 2])); // one lane each with two or more players
  for (const t of detector.update(now, feet, lanes).taps) taps[t.spotId - 1]++;
  poses.forEach((p, i) => { if (p.dropped) dropped[i]++; });
  if (recording) {
    recording.frames.push(frameOf(now - recording.began, poses));
    recButton.textContent = `Stop and save (${recording.frames.length} frames)`;
  }
}

function toggleRecording() {
  if (!recording) {
    recording = { began: performance.now(), frames: [] };
    recButton.textContent = "Stop and save (0 frames)";
    return;
  }
  const { frames } = recording;
  recording = null;
  recButton.textContent = "Record";
  if (!frames.length) return showError("Nothing was recorded. The tracker has not produced a frame yet. Wait for the dots to appear, then record again.");
  const file = { version: 2, model: modelSelect.value, pad: +padSelect.value, delegate, slices: slices.map(({ spotId, x0, x1 }) => ({ spotId, x0, x1 })), frames };
  const link = document.createElement("a");
  link.href = URL.createObjectURL(new Blob([JSON.stringify(file)], { type: "application/json" }));
  link.download = `seats-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}.json`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 10000); // not at once: some browsers start the download after the click returns
}

async function restart() {
  const id = ++run;
  if (tracker) tracker.stop();
  tracker = null;
  recording = null;
  recButton.textContent = "Record";
  showError("");
  mode = modeSelect.value;
  recButton.disabled = mode === "whole";
  try {
    await ready;
    if (id !== run) return;
    if (recorded) countSelect.value = recorded.slices.length; // a recording knows how many seats it had
    const n = +countSelect.value;
    bounds = recorded ? [...recorded.slices.map((s) => s.x0), recorded.slices.at(-1).x1] : readSaved(n);
    slices = recorded ? recorded.slices.map((s) => ({ ...s })) : bounds.slice(0, n).map((x0, i) => ({ spotId: i + 1, x0, x1: bounds[i + 1] }));
    history = slices.map(() => [[], []]);
    detector = createTapDetector();
    taps = slices.map(() => 0);
    dropped = slices.map(() => 0);
    seen = "";
    buildCards(n);
    $("seats").hidden = mode === "whole";
    $("stats").textContent = "Starting...";
    const perFrame = +params.get("perframe") || Infinity;
    const pad = +padSelect.value;
    tracker = recorded ? createReplayFeet({ recording: recorded })
      : mode === "whole" ? createCameraFeet({ video: el, model: modelSelect.value })
      : createSeatFeet({ video: el, slices, model: modelSelect.value, perFrame, pad, cpuOnly: params.get("delegate") === "cpu" });
    const mine = tracker;
    delegate = await mine.start();
    if (id !== run) return;
    const pace = params.has("pace") ? +params.get("pace") : 100;
    const next = isImage ? (f) => setTimeout(f, pace) : requestAnimationFrame; // a still picture does not need 30 fps
    const loop = () => {
      if (id !== run) return;
      const feet = mine.read();
      const poses = mine.poses();
      const now = performance.now();
      draw(feet, poses);
      if (mode === "sliced") {
        const stamp = poses.map((p) => p.n).join();
        if (stamp !== seen) { seen = stamp; onNewFrame(feet, poses, now); }
        record(feet, now);
        const rates = mine.fps();
        slices.forEach((s, i) => {
          const card = $("seats").children[i];
          const own = feet.filter((f) => f.spotId === s.spotId).length;
          card.querySelector(".info").textContent = `${rates[i]} fps, ${own} feet, ${taps[i]} taps, ${dropped[i]} neighbour frames dropped`;
          drawGraph(i, now);
        });
        $("stats").textContent = `${n} seats, ${feet.length} feet, ${delegate}`;
        document.body.dataset.result = JSON.stringify({ delegate, rates, feet: feet.length, taps, dropped, seats: poses.map((p) => ({ feet: p.feet.length, hipX: p.hipX, dropped: p.dropped })) });
      } else {
        $("stats").textContent = `whole picture: ${poses.length} ${poses.length === 1 ? "person" : "people"}, ${feet.length} feet, ${mine.fps()} fps, ${delegate}`;
        document.body.dataset.result = JSON.stringify({ delegate, rates: [mine.fps()], people: poses.length, feet: feet.length });
      }
      next(loop);
    };
    loop();
  } catch (e) {
    if (id !== run) return;
    $("stats").textContent = "";
    showError(e.message);
  }
}

// Drag any divider, the outer edges included: the nearest one to the pointer, kept between its neighbours.
let dragging = -1;
canvas.addEventListener("pointerdown", (e) => {
  if (mode !== "sliced" || replayUrl) return;
  const rect = canvas.getBoundingClientRect(), x = (e.clientX - rect.left) / rect.width;
  const reach = 16 / rect.width;
  const nearest = bounds.reduce((best, b, i) => (Math.abs(b - x) < Math.abs(bounds[best] - x) ? i : best), 0);
  if (Math.abs(bounds[nearest] - x) > reach) return;
  dragging = nearest;
  canvas.setPointerCapture(e.pointerId);
});
canvas.addEventListener("pointermove", (e) => {
  if (dragging < 0) return;
  const rect = canvas.getBoundingClientRect();
  setBounds(moveBound(bounds, dragging, (e.clientX - rect.left) / rect.width));
});
canvas.addEventListener("pointerup", () => { dragging = -1; });

const ready = openSource();
ready.catch((e) => { $("stats").textContent = ""; showError(e.message); });
cameraSelect.parentElement.hidden = !!src || !!replayUrl;
countSelect.value = params.get("seats") || "2";
countSelect.disabled = !!replayUrl;
modelSelect.value = params.get("model") || "lite";
modeSelect.value = params.get("mode") || "sliced";
padSelect.value = params.has("pad") ? String(+params.get("pad")) : String(PAD_SHARE);
if (![...padSelect.options].some((o) => o.value === padSelect.value)) padSelect.add(new Option(`${Math.round(padSelect.value * 100)}%`, padSelect.value, false, true));
recButton.hidden = !!replayUrl;
recButton.addEventListener("click", () => { if (mode === "sliced") toggleRecording(); });
for (const s of [countSelect, modelSelect, modeSelect, padSelect]) s.addEventListener("change", restart);
cameraSelect.addEventListener("change", () => {
  localStorage.setItem(CAMERA_KEY, cameraSelect.value);
  run++; // stop the tracker's loop while the camera changes
  openSource().then(restart, (e) => showError(e.message));
});
restart();
