// The review page's thinking, with no page in it: reads a saved test or recording into one shape, says which taps match which
// beats, lists the problems, and does the maps between time, pixels and frames. Tested in logic.test.js.
//
// Two files open here. A tracktest (kind "tracktest", version 1: phases, taps, debug and an optional score and video) and a plain
// seats recording from seats.html (no phases, no taps): for that one the current tap detector is run here to get taps and debug.
import { createTapDetector } from "../track/taps.js";

export const MATCH_MS = 300; // a tap this close to a beat is that beat's tap
export const LEAD_MS = 500; // jumping to a tap starts this long before it
const FRAME_EPS = 0.5; // ms: two times closer than this are the same frame

// ---- reading a file ----

const needFrames = "This file has no frames. Open a test saved by the tracking test, or a recording saved by seats.html.";

// raw: the parsed JSON. Returns the model every other part reads: { kind, facing, spotIds, slices, lanes, video, phases, frames,
// taps, score, durationMs, fps }. frames: [{ t, seats, debug, lifted }]. taps: [{ spotId, atMs, x, y }].
export function buildModel(raw) {
  if (!raw || !Array.isArray(raw.frames) || !raw.frames.length) throw new Error(needFrames);
  const tracktest = raw.kind === "tracktest";
  if (tracktest && raw.version !== 1) throw new Error(`This test file is version ${raw.version}. This page reads version 1.`);
  const slices = raw.slices ?? [];
  const spotIds = slices.length ? slices.map((s) => s.spotId) : [...new Set(raw.frames.flatMap((f) => f.seats.map((s) => s.spotId)))];
  const lanes = raw.lanes ?? Object.fromEntries(spotIds.map((id) => [id, 1])); // a recording is read with one lane a seat, like replay-taps.mjs
  const m = { kind: tracktest ? "tracktest" : "recording", facing: tracktest && raw.facing === true, spotIds, slices, lanes, video: raw.video ?? null,
    phases: tracktest ? raw.phases ?? [] : [], score: tracktest ? raw.score ?? null : null, model: raw.model ?? null };
  if (tracktest) {
    m.frames = raw.frames.map((f) => ({ t: f.t, seats: f.seats, debug: f.debug ?? [], lifted: f.lifted ?? {} }));
    m.taps = (raw.taps ?? []).map((t) => ({ spotId: t.spotId, atMs: t.atMs, x: t.x, y: t.y ?? footAt(m.frames, t)?.y }));
  } else {
    Object.assign(m, runDetector(raw.frames, lanes));
  }
  const last = m.frames.at(-1).t;
  m.durationMs = Math.max(last, ...m.phases.map((p) => p.toMs));
  m.fps = m.frames.length > 1 ? ((m.frames.length - 1) / (last - m.frames[0].t)) * 1000 : 0;
  return m;
}

// Runs the current detector over a recording's frames.
function runDetector(rawFrames, lanes) {
  const det = createTapDetector();
  const frames = [];
  const taps = [];
  for (const fr of rawFrames) {
    const feet = fr.seats.flatMap((s) => s.feet.map((f) => ({ spotId: s.spotId, ...f })));
    const r = det.update(fr.t, feet, lanes);
    const lifted = {};
    for (const f of r.feet) lifted[f.spotId] = f.lifted;
    for (const t of r.taps) {
      const top = r.feet.find((f) => f.spotId === t.spotId);
      taps.push({ spotId: t.spotId, atMs: t.atMs, x: top?.x, y: top?.y });
    }
    frames.push({ t: fr.t, seats: fr.seats, debug: r.debug, lifted });
  }
  return { frames, taps };
}

// The foot a tap came from: in the seat's frame at the tap, the foot nearest to the tap's x (the highest one when it has no x).
// A tap in the file has no y, and the camera overlay needs one to put the ring on the foot.
export function footAt(frames, tap) {
  const fr = frames[nearestIndex(frames.map((f) => f.t), tap.atMs)];
  const feet = fr.seats.find((s) => s.spotId === tap.spotId)?.feet ?? [];
  const key = Number.isFinite(tap.x) ? (f) => Math.abs(f.x - tap.x) : (f) => f.y;
  return feet.reduce((best, f) => (!best || key(f) < key(best) ? f : best), null);
}

