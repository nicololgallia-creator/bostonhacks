// Feet for seated players: one pose for each seat.
// The camera picture is cut into one upright slice for each seat. A pose model with one person
// to find runs on each slice by itself, so the second, third and fourth person are not missed.
// `slices` is [{ spotId, x0, x1 }], each a share of the picture's width (0 to 1).
// Two things keep a close neighbour out of a seat:
// - Each model is shown a little more picture than its slice, on both sides, so a person near the edge is whole.
// - A person counts for the seat whose own slice holds their hips. A pose with its hips outside the slice is the
//   neighbour and is dropped for that frame.
// read() returns [{ spotId, foot: 0 | 1, x, y, shin }] in whole-picture units (x and y from 0 to 1;
// shin, the knee-to-ankle length, is a share of the picture's height). Feet keep their names by position: a foot
// seen now takes the name of the nearest foot of the frame before, so crossing feet do not swap. With no
// history, the foot further left in the picture is 0.
import { FilesetResolver, PoseLandmarker } from "@mediapipe/tasks-vision";

export const PAD_SHARE = 0.15; // the extra picture on each side of a slice, a share of the slice's width
const MEMORY_MS = 500; // a foot unseen for longer than this has no place to be matched to
const HEEL_TOE = [[29, 31], [30, 32]]; // the model's left foot, then its right foot
const KNEE_ANKLE = [[25, 27], [26, 28]];
const SEEN = 0.5; // a landmark is used above this visibility

// The picture span the model is shown for a slice: the slice and `pad` of its width on each side, kept inside the picture.
export function cropOf({ x0, x1 }, pad = PAD_SHARE) {
  const extra = (x1 - x0) * pad;
  return { x0: Math.max(0, x0 - extra), x1: Math.min(1, x1 + extra) };
}

// Where a person's hips are across the picture (0 to 1): the middle of the two hip landmarks. One hip seen is used
// alone, shoulders stand in when no hip is seen, and null means nothing to judge by. `lm` is in whole-picture units.
export function hipsX(lm) {
  for (const pair of [[23, 24], [11, 12]]) {
    const seen = pair.map((k) => lm[k]).filter((p) => p && p.visibility > SEEN);
    if (seen.length) return seen.reduce((sum, p) => sum + p.x, 0) / seen.length;
  }
  return null;
}

// A person belongs to the seat whose own slice holds their hips. With no hips to judge by, the benefit of the doubt.
export const ownsPerson = (hipX, { x0, x1 }) => hipX === null || (hipX >= x0 && hipX <= x1);

// Every foot one pose shows, before names: [{ side, x, y, shin }]. `lm` is in whole-picture units.
export function seenFeet(lm, vw, vh) {
  return [0, 1].flatMap((side) => {
    const [heel, toe] = HEEL_TOE[side].map((k) => lm[k]);
    if (heel.visibility <= SEEN || toe.visibility <= SEEN) return [];
    const shins = [side, 1 - side].flatMap((s) => {
      const [knee, ankle] = KNEE_ANKLE[s].map((k) => lm[k]);
      return knee.visibility > SEEN && ankle.visibility > SEEN ? [Math.hypot((knee.x - ankle.x) * vw, (knee.y - ankle.y) * vh) / vh] : [];
    });
    // No leg seen at all: the tap detector cannot scale this foot, so it is left out.
    return shins.length ? [{ side, x: (heel.x + toe.x) / 2, y: (heel.y + toe.y) / 2, shin: shins[0] }] : [];
  });
}

// Gives each seen foot a name, 0 or 1. `prev` is [foot 0's last place, foot 1's last place], each { x, y } or null,
// and `aspect` is the picture's width over its height. With both last places known, the feet are matched to them by
// the least total distance, so feet that cross, or one that drops out for a frame, keep their names. Otherwise: the
// one further left is 0 when two are seen, and a lone foot is named from the model's side (the model's right foot is
// on the left of the picture for a person facing the camera).
export function nameFeet(seen, prev = [null, null], aspect = 1) {
  if (seen.length === 2) seen = [...seen].sort((a, b) => a.x - b.x);
  const d = (f, p) => Math.hypot((f.x - p.x) * aspect, f.y - p.y);
  if (prev[0] && prev[1]) {
    if (seen.length === 2) {
      const swap = d(seen[0], prev[1]) + d(seen[1], prev[0]) < d(seen[0], prev[0]) + d(seen[1], prev[1]);
      return seen.map((f, i) => ({ ...f, foot: (i === 1) !== swap ? 1 : 0 }));
    }
    return seen.map((f) => ({ ...f, foot: d(f, prev[1]) < d(f, prev[0]) ? 1 : 0 }));
  }
  return seen.map((f, i) => ({ ...f, foot: seen.length === 2 ? i : 1 - f.side }));
}

