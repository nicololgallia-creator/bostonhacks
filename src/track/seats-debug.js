// Seat tracking check: the live camera cut into one slice for each seat, a dot on every foot,
// each seat's frames a second, and a graph of each foot's height so a tap shows as a bump.
// seats.html?src=/qa/seats/three.png&seats=3 runs on a picture or video file instead of the camera.
// Other settings in the address: model=lite|full, mode=whole (the old whole-picture tracker),
// perframe=N (slices run in turn), delegate=cpu (skip the GPU), pace=ms (wait between frames on a still picture).
import { createSeatFeet } from "./seats.js";
import { createCameraFeet } from "./camera.js";

const $ = (id) => document.getElementById(id);
const stage = $("stage"), cameraSelect = $("camera"), countSelect = $("count"), modelSelect = $("model"), modeSelect = $("mode");
const params = new URLSearchParams(location.search);
const src = params.get("src");
const CAMERA_KEY = "seats:camera", EDGES_KEY = "seats:edges";
const COLORS = ["#ff6b6b", "#4dd2ff", "#7dff7d", "#ffd23f"];
const HISTORY_MS = 5000, LIFT = 0.08; // a lift counts above this share of a shin
const MIN_WIDTH = 0.12; // the smallest share of the picture the outer edges may close to

const isImage = src && /\.(jpe?g|png|webp)(\?|$)/i.test(src);
const el = isImage ? new Image() : document.createElement("video");
el.muted = true;
el.playsInline = true;
const canvas = document.createElement("canvas");
stage.append(el, canvas);

let edges = { l: 0, r: 1 }; // the picture's left and right edge of the slices, shares of its width
try {
  const saved = JSON.parse(localStorage.getItem(EDGES_KEY));
  if (saved && saved.l >= 0 && saved.r <= 1 && saved.r - saved.l >= MIN_WIDTH) edges = saved;
} catch { /* nothing saved yet */ }
let slices = [];
let tracker = null, stream = null, run = 0, mode = "sliced", delegate = "";
let history = []; // history[seat][foot] = [{ t, y }]

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

function makeSlices(n) {
  const w = (edges.r - edges.l) / n;
  return Array.from({ length: n }, (_, i) => ({ spotId: i + 1, x0: edges.l + w * i, x1: edges.l + w * (i + 1) }));
}

function setEdges(l, r) {
  edges = { l, r };
  slices.forEach((s, i) => { // the tracker reads these same objects, so it follows at once
    const w = (r - l) / slices.length;
    s.x0 = l + w * i;
    s.x1 = l + w * (i + 1);
  });
  localStorage.setItem(EDGES_KEY, JSON.stringify(edges));
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
    g.fillStyle = "#fff"; // the two edge handles
    for (const x of [edges.l, edges.r]) { g.fillRect(x * w - 3, 0, 6, h); g.fillRect(x * w - 10, h / 2 - 24, 20, 48); }
    g.fillStyle = "rgba(0, 220, 255, 0.55)";
    for (const p of poses) for (const q of p.landmarks) { g.beginPath(); g.arc(q.x * w, q.y * h, 3, 0, 7); g.fill(); }
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

async function restart() {
  const id = ++run;
  if (tracker) tracker.stop();
  tracker = null;
  showError("");
  mode = modeSelect.value;
  const n = +countSelect.value;
  slices = makeSlices(n);
  history = slices.map(() => [[], []]);
  buildCards(n);
  $("seats").hidden = mode === "whole";
  $("stats").textContent = "Starting...";
  try {
    await ready;
    if (id !== run) return;
    const perFrame = +params.get("perframe") || Infinity;
    tracker = mode === "whole" ? createCameraFeet({ video: el, model: modelSelect.value }) : createSeatFeet({ video: el, slices, model: modelSelect.value, perFrame, cpuOnly: params.get("delegate") === "cpu" });
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
        record(feet, now);
        const rates = mine.fps();
        slices.forEach((s, i) => {
          const card = $("seats").children[i];
          card.querySelector(".info").textContent = `${rates[i]} fps, ${feet.filter((f) => f.spotId === s.spotId).length} feet`;
          drawGraph(i, now);
        });
        $("stats").textContent = `${n} seats, ${feet.length} feet, ${delegate}`;
        document.body.dataset.result = JSON.stringify({ delegate, rates, feet: feet.length });
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

// Drag the outer edges of the slices.
let dragging = null;
canvas.addEventListener("pointerdown", (e) => {
  if (mode !== "sliced") return;
  const rect = canvas.getBoundingClientRect(), x = (e.clientX - rect.left) / rect.width;
  const reach = 16 / rect.width;
  const side = Math.abs(x - edges.l) <= reach ? "l" : Math.abs(x - edges.r) <= reach ? "r" : null;
  if (!side) return;
  dragging = side;
  canvas.setPointerCapture(e.pointerId);
});
canvas.addEventListener("pointermove", (e) => {
  if (!dragging) return;
  const rect = canvas.getBoundingClientRect(), x = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
  if (dragging === "l") setEdges(Math.min(x, edges.r - MIN_WIDTH), edges.r);
  else setEdges(edges.l, Math.max(x, edges.l + MIN_WIDTH));
});
canvas.addEventListener("pointerup", () => { dragging = null; });

const ready = openSource();
ready.catch((e) => { $("stats").textContent = ""; showError(e.message); });
cameraSelect.parentElement.hidden = !!src;
countSelect.value = params.get("seats") || "2";
modelSelect.value = params.get("model") || "lite";
modeSelect.value = params.get("mode") || "sliced";
for (const s of [countSelect, modelSelect, modeSelect]) s.addEventListener("change", restart);
cameraSelect.addEventListener("change", () => {
  localStorage.setItem(CAMERA_KEY, cameraSelect.value);
  run++; // stop the tracker's loop while the camera changes
  openSource().then(restart, (e) => showError(e.message));
});
restart();
