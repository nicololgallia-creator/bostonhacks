// Feet from a camera picture, using MediaPipe Pose Landmarker in the browser.
// `video` is a <video> or an <img>. read() returns one { x, y, person } per visible foot,
// x and y from 0 to 1 in the picture. Calibration (src/track/homography.js) maps them onto the field.
import { FilesetResolver, PoseLandmarker } from "@mediapipe/tasks-vision";

const FEET = [[29, 31], [30, 32]]; // heel and foot index landmarks, left foot then right foot

export function createCameraFeet({ video, model = "lite", maxPeople = 4 }) {
  const modelUrl = `/mediapipe/pose_landmarker_${model}.task`;
  let landmarker = null;
  let poses = [];
  let feet = [];
  let lastTime = -1;
  let stamps = [];

  const make = (vision, delegate) => PoseLandmarker.createFromOptions(vision, {
    baseOptions: { modelAssetPath: modelUrl, delegate },
    runningMode: "VIDEO",
    numPoses: maxPeople,
  });

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
    try {
      landmarker = await make(vision, "GPU");
      landmarker.detectForVideo(document.createElement("canvas"), performance.now()); // proves the GPU path runs
      return "GPU";
    } catch {
      if (landmarker) landmarker.close();
      landmarker = await make(vision, "CPU");
      return "CPU";
    }
  }

  function read() {
    if (!landmarker) return feet;
    const isVideo = video.tagName === "VIDEO";
    if (isVideo ? video.readyState < 2 || video.currentTime === lastTime : !video.naturalWidth) return feet;
    lastTime = video.currentTime;
    const now = performance.now();
    poses = landmarker.detectForVideo(video, now).landmarks;
    feet = poses.flatMap((lm, person) => FEET.flatMap(([heel, toe]) => {
      const a = lm[heel], b = lm[toe];
      return a.visibility > 0.5 && b.visibility > 0.5 ? [{ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, person }] : [];
    }));
    stamps = stamps.filter((t) => now - t < 1000).concat(now);
    return feet;
  }

  return {
    start,
    read,
    fps: () => stamps.length,
    poses: () => poses, // every landmark of every person from the last frame, for the debug dots
    stop() { if (landmarker) landmarker.close(); landmarker = null; },
  };
}
