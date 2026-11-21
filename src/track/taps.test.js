import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createTapDetector } from "./taps.js";

const GROUND = 0.8;
const LIFT = 0.05; // well past the 0.02 threshold

// Runs one foot (seat 1, foot 0) from `from` to `to` every `step` ms. yAt(t) is its y; undefined means the foot is missing.
function play(det, yAt, from, to, { step = 20, shin = 0.2, spotId = 1, foot = 0 } = {}) {
  const taps = [];
  const lifted = new Map();
  for (let t = from; t <= to; t += step) {
    const y = yAt(t);
    const r = det.update(t, y === undefined ? [] : [{ spotId, foot, x: 0.5, y, shin }]);
    taps.push(...r.taps);
    if (r.feet.length) lifted.set(t, r.feet[0].lifted);
  }
  return { taps, lifted };
}
const lift = (a, b, h = LIFT) => (t) => (t >= a && t < b ? GROUND - h : GROUND); // in the air from a, back on the ground at b

test("a clean tap: lifted while in the air, one tap at the landing", () => {
  const { taps, lifted } = play(createTapDetector(), lift(100, 300), 0, 600);
  assert.deepEqual(taps, [{ spotId: 1, foot: 0, atMs: 300 }]);
  assert.equal(lifted.get(80), false);
  assert.equal(lifted.get(100), true);
  assert.equal(lifted.get(280), true);
  assert.equal(lifted.get(300), false);
});

test("ten taps at two a second give ten", () => {
  const { taps } = play(createTapDetector(), (t) => (t % 500 >= 100 && t % 500 < 300 ? GROUND - LIFT : GROUND), 0, 5000);
  assert.equal(taps.length, 10);
  assert.deepEqual(taps.map((x) => x.atMs), [300, 800, 1300, 1800, 2300, 2800, 3300, 3800, 4300, 4800]);
});

test("jitter of 0.003 gives no lift and no tap", () => {
  const { taps, lifted } = play(createTapDetector(), (t) => GROUND + ((t / 20) % 2 ? 0.003 : -0.003), 0, 3000);
  assert.equal(taps.length, 0);
  assert.ok([...lifted.values()].every((l) => !l));
});

test("a foot sliding slowly up or down gives no lift and no tap", () => {
  const det = createTapDetector();
  const up = play(det, (t) => GROUND - (0.1 * t) / 4000, 0, 4000); // 0.1 in 4 seconds
  const down = play(det, (t) => GROUND - 0.1 + (0.1 * (t - 4020)) / 4000, 4020, 8020);
  assert.equal(up.taps.length + down.taps.length, 0);
  assert.ok([...up.lifted.values(), ...down.lifted.values()].every((l) => !l));
});

test("a foot held up for two seconds is lifted the whole time and taps once when it lands", () => {
  const { taps, lifted } = play(createTapDetector(), lift(100, 2100), 0, 2500);
  assert.deepEqual(taps, [{ spotId: 1, foot: 0, atMs: 2100 }]);
  for (let t = 100; t < 2100; t += 20) assert.equal(lifted.get(t), true, `lifted at ${t}`);
  assert.equal(lifted.get(2100), false);
});

test("a foot that shifts up and stays is lifted only until maxLiftMs, then is the new ground, with no tap", () => {
  const { taps, lifted } = play(createTapDetector(), (t) => (t >= 500 ? GROUND - 0.03 : GROUND), 0, 5000);
  assert.equal(lifted.get(520), true);
  assert.equal(lifted.get(3480), true);
  assert.equal(lifted.get(3540), false);
  assert.equal(lifted.get(5000), false);
  assert.equal(taps.length, 0);
});

test("a foot that comes back only partway is still lifted, and taps when it is down", () => {
  const { taps, lifted } = play(createTapDetector(), (t) => (t < 100 ? GROUND : t < 300 ? GROUND - LIFT : t < 500 ? GROUND - 0.01 : GROUND), 0, 700);
  assert.equal(lifted.get(400), true); // 0.01 above the ground is more than 0.4 of the threshold
  assert.deepEqual(taps, [{ spotId: 1, foot: 0, atMs: 500 }]);
});

