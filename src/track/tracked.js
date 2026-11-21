// The real feet source for the stage: the saved camera, through the pose model (camera.js), through the
// clean-up and map onto the field (pipeline.js). Same shape as mouse.js: read() gives field feet [{ u, v }].
// With ?replay=/qa/feet/<name>.json in the address it plays a recording (record.js) instead of the camera.
// The map comes from the setup (pp:calibration). With no map it returns no feet.
import { createCameraFeet } from "./camera.js";
import { createPipeline } from "./pipeline.js";
import { createReplay, loadRecording } from "./record.js";
import { loadCalibration, saveCalibration } from "../stage/keystone.js";

function cameraReason(e) {
  if (!navigator.mediaDevices) return "The browser only allows the camera on localhost or https. Open this page at http://localhost:5173 on the laptop.";
  if (e.name === "NotAllowedError") return "The browser blocked the camera. Click the camera icon in the address bar, choose Allow, and reload.";
  if (e.name === "NotFoundError") return "No camera found. Plug the camera in and reload. The DJI must be in webcam mode.";
  if (e.name === "NotReadableError") return "Another app is using this camera. Close it (Zoom, the DJI app, another browser tab) and reload.";
  return e.message;
}

export function createTrackedFeet({ model = "lite" } = {}) {
  const replayUrl = new URLSearchParams(location.search).get("replay");
  const video = replayUrl ? null : document.createElement("video"); // the setup shows this picture
  if (video) {
    video.muted = true;
    video.playsInline = true;
    // The browser pauses a video that is taken off the page, and a paused camera hands out the
    // same old frame for ever (found on the real DJI, Sat 21 Nov: setup's still was stale).
    // So this video lives on the page for good, out of sight, and nothing ever moves it.
    Object.assign(video.style, { position: "fixed", left: "0", top: "0", width: "2px", height: "2px", opacity: "0.01", pointerEvents: "none" });
    video.setAttribute("aria-hidden", "true");
    document.body.append(video);
    video.addEventListener("pause", () => { if (video.srcObject) video.play().catch(() => {}); });
  }
  const pipeline = createPipeline({ cameraToField: null });
  let matrix = null;
  let source = null;
  let stream = null;
  let started = null;
  let lastRaw = null; // the last camera frame's feet, to run the clean-up once for each new frame
  let raw = [];
  let field = [];

  function useMatrix(m) {
    matrix = m;
    pipeline.setMatrix(m);
    lastRaw = null;
    field = [];
  }

  function closeStream() {
    if (stream) stream.getTracks().forEach((t) => t.stop());
    stream = null;
    if (video) video.srcObject = null; // lets the camera go, and the setup's preview video lets go with it
  }

  // Opens the saved camera, or the first one when none is saved or the saved one is unplugged.
  async function openCamera() {
    if (!navigator.mediaDevices) throw new Error(cameraReason({}));
    closeStream();
    const saved = loadCalibration();
    const open = (id) => navigator.mediaDevices.getUserMedia({ video: { deviceId: id ? { exact: id } : undefined, width: { ideal: 1280 }, height: { ideal: 720 } } });
    try {
      try {
        stream = await open(saved.cameraId);
      } catch (e) {
        if (e.name !== "OverconstrainedError" || !saved.cameraId) throw e;
        stream = await open();
        saved.cameraToField = null; // the saved map was made for a camera that is not here
      }
      video.srcObject = stream;
      await video.play();
    } catch (e) {
      closeStream();
      throw new Error(cameraReason(e));
    }
    saveCalibration({ cameraId: stream.getVideoTracks()[0].getSettings().deviceId ?? null, cameraToField: saved.cameraToField });
    useMatrix(saved.cameraToField);
  }

  // Safe to call more than once. After a failure it tries again.
  function start() {
    started ??= (async () => {
      if (replayUrl) {
        source = createReplay(await loadRecording(replayUrl));
        useMatrix(loadCalibration().cameraToField);
      } else {
        await openCamera();
        source = createCameraFeet({ video, model });
      }
      return source.start();
    })().catch((e) => { stop(); throw e; });
    return started;
  }

  function read() {
    if (!source) return [];
    const feet = source.read();
    if (feet === lastRaw) return field; // no new camera frame, so nothing to clean up yet
    lastRaw = raw = feet;
    field = matrix ? pipeline.update(performance.now(), feet) : [];
    return field;
  }

  function stop() {
    if (source) source.stop();
    source = started = null;
    closeStream();
    useMatrix(matrix);
  }

  return {
    start,
    read,
    fps: () => (source ? source.fps() : 0),
    stop,
    ready: () => ({ camera: !!source, calibrated: !!matrix }),
    video,
    raw: () => raw, // camera feet [{ x, y, person }] for the setup's picture, before the map
    // Picks up a changed camera or map from pp:calibration, without a restart.
    async reload() {
      const saved = loadCalibration();
      const current = stream && stream.getVideoTracks()[0].getSettings().deviceId;
      if (source && !replayUrl && saved.cameraId && saved.cameraId !== current) await openCamera();
      else useMatrix(saved.cameraToField);
    },
  };
}
