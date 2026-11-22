// The feet source for seated play: the camera cut into one slice for each seat (seats.js), each foot's tap
// found (taps.js), handed to the game as each seat's two lanes in pad coordinates.
// bySpot() gives { [spotId]: [{ u, v, lifted }] }, which is what session.tick takes as its feet.
import { isFacing } from "../facing.js";
import { createSeatFeet, findHips } from "./seats.js";
import { createTapDetector, calibrationOf } from "./taps.js";
import { createReplayFeet, loadSeatRecording } from "./seatreplay.js";
import { EDGES_KEY, boundsFor, slicesKey, writeSaved, assignHips, fitBounds, easeBounds } from "./slices.js";

export const CAMERA_KEY = "seats:camera"; // the camera picked on seats.html and in setup
export const FOLLOW_KEY = "seats:follow"; // false when the operator turned following off
const FOLLOW_EVERY_MS = 100; // how often following looks at the hips: the saved dividers are written at most this often
const FOLLOW_MAX_DT = 500; // a long gap (a hidden tab) moves the dividers no further than this long a gap would
const HEIGHT_MS = 500; // a tap in a one-lane pad is the foot that came down furthest in this long (a guess)
const SWAP_KEY = "pp:seat-swap"; // spot ids whose pad is mirrored: [2, 3]
export const LANE_U = [0.25, 0.75]; // with two lanes (a lone player): foot 0 and foot 1, the middle of each lane
export const ONE_LANE_U = 0.5; // with one lane (two to four players): both feet play the one lane
export const PAD_V = 0.8; // inside the square (it runs from v 0.55 to 1)

// Each player's own lift threshold, learned from their warm-up taps (createCalibrator). It is measured always and shown in
// calibration(), but only set on the tap detector when this is true. OFF: on the real two-person recording, the calibration
// that replaces the shin-share threshold gave seat 2 two false taps at rest where the defaults gave none (reports/tracker-6.md).
export const CALIBRATE_FROM_WARMUP = false;

const saved = (key) => { try { return JSON.parse(localStorage.getItem(key)); } catch { return null; } };

// Learns how each player taps from the taps the detector fires during the warm-up, and (when `apply`) sets the detector to it for
// that seat. `getDetector()` is the current tap detector. Call round(status, players) every frame with the State's status and
// players [{ spotId, clientId }], and record(taps, lifts) with what taps.update gave.
// - A warm-up starting throws every earlier calibration away; the end of it (any other status, a pause aside) sets each seat that
//   made at least 3 taps (taps.js calibrationOf). Fewer keeps the defaults.
// - It lasts through the song and a "play again" straight after it (the lobby between does not end it), and ends for a seat when
//   that seat is released or taken by another phone.
export function createCalibrator(getDetector, apply = CALIBRATE_FROM_WARMUP) {
  let owners = new Map(); // spotId -> the clientId holding it
  let warming = false;
  const recorded = new Map(); // spotId -> [{ peak, liftMs }], while the warm-up runs
  const done = new Map(); // spotId -> calibrationOf(...), for the song
  const drop = (id) => { recorded.delete(id); done.delete(id); getDetector().setSeat(id, null); };
  return {
    round(status, players) {
      const next = new Map(players.map((p) => [p.spotId, p.clientId]));
      for (const [id, who] of owners) if (next.get(id) !== who) drop(id); // the seat was let go, or taken by someone else
      owners = next;
      if (status === "paused") return; // a pause in the warm-up is neither its start nor its end
      if (status === "warmup" && !warming) {
        warming = true;
        [...done.keys(), ...recorded.keys()].forEach(drop);
      } else if (status !== "warmup" && warming) {
        warming = false;
        for (const [id, lifts] of recorded) {
          const c = calibrationOf(lifts);
          if (!c) continue;
          done.set(id, c);
          if (apply) getDetector().setSeat(id, { minLift: c.minLift, liftRatio: 0 }); // its own reach in place of the shin share too
        }
        recorded.clear();
      }
    },
    record(taps, lifts) {
      if (!warming) return;
      taps.forEach((t, i) => { if (owners.has(t.spotId)) recorded.set(t.spotId, [...(recorded.get(t.spotId) ?? []), lifts[i]]); });
    },
    clear() { [...done.keys(), ...recorded.keys()].forEach(drop); warming = false; owners = new Map(); },
    result: () => Object.fromEntries(done),
  };
}

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

// The camera x of the middle of each seat's feet: { [spotId]: x, or null when no person with feet is seen there }. A pose dropped as a neighbour's does not count.
export const feetMiddle = (poses) => Object.fromEntries(poses.map((p) => [p.spotId, p.dropped || !p.feet.length ? null : p.feet.reduce((s, f) => s + f.x, 0) / p.feet.length]));