test("two feet and two seats do not mix", () => {
  const det = createTapDetector();
  const ys = (t) => [
    [1, 0, lift(100, 300)(t)],
    [1, 1, GROUND],
    [2, 0, GROUND],
    [2, 1, lift(600, 800)(t)],
  ];
  const taps = [];
  const flags = {};
  for (let t = 0; t <= 1000; t += 20) {
    const r = det.update(t, ys(t).map(([spotId, foot, y]) => ({ spotId, foot, x: 0.5, y, shin: 0.2 })));
    taps.push(...r.taps);
    flags[t] = r.feet.map((f) => `${f.spotId}.${f.foot}:${f.lifted}`).join(" ");
  }
  assert.deepEqual(taps, [{ spotId: 1, foot: 0, atMs: 300 }, { spotId: 2, foot: 1, atMs: 800 }]);
  assert.equal(flags[200], "1.0:true 1.1:false 2.0:false 2.1:false");
  assert.equal(flags[700], "1.0:false 1.1:false 2.0:false 2.1:true");
});

test("the same feet come back with lifted added and nothing else changed", () => {
  const f = { spotId: 3, foot: 1, x: 0.4, y: 0.7, shin: 0.2 };
  const r = createTapDetector().update(0, [f]);
  assert.deepEqual(r, { feet: [{ ...f, lifted: false }], taps: [] });
});

test("a dropout in the middle of a lift does not fire, and the real landing still taps once", () => {
  const y = (t) => (t >= 160 && t <= 220 ? undefined : lift(100, 300)(t));
  const { taps, lifted } = play(createTapDetector(), y, 0, 600);
  assert.deepEqual(taps, [{ spotId: 1, foot: 0, atMs: 300 }]);
  assert.equal(lifted.get(240), true); // back after the gap and still lifted
});

test("a foot missing on the ground and coming back on the ground does not tap", () => {
  const { taps } = play(createTapDetector(), (t) => (t >= 100 && t < 300 ? undefined : GROUND), 0, 600);
  assert.equal(taps.length, 0);
});

test("a foot missing longer than lostMs starts over: no tap when it returns on the ground", () => {
  const { taps, lifted } = play(createTapDetector(), (t) => (t >= 100 && t < 800 ? (t < 140 ? GROUND - LIFT : undefined) : GROUND), 0, 1000);
  assert.equal(taps.length, 0);
  assert.equal(lifted.get(800), false);
});

test("a lift seen in one frame counts only if it was high; two quick low frames do not", () => {
  // 20 ms frames, so a one-frame lift lasts under minLiftMs.
  assert.equal(play(createTapDetector(), lift(100, 120, 0.05), 0, 400).taps.length, 1); // more than twice the threshold
  assert.equal(play(createTapDetector(), lift(100, 120, 0.03), 0, 400).taps.length, 0);
  assert.equal(play(createTapDetector(), lift(100, 140, 0.03), 0, 400).taps.length, 0); // 40 ms
  assert.equal(play(createTapDetector(), lift(100, 160, 0.03), 0, 400).taps.length, 1); // 60 ms
});

test("the same foot cannot tap again within 150 ms of a tap", () => {
  // Lands at 200, lifts again 220 to 260 (lands 60 ms after the first tap), then a full tap 400 to 500.
  const y = (t) => ((t >= 100 && t < 200) || (t >= 220 && t < 260) || (t >= 400 && t < 500) ? GROUND - LIFT : GROUND);
  assert.deepEqual(play(createTapDetector(), y, 0, 700).taps.map((x) => x.atMs), [200, 500]);
  assert.deepEqual(play(createTapDetector({ cooldownMs: 0 }), y, 0, 700).taps.map((x) => x.atMs), [200, 260, 500]);
});

test("the threshold scales with the shin, has a floor, and is a plain 0.02 with no shin", () => {
  const lifted = (shin, h) => play(createTapDetector(), lift(100, 300, h), 0, 400, { shin }).lifted.get(200);
  assert.equal(lifted(0.5, 0.03), false); // a long shin needs 0.04
  assert.equal(lifted(0.5, 0.05), true);
  assert.equal(lifted(0.05, 0.015), false); // a tiny shin still needs 0.02
  assert.equal(lifted(0.05, 0.03), true);
  assert.equal(lifted(undefined, 0.015), false);
  assert.equal(lifted(undefined, 0.03), true);
});

test("options replace the defaults", () => {
  const det = createTapDetector({ minLift: 0.1 });
  assert.equal(play(det, lift(100, 300), 0, 600).taps.length, 0); // 0.05 is below 0.1
});

