// The feet source for seated play: the camera cut into one slice for each seat (seats.js), each foot's tap
// found (taps.js), handed to the game as each seat's two lanes in pad coordinates.
// bySpot() gives { [spotId]: [{ u, v, lifted }] }, which is what session.tick takes as its feet.
import { isFacing } from "../facing.js";
import { createSeatFeet, findHips } from "./seats.js";
import { createTapDetector } from "./taps.js";
import { createReplayFeet, loadSeatRecording } from "./seatreplay.js";
import { EDGES_KEY, boundsFor, slicesKey, writeSaved, assignHips, fitBounds, easeBounds } from "./slices.js";

export const CAMERA_KEY = "seats:camera"; // the camera picked on seats.html and in setup
export const FOLLOW_KEY = "seats:follow"; // false when the operator turned following off
const FOLLOW_EVERY_MS = 100; // how often following looks at the hips: the saved dividers are written at most this often
const FOLLOW_MAX_DT = 500; // a long gap (a hidden tab) moves the dividers no further than this long a gap would
const SWAP_KEY = "pp:seat-swap"; // spot ids whose pad is mirrored: [2, 3]
export const LANE_U = [0.25, 0.75]; // with two lanes (a lone player): foot 0 and foot 1, the middle of each lane
export const ONE_LANE_U = 0.5; // with one lane (two to four players): both feet play the one lane
export const PAD_V = 0.8; // inside the square (it runs from v 0.55 to 1)

const saved = (key) => { try { return JSON.parse(localStorage.getItem(key)); } catch { return null; } };

// One slice for each pad, left to right. `bounds` is the saved list of dividers for this many pads (seats.html saves one
// for each seat count); without a good one the slices are equal, across the saved outer edges `edges`.
export function makeSlices(layout, edges, bounds) {
  const ids = [...layout.spots].sort((a, b) => a.rect.u - b.rect.u).map((s) => s.id);
  // The camera faces the players when the projector does (facing.js): its left is the players' right, so the pad on the canvas
  // left (the smallest u) takes the rightmost slice. The dividers stay in camera order.
  if (isFacing()) ids.reverse();
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
    out[f.spotId].push({ u: (lanes[f.spotId] ?? 2) === 1 ? ONE_LANE_U : LANE_U[laneOf(f, swapped, lanes)], v: PAD_V, lifted: !!f.lifted });
  }
  return out;
}

// The lane a foot (or a tap) plays, 0 or 1, and always 0 in a one-lane pad. A pad in `swapped` is mirrored.
// Facing the players the camera's left foot is the player's right, so the default flips, and Swap feet flips it back.
export const laneOf = ({ spotId, foot }, swapped = [], lanes = {}) => ((lanes[spotId] ?? 2) === 1 ? 0 : (foot === 1) !== isFacing() !== swapped.includes(spotId) ? 1 : 0);

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

