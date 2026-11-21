// The feet source for seated play: the camera cut into one slice for each seat (seats.js), each foot's tap
// found (taps.js), handed to the game as each seat's two lanes in pad coordinates.
// bySpot() gives { [spotId]: [{ u, v, lifted }] }, which is what session.tick takes as its feet.
import { createSeatFeet } from "./seats.js";
import { createTapDetector } from "./taps.js";
import { createReplayFeet, loadSeatRecording } from "./seatreplay.js";
import { EDGES_KEY, boundsFor, slicesKey } from "./slices.js";

const CAMERA_KEY = "seats:camera"; // the camera picked on seats.html
const SWAP_KEY = "pp:seat-swap"; // spot ids whose pad is mirrored: [2, 3]
export const LANE_U = [0.25, 0.75]; // with two lanes (a lone player): foot 0 and foot 1, the middle of each lane
export const ONE_LANE_U = 0.5; // with one lane (two to four players): both feet play the one lane
export const PAD_V = 0.8; // inside the square (it runs from v 0.55 to 1)

const saved = (key) => { try { return JSON.parse(localStorage.getItem(key)); } catch { return null; } };

// One slice for each pad, left to right. `bounds` is the saved list of dividers for this many pads (seats.html saves one
// for each seat count); without a good one the slices are equal, across the saved outer edges `edges`.
export function makeSlices(layout, edges, bounds) {
  const ids = [...layout.spots].sort((a, b) => a.rect.u - b.rect.u).map((s) => s.id);
  const b = boundsFor(ids.length, edges, bounds);
  return ids.map((spotId, i) => ({ spotId, x0: b[i], x1: b[i + 1] }));
}

// Camera feet in (with `lifted` from the tap detector), pad feet out. A pad whose id is in `swapped` is mirrored.
// `lanes` is { [spotId]: how many lanes that pad has }, 2 when a pad is not in it. With one lane both feet stand on the same
// square, and one lifting and landing is an arrival. Every pad in the layout has an entry, empty when its player's feet are not seen. A missing foot is simply left out,
// so the engine gives it its 150 ms wait. A tap needs nothing more: the foot is lifted, then it lands.
export function padFeet(feet, spotIds, swapped = [], lanes = {}) {
  const out = Object.fromEntries(spotIds.map((id) => [id, []]));
  for (const f of feet) {
    if (!out[f.spotId]) continue;
    const u = (lanes[f.spotId] ?? 2) === 1 ? ONE_LANE_U : LANE_U[(f.foot === 1) !== swapped.includes(f.spotId) ? 1 : 0];
    out[f.spotId].push({ u, v: PAD_V, lifted: !!f.lifted });
  }
  return out;
}

// Where the floor draws a foot glow: in the pad's lane, for each foot that is down.
export function glowFeet(layout, byPad) {
  return layout.spots.flatMap(({ id, rect }) => (byPad[id] ?? []).filter((f) => !f.lifted).map((f) => ({ u: rect.u + f.u * rect.w, v: rect.v + f.v * rect.h })));
}

function cameraReason(e) {
  if (!navigator.mediaDevices) return "The browser only allows the camera on localhost or https. Open this page at http://localhost:5173 on the laptop.";
  if (e.name === "NotAllowedError") return "The browser blocked the camera. Click the camera icon in the address bar, choose Allow, and reload.";
  if (e.name === "NotFoundError") return "No camera found. Plug the camera in and reload. The DJI must be in webcam mode.";
  if (e.name === "NotReadableError") return "Another app is using this camera. Close it (Zoom, the DJI app, another browser tab) and reload.";
  return e.message;
}

// `src` is a video file to play instead of the camera. With no `video`, one is made and put on the page for good.
export function createSeatSource({ video, src, layout, model = "lite", perFrame = Infinity }) {
  if (!video) {
    video = document.createElement("video");
    video.muted = true;
    video.playsInline = true;
    // The browser pauses a video that is taken off the page, or hidden with display none, and a paused camera hands out
    // one frozen frame. So it sits on the page out of sight and nothing ever moves it (same as tracked.js).
    Object.assign(video.style, { position: "fixed", left: "0", top: "0", width: "2px", height: "2px", opacity: "0.01", pointerEvents: "none" });
    video.setAttribute("aria-hidden", "true");
    document.body.append(video);
    video.addEventListener("pause", () => { if (video.srcObject) video.play().catch(() => {}); });
  }
  const spotIds = layout.spots.map((s) => s.id);
  const seats = createSeatFeet({ video, slices: makeSlices(layout, saved(EDGES_KEY)), model, perFrame });
  const taps = createTapDetector();
  let stream = null;
  let started = null;
  let tracking = false;

  async function open() {
    if (src) {
      video.src = src;
      video.loop = true;
      return video.play().catch(() => { throw new Error(`The video ${src} could not be played. Check the address in ?src=.`); });
    }
    if (!navigator.mediaDevices) throw new Error(cameraReason({}));
    const get = (id) => navigator.mediaDevices.getUserMedia({ video: { deviceId: id ? { exact: id } : undefined, width: { ideal: 1280 }, height: { ideal: 720 } } });
    try {
      try {
        stream = await get(localStorage.getItem(CAMERA_KEY));
      } catch (e) {
        if (e.name !== "OverconstrainedError") throw e;
        stream = await get(); // the picked camera is unplugged: take the first
      }
      video.srcObject = stream;
      await video.play();
    } catch (e) {
      throw new Error(cameraReason(e));
    }
  }

  function stop() {
    seats.stop();
    stream?.getTracks().forEach((t) => t.stop());
    stream = started = null;
    tracking = false;
    video.srcObject = null;
  }

  return {
    // Safe to call more than once. After a failure it tries again.
    start() {
      started ??= (async () => {
        await open();
        const delegate = await seats.start();
        tracking = true;
        return delegate;
      })().catch((e) => { stop(); throw e; });
      return started;
    },
    stop,
    fps: () => Math.min(...seats.fps()), // the slowest seat's frames a second
    ready: () => ({ camera: tracking, calibrated: true }), // no field map is needed: each foot is placed by its seat
    // lanes: { [spotId]: lanes in that pad now }, from the session
    bySpot(lanes) {
      const swapped = saved(SWAP_KEY);
      return padFeet(taps.update(performance.now(), seats.read()).feet, spotIds, Array.isArray(swapped) ? swapped : [], lanes);
    },
  };
}