// The real recording: one seated person tapping, on the DJI. qa/feet/real-taps-1.json is the old camera shape,
// {t, feet: [{x, y, person}]}. Left foot in the picture is foot 0, right is foot 1. A frame without exactly two feet
// cannot be told apart, so it is left out.
test("on a real recording of one person tapping, finds about as many taps as the person made", () => {
  const rec = JSON.parse(readFileSync(new URL("../../qa/feet/real-taps-1.json", import.meta.url), "utf8"));
  const det = createTapDetector(); // no shin: the plain 0.02 threshold
  const taps = [];
  for (const fr of rec.frames) {
    if (fr.feet.length !== 2) continue;
    const [a, b] = [...fr.feet].sort((p, q) => p.x - q.x);
    taps.push(...det.update(fr.t, [{ spotId: 1, foot: 0, x: a.x, y: a.y }, { spotId: 1, foot: 1, x: b.x, y: b.y }]).taps);
  }
  for (const foot of [0, 1]) {
    const mine = taps.filter((x) => x.foot === foot && x.atMs >= 3000 && x.atMs <= 39500);
    assert.ok(mine.length >= 25 && mine.length <= 40, `foot ${foot}: ${mine.length} taps`);
    // Both feet held up about 0.10 for a second near 16 s: one tap each, when they land.
    assert.equal(mine.filter((x) => x.atMs >= 16000 && x.atMs <= 17500).length, 1, `foot ${foot} at 16 s`);
    // Both feet rest from 30 s to 32 s. (They both move at 29.3 to 29.7 s and 32.1 to 32.3 s, by 0.02 to 0.04: real lifts.)
    assert.equal(mine.filter((x) => x.atMs >= 30000 && x.atMs <= 32000).length, 0, `foot ${foot} at rest`);
  }
});

// Seat mode: a seat with one lane is one signal, the highest of its feet, so no foot needs a name.
const ONE = { 1: 1 };
// Runs seat 1's two feet, each y given by a function of time (undefined: the foot is not seen). `rename` is called to
// choose the names for the two feet in a frame, to make names flip. Returns the taps and what the detector handed back.
function seat(yA, yB, { lanes = ONE, to = 3000, step = 20, rename = (t) => [0, 1] } = {}) {
  const det = createTapDetector();
  const taps = [], handed = [];
  for (let t = 0; t <= to; t += step) {
    const [na, nb] = rename(t);
    const feet = [[na, yA(t)], [nb, yB(t)]].filter(([, y]) => y !== undefined).map(([foot, y]) => ({ spotId: 1, foot, x: 0.3 + foot * 0.1, y, shin: 0.2 }));
    const r = det.update(t, feet, lanes);
    taps.push(...r.taps);
    handed.push(r.feet);
  }
  return { taps, handed };
}
const rest = (y) => () => y;
const upBetween = (y, a, b, h = LIFT) => (t) => (t >= a && t < b ? y - h : y);

test("seat mode: either foot lifting and landing is one tap, reported as foot 0, and the seat comes back as one foot", () => {
  const { taps, handed } = seat(rest(0.8), upBetween(0.82, 500, 700));
  assert.deepEqual(taps, [{ spotId: 1, foot: 0, atMs: 700 }]);
  assert.ok(handed.every((fs) => fs.length === 1 && fs[0].foot === 0));
  assert.equal(handed[Math.round(600 / 20)][0].lifted, true);
  assert.equal(handed[Math.round(400 / 20)][0].lifted, false);
  const other = seat(upBetween(0.8, 500, 700), rest(0.82));
  assert.deepEqual(other.taps.map((x) => x.atMs), [700]);
});

test("seat mode: the two feet taking turns give a tap each", () => {
  const { taps } = seat(upBetween(0.8, 500, 700), upBetween(0.82, 1000, 1200));
  assert.deepEqual(taps.map((x) => x.atMs), [700, 1200]);
});

test("seat mode: feet swapping names every frame make no taps, where separate feet read the flips as lifts", () => {
  const flip = (t) => ((t / 20) % 2 ? [1, 0] : [0, 1]);
  // feet resting 0.04 apart in height, names flipping each frame
  assert.equal(seat(rest(0.8), rest(0.84), { rename: flip }).taps.length, 0);
  assert.ok(seat(rest(0.8), rest(0.84), { rename: flip }).handed.every((fs) => !fs[0].lifted));
  const apart = seat(rest(0.8), rest(0.84), { rename: flip, lanes: {} }).handed; // separate feet: the flips read as lifts
  assert.ok(apart.some((fs) => fs.some((f) => f.lifted)), "the flips fool the two-foot detector");
  // and a real tap still counts with names flipping
  assert.deepEqual(seat(rest(0.8), upBetween(0.84, 500, 700, 0.09), { rename: flip }).taps.map((x) => x.atMs), [700]);
});

