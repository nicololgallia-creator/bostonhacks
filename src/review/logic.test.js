import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  buildModel, nearestIndex, stepIndex, videoToTest, testToVideo, viewFor, makeAxis, tickStep, stripLayout, tapAt,
  matchBeats, analyse, nextAfter, buildSeries, riseTop, liftBefore, riseNear, scoreOf, footAt,
} from "./logic.js";

// A tiny tracktest: seat 1 at 100 ms a frame for 3 s, one foot, resting at y 0.5 and lifting by 0.05 while "lifted".
const frame = (t, rise = 0, lifted = false) => ({
  t,
  seats: [{ spotId: 1, hipX: 0.3, feet: [{ foot: 0, x: 0.3, y: 0.5 - rise, shin: 0.25 }] }],
  debug: [{ spotId: 1, foot: 0, ground: 0.5, threshold: 0.015, shake: 0.001 }],
  lifted: { 1: lifted },
});
function made(extra = {}) {
  const frames = [];
  for (let t = 0; t <= 3000; t += 100) {
    const up = t >= 1000 && t <= 1200; // in the air from 1.0 to 1.2 s, lands at 1.3 s
    frames.push(frame(t, up ? 0.05 : 0, up));
  }
  return {
    version: 1, kind: "tracktest", facing: false, lanes: { 1: 1 }, slices: [{ spotId: 1, x0: 0, x1: 1 }], model: "lite", video: null,
    phases: [
      { id: "still", label: "Sit still", fromMs: 0, toMs: 1500, expect: { 1: "none" } },
      { id: "beat", label: "Tap", fromMs: 1500, toMs: 3000, expect: { 1: { beats: [1800, 2400] } } },
    ],
    frames,
    taps: [{ spotId: 1, atMs: 1300, x: 0.3, y: 0.45 }, { spotId: 1, atMs: 1850, x: 0.3, y: 0.5 }, { spotId: 1, atMs: 2800, x: 0.3, y: 0.5 }],
    ...extra,
  };
}

test("nearestIndex finds the closest frame, and the ends", () => {
  const ts = [0, 33, 66, 100];
  assert.equal(nearestIndex(ts, 40), 1);
  assert.equal(nearestIndex(ts, 55), 2);
  assert.equal(nearestIndex(ts, -50), 0);
  assert.equal(nearestIndex(ts, 5000), 3);
  assert.equal(nearestIndex(ts, 33), 1);
});

test("stepIndex moves one frame, from a time between frames too, and stops at the ends", () => {
  const ts = [0, 33, 66, 100];
  assert.equal(stepIndex(ts, 33, 1), 2);
  assert.equal(stepIndex(ts, 33, -1), 0);
  assert.equal(stepIndex(ts, 40, 1), 2); // 40 is nearest 33: the next frame after 40 is 66
  assert.equal(stepIndex(ts, 40, -1), 1);
  assert.equal(stepIndex(ts, 0, -1), 0);
  assert.equal(stepIndex(ts, 100, 1), 3);
});

test("test time and video time differ by startMs", () => {
  assert.equal(videoToTest(2.5, 4000), 6500);
  assert.equal(testToVideo(6500, 4000), 2.5);
  assert.equal(testToVideo(1000, 4000), -3); // before the video began
  for (const t of [0, 1234, 39600]) assert.equal(videoToTest(testToVideo(t, 777), 777), t);
});

test("viewFor: the whole test, or a span around the head kept inside the test", () => {
  assert.deepEqual(viewFor("all", 5000, 40000), [0, 40000]);
  assert.deepEqual(viewFor(10000, 20000, 40000), [15000, 25000]);
  assert.deepEqual(viewFor(10000, 1000, 40000), [0, 10000]);
  assert.deepEqual(viewFor(10000, 39000, 40000), [30000, 40000]);
  assert.deepEqual(viewFor(10000, 100, 4000), [0, 4000]); // a test shorter than the span shows all of it
});

test("makeAxis maps time to pixels and back", () => {
  const a = makeAxis(10000, 20000, 100, 600);
  assert.equal(a.toX(10000), 100);
  assert.equal(a.toX(20000), 600);
  assert.equal(a.toX(15000), 350);
  assert.equal(a.toT(350), 15000);
});

test("tickStep gives marks about 90 px apart", () => {
  assert.equal(tickStep(40000, 700), 5000); // 40 s over 700 px: 5.1 s wanted, 5 s is 87 px
  assert.equal(tickStep(3000, 700), 500);
  assert.equal(tickStep(10000, 700), 2000);
});