// The camera x of the foot that made a tap, or null when the seat's feet are not in `feet` (the frame's feet, with x). A pad with two lanes
// knows the foot by name. With one lane the tap does not say which foot, so it is the one that has just come down the furthest: `drop(f)`.
export function tappedX({ spotId, foot }, feet, lanes = {}, drop = () => 0) {
  const mine = feet.filter((f) => f.spotId === spotId);
  if ((lanes[spotId] ?? 2) !== 1) return mine.find((f) => f.foot === foot)?.x ?? null;
  return mine.reduce((best, f) => (best === null || drop(f) > drop(best) ? f : best), null)?.x ?? null;
}

// What the last bySpot frame saw and decided, for the tracking test (stage/tracktest.js): `read` is the feet as the tracker
// gave them, `debug` and `taps` come from the tap detector, `poses` are the seats' results, and `lifted` is
// { [spotId]: true when any of that seat's feet is in the air }, with an entry for every seat. A tap also has `peak` and `liftMs`
// (how high the foot rose and for how long). `calibration` is what the warm-ups taught (see calibration()), and each pose has
// `active`, false for a seat that is not being looked at.
export function frameReadout(t, read, feet, debug, taps, poses, calibration = {}) {
  const lifted = Object.fromEntries(poses.map((p) => [p.spotId, false]));
  for (const f of feet) if (f.lifted) lifted[f.spotId] = true;
  return { t, read, debug, taps, poses, lifted, calibration };
}

