// Record camera feet and play them back later, so tracking and the game can be tuned with no camera.
// A recording is { version: 1, frames: [{ t, feet: [{ x, y, person }] }] }, t in ms from the first frame.

export function createRecorder() {
  const frames = [];
  let first = null;
  return {
    add(nowMs, cameraFeet) {
      if (first === null) first = nowMs;
      frames.push({
        t: Math.round(nowMs - first),
        feet: cameraFeet.map((f) => ({ x: +f.x.toFixed(4), y: +f.y.toFixed(4), person: f.person })),
      });
    },
    count: () => frames.length,
    toJSON: () => ({ version: 1, frames }),
  };
}

function check(recording) {
  const bad = (why) => { throw new Error(`That recording cannot be used: ${why}`); };
  if (!recording || typeof recording !== "object" || recording.version !== 1) bad("it is not a version 1 feet recording.");
  const { frames } = recording;
  if (!Array.isArray(frames) || frames.length === 0) bad("it has no frames. Record again and keep recording for a few seconds.");
  let last = -1;
  frames.forEach((f, i) => {
    if (!f || typeof f.t !== "number" || f.t < last) bad(`frame ${i} has a missing or out-of-order time.`);
    last = f.t;
    const ok = Array.isArray(f.feet) && f.feet.every((p) => p && typeof p.x === "number" && typeof p.y === "number");
    if (!ok) bad(`frame ${i} has a foot without x and y.`);
  });
}

// Same shape as createCameraFeet: start(), read(), fps(), stop(). Plays the frames in real time and loops.
// `now` is a clock in ms, replaceable in tests.
export function createReplay(recording, now = () => performance.now()) {
  check(recording);
  const { frames } = recording;
  const lastT = frames[frames.length - 1].t;
  const gap = frames.length > 1 ? lastT / (frames.length - 1) : 33;
  const length = lastT + Math.max(gap, 1); // the last frame stays up for one gap, then the loop restarts
  let begun = 0;
  let shown = -1;
  let stamps = [];

  function read() {
    const at = (now() - begun) % length;
    let i = frames.length - 1;
    while (frames[i].t > at) i--;
    if (i !== shown) {
      shown = i;
      stamps = stamps.filter((t) => now() - t < 1000).concat(now());
    }
    return frames[i].feet;
  }

  return {
    async start() { begun = now(); return "replay"; },
    read,
    fps: () => stamps.length,
    poses: () => [], // the recording holds feet only, so the page has no other landmarks to draw
    stop() {},
  };
}

export async function loadRecording(url) {
  let res;
  try { res = await fetch(url); } catch { throw new Error(`The recording ${url} could not be fetched. Check the address and that the dev server is running.`); }
  if (!res.ok) throw new Error(`The recording ${url} was not found (HTTP ${res.status}).`);
  try { return await res.json(); } catch { throw new Error(`The recording ${url} is not a JSON file.`); }
}