test("stripLayout puts the rows between the phase bar and the ruler", () => {
  const l = stripLayout(800, 322, 2);
  assert.equal(l.rows.length, 2);
  assert.equal(l.rows[0].top, l.phaseH);
  assert.equal(l.rows[1].top, l.rows[0].bottom);
  assert.ok(l.rows[1].bottom + l.rulerH <= 322);
  assert.equal(l.rulerTop, l.rows[1].bottom);
});

test("tapAt takes the nearest tap of that seat inside the tolerance", () => {
  const taps = [{ spotId: 1, atMs: 1000 }, { spotId: 1, atMs: 1100 }, { spotId: 2, atMs: 1050 }];
  assert.equal(tapAt(taps, 1060, 1, 100), 1);
  assert.equal(tapAt(taps, 1060, 2, 100), 2);
  assert.equal(tapAt(taps, 3000, 1, 100), -1);
});

test("matchBeats pairs each tap with its nearest free beat inside 300 ms", () => {
  const r = matchBeats([1000, 1100, 5000], [1050, 2000]);
  // 1000 and 1100 are both 50 ms from the beat at 1050: the first one listed takes it, the other has none
  assert.deepEqual(r.beatOfTap, [0, -1, -1]);
  assert.deepEqual(r.tapOfBeat, [0, -1]);
  assert.deepEqual(matchBeats([1000], [1300]).beatOfTap, [0]); // exactly 300 ms still matches
  assert.deepEqual(matchBeats([1000], [1301]).beatOfTap, [-1]);
  assert.deepEqual(matchBeats([1000, 1250], [1200]).beatOfTap, [-1, 0]); // the closer tap (50 ms) wins over the one 200 ms away
});

test("analyse: a tap on a beat matches, a tap in a none phase is false, a beat with no tap is missed", () => {
  const a = analyse(buildModel(made()));
  assert.deepEqual(a.taps.map((t) => t.status), ["false", "match", "extra"]); // 1300 in "still", 1850 on beat 1800, 2800 near no beat
  assert.equal(a.taps[0].phase.id, "still");
  assert.equal(a.beats.length, 2);
  assert.deepEqual(a.beats.map((b) => b.caught), [true, false]);
  assert.deepEqual(a.problems.map((p) => p.kind), ["false", "missed", "extra"]);
  assert.deepEqual(a.problems.map((p) => p.atMs), [1300, 2400, 2800]);
});

test("analyse: a tap in no phase at all is extra, and a seat the phase does not mention expects none", () => {
  const raw = made({ taps: [{ spotId: 1, atMs: 3500, x: 0, y: 0 }] });
  raw.frames.push(frame(3500));
  assert.equal(analyse(buildModel(raw)).taps[0].status, "extra");
  raw.phases[1].expect = {};
  raw.taps = [{ spotId: 1, atMs: 2000, x: 0, y: 0 }];
  assert.equal(analyse(buildModel(raw)).taps[0].status, "false");
});

test("a recording with no phases calls no tap false", () => {
  const raw = made();
  delete raw.kind;
  const a = analyse(buildModel(raw));
  assert.equal(a.plain, true);
  assert.deepEqual(a.problems, []);
});

test("nextAfter jumps to the next tap whose jump point is ahead, and wraps", () => {
  const list = [{ atMs: 1300 }, { atMs: 2700 }, { atMs: 5000 }];
  assert.equal(nextAfter(list, 0), 0);
  assert.equal(nextAfter(list, 800), 1); // we are at the jump point of tap 0 (1300 - 500): move on
  assert.equal(nextAfter(list, 801), 1);
  assert.equal(nextAfter(list, 1300), 1);
  assert.equal(nextAfter(list, 4500), 0); // past the last jump point: back to the first
  assert.equal(nextAfter([], 0), -1);
});

test("buildSeries gives rise over ground and the threshold, per foot", () => {
  const s = buildSeries(buildModel(made()));
  const tr = s[1].tracks[0];
  assert.ok(Math.abs(tr.rise[10] - 0.05) < 1e-6); // 1.0 s
  assert.ok(Math.abs(tr.rise[0]) < 1e-6);
  assert.ok(Math.abs(tr.thr[10] - 0.015) < 1e-6);
  assert.ok(Number.isNaN(s[1].tracks[1].rise[10])); // one foot only
  assert.equal(s[1].lifted[10], 1);
  assert.equal(s[1].lifted[13], 0);
  assert.equal(riseTop(s), 0.06); // never under 0.06
});

