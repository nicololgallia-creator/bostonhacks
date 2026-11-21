// Camera check page: the live picture with a dot on every foot. Works with no camera too:
// track.html?src=/qa/person.jpg (an image) or ?src=<video file url>.
// track.html?replay=/qa/feet/<name>.json runs the page from a recording instead. Record saves one.
import { createCameraFeet } from "./camera.js";
import { createRecorder, createReplay, loadRecording } from "./record.js";

const $ = (id) => document.getElementById(id);
const stage = $("stage"), cameraSelect = $("camera"), modelSelect = $("model"), stats = $("stats");
const params = new URLSearchParams(location.search);
const src = params.get("src"), replay = params.get("replay");
let recorder = null; // set while Record is on

const recordButton = document.createElement("button");
recordButton.textContent = "Record";
recordButton.style.cssText = "font: inherit; min-height: 44px; padding: 0 16px;";
recordButton.hidden = !!replay;
stats.before(recordButton);
recordButton.addEventListener("click", () => {
  if (!recorder) { recorder = createRecorder(); recordButton.textContent = "Stop and save"; return; }
  const done = recorder;
  recorder = null;
  recordButton.textContent = "Record";
  if (done.count() === 0) return showError("Nothing was recorded. Wait for the camera to start, record for a few seconds, then press Stop and save.");
  const link = document.createElement("a");
  link.href = URL.createObjectURL(new Blob([JSON.stringify(done.toJSON())], { type: "application/json" }));
  link.download = `feet-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}.json`;
  link.click();
  URL.revokeObjectURL(link.href);
});
const CAMERA_KEY = "track:camera";

let tracker = null;
let stream = null;
let run = 0; // bumped on every restart, so an old loop stops itself

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

function makeSource() {
  if (src && /\.(jpe?g|png|webp)(\?|$)/i.test(src)) {
    const img = new Image();
    img.src = src;
    return { el: img, ready: img.decode().catch(() => { throw new Error(`The image ${src} could not be loaded.`); }) };
  }
  const video = document.createElement("video");
  video.muted = true;
  video.playsInline = true;
  if (src) {
    video.src = src;
    video.loop = true;
    return { el: video, ready: video.play().catch(() => { throw new Error(`The video ${src} could not be played.`); }) };
  }
  const open = (id) => navigator.mediaDevices.getUserMedia({ video: { deviceId: id ? { exact: id } : undefined, width: { ideal: 1280 }, height: { ideal: 720 } } });
  const ready = (async () => {
    if (!navigator.mediaDevices) throw new Error(cameraReason({}));
    try {
      stream = await open(localStorage.getItem(CAMERA_KEY));
    } catch (e) {
      if (e.name !== "OverconstrainedError") throw e;
      localStorage.removeItem(CAMERA_KEY); // the remembered camera is unplugged
      stream = await open();
    }
    video.srcObject = stream;
    await video.play();
    const cameras = (await navigator.mediaDevices.enumerateDevices()).filter((d) => d.kind === "videoinput");
    const current = stream.getVideoTracks()[0].getSettings().deviceId;
    cameraSelect.replaceChildren(...cameras.map((d, i) => new Option(d.label || `Camera ${i + 1}`, d.deviceId, false, d.deviceId === current)));
  })().catch((e) => { throw new Error(cameraReason(e)); });
  return { el: video, ready };
}

// A recording holds no picture, so the dots are drawn on a black box with the camera's 16:9 shape.
function blankPicture() {
  const box = document.createElement("div");
  box.style.cssText = "width: 960px; max-width: 100%; aspect-ratio: 16 / 9; background: #111;";
  return box;
}

function draw(canvas, el, poses, feet) {
  const w = (canvas.width = el.clientWidth), h = (canvas.height = el.clientHeight);
  const g = canvas.getContext("2d");
  g.fillStyle = "rgba(0, 220, 255, 0.55)";
  for (const lm of poses) for (const p of lm) { g.beginPath(); g.arc(p.x * w, p.y * h, 4, 0, 7); g.fill(); }
  g.fillStyle = "#ffd23f";
  g.strokeStyle = "#000";
  g.lineWidth = 2;
  for (const f of feet) { g.beginPath(); g.arc(f.x * w, f.y * h, 10, 0, 7); g.fill(); g.stroke(); }
}

async function restart() {
  const id = ++run;
  if (tracker) tracker.stop();
  if (stream) stream.getTracks().forEach((t) => t.stop());
  stream = tracker = null;
  stage.replaceChildren();
  showError("");
  stats.textContent = "Starting...";
  try {
    const recording = replay ? await loadRecording(replay) : null;
    const { el, ready } = recording ? { el: blankPicture(), ready: Promise.resolve() } : makeSource();
    await ready;
    const canvas = document.createElement("canvas");
    stage.append(el, canvas);
    tracker = recording ? createReplay(recording) : createCameraFeet({ video: el, model: modelSelect.value });
    const mine = tracker;
    const delegate = await mine.start();
    const next = el.tagName === "IMG" ? (f) => setTimeout(f, 100) : requestAnimationFrame; // a still picture does not need 30 fps
    const loop = () => {
      if (id !== run) return;
      const feet = mine.read();
      if (recorder) recorder.add(performance.now(), feet);
      draw(canvas, el, mine.poses(), feet);
      stats.textContent = `${mine.fps()} fps, ${delegate}, ${feet.length} feet`;
      next(loop);
    };
    loop();
  } catch (e) {
    if (id !== run) return;
    stats.textContent = "";
    showError(e.message);
  }
}

cameraSelect.parentElement.hidden = !!src || !!replay;
modelSelect.parentElement.hidden = !!replay;
modelSelect.value = params.get("model") || "lite";
modelSelect.addEventListener("change", restart);
cameraSelect.addEventListener("change", () => { localStorage.setItem(CAMERA_KEY, cameraSelect.value); restart(); });
restart();
