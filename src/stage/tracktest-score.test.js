import test from "node:test";
import assert from "node:assert/strict";
import { planTest, scoreTest, classifyTaps, frameRecord, falseTaps, LEAD_MS } from "./tracktest-score.js";

const { phases } = planTest([1, 2]);
const slices = [{ spotId: 1, x0: 0, x1: 0.5 }, { spotId: 2, x0: 0.5, x1: 1 }];
const phase = (id) => phases.find((p) => p.id === id);

// Every expected tap, for each seat, shifted by `lag`: a perfect run when lag is 0.
const perfect = (lag = 0) => phases.flatMap((p) => Object.entries(p.expect).flatMap(([id, e]) => (e === "none" ? [] : e.beats.map((b) => ({ spotId: +id, atMs: b + lag, x: 0.4 })))));
// Ten fresh frames a second over the whole run.
const frames = (endMs, gap = 100) => Array.from({ length: Math.floor(endMs / gap) }, (_, i) => ({ t: i * gap, fresh: true, seats: [{ spotId: 1, feet: [{ foot: 0 }] }, { spotId: 2, feet: [{ foot: 0 }] }], debug: [], lifted: {} }));
const run = (taps, extra = {}) => ({ version: 1, kind: "tracktest", slices, phases, taps, frames: frames(planTest([1, 2]).endMs), ...extra });
const seat = (score, id) => score.seats[id];

test("plan: six kinds of phase in order, each announced 3 s ahead, with the beats the brief gives", () => {
  assert.deepEqual(phases.map((p) => p.id), ["still", "move", "beat", "fast", "solo-1", "solo-2"]);
  assert.equal(phase("still").fromMs, LEAD_MS);
  assert.equal(phase("still").toMs - phase("still").fromMs, 10000);
  assert.equal(phase("move").announceFromMs, phase("still").toMs); // the next phase's 3 s begin when the last ends
  assert.equal(phase("beat").expect[1].beats.length, 25); // 15 s at 100 a minute
  assert.equal(phase("fast").expect[2].beats.length, 25); // 10 s at 150 a minute
  assert.equal(phase("solo-1").expect[1].beats.length, 13); // 8 s at 100 a minute
  assert.equal(phase("solo-1").expect[2], "none");
  assert.equal(phase("solo-2").expect[1], "none");
  assert.equal(phase("still").expect[1], "none");
  assert.equal(phase("beat").expect[1].beats[1] - phase("beat").expect[1].beats[0], 600);
  assert.equal(phase("fast").expect[1].beats[1] - phase("fast").expect[1].beats[0], 400);
});

test("plan: one seat has no solo phases, and speed squeezes the clock and the beats together", () => {
  assert.deepEqual(planTest([1]).phases.map((p) => p.id), ["still", "move", "beat", "fast"]);
  const fast = planTest([1, 2], 4);
  assert.equal(fast.endMs * 4, planTest([1, 2]).endMs);
  assert.equal(fast.phases[2].expect[1].beats.length, 25);
  assert.equal(fast.phases[2].expect[1].beats[1] - fast.phases[2].expect[1].beats[0], 150);
});

test("a perfect run: every beat caught, no false taps, no delay, no extras", () => {
  const s = scoreTest(run(perfect()));
  for (const id of [1, 2]) {
    assert.equal(falseTaps(seat(s, id)), 0);
    assert.equal(seat(s, id).expected, 25 + 25 + 13);
    assert.equal(seat(s, id).caught, 63);
    assert.equal(seat(s, id).extra, 0);
    assert.equal(seat(s, id).delayMs, 0);
    assert.equal(seat(s, id).delaySpreadMs, 0);
  }
  assert.equal(s.missed, 0);
  assert.equal(s.fps, 10);
  assert.equal(s.frameGapMaxMs, 100);
});

test("one false tap in each kind of phase lands in its own number, for the right seat", () => {
  const taps = [
    ...perfect(),
    { spotId: 1, atMs: phase("still").fromMs + 4000 },
    { spotId: 2, atMs: phase("move").fromMs + 2000 },
    { spotId: 1, atMs: phase("solo-2").fromMs + 1500 }, // seat 1 taps in seat 2's turn
  ];
  const s = scoreTest(run(taps));
  assert.equal(seat(s, 1).falseStill, 1);
  assert.equal(seat(s, 1).falseMove, 0);
  assert.equal(seat(s, 1).falseOthersTurn, 1);
  assert.equal(seat(s, 2).falseMove, 1);
  assert.equal(seat(s, 2).falseStill, 0);
  assert.equal(seat(s, 2).falseOthersTurn, 0);
  assert.equal(falseTaps(seat(s, 1)), 2);
  assert.equal(seat(s, 1).caught, 63); // the real taps are all still caught
});