// Which seats have a new camera picture since the last look: their counter `n` moved on. `seen` is brought up to date.
// The stage asks for feet on every screen frame (60 or more a second) and the camera gives about 30 pictures a second.
// The tap detector must see each picture once: a repeated picture looks like a foot that held perfectly still, which
// halves the shake it measures, and one noisy picture seen twice passes its "two pictures in a row" rule. On the real
// two-person recording, repeats gave 2 taps from a seat at rest; each picture once gave none.
export function freshSeats(poses, seen) {
  const fresh = new Set();
  for (const p of poses) {
    if (seen.get(p.spotId) !== p.n) fresh.add(p.spotId);
    seen.set(p.spotId, p.n);
  }
  return fresh;
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
  const calib = createCalibrator(() => taps);
  let active = null; // the spot ids being tracked (setActive); null is every seat
  let activeKey = "*";
  let tapLog = {}; // { [spotId]: { count, lane, at } }: each seat's taps since the tracker started, and the latest one
  let stream = null;
  let started = null;
  let tracking = false;
  let fitted = !!saved(slicesKey(layout.spots.length)); // lines for this many seats were fitted, dragged or saved before
  let held = false; // following is off for this session only (a line was dragged)
  let lastFollow = 0;
  let latest = null; // the last bySpot frame's read-out (lastFrame)
  const seenN = new Map(); // spotId -> the picture counter the tap detector last saw for that seat
  let lastFeet = []; // the tap detector's last answer, kept for the screen frames between two camera pictures
  const heights = new Map(); // `${spotId}:${foot}` -> [{ t, y }] for the last HEIGHT_MS: how far a foot has just come down (tappedX)
  const drop = (f) => { const h = heights.get(`${f.spotId}:${f.foot}`); return h ? f.y - Math.min(...h.map((p) => p.y)) : 0; };
  const isOn = (spotId) => !active || active.has(spotId);
  // Each seat's last result, with `active` set. A seat not in use shows nothing, whatever the tracker underneath gave (a recording
  // plays every seat), and its picture counter stands where it was.
  const poseList = () => (seats?.poses() ?? []).map((p) => (isOn(p.spotId) ? { ...p, active: true } : { ...p, feet: [], landmarks: [], hipX: null, dropped: false, active: false, n: seenN.get(p.spotId) ?? p.n }));

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
    const poses = poseList();
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
    fps: () => { const f = (seats?.fps() ?? [0]).filter((_, i) => !slices[i] || isOn(slices[i].spotId)); return f.length ? Math.min(...f) : 0; }, // the slowest seat in use, frames a second
    // Which seats the tracker looks at: `spotIds`, or null for every seat. A seat left out is not detected at all (no model run, no feet,
    // no taps, its picture counter stands still), and one put back starts clean. Asked of the seat tracker too; safe to call every frame.
    setActive(spotIds) {
      const key = spotIds ? [...spotIds].sort().join() : "*";
      if (key === activeKey) return;
      const before = active;
      active = spotIds ? new Set(spotIds) : null;
      activeKey = key;
      seats?.setActive?.(spotIds);
      for (const { spotId } of slices) {
        const was = !before || before.has(spotId);
        if (was && !isOn(spotId)) lastFeet = lastFeet.filter((f) => f.spotId !== spotId); // it stops: its last feet do not stand in
        if (!was && isOn(spotId)) { // it comes back: no stale ground, no old heights
          taps.reset(spotId);
          for (const k of [...heights.keys()]) if (k.startsWith(`${spotId}:`)) heights.delete(k);
        }
      }
    },
    // Each frame, with the State's status and players [{ spotId, clientId }]: learns each player's own tap from the warm-up (createCalibrator).
    calibrate: (status, players) => calib.round(status, players),
    // What the warm-up taught about each player: { [spotId]: { taps, medianPeak, medianLiftMs, minLift } }, only for seats with 3 or more
    // taps. Set on the tap detector only when CALIBRATE_FROM_WARMUP is true.
    calibration: () => calib.result(),
    // Pose model runs so far (one per seat and camera picture), or null when the source is a recording.
    detections: () => seats?.detections?.() ?? null,
    ready: () => ({ camera: tracking, calibrated: true }), // no field map is needed: each foot is placed by its seat
    // lanes: { [spotId]: lanes in that pad now }, from the session
    bySpot(lanes) {
      const swapped = saved(SWAP_KEY);
      const swap = Array.isArray(swapped) ? swapped : [];
      const now = performance.now();
      const read = (seats?.read() ?? []).filter((f) => isOn(f.spotId));
      for (const f of read) { // the last HEIGHT_MS of each foot's height, for the tap's x
        const key = `${f.spotId}:${f.foot}`;
        heights.set(key, [...(heights.get(key) ?? []).filter((p) => now - p.t < HEIGHT_MS), { t: now, y: f.y }]);
      }
      // The tap detector sees each camera picture once (see freshSeats). Between pictures its last answer stands.
      const poses = poseList();
      const fresh = freshSeats(poses.filter((p) => p.active), seenN); // a seat not in use has no pictures to see
      let tapped = [], tapLifts = [], debug = [];
      if (fresh.size) {
        const r = taps.update(now, read.filter((f) => fresh.has(f.spotId)), lanes);
        lastFeet = [...lastFeet.filter((f) => !fresh.has(f.spotId)), ...r.feet];
        tapped = r.taps;
        tapLifts = r.lifts;
        debug = r.debug;
      }
      calib.record(tapped, tapLifts);
      const feet = lastFeet;
      follow(now);
      const fired = tapped.map((t, i) => ({ ...t, x: tappedX(t, read, lanes, drop), ...tapLifts[i] }));
      for (const t of fired) tapLog[t.spotId] = { count: (tapLog[t.spotId]?.count ?? 0) + 1, lane: laneOf(t, swap, lanes), at: t.atMs, x: t.x };
      latest = frameReadout(now, read, feet, debug, fired, poses, calib.result());
      return padFeet(feet, spotIds, swap, lanes);
    },
    // The last bySpot frame's read-out (null before the first), for the tracking test. Read it in the same tick as bySpot.
    lastFrame: () => latest,
    model,

    // What setup needs. None of it runs the tracker: it reads what the stage's own frames already found.
    video, // the picture the tracker reads (setup shows it with a second one, and never moves this one); none for a recording
    kind: replay ? "replay" : src ? "file" : "camera", // a file or a recording has no camera to pick
    raw: () => poseList().flatMap((p) => p.feet), // every foot found, [{ spotId, foot, x, y }], whole-picture units
    poses: poseList, // each seat's last result: { spotId, feet, hipX, dropped, active, landmarks }
    slices: () => slices.map(({ spotId, x0, x1 }) => ({ spotId, x0, x1 })),
    taps: () => ({ ...tapLog }), // each seat's latest tap also has `x`, the camera x of the foot that tapped (null when it was not seen)
    feetX: () => feetMiddle(poseList()), // the middle of each seat's feet, for placing its pad (autoplace.js)
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
        if (fresh.some((f, i) => f.spotId !== slices[i].spotId)) { taps = createTapDetector(); calib.clear(); tapLog = {}; } // the seats turned round (facing): old taps belong to other seats
        slices.forEach((s, i) => Object.assign(s, fresh[i]));
        return;
      }
      slices = fresh;
      fitted = !!saved(slicesKey(next.spots.length));
      taps = createTapDetector();
      calib.clear();
      tapLog = {};
      seats.stop();
      seats = makeSeats();
      seats.setActive(active ? [...active] : null);
      tracking = false;
      if (started) begin(seats).catch(() => {});
    },
  };
}
