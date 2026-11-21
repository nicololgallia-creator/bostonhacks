// Camera check page: the live picture with a dot on every foot. Works with no camera too:
// track.html?src=/qa/person.jpg (an image) or ?src=<video file url>.
import { createCameraFeet } from "./camera.js";

const $ = (id) => document.getElementById(id);
const stage = $("stage"), cameraSelect = $("camera"), modelSelect = $("model"), stats = $("stats");
const src = new URLSearchParams(location.search).get("src");
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
    const { el, ready } = makeSource();
    await ready;
    const canvas = document.createElement("canvas");
    stage.append(el, canvas);
    tracker = createCameraFeet({ video: el, model: modelSelect.value });
    const mine = tracker;
    const delegate = await mine.start();
    const next = el.tagName === "IMG" ? (f) => setTimeout(f, 100) : requestAnimationFrame; // a still picture does not need 30 fps
    const loop = () => {
      if (id !== run) return;
      const feet = mine.read();
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

cameraSelect.parentElement.hidden = !!src;
modelSelect.value = new URLSearchParams(location.search).get("model") || "lite";
modelSelect.addEventListener("change", restart);
cameraSelect.addEventListener("change", () => { localStorage.setItem(CAMERA_KEY, cameraSelect.value); restart(); });
restart();
