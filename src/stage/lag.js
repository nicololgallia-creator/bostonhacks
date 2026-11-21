// The lag test's logic, with no browser calls. The camera, the model and the projector together run a little behind
// the player. The setup asks for eight steps onto a square in time with eight clicks, and this finds how late they were.
const IGNORED = 2; // the first two beats: the player is still catching the rhythm
const REACH_MS = 400; // a step counts for a beat only this close to it
const MIN_USED = 4;
const MAX_OFFSET_MS = 400;

// beatTimes and arrivalTimes are in milliseconds on one clock. Each beat takes the nearest step not already used.
// Returns { offsetMs, used }: the median lateness, clamped to 0 through 400 and rounded to 10, and how many of the
// counted beats got a step. offsetMs is null when fewer than four did.
export function measureLag(beatTimes, arrivalTimes) {
  const free = [...arrivalTimes];
  const late = [];
  beatTimes.forEach((beat, i) => {
    let best = -1;
    free.forEach((t, j) => { if (best < 0 || Math.abs(t - beat) < Math.abs(free[best] - beat)) best = j; });
    if (best < 0 || Math.abs(free[best] - beat) > REACH_MS) return;
    const t = free.splice(best, 1)[0];
    if (i >= IGNORED) late.push(t - beat);
  });
  if (late.length < MIN_USED) return { offsetMs: null, used: late.length };
  late.sort((a, b) => a - b);
  const mid = late.length >> 1;
  const median = late.length % 2 ? late[mid] : (late[mid - 1] + late[mid]) / 2;
  return { offsetMs: Math.round(Math.min(MAX_OFFSET_MS, Math.max(0, median)) / 10) * 10, used: late.length };
}

// Turns "how many feet are in the square now" into "a foot has just arrived". A foot counts as gone only after
// 150 ms without it, so a tracker that drops a foot for a frame does not make a second arrival.
export function createArrivals(goneMs = 150) {
  let held = 0;
  let lowSince = null;
  return (nowMs, count) => {
    if (count >= held) {
      lowSince = null;
      const arrived = count > held;
      held = count;
      return arrived;
    }
    lowSince ??= nowMs;
    if (nowMs - lowSince >= goneMs) { held = count; lowSince = null; }
    return false;
  };
}
