import { test } from "node:test";
import assert from "node:assert/strict";
import { createRecorder, createReplay } from "./record.js";

const foot = (x) => ({ x, y: 0.5, person: 0 });

function sample() {
  const rec = createRecorder();
  rec.add(5000, [foot(0.1)]);
  rec.add(5100, [foot(0.2), foot(0.3)]);
  rec.add(5200, []);
  return rec.toJSON();
}

test("times start at zero and the shape matches the plan", () => {
  const json = sample();
  assert.equal(json.version, 1);
  assert.deepEqual(json.frames.map((f) => f.t), [0, 100, 200]);
  assert.deepEqual(json.frames[0].feet, [{ x: 0.1, y: 0.5, person: 0 }]);
  assert.equal(json.frames[1].feet.length, 2);
});

test("an empty recorder gives no frames", () => {
  assert.deepEqual(createRecorder().toJSON(), { version: 1, frames: [] });
});

test("replay returns the frame for the elapsed time", async () => {
  let t = 1000;
  const replay = createReplay(sample(), () => t);
  await replay.start();
  assert.equal(replay.read()[0].x, 0.1);
  t = 1099;
  assert.equal(replay.read()[0].x, 0.1);
  t = 1100;
  assert.equal(replay.read().length, 2);
  t = 1250;
  assert.deepEqual(replay.read(), []);
});

test("replay loops after the last frame", async () => {
  let t = 0;
  const replay = createReplay(sample(), () => t);
  await replay.start();
  t = 300; // loop length is 200 + one 100 ms gap
  assert.equal(replay.read()[0].x, 0.1);
  t = 430;
  assert.equal(replay.read().length, 2);
});

test("a one frame recording keeps returning its frame", async () => {
  let t = 0;
  const rec = createRecorder();
  rec.add(10, [foot(0.4)]);
  const replay = createReplay(rec.toJSON(), () => t);
  await replay.start();
  for (t of [0, 20, 1000, 12345]) assert.equal(replay.read()[0].x, 0.4);
});

test("fps counts the frames shown in the last second", async () => {
  let t = 0;
  const replay = createReplay(sample(), () => t);
  await replay.start();
  for (t of [0, 100, 200, 250]) replay.read();
  assert.equal(replay.fps(), 3);
});

test("bad files are refused with a plain reason", () => {
  const refuse = (value, text) => assert.throws(() => createReplay(value), (e) => e.message.includes(text));
  refuse(null, "version 1");
  refuse("hello", "version 1");
  refuse({ version: 2, frames: [] }, "version 1");
  refuse({ version: 1, frames: [] }, "no frames");
  refuse({ version: 1 }, "no frames");
  refuse({ version: 1, frames: [{ t: 0, feet: [{ x: 0.1 }] }] }, "without x and y");
  refuse({ version: 1, frames: [{ t: 50, feet: [] }, { t: 10, feet: [] }] }, "out-of-order");
  refuse({ version: 1, frames: [{ feet: [] }] }, "missing");
});
