// Feet for seated players: one pose for each seat.
// The camera picture is cut into one upright slice for each seat. A pose model with one person
// to find runs on each slice by itself, so the second, third and fourth person are not missed.
// `slices` is [{ spotId, x0, x1 }], each a share of the picture's width (0 to 1).
// read() returns [{ spotId, foot: 0 | 1, x, y, shin }] in whole-picture units (x and y from 0 to 1;
// shin, the knee-to-ankle length, is a share of the picture's height). foot 0 is the one further
// left in the picture. When only one foot is seen, the model's right foot is foot 0, since people
// face the camera and their right foot is on the left of the picture.
import { FilesetResolver, PoseLandmarker } from "@mediapipe/tasks-vision";

const HEEL_TOE = [[29, 31], [30, 32]]; // the model's left foot, then its right foot
const KNEE_ANKLE = [[25, 27], [26, 28]];

// `perFrame` limits how many slices run on each new camera frame (they take turns), if all of
// them together are too slow. Each seat's rate then falls to about fps * perFrame / seats.
// `cpuOnly` skips the GPU, for a computer whose GPU path is slow or unreliable.
// The slices are read on every frame, so moving a slice's x0 and x1 in place moves it at once.
export function createSeatFeet({ video, slices, model = "lite", perFrame = Infinity, cpuOnly = false }) {
  const modelUrl = `/mediapipe/pose_landmarker_${model}.task`;
  const landmarkers = [];
  const canvases = slices.map(() => document.createElement("canvas"));
  const results = slices.map(() => ({ feet: [], landmarks: [] }));
  const stamps = slices.map(() => []);
  const lastTs = slices.map(() => 0);
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

  // Feet of one seat from one slice's landmarks. Coordinates are whole-picture units.
  function feetOf(lm, spotId, sw, vw, vh) {
    const seen = [0, 1].flatMap((side) => {
      const [heel, toe] = HEEL_TOE[side].map((k) => lm[k]);
      if (heel.visibility <= 0.5 || toe.visibility <= 0.5) return [];
      const shins = [side, 1 - side].flatMap((s) => {
        const [knee, ankle] = KNEE_ANKLE[s].map((k) => lm[k]);
        return knee.visibility > 0.5 && ankle.visibility > 0.5 ? [Math.hypot((knee.x - ankle.x) * sw, (knee.y - ankle.y) * vh) / vh] : [];
      });
      // No leg seen at all: the tap detector cannot scale this foot, so it is left out.
      return shins.length ? [{ side, x: (heel.x + toe.x) / 2, y: (heel.y + toe.y) / 2, shin: shins[0] }] : [];
    });
    if (seen.length === 2) seen.sort((a, b) => a.x - b.x);
    return seen.map((f, i) => ({ spotId, foot: seen.length === 2 ? i : 1 - f.side, x: f.x, y: f.y, shin: f.shin }));
  }

  function detect(i, vw, vh) {
    const { spotId, x0, x1 } = slices[i];
    const sx = Math.round(x0 * vw), sw = Math.max(1, Math.round(x1 * vw) - sx);
    const canvas = canvases[i];
    if (canvas.width !== sw || canvas.height !== vh) { canvas.width = sw; canvas.height = vh; }
    canvas.getContext("2d").drawImage(video, sx, 0, sw, vh, 0, 0, sw, vh);
    const now = performance.now();
    lastTs[i] = Math.max(now, lastTs[i] + 1); // a landmarker needs rising timestamps
    const [lm] = landmarkers[i].detectForVideo(canvas, lastTs[i]).landmarks;
    const whole = (p) => ({ x: (sx + p.x * sw) / vw, y: p.y, visibility: p.visibility });
    results[i] = lm ? { feet: feetOf(lm, spotId, sw, vw, vh).map((f) => ({ ...f, x: (sx + f.x * sw) / vw })), landmarks: lm.map(whole) } : { feet: [], landmarks: [] };
    stamps[i] = stamps[i].filter((t) => now - t < 1000).concat(now);
  }

  function read() {
    if (landmarkers.length === slices.length) {
      const isVideo = video.tagName === "VIDEO";
      const vw = isVideo ? video.videoWidth : video.naturalWidth, vh = isVideo ? video.videoHeight : video.naturalHeight;
      const fresh = isVideo ? video.readyState >= 2 && video.currentTime !== lastTime : vw > 0;
      if (fresh && vw && vh) {
        lastTime = video.currentTime;
        const count = Math.min(perFrame, slices.length);
        for (let k = 0; k < count; k++) detect((cursor + k) % slices.length, vw, vh);
        cursor = (cursor + count) % slices.length;
      }
    }
    return results.flatMap((r) => r.feet);
  }

  return {
    start,
    read,
    // Frames a second of each seat's own pose model, one number for each slice.
    fps: () => stamps.map((s) => s.filter((t) => performance.now() - t < 1000).length),
    poses: () => results.map((r, i) => ({ spotId: slices[i].spotId, landmarks: r.landmarks })), // every landmark of each seat, for the debug dots
    stop() { landmarkers.splice(0).forEach((l) => l.close()); },
  };
}