// ---- time, frames, pixels ----

// The index of the frame nearest to t (ts is sorted).
export function nearestIndex(ts, t) {
  let lo = 0;
  let hi = ts.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (ts[mid] < t) lo = mid + 1;
    else hi = mid;
  }
  return lo > 0 && t - ts[lo - 1] <= ts[lo] - t ? lo - 1 : lo;
}

// The frame one step from t. A time between frames steps to the next one that way. At either end it stays put.
export function stepIndex(ts, t, dir) {
  const i = nearestIndex(ts, t);
  if (dir > 0) return Math.min(ts.length - 1, ts[i] > t + FRAME_EPS ? i : i + 1);
  return Math.max(0, ts[i] < t - FRAME_EPS ? i : i - 1);
}

// test time = video time * 1000 + startMs
export const videoToTest = (seconds, startMs) => seconds * 1000 + startMs;
export const testToVideo = (t, startMs) => (t - startMs) / 1000;

// The part of the test the time axis shows. mode: "all", or a span in ms, centred on the play head and kept inside the test.
export function viewFor(mode, head, durationMs) {
  if (mode === "all" || mode >= durationMs) return [0, durationMs];
  const a = Math.min(Math.max(head - mode / 2, 0), durationMs - mode);
  return [a, a + mode];
}

export function makeAxis(t0, t1, x0, x1) {
  const k = (x1 - x0) / (t1 - t0);
  return { t0, t1, x0, x1, toX: (t) => x0 + (t - t0) * k, toT: (x) => t0 + (x - x0) / k };
}

// A gap between ruler marks that leaves about 90 px between them.
export function tickStep(spanMs, widthPx) {
  const want = (spanMs / widthPx) * 90;
  return [100, 200, 500, 1000, 2000, 5000, 10000, 15000, 30000, 60000].find((s) => s * 1.25 >= want) ?? 60000;
}

// Where things sit in the strips canvas, in CSS pixels: the phase bar, one row a seat, the ruler.
export function stripLayout(W, H, seatCount, gutter = 72) {
  const phaseH = 28;
  const rulerH = 22;
  const rowH = Math.floor((H - phaseH - rulerH) / Math.max(seatCount, 1));
  const rows = Array.from({ length: seatCount }, (_, i) => ({ top: phaseH + i * rowH, bottom: phaseH + (i + 1) * rowH }));
  return { gutter, phaseH, rulerH, rowH, rows, plotLeft: gutter, plotRight: W - 10, rulerTop: phaseH + seatCount * rowH, H };
}

// The tap nearest to a point, if it is within tolMs and the point is in that seat's row. rowSeat: the seat of the row the pointer is in.
export function tapAt(taps, t, rowSeat, tolMs) {
  let best = null;
  for (const [i, tap] of taps.entries()) {
    const d = Math.abs(tap.atMs - t);
    if (tap.spotId === rowSeat && d <= tolMs && (!best || d < best.d)) best = { i, d };
  }
  return best?.i ?? -1;
}

// ---- which tap is which ----

// One to one, nearest pairs first: each tap goes to the beat within windowMs that is closest to it, and each beat to one tap.
// Returns { beatOfTap: [beat index or -1], tapOfBeat: [tap index or -1] }.
export function matchBeats(tapTimes, beatTimes, windowMs = MATCH_MS) {
  const beatOfTap = tapTimes.map(() => -1);
  const tapOfBeat = beatTimes.map(() => -1);
  const pairs = [];
  tapTimes.forEach((tt, i) => beatTimes.forEach((bt, j) => { const d = Math.abs(tt - bt); if (d <= windowMs) pairs.push([d, i, j]); }));
  pairs.sort((a, b) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2]);
  for (const [, i, j] of pairs) {
    if (beatOfTap[i] === -1 && tapOfBeat[j] === -1) { beatOfTap[i] = j; tapOfBeat[j] = i; }
  }
  return { beatOfTap, tapOfBeat };
}

export const phaseAt = (phases, t) => phases.find((p) => t >= p.fromMs && t < p.toMs) ?? null;

// The beats a phase expects of one seat: [] when it says "none" or says nothing about the seat.
const beatsOf = (phase, spotId) => phase.expect?.[spotId]?.beats ?? [];