test("a one-lane seat's two debug entries go left and right by x", () => {
  const raw = made();
  raw.frames = raw.frames.map((f) => ({
    ...f,
    seats: [{ spotId: 1, hipX: 0.3, feet: [{ foot: 1, x: 0.4, y: 0.45, shin: 0.25 }, { foot: 0, x: 0.2, y: 0.5, shin: 0.25 }] }], // the model's names are swapped
    debug: [{ spotId: 1, foot: 0, ground: 0.5, threshold: 0.01, shake: 0 }, { spotId: 1, foot: 1, ground: 0.5, threshold: 0.02, shake: 0 }],
  }));
  const s = buildSeries(buildModel(raw));
  assert.ok(Math.abs(s[1].tracks[0].rise[0]) < 1e-6); // track 0 is the foot at x 0.2, on the ground
  assert.ok(Math.abs(s[1].tracks[1].rise[0] - 0.05) < 1e-6); // track 1 is the foot at x 0.4, 0.05 up
});

test("liftBefore describes the lift that ends at a tap", () => {
  const m = buildModel(made());
  const ts = m.frames.map((f) => f.t);
  const d = liftBefore(buildSeries(m), ts, 1, 1300);
  assert.equal(d.frames, 3); // lifted at 1.0, 1.1, 1.2 s
  assert.equal(d.ms, 300);
  assert.ok(Math.abs(d.over - 0.035) < 1e-6);
  assert.ok(Math.abs(d.peak - 0.05) < 1e-6);
});

test("riseNear says how high a foot got around a beat that was missed", () => {
  const m = buildModel(made());
  const ts = m.frames.map((f) => f.t);
  const d = riseNear(buildSeries(m), ts, 1, 2400);
  assert.ok(d.over < 0 && Math.abs(d.peak) < 1e-6); // on the ground the whole time
  assert.equal(riseNear(buildSeries(m), ts, 9, 2400), null);
});

test("scoreOf takes the file's score when it has one", () => {
  const raw = made({ score: { 1: { falseStill: 3, expected: 9 }, fps: 27.5 } });
  const m = buildModel(raw);
  const s = scoreOf(m, analyse(m));
  assert.equal(s.source, "file");
  assert.equal(s.fps, 27.5);
  assert.equal(s.seats[1].falseStill, 3);
});

test("scoreOf reads the seats from score.seats too", () => {
  const m = buildModel(made({ score: { seats: { 1: { falseMove: 2, droppedSeatFrames: 7 } }, fps: 30 } }));
  const s = scoreOf(m, analyse(m));
  assert.equal(s.source, "file");
  assert.equal(s.seats[1].falseMove, 2);
  assert.equal(s.fps, 30);
});

test("scoreOf works the numbers out when the file has none", () => {
  const m = buildModel(made());
  const s = scoreOf(m, analyse(m)).seats[1];
  assert.equal(s.falseStill, 1);
  assert.equal(s.falseMove, 0);
  assert.equal(s.expected, 2);
  assert.equal(s.caught, 1);
  assert.equal(s.extra, 1);
  assert.equal(s.delayMs, 50); // tap at 1850 for a beat at 1800
});

test("a plain recording is run through the detector, and a bad file says why", () => {
  const rec = JSON.parse(readFileSync("qa/seats/real-two-1.json", "utf8"));
  const m = buildModel(rec);
  assert.equal(m.kind, "recording");
  assert.deepEqual(m.spotIds, [1, 2]);
  assert.equal(m.phases.length, 0);
  const inRest = (id) => m.taps.filter((t) => t.spotId === id && t.atMs > 5000 && t.atMs < 22000).length;
  assert.equal(inRest(1) + inRest(2), 0); // taps-feet: no taps at rest
  assert.ok(m.taps.filter((t) => t.spotId === 1 && t.atMs > 22000 && t.atMs < 39600).length >= 27);
  assert.ok(m.frames.every((f) => Array.isArray(f.debug)));
  assert.ok(m.frames.some((f) => f.lifted[1])); // seat 1 was in the air at some point
  assert.throws(() => buildModel({ frames: [] }), /no frames/);
  assert.throws(() => buildModel({ version: 2, kind: "tracktest", frames: [{}] }), /version 2/);
});


test("a tap with no y gets the y of the foot nearest its x", () => {
  const raw = made({ taps: [{ spotId: 1, atMs: 1000, x: 0.31 }] }); // the foot is at x 0.3, 0.05 up at 1.0 s
  assert.ok(Math.abs(buildModel(raw).taps[0].y - 0.45) < 1e-6);
  const fr = [{ t: 0, seats: [{ spotId: 1, feet: [{ x: 0.2, y: 0.5 }, { x: 0.4, y: 0.4 }] }] }];
  assert.equal(footAt(fr, { spotId: 1, atMs: 0, x: 0.22 }).y, 0.5); // nearest x
  assert.equal(footAt(fr, { spotId: 1, atMs: 0 }).y, 0.4); // no x: the highest
  assert.equal(footAt(fr, { spotId: 9, atMs: 0, x: 0.2 }), null);
});