// The cost of one signal: the highest foot. A foot resting lower in the picture than the other (nearer the camera) has to rise past
// the other foot before the seat counts as lifted. On the real recording the two feet rest about 0.01 to 0.02 apart.
test("seat mode: a lower foot lifted by less than the gap to the other foot is not seen, past the gap it is", () => {
  assert.equal(seat(rest(0.8), upBetween(0.84, 500, 700, 0.05)).taps.length, 0); // up to 0.79: only 0.01 above the other foot
  assert.equal(seat(rest(0.8), upBetween(0.84, 500, 700, 0.07)).taps.length, 1); // up to 0.77: 0.03 above it
});

test("seat mode: a foot that drops out and comes back, even for two seconds, is not a lift or a tap", () => {
  const higher = (t) => (t >= 1000 && t < 3000 ? undefined : 0.8); // the higher foot is the one that goes
  const { taps, handed } = seat(higher, rest(0.84), { to: 6000 });
  assert.equal(taps.length, 0);
  assert.ok(handed.every((fs) => fs.every((f) => !f.lifted)));
  // the lower one going is no jump at all
  assert.equal(seat(rest(0.8), (t) => (t >= 1000 && t < 3000 ? undefined : 0.84), { to: 6000 }).taps.length, 0);
});

test("seat mode: a lone foot works, jitter gives nothing, and a foot held up for two seconds taps once when it lands", () => {
  assert.deepEqual(seat(upBetween(0.8, 500, 700), () => undefined).taps.map((x) => x.atMs), [700]);
  assert.equal(seat((t) => 0.8 + ((t / 20) % 2 ? 0.003 : -0.003), rest(0.84)).taps.length, 0);
  const held = seat(rest(0.8), upBetween(0.84, 500, 2500, 0.09), { to: 4000 });
  assert.deepEqual(held.taps.map((x) => x.atMs), [2500]);
  assert.ok(held.handed.slice(Math.round(600 / 20), Math.round(2400 / 20)).every((fs) => fs[0].lifted));
});

test("seat mode: only the seats with one lane are merged; a seat with two lanes keeps both feet, and seats do not mix", () => {
  const det = createTapDetector();
  const feet = [0, 1].flatMap((foot) => [1, 2].map((spotId) => ({ spotId, foot, x: 0.3, y: 0.8 + foot * 0.04, shin: 0.2 })));
  const r = det.update(0, feet, { 1: 1, 2: 2 });
  assert.equal(r.feet.filter((f) => f.spotId === 1).length, 1);
  assert.equal(r.feet.filter((f) => f.spotId === 2).length, 2);
  // seat 1 (one lane) lifts one foot; seat 2 (two lanes) does nothing
  const up = det.update(100, feet.map((f) => (f.spotId === 1 && f.foot === 1 ? { ...f, y: f.y - 0.09 } : f)), { 1: 1, 2: 2 });
  assert.deepEqual(up.feet.filter((f) => f.lifted).map((f) => f.spotId), [1]);
  const down = det.update(200, feet, { 1: 1, 2: 2 });
  assert.deepEqual(down.taps, [{ spotId: 1, foot: 0, atMs: 200 }]);
});

test("seat mode: a seat that goes from two lanes to one does not carry a stale lift", () => {
  const det = createTapDetector();
  const feet = (up) => [{ spotId: 1, foot: 0, x: 0.3, y: 0.8 - up, shin: 0.2 }, { spotId: 1, foot: 1, x: 0.4, y: 0.84, shin: 0.2 }];
  for (let t = 0; t < 400; t += 20) det.update(t, feet(0), {});
  assert.equal(det.update(400, feet(0.06), {}).feet.find((f) => f.foot === 0).lifted, true); // lifted in two-lane mode
  const r = det.update(420, feet(0), ONE); // the next song has one lane: this seat starts its own track
  assert.deepEqual(r.feet.map((f) => f.lifted), [false]);
});