const SCAN_WIDTH = 0.4, SCAN_STEP = 0.2; // the windows of the scan: a share of the picture's width, and how far each moves on
const SAME_PERSON = 0.05; // two hips closer than this across the picture are one person

// Adds hips to a list of people already found, skipping any that is the same person as one there. Returns the list, sorted.
export const addHips = (found, hips) => hips.reduce((all, h) => (all.some((x) => Math.abs(x - h) < SAME_PERSON) ? all : [...all, h]), found).sort((a, b) => a - b);

// Finds where `n` people are in one picture (a video frame or an image), once, with no slices to start from. Returns
// { hips: [x, ...] sorted left to right, at most n, each 0 to 1 across the picture; ms; method }.
// The first try is one pose model asked for n people in the whole frame. If that finds fewer, it scans: the same model on
// windows across the picture, each shown more or less one person, keeping the distinct hips. `method` is "whole" or "scan".
export async function findHips(source, n, { model = "lite", scan = true } = {}) {
  const t0 = performance.now();
  const isVideo = source.tagName === "VIDEO";
  const vw = isVideo ? source.videoWidth : source.naturalWidth, vh = isVideo ? source.videoHeight : source.naturalHeight;
  if (!vw || !vh) throw new Error("The camera picture is not ready yet, so no one can be found in it.");
  const vision = await FilesetResolver.forVisionTasks("/mediapipe/wasm");
  const open = (delegate) => PoseLandmarker.createFromOptions(vision, {
    baseOptions: { modelAssetPath: `/mediapipe/pose_landmarker_${model}.task`, delegate },
    runningMode: "IMAGE",
    numPoses: n,
    minPoseDetectionConfidence: 0.3,
    minPosePresenceConfidence: 0.3,
    minTrackingConfidence: 0.3,
  });
  let landmarker;
  try {
    landmarker = await open("GPU");
    landmarker.detect(document.createElement("canvas")); // proves the GPU path runs
  } catch {
    landmarker?.close();
    landmarker = await open("CPU");
  }
  try {
    // Every person's hips in the span x0 to x1 of the picture, in whole-picture units.
    const look = (x0, x1) => {
      const sx = Math.round(x0 * vw), sw = Math.max(1, Math.round(x1 * vw) - sx);
      const canvas = document.createElement("canvas");
      canvas.width = sw; canvas.height = vh;
      canvas.getContext("2d").drawImage(source, sx, 0, sw, vh, 0, 0, sw, vh);
      return landmarker.detect(canvas).landmarks
        .map((raw) => hipsX(raw.map((p) => ({ x: (sx + p.x * sw) / vw, y: p.y, visibility: p.visibility }))))
        .filter((h) => h !== null);
    };
    let hips = addHips([], look(0, 1));
    let method = "whole";
    if (scan && hips.length < n) {
      method = "scan";
      for (let x = 0; x + SCAN_WIDTH < 1 + SCAN_STEP / 2; x += SCAN_STEP) hips = addHips(hips, look(x, Math.min(1, x + SCAN_WIDTH)));
    }
    return { hips: hips.slice(0, n), ms: Math.round(performance.now() - t0), method, found: hips.length };
  } finally {
    landmarker.close();
  }
}

