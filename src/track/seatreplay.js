// Records what the seat tracker sees, and plays it back later in place of a camera, so a real test with real people
// can be studied again here. A recording is JSON:
//   { version: 2, slices: [{ spotId, x0, x1 }], frames: [{ t, seats: [{ spotId, hipX, dropped, feet: [{ foot, x, y, shin }] }] }] }
// `t` is milliseconds from the start of the recording, `hipX` is where the seat's person's hips were (null when no pose was
// found), `dropped` is true when a pose was found but thrown out as a neighbour's, and `feet` are the feet the tracker
// handed on (empty when dropped). Positions are whole-picture units, 0 to 1.
import { loadRecording } from "./record.js";

const four = (v) => +v.toFixed(4); // the same rounding record.js uses

// One frame of a recording from the tracker's poses() (see seats.js).
export function frameOf(tMs, poses) {
  return {
    t: Math.round(tMs),
    seats: poses.map((p) => ({
      spotId: p.spotId,
      hipX: p.hipX === null ? null : four(p.hipX),
      dropped: !!p.dropped,
      feet: p.feet.map((f) => ({ foot: f.foot, x: four(f.x), y: four(f.y), shin: four(f.shin) })),
    })),
  };
}

export function parseRecording(json) {
  if (!json || json.version !== 2 || !Array.isArray(json.frames) || !Array.isArray(json.slices)) {
    throw new Error("That is not a seat recording. Make one with the Record button on seats.html (version 2 files only).");
  }
  if (!json.frames.length) throw new Error("That recording has no frames. Press Record, wait a few seconds, then Stop.");
  return json;
}

// Fetches a recording file and checks it is a seat recording.
export const loadSeatRecording = async (url) => parseRecording(await loadRecording(url));

// The same shape as createSeatFeet: start(), read(), poses(), fps(), stop(). It runs the recording on a clock, looped.
// `now` is the clock, in milliseconds, so a test can run it with its own.
export function createReplayFeet({ recording, loop = true, now = () => performance.now() }) {
  const { frames, slices } = recording;
  const span = frames.at(-1).t + (frames.length > 1 ? frames.at(-1).t / (frames.length - 1) : 33); // the last frame lasts one interval
  let began = 0;
  let index = 0; // the frame showing now

  function at() {
    const elapsed = loop ? (now() - began) % span : Math.min(now() - began, span);
    if (frames[index].t > elapsed) index = 0; // the loop wrapped round
    while (index + 1 < frames.length && frames[index + 1].t <= elapsed) index++;
    return index;
  }

  const seats = () => frames[at()].seats;
  return {
    async start() { began = now(); return "replay"; },
    read: () => seats().flatMap((s) => s.feet.map((f) => ({ spotId: s.spotId, ...f }))),
    poses: () => seats().map((s) => ({ ...s, landmarks: [], n: index })),
    fps: () => slices.map(() => Math.round((frames.length / span) * 1000)),
    stop() {},
  };
}


