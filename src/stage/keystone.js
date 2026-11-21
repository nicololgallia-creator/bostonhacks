// Straightens the projected picture. A projector that sits at an angle throws a stretched shape on the floor,
// so the stage draws through a CSS matrix3d that pulls the picture's four corners to where the person dragged them.
// Also keeps the setup's saved result, { cameraId, corners, cameraToField }, in localStorage as `pp:calibration`.
import { solve } from "../track/homography.js";

const KEY = "pp:calibration";
const FULL = [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }]; // top left, top right, bottom right, bottom left

// The CSS matrix3d that stretches a full-window element of width x height pixels so its corners land on `corners`,
// given as 0 to 1 of the window. Throws a plain sentence when three corners are in a line.
export function matrix3dFor(corners, width, height) {
  const rect = [{ x: 0, y: 0 }, { x: width, y: 0 }, { x: width, y: height }, { x: 0, y: height }];
  const target = corners.map((c) => ({ x: c.x * width, y: c.y * height }));
  let h;
  try { h = solve(rect, target); } catch { throw new Error("Three of the corners are in a line, so the picture cannot be straightened. Drag a corner away from the others."); }
  // The 3x3 map goes into a 4x4 matrix, written column by column as CSS wants it.
  return `matrix3d(${[h[0], h[3], 0, h[6], h[1], h[4], 0, h[7], 0, 0, 1, 0, h[2], h[5], 0, h[8]].join(", ")})`;
}

const watched = new WeakSet();

// Sets the saved corners on a full-window element, and again whenever the window changes size (F for full screen).
export function applyKeystone(element) {
  const set = () => {
    element.style.transformOrigin = "0 0";
    element.style.transform = matrix3dFor(loadCalibration().corners, innerWidth, innerHeight);
  };
  set();
  if (!watched.has(element)) {
    watched.add(element);
    addEventListener("resize", set);
  }
}

const isNumber = (n) => typeof n === "number" && Number.isFinite(n);

// Each saved part is checked on its own, so one broken value falls back to its default and keeps the rest.
export function loadCalibration() {
  const out = { cameraId: null, corners: FULL.map((c) => ({ ...c })), cameraToField: null };
  let saved;
  try { saved = JSON.parse(localStorage.getItem(KEY)); } catch { return out; }
  if (!saved || typeof saved !== "object") return out;
  if (typeof saved.cameraId === "string" && saved.cameraId) out.cameraId = saved.cameraId;
  if (Array.isArray(saved.cameraToField) && saved.cameraToField.length === 9 && saved.cameraToField.every(isNumber)) out.cameraToField = saved.cameraToField;
  const c = saved.corners;
  if (Array.isArray(c) && c.length === 4 && c.every((p) => p && isNumber(p.x) && isNumber(p.y) && p.x >= 0 && p.x <= 1 && p.y >= 0 && p.y <= 1)) {
    try { matrix3dFor(c, 1, 1); out.corners = c.map((p) => ({ x: p.x, y: p.y })); } catch { /* three in a line: keep the full window */ }
  }
  return out;
}

// Changes only the parts given: saveCalibration({ corners }) keeps the camera and the map.
export function saveCalibration(changes) {
  localStorage.setItem(KEY, JSON.stringify({ ...loadCalibration(), ...changes }));
}