// `src` is a video file to play instead of the camera, or a picture (jpg, png, webp) that stands in for it. With no `video`, one is made and put on the page for good.
// `replay` is a recording saved by seats.html (the address's ?replay= when not given): it plays in place of the camera, and
// no video is made. `pad` is the extra picture each seat's model sees on both sides (seats.js).
export function createSeatSource({ video, src, layout, model = "lite", perFrame = Infinity, pad, replay = new URLSearchParams(globalThis.location?.search).get("replay") }) {
  const still = !!src && /\.(jpe?g|png|webp)(\?|$)/i.test(src);
  if (!video && !replay) {
    video = still ? new Image() : document.createElement("video");
    video.muted = true;
    video.playsInline = true;
    // The browser pauses a video that is taken off the page, or hidden with display none, and a paused camera hands out
    // one frozen frame. So it sits on the page out of sight and nothing ever moves it (same as tracked.js).
    Object.assign(video.style, { position: "fixed", left: "0", top: "0", width: "2px", height: "2px", opacity: "0.01", pointerEvents: "none" });
    video.setAttribute("aria-hidden", "true");
    document.body.append(video);
    video.addEventListener("pause", () => { if (video.srcObject) video.play().catch(() => {}); });
  }
  let spotIds = layout.spots.map((s) => s.id);
  let slices = makeSlices(layout, saved(EDGES_KEY), saved(slicesKey(layout.spots.length)));
  const makeSeats = () => createSeatFeet({ video, slices, model, perFrame, pad });
  let seats = replay ? null : makeSeats();
  let taps = createTapDetector();
  let tapLog = {}; // { [spotId]: { count, lane, at } }: each seat's taps since the tracker started, and the latest one
  let stream = null;
  let started = null;
  let tracking = false;
  let fitted = !!saved(slicesKey(layout.spots.length)); // lines for this many seats were fitted, dragged or saved before
  let held = false; // following is off for this session only (a line was dragged)
  let lastFollow = 0;

  // Where the dividers are now: n + 1 shares of the picture's width.
  const boundsNow = () => [slices[0].x0, ...slices.map((s) => s.x1)];
  const apply = (bounds, save = true) => {
    slices.forEach((s, i) => { s.x0 = bounds[i]; s.x1 = bounds[i + 1]; });
    if (save) writeSaved(bounds);
  };
  const following = () => !replay && !held && saved(FOLLOW_KEY) !== false;

  // Each seat's own hips pull its dividers toward the fit, slowly (slices.js). A pose dropped as a neighbour's has someone else's hips, so it does not count.
  function follow(now) {
    if (!following() || !seats || now - lastFollow < FOLLOW_EVERY_MS) return;
    const dt = Math.min(now - lastFollow, FOLLOW_MAX_DT);
    lastFollow = now;
    const poses = seats.poses();
    const hips = slices.map((s) => { const p = poses.find((q) => q.spotId === s.spotId); return p && !p.dropped ? p.hipX : null; });
    const current = boundsNow();
    const next = easeBounds(current, fitBounds(hips, { n: slices.length, current }), dt, hips);
    if (next) apply(next, fitted); // until the lines were fitted, dragged or saved, following moves them for this session only
  }

  // Waits for the picture to have a size (a camera takes a moment).
  async function pictureReady() {
    const img = video?.tagName !== "VIDEO";
    for (let i = 0; i < 80; i++) {
      if (img ? video.naturalWidth > 0 : video.videoWidth > 0 && video.readyState >= 2) return;
      await new Promise((r) => setTimeout(r, 100));
    }
    throw new Error("The camera picture did not start, so no one can be found in it. Check the camera step.");
  }

  async function open() {
    if (still) {
      video.src = src;
      return video.decode().catch(() => { throw new Error(`The picture ${src} could not be loaded. Check the address in ?src=.`); });
    }
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

  // Starts a tracker. It counts as running only while it is still the current one (a new seat count builds another).
  const begin = (mine) => mine.start().then((delegate) => {
    if (seats === mine) tracking = true;
    else mine.stop();
    return delegate;
  });

  function stop() {
    seats?.stop();
    stream?.getTracks().forEach((t) => t.stop());
    stream = started = null;
    tracking = false;
    lastFollow = 0;
    if (video) video.srcObject = null;
  }

  return {
    // Safe to call more than once. After a failure it tries again.
    start() {
      started ??= (async () => {
        if (replay) {
          const recording = await loadSeatRecording(replay);
          seats = createReplayFeet({ recording });
          slices = recording.slices.map((s) => ({ ...s })); // the recording's own slices: its lines cannot be moved
        } else await open();
        return begin(seats);
      })().catch((e) => { stop(); throw e; });
      return started;
    },
    stop,
    fps: () => Math.min(...(seats?.fps() ?? [0])), // the slowest seat's frames a second
    ready: () => ({ camera: tracking, calibrated: true }), // no field map is needed: each foot is placed by its seat
    // lanes: { [spotId]: lanes in that pad now }, from the session
    bySpot(lanes) {
      const swapped = saved(SWAP_KEY);
      const swap = Array.isArray(swapped) ? swapped : [];
      const { feet, taps: tapped } = taps.update(performance.now(), seats?.read() ?? [], lanes);
      follow(performance.now());
      for (const t of tapped) tapLog[t.spotId] = { count: (tapLog[t.spotId]?.count ?? 0) + 1, lane: laneOf(t, swap, lanes), at: t.atMs };
      return padFeet(feet, spotIds, swap, lanes);
    },

    // What setup needs. None of it runs the tracker: it reads what the stage's own frames already found.
    video, // the picture the tracker reads (setup shows it with a second one, and never moves this one); none for a recording
    kind: replay ? "replay" : src ? "file" : "camera", // a file or a recording has no camera to pick
    raw: () => (seats?.poses() ?? []).flatMap((p) => p.feet), // every foot found, [{ spotId, foot, x, y }], whole-picture units
    poses: () => seats?.poses() ?? [], // each seat's last result: { spotId, feet, hipX, dropped, landmarks }
    slices: () => slices.map(({ spotId, x0, x1 }) => ({ spotId, x0, x1 })),
    taps: () => ({ ...tapLog }),
    // Reopens the camera chosen in setup, and starts the tracker again if it had failed.
    reload() {
      stop();
      return this.start();
    },
    // New dividers (n + 1 shares of the picture's width, rising) take effect at once and are saved for seats.html and the next start.
    setSlices(bounds) {
      if (replay || bounds.length !== slices.length + 1) return;
      fitted = true;
      apply(bounds);
    },
    // True until the lines for this many seats were fitted, dragged or loaded from a save: setup fits on its first visit.
    needsFit: () => !fitted && !replay,
    // Finds every person in the whole picture once and puts each seat's dividers around them, at once (not eased). Takes about a
    // second, on a button and never per frame. Resolves { bounds, found, hips, ms, method }, `found` being how many people it saw.
    async fit() {
      if (replay) throw new Error("A recording has its own lines. They cannot be fitted.");
      await pictureReady();
      const r = await findHips(video, slices.length, { model });
      const current = boundsNow();
      const hips = assignHips(r.hips, current);
      const bounds = fitBounds(hips, { n: slices.length, current });
      if (r.hips.length) { fitted = true; apply(bounds); }
      return { bounds, found: r.hips.length, hips, ms: r.ms, method: r.method };
    },
    // Following: each seat's hips keep nudging the lines (see follow above). It is on unless the operator turned it off (saved) or dragged a line (this session).
    following,
    setFollow(on, remember = true) {
      held = !on && !remember;
      if (remember) localStorage.setItem(FOLLOW_KEY, JSON.stringify(on));
    },
    // The pads changed. The same seat count only moves the slices (their order is the pads' order on the floor). A new count
    // builds the tracker again for the new number of slices, which takes a moment.
    setLayout(next) {
      spotIds = next.spots.map((s) => s.id);
      if (replay) return;
      const fresh = makeSlices(next, saved(EDGES_KEY), saved(slicesKey(next.spots.length)));
      if (fresh.length === slices.length) {
        if (fresh.some((f, i) => f.spotId !== slices[i].spotId)) { taps = createTapDetector(); tapLog = {}; } // the seats turned round (facing): old taps belong to other seats
        slices.forEach((s, i) => Object.assign(s, fresh[i]));
        return;
      }
      slices = fresh;
      fitted = !!saved(slicesKey(next.spots.length));
      taps = createTapDetector();
      tapLog = {};
      seats.stop();
      seats = makeSeats();
      tracking = false;
      if (started) begin(seats).catch(() => {});
    },
  };
}