test("a missed beat: caught is one short and the beat is listed", () => {
  const skipped = phase("beat").expect[1].beats[5];
  const taps = perfect().filter((t) => !(t.spotId === 1 && t.atMs === skipped));
  const s = scoreTest(run(taps));
  assert.equal(seat(s, 1).caught, 62);
  assert.equal(seat(s, 1).expected, 63);
  assert.equal(seat(s, 2).caught, 63);
  assert.equal(s.missed, 1);
  assert.deepEqual(classifyTaps(run(taps)).missed, [{ spotId: 1, phase: "beat", beatMs: skipped }]);
});

test("a steady 120 ms lag is the delay, with no spread", () => {
  const s = scoreTest(run(perfect(120)));
  assert.equal(seat(s, 1).delayMs, 120);
  assert.equal(seat(s, 1).delaySpreadMs, 0);
  assert.equal(seat(s, 1).caught, 63);
  assert.equal(seat(s, 1).extra, 0);
});

test("lag that wobbles: the median is the delay and the spread is the middle half's width", () => {
  const taps = phase("beat").expect[1].beats.map((b, i) => ({ spotId: 1, atMs: b + 100 + (i % 2) * 40 }));
  const s = scoreTest(run(taps));
  assert.ok(seat(s, 1).delayMs >= 100 && seat(s, 1).delayMs <= 140);
  assert.ok(seat(s, 1).delaySpreadMs > 0 && seat(s, 1).delaySpreadMs <= 40);
});

test("an early tap still counts and gives a negative delay; a tap far from any beat is extra", () => {
  const b = phase("beat").expect[1].beats;
  const early = scoreTest(run(b.map((ms) => ({ spotId: 1, atMs: ms - 80 }))));
  assert.equal(seat(early, 1).delayMs, -80);
  assert.equal(seat(early, 1).caught, 25);
  // A tap 300 ms after a beat is half way to the next (600 ms apart) and 300 from this one: a second tap near the same beat is extra.
  const twice = scoreTest(run([...b.map((ms) => ({ spotId: 1, atMs: ms })), { spotId: 1, atMs: b[3] + 250 }]));
  assert.equal(seat(twice, 1).caught, 25);
  assert.equal(seat(twice, 1).extra, 1);
});

test("each beat and each tap is used once: a double tap does not catch two beats", () => {
  const fast = phase("fast").expect[1].beats; // 400 ms apart
  const s = scoreTest(run([{ spotId: 1, atMs: fast[4] + 200 }])); // 200 from two beats
  assert.equal(seat(s, 1).caught, 1);
  assert.equal(seat(s, 1).extra, 0);
});

test("a tap in the 3 s before a phase is not a false tap, but one just before a beat can still catch it", () => {
  const s = scoreTest(run([{ spotId: 1, atMs: phase("still").fromMs - 1000 }, { spotId: 1, atMs: phase("beat").fromMs - 100 }]));
  assert.equal(falseTaps(seat(s, 1)), 0);
  assert.equal(seat(s, 1).caught, 1);
  assert.equal(seat(s, 1).delayMs, -100);
});

test("frames: rate from fresh frames only, the biggest gap, and the seat frames with no feet", () => {
  const f = frames(10000, 50);
  f.forEach((x, i) => { if (i % 2) x.fresh = false; }); // half are the same picture again
  f.forEach((x, i) => { if (i === 40 || i === 41) x.seats[1].feet = []; });
  const s = scoreTest(run([], { frames: f }));
  assert.equal(s.fps, 10);
  assert.equal(s.frameGapMaxMs, 100);
  assert.equal(seat(s, 2).droppedSeatFrames, 1); // frame 41 is not fresh
  assert.equal(seat(s, 1).droppedSeatFrames, 0);
});

test("a file with no taps and no frames still scores", () => {
  const s = scoreTest(run([], { frames: [] }));
  assert.equal(s.fps, 0);
  assert.equal(seat(s, 1).delayMs, null);
  assert.equal(seat(s, 1).caught, 0);
});

test("frameRecord: the seats shape of a seats recording, plus what the detector thought", () => {
  const r = {
    t: 5123.456,
    read: [{ spotId: 1, foot: 0, x: 0.123456789, y: 0.5, shin: 0.25 }],
    poses: [{ spotId: 1, hipX: 0.4, dropped: false, n: 7 }, { spotId: 2, hipX: null, dropped: false, n: 7 }],
    debug: [{ spotId: 1, foot: 0, ground: 0.5, threshold: 0.012, shake: 0.002 }],
    lifted: { 1: false, 2: false },
  };
  const f = frameRecord(r, 5000, true);
  assert.equal(f.t, 123.46);
  assert.deepEqual(f.seats[0].feet, [{ foot: 0, x: 0.12346, y: 0.5, shin: 0.25 }]);
  assert.deepEqual(f.seats[1], { spotId: 2, hipX: null, dropped: false, n: 7, feet: [] });
  assert.deepEqual(f.debug[0], { spotId: 1, foot: 0, ground: 0.5, threshold: 0.012, shake: 0.002 });
  assert.deepEqual(f.lifted, { 1: false, 2: false });
  assert.equal(f.fresh, true);
});
