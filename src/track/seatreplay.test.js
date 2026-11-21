import test from "node:test";
import assert from "node:assert/strict";
import { frameOf, parseRecording, createReplayFeet } from "./seatreplay.js";

const pose = (spotId, feet, hipX = 0.3, dropped = false) => ({ spotId, hipX, dropped, feet, landmarks: [{ x: 0, y: 0 }], n: 1 });
const foot = (foot, x, y, shin = 0.2) => ({ spotId: 1, foot, x, y, shin });

test("a frame keeps time, hips, the dropped flag and each foot's x, y and shin, rounded, and no landmarks", () => {
  const f = frameOf(1234.6, [pose(1, [foot(0, 0.123456, 0.8, 0.2)], 0.31234), pose(2, [], null, true)]);
  assert.deepEqual(f, {
    t: 1235,
    seats: [
      { spotId: 1, hipX: 0.3123, dropped: false, feet: [{ foot: 0, x: 0.1235, y: 0.8, shin: 0.2 }] },
      { spotId: 2, hipX: null, dropped: true, feet: [] },
    ],
  });
});

test("a recording must be version 2 with slices and frames, and say so plainly when it is not", () => {
  const ok = { version: 2, slices: [{ spotId: 1, x0: 0, x1: 1 }], frames: [{ t: 0, seats: [] }] };
  assert.equal(parseRecording(ok), ok);
  for (const bad of [null, {}, { version: 1, frames: [{}] }, { ...ok, slices: undefined }]) {
    assert.throws(() => parseRecording(bad), /not a seat recording/);
  }
  assert.throws(() => parseRecording({ ...ok, frames: [] }), /no frames/);
});

// Two seats, a frame every 100 ms, seat 1's foot rising 0.01 each frame
const recording = {
  version: 2,
  slices: [{ spotId: 1, x0: 0, x1: 0.5 }, { spotId: 2, x0: 0.5, x1: 1 }],
  frames: Array.from({ length: 10 }, (_, i) => ({
    t: i * 100,
    seats: [
      { spotId: 1, hipX: 0.25, dropped: false, feet: [{ foot: 0, x: 0.2, y: 0.8 - i * 0.01, shin: 0.2 }] },
      { spotId: 2, hipX: 0.75, dropped: i === 3, feet: i === 3 ? [] : [{ foot: 0, x: 0.7, y: 0.8, shin: 0.2 }] },
    ],
  })),
};

test("replay: the frame for the clock's time, with each foot carrying its seat", async () => {
  let clock = 5000;
  const r = createReplayFeet({ recording, now: () => clock });
  assert.equal(await r.start(), "replay");
  assert.deepEqual(r.read().map((f) => [f.spotId, f.foot, f.y]), [[1, 0, 0.8], [2, 0, 0.8]]);
  clock = 5250; // frame 2 (200 ms)
  assert.ok(Math.abs(r.read()[0].y - 0.78) < 1e-9);
  clock = 5300; // frame 3: seat 2 was dropped as a neighbour
  assert.deepEqual(r.read().map((f) => f.spotId), [1]);
  const p = r.poses();
  assert.equal(p[1].dropped, true);
  assert.equal(p[0].hipX, 0.25);
});

test("replay: loops back to the first frame, and goes backwards in time without breaking", async () => {
  let clock = 0;
  const r = createReplayFeet({ recording, now: () => clock });
  await r.start();
  clock = 950;
  assert.ok(Math.abs(r.read()[0].y - 0.71) < 1e-9); // the last frame, i = 9
  clock = 1050; // 1000 ms is the span (the last frame lasts one gap): back to frame 0
  assert.equal(r.read()[0].y, 0.8);
  clock = 1150;
  assert.ok(Math.abs(r.read()[0].y - 0.79) < 1e-9);
});

test("replay: with loop off it stays on the last frame", async () => {
  let clock = 0;
  const r = createReplayFeet({ recording, loop: false, now: () => clock });
  await r.start();
  clock = 99999;
  assert.ok(Math.abs(r.read()[0].y - 0.71) < 1e-9);
});

test("replay: one frame alone plays without dividing by nothing", async () => {
  const one = { ...recording, frames: [recording.frames[0]] };
  const r = createReplayFeet({ recording: one, now: () => 12345 });
  await r.start();
  assert.equal(r.read().length, 2);
  assert.ok(r.fps().every(Number.isFinite));
});
