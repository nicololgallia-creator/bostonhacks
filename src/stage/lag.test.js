import test from "node:test";
import assert from "node:assert/strict";
import { measureLag, createArrivals } from "./lag.js";

const beats = Array.from({ length: 8 }, (_, i) => 1000 + i * 600);
const steps = (lateness) => beats.map((b, i) => b + lateness[i]);

test("steady late steps give that lateness", () => {
  assert.deepEqual(measureLag(beats, steps(Array(8).fill(140))), { offsetMs: 140, used: 6 });
});

test("the result is rounded to 10", () => {
  assert.equal(measureLag(beats, steps(Array(8).fill(147))).offsetMs, 150);
});

test("one wild step does not move the median", () => {
  const late = [140, 140, 140, 140, 140, 140, 140, 140];
  late[5] = 380;
  assert.equal(measureLag(beats, steps(late)).offsetMs, 140);
});

test("early steps clamp to 0", () => {
  assert.equal(measureLag(beats, steps(Array(8).fill(-90))).offsetMs, 0);
});

test("very late steps clamp to 400", () => {
  assert.equal(measureLag(beats, steps(Array(8).fill(390))).offsetMs, 390);
  assert.equal(measureLag(beats, steps(Array(8).fill(395))).offsetMs, 400);
});

test("too few steps give null and say how many were seen", () => {
  const some = beats.slice(2, 5).map((b) => b + 100); // three steps among the counted beats
  assert.deepEqual(measureLag(beats, some), { offsetMs: null, used: 3 });
  assert.deepEqual(measureLag(beats, []), { offsetMs: null, used: 0 });
});

test("four steps are enough", () => {
  const four = beats.slice(2, 6).map((b) => b + 100);
  assert.deepEqual(measureLag(beats, four), { offsetMs: 100, used: 4 });
});

test("the first two beats are ignored", () => {
  const late = [-300, 390, 140, 140, 140, 140, 140, 140];
  assert.deepEqual(measureLag(beats, steps(late)), { offsetMs: 140, used: 6 });
  // steps for the first two beats alone are not enough
  assert.equal(measureLag(beats, steps(late).slice(0, 2)).offsetMs, null);
});

test("a step further than 400 ms from every beat is not counted", () => {
  assert.deepEqual(measureLag(beats, [beats[7] + 450]), { offsetMs: null, used: 0 });
  assert.equal(measureLag(beats, [beats[7] + 400]).used, 1);
});

test("one step is not used for two beats", () => {
  const between = [beats[2] + 300]; // 300 ms after beat 2 and 300 ms before beat 3
  assert.equal(measureLag(beats, between).used, 1);
});

test("an arrival is the count going up", () => {
  const arrived = createArrivals();
  assert.equal(arrived(0, 0), false);
  assert.equal(arrived(16, 1), true);
  assert.equal(arrived(32, 1), false); // still standing there
  assert.equal(arrived(48, 2), true); // a second foot
});

test("a foot lost for under 150 ms is not a new arrival", () => {
  const arrived = createArrivals();
  arrived(0, 1);
  assert.equal(arrived(50, 0), false);
  assert.equal(arrived(100, 0), false);
  assert.equal(arrived(140, 1), false); // back after 90 ms
});

test("a foot lost for 150 ms is gone, and the next one arrives", () => {
  const arrived = createArrivals();
  arrived(0, 1);
  arrived(50, 0);
  arrived(200, 0); // 150 ms without one
  assert.equal(arrived(300, 1), true);
});
