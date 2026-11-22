// Install mode: the stage as a fixture in a space. Nobody picks a camera, presses F, presses T or presses a key for sound.
// Turned on by stage.html?install=1 and remembered; ?install=0 turns it off. Everything here is pure, or takes what it needs.
// What the stage does with it is in the "install" blocks of main.js.
const INSTALL_KEY = "pp:install";
const FACING_KEY = "pp:facing"; // facing.js's key. install.test.js checks the two still match.
const FLOOR_WORDS = ["osmo", "dji", "action"]; // the camera on the tripod
const LAPTOP_WORDS = ["integrated", "facetime", "built-in", "hd webcam", "ir camera"]; // the laptop's own cameras
export const NAME_MS = 6000; // how long the strip names the camera when all is well
export const RETRY_MS = 3000; // how often a camera that is missing is looked for again

const has = (label, words) => words.some((w) => String(label ?? "").toLowerCase().includes(w));
export const isLaptopCamera = (label) => has(label, LAPTOP_WORDS);
// Chrome and Edge add the USB ids to a camera's name: "DJI Osmo Action 4 (2ca3:0023)". People do not need them.
export const cleanLabel = (label) => String(label ?? "").replace(/\s*\([0-9a-f]{4}:[0-9a-f]{4}\)\s*$/i, "").trim();

// ?install=1 turns install mode on for good, ?install=0 turns it off, and without either the saved choice stands.
export function installOn(search, storage) {
  const q = new URLSearchParams(search).get("install");
  try {
    if (q === "1") storage.setItem(INSTALL_KEY, "1");
    else if (q === "0") storage.removeItem(INSTALL_KEY);
    return storage.getItem(INSTALL_KEY) === "1";
  } catch { return q === "1"; } // no storage: only the address counts
}

// The projector faces the players, so the picture starts turned. Someone who set it either way (key T, setup) keeps their choice.
export function defaultFacing(storage) {
  try { if (storage.getItem(FACING_KEY) === null) storage.setItem(FACING_KEY, "1"); } catch { /* no storage: the picture stays as it is */ }
}

// Which camera the floor uses. `devices` is [{ id, label }] in the browser's order, `savedId` the camera chosen before (or null).
// Gives { id, label, reason, laptop, remember }. reason: "saved" (the one chosen before, still there), "osmo" (the DJI),
// "outside" (a camera that is not the laptop's), "laptop" (only the laptop's own), "none" (no camera at all, id is null).
// `remember` is false for the laptop's own camera picked by default: it is not saved, so the DJI is found the day it is plugged in.
export function chooseCamera(devices, savedId = null) {
  const pick = (d, reason) => ({ id: d.id, label: cleanLabel(d.label), reason, laptop: isLaptopCamera(d.label), remember: reason !== "laptop" });
  const saved = savedId && devices.find((d) => d.id === savedId);
  if (saved) return pick(saved, "saved");
  const floor = devices.find((d) => has(d.label, FLOOR_WORDS));
  if (floor) return pick(floor, "osmo");
  const outside = devices.find((d) => !isLaptopCamera(d.label));
  if (outside) return pick(outside, "outside");
  const laptop = devices.find((d) => !has(d.label, ["ir camera"])) ?? devices[0]; // the infrared one cannot be used as a picture
  return laptop ? pick(laptop, "laptop") : { id: null, label: "", reason: "none", laptop: false, remember: false };
}

// The browser hides camera names until a camera has been allowed once, so with no names a camera is opened and let go first.
export async function pickInstallCamera(savedId, media = navigator.mediaDevices) {
  const cameras = async () => (await media.enumerateDevices()).filter((d) => d.kind === "videoinput");
  let list = await cameras();
  if (list.length && list.every((d) => !d.label)) {
    (await media.getUserMedia({ video: true })).getTracks().forEach((t) => t.stop());
    list = await cameras();
  }
  return chooseCamera(list.map((d) => ({ id: d.deviceId, label: d.label })), savedId);
}

// The camera a feet source is using now: { label, laptop }, or null when it has none (the mouse, a recording, a still).
export function cameraOf(feetSource) {
  const label = feetSource?.video?.srcObject?.getVideoTracks?.()[0]?.label;
  return label ? { label: cleanLabel(label), laptop: isLaptopCamera(label) } : null;
}

// What the strip says now, or null for nothing. A problem always shows in the lobby. The laptop's own camera in seated play stays up,
// because the tripod's camera is the one that sees the feet. Any other camera is named for NAME_MS after the lobby opens.
export function stripFor({ lobby, problem, camera, seated, sinceMs }) {
  if (!lobby) return null;
  if (problem) return { text: problem, alert: true };
  if (!camera) return null;
  if (camera.laptop && seated) return { text: "Camera: the laptop's own. Press C to change.", alert: true };
  return sinceMs < NAME_MS ? { text: `Camera: ${camera.label}`, alert: false } : null;
}

// The strip, an HTML element over the stage. `place(el)` turns it with the picture (applyKeystone), as the tracking test does.
export function createStrip(place) {
  const root = document.createElement("div");
  root.className = "install-strip";
  root.hidden = true;
  const text = document.createElement("p");
  text.setAttribute("role", "status");
  root.append(text);
  document.body.append(root);
  place(root);
  let shown = "";
  return {
    // `now` is what stripFor gives. The same words again change nothing, so a screen reader does not repeat them.
    show(now) {
      const key = now ? `${now.alert}:${now.text}` : "";
      if (key === shown) return;
      shown = key;
      root.hidden = !now;
      if (!now) return;
      text.textContent = now.text;
      root.classList.toggle("is-alert", now.alert);
    },
  };
}