// Says what every tap and beat was. Taps get status: "match" (on a beat), "false" (the phase expects none from that seat),
// "extra" (the phase expects beats but none is near, or no phase is running), or "plain" (a recording with no phases).
// Beats get caught: true or false. Returns { taps, beats, problems }; problems are the false and extra taps and the missed beats
// in time order: { kind: "false" | "extra" | "missed", spotId, atMs, phase, tapIndex or beatIndex }.
export function analyse(model) {
  const plain = !model.phases.length;
  const beats = model.phases.flatMap((p) => model.spotIds.flatMap((id) => beatsOf(p, id).map((atMs) => ({ spotId: id, atMs, phase: p, caught: false }))));
  const taps = model.taps.map((t) => ({ ...t, phase: phaseAt(model.phases, t.atMs), status: plain ? "plain" : "false", beat: -1 }));
  for (const id of model.spotIds) {
    const myTaps = taps.map((t, i) => (t.spotId === id ? i : -1)).filter((i) => i >= 0);
    const myBeats = beats.map((b, i) => (b.spotId === id ? i : -1)).filter((i) => i >= 0);
    const { beatOfTap } = matchBeats(myTaps.map((i) => taps[i].atMs), myBeats.map((i) => beats[i].atMs));
    myTaps.forEach((ti, k) => {
      if (beatOfTap[k] < 0) return;
      taps[ti].status = "match";
      taps[ti].beat = myBeats[beatOfTap[k]];
      beats[myBeats[beatOfTap[k]]].caught = true;
    });
  }
  if (!plain) {
    for (const t of taps) if (t.status === "false" && t.phase && beatsOf(t.phase, t.spotId).length) t.status = "extra";
    for (const t of taps) if (t.status === "false" && !t.phase) t.status = "extra";
  }
  const problems = [
    ...taps.map((t, tapIndex) => ({ kind: t.status, spotId: t.spotId, atMs: t.atMs, phase: t.phase, tapIndex })).filter((p) => p.kind === "false" || p.kind === "extra"),
    ...beats.map((b, beatIndex) => ({ kind: "missed", spotId: b.spotId, atMs: b.atMs, phase: b.phase, beatIndex })).filter((_, i) => !beats[i].caught),
  ].sort((a, b) => a.atMs - b.atMs || a.spotId - b.spotId);
  return { taps, beats, problems, plain };
}

// The next tap to look at after the play head: its jump point (atMs - lead) must be past the head, so pressing it again
// moves on. At the end it comes back to the first. Returns an index into list, or -1 when the list is empty.
export function nextAfter(list, t, lead = LEAD_MS) {
  const i = list.findIndex((x) => x.atMs - lead > t + 1);
  return list.length ? Math.max(i, 0) : -1;
}

// ---- what the foot did ----

// One entry a seat: { tracks: [{ rise, thr }, { rise, thr }], lifted } as typed arrays the length of the frames. A track is one
// foot as the detector saw it (a one-lane seat: the left and the right foot). rise: how far the foot is over its ground, in
// picture units (up is positive). thr: the threshold. NaN where the foot was not seen. In a one-lane seat the debug foot index
// says which foot: 0 is the left one, 1 the right one; a seat with two lanes goes by the model's foot name.
export function buildSeries(model) {
  const n = model.frames.length;
  const mk = () => ({ rise: new Float32Array(n).fill(NaN), thr: new Float32Array(n).fill(NaN) });
  const series = Object.fromEntries(model.spotIds.map((id) => [id, { tracks: [mk(), mk()], lifted: new Uint8Array(n) }]));
  model.frames.forEach((fr, i) => {
    for (const seat of fr.seats) {
      const s = series[seat.spotId];
      if (!s) continue;
      s.lifted[i] = fr.lifted[seat.spotId] ? 1 : 0;
      const sorted = [...seat.feet].sort((a, b) => a.x - b.x);
      for (const d of fr.debug) {
        if (d.spotId !== seat.spotId) continue;
        const foot = model.lanes[seat.spotId] === 1 ? (sorted.length === 1 || d.foot === 0 ? sorted[0] : sorted.at(-1)) : seat.feet.find((f) => f.foot === d.foot);
        if (!foot) continue;
        const tr = s.tracks[d.foot === 1 ? 1 : 0];
        tr.rise[i] = d.ground - foot.y;
        tr.thr[i] = d.threshold;
      }
    }
  });
  return series;
}