// `perFrame` limits how many slices run on each new camera frame (they take turns), if all of
// them together are too slow. Each seat's rate then falls to about fps * perFrame / seats.
// `cpuOnly` skips the GPU, for a computer whose GPU path is slow or unreliable.
// `pad` is the extra picture each model sees on both sides of its slice (0 for none).
// The slices are read on every frame, so moving a slice's x0 and x1 in place moves it at once.
export function createSeatFeet({ video, slices, model = "lite", perFrame = Infinity, cpuOnly = false, pad = PAD_SHARE }) {
  const modelUrl = `/mediapipe/pose_landmarker_${model}.task`;
  const landmarkers = [];
  const canvases = slices.map(() => document.createElement("canvas"));
  const empty = (i) => ({ spotId: slices[i].spotId, feet: [], landmarks: [], hipX: null, dropped: false, active: true, n: 0 });
  const results = slices.map((_, i) => empty(i));
  let active = null; // the spot ids whose models run (setActive); null is all of them
  const isActive = (i) => !active || active.has(slices[i].spotId);
  let runs = 0; // pose models run so far, one for each seat and camera picture (detections)
  const stamps = slices.map(() => []);
  const lastTs = slices.map(() => 0);
  const places = slices.map(() => [null, null]); // each seat's feet where they were last seen: [{ x, y, t }, ...]
  let lastTime = -1;
  let cursor = 0;

  const make = (vision, delegate) => PoseLandmarker.createFromOptions(vision, {
    baseOptions: { modelAssetPath: modelUrl, delegate },
    runningMode: "VIDEO",
    numPoses: 1,
    minPoseDetectionConfidence: 0.3,
    minPosePresenceConfidence: 0.3,
    minTrackingConfidence: 0.3,
  });

  async function makeAll(vision, delegate) {
    for (let i = 0; i < slices.length; i++) landmarkers[i] = await make(vision, delegate);
  }

  // Resolves to "GPU" or "CPU", the one that works on this computer.
  async function start() {
    const head = await fetch(modelUrl, { method: "HEAD" }).catch(() => null);
    if (!head || !head.ok || (head.headers.get("content-type") || "").includes("html")) {
      throw new Error(`The pose model ${modelUrl} is missing. Run npm.cmd install to download it, then reload.`);
    }
    if (!document.createElement("canvas").getContext("webgl2")) {
      throw new Error("This browser has no WebGL, which the pose model needs. Use Chrome or Edge with hardware acceleration turned on.");
    }
    const vision = await FilesetResolver.forVisionTasks("/mediapipe/wasm");
    if (!cpuOnly) {
      try {
        await makeAll(vision, "GPU");
        landmarkers.forEach((l) => l.detectForVideo(document.createElement("canvas"), performance.now())); // proves the GPU path runs
        return "GPU";
      } catch {
        landmarkers.splice(0).forEach((l) => l.close());
      }
    }
    await makeAll(vision, "CPU");
    return "CPU";
  }

  function detect(i, vw, vh) {
    const slice = slices[i];
    const crop = cropOf(slice, pad);
    const sx = Math.round(crop.x0 * vw), sw = Math.max(1, Math.round(crop.x1 * vw) - sx);
    const canvas = canvases[i];
    if (canvas.width !== sw || canvas.height !== vh) { canvas.width = sw; canvas.height = vh; }
    canvas.getContext("2d").drawImage(video, sx, 0, sw, vh, 0, 0, sw, vh);
    const now = performance.now();
    lastTs[i] = Math.max(now, lastTs[i] + 1); // a landmarker needs rising timestamps
    const [raw] = landmarkers[i].detectForVideo(canvas, lastTs[i]).landmarks;
    runs++;
    const n = results[i].n + 1;
    if (!raw) {
      results[i] = { ...empty(i), n };
    } else {
      const lm = raw.map((p) => ({ x: (sx + p.x * sw) / vw, y: p.y, visibility: p.visibility }));
      const hipX = hipsX(lm);
      const own = ownsPerson(hipX, slice);
      const prev = places[i].map((p) => (p && now - p.t < MEMORY_MS ? p : null));
      const feet = own ? nameFeet(seenFeet(lm, vw, vh), prev, vw / vh).map(({ side, ...f }) => ({ spotId: slice.spotId, ...f })) : [];
      for (const f of feet) places[i][f.foot] = { x: f.x, y: f.y, t: now };
      results[i] = { spotId: slice.spotId, feet, landmarks: lm, hipX, dropped: !own, active: true, n };
    }
    stamps[i] = stamps[i].filter((t) => now - t < 1000).concat(now);
  }

  function read() {
    if (landmarkers.length === slices.length) {
      const isVideo = video.tagName === "VIDEO";
      const vw = isVideo ? video.videoWidth : video.naturalWidth, vh = isVideo ? video.videoHeight : video.naturalHeight;
      const fresh = isVideo ? video.readyState >= 2 && video.currentTime !== lastTime : vw > 0;
      if (fresh && vw && vh) {
        lastTime = video.currentTime;
        // Only the seats in use run; they take turns when perFrame is less than their number.
        const running = slices.map((_, i) => i).filter(isActive);
        const count = Math.min(perFrame, running.length);
        for (let k = 0; k < count; k++) detect(running[(cursor + k) % running.length], vw, vh);
        cursor = running.length ? (cursor + count) % running.length : 0;
      }
    }
    return results.flatMap((r) => r.feet);
  }

  // `ids` are the spot ids whose models run (null: all). A seat left out is not looked at: it shows no feet, its `n` stands
  // still, and it costs no model run. One put back starts with no memory of where its feet were.
  function setActive(ids) {
    active = ids ? new Set(ids) : null;
    slices.forEach((s, i) => {
      if (!isActive(i)) results[i] = { ...empty(i), active: false, n: results[i].n };
      else if (!results[i].active) { results[i] = { ...results[i], active: true }; places[i] = [null, null]; }
    });
  }

  return {
    start,
    read,
    setActive,
    detections: () => runs,
    // Frames a second of each seat's own pose model, one number for each slice (0 for a seat that is not running).
    fps: () => stamps.map((s) => s.filter((t) => performance.now() - t < 1000).length),
    // Each seat's last result: every landmark (for the debug dots), where the person's hips are, whether the pose was
    // dropped as a neighbour's, its feet, and a count of how many times the seat has been looked at.
    poses: () => results,
    stop() { landmarkers.splice(0).forEach((l) => l.close()); },
  };
}