// How high rises go on the shared vertical scale: just past what nearly every lift reaches, never under 0.06 or over 0.2.
export function riseTop(series) {
  const all = Object.values(series).flatMap((s) => s.tracks.flatMap((t) => [...t.rise].filter((v) => v > 0)));
  all.sort((a, b) => a - b);
  const p = all.length ? all[Math.floor(all.length * 0.995)] : 0;
  return Math.min(0.2, Math.max(0.06, p * 1.15));
}

// What the foot did around a tap: the run of lifted frames that ends at it. { frames, ms, over, peak, thr } or null with no frames.
export function liftBefore(series, ts, spotId, atMs) {
  const s = series[spotId];
  if (!s) return null;
  let e = nearestIndex(ts, atMs);
  while (e < ts.length - 1 && s.lifted[e]) e++; // the first frame that is not in the air, at or after the tap
  let b = e;
  while (b > 0 && s.lifted[b - 1]) b--;
  const from = b === e ? Math.max(0, e - 3) : b; // a tap seen with no lifted frame: look at the 3 frames before it
  return peakOver(s, ts, from, e, e - b, e > b ? ts[e] - ts[b] : 0);
}

// What the foot did in the time around a beat that got no tap: the highest it rose.
export function riseNear(series, ts, spotId, atMs, windowMs = MATCH_MS) {
  const s = series[spotId];
  if (!s) return null;
  const a = nearestIndex(ts, atMs - windowMs);
  const b = nearestIndex(ts, atMs + windowMs);
  let air = 0;
  for (let i = a; i <= b; i++) air += s.lifted[i];
  return peakOver(s, ts, a, b, air, 0);
}

function peakOver(s, ts, from, to, frames, ms) {
  let best = null;
  for (let i = from; i <= to; i++) {
    for (const tr of s.tracks) {
      const over = tr.rise[i] - tr.thr[i];
      if (Number.isFinite(over) && (!best || over > best.over)) best = { over, peak: tr.rise[i], thr: tr.thr[i] };
    }
  }
  return best && { ...best, frames, ms };
}

// ---- numbers ----

const median = (xs) => (xs.length ? [...xs].sort((a, b) => a - b)[xs.length >> 1] : null);
const spread = (xs) => (xs.length > 1 ? Math.sqrt(xs.reduce((s, x) => s + (x - xs.reduce((a, b) => a + b) / xs.length) ** 2, 0) / xs.length) : null);

// The score for each seat: the file's own when it has one (score.seats[spotId], or score[spotId]), else worked out from the tap and beat statuses. Same fields either way:
// falseStill, falseMove, falseOthersTurn, expected, caught, extra, delayMs, delaySpreadMs. A recording has only taps.
export function scoreOf(model, analysis) {
  if (model.score) return { source: "file", fps: Number.isFinite(model.score.fps) ? model.score.fps : null, seats: Object.fromEntries(model.spotIds.map((id) => [id, model.score.seats?.[id] ?? model.score[id] ?? null])) };
  const seats = {};
  for (const id of model.spotIds) {
    const taps = analysis.taps.filter((t) => t.spotId === id);
    if (analysis.plain) { seats[id] = { taps: taps.length }; continue; }
    const beats = analysis.beats.filter((b) => b.spotId === id);
    const falseIn = (test) => taps.filter((t) => t.status === "false" && t.phase && test(t.phase.id)).length;
    const delays = taps.filter((t) => t.status === "match").map((t) => t.atMs - analysis.beats[t.beat].atMs);
    seats[id] = {
      falseStill: falseIn((p) => p === "still"),
      falseMove: falseIn((p) => p === "move"),
      falseOthersTurn: falseIn((p) => p.startsWith("solo-") && p !== `solo-${id}`),
      expected: beats.length,
      caught: beats.filter((b) => b.caught).length,
      extra: taps.filter((t) => t.status === "extra").length,
      delayMs: median(delays),
      delaySpreadMs: spread(delays),
    };
  }
  return { source: "computed", fps: null, seats };
}

