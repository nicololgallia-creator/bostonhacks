// The rules behind the floor's reactions: when a lane heats, when a streak breaks, which tiles are the whole team's,
// where a floater is on its way to the score, who just took the lead in a duel.
import test from "node:test";
import assert from "node:assert/strict";
import { heatOf, breaksStreak, shakeOffset, sameMoment, everyoneHas, everyoneLanded, flightAt } from "./floor-fx.js";
import { newLeaders, leaderMask } from "./floor-duel.js";

test("a lane heats at 10, 25 and 50 in a row, the same steps as the combo multiplier", () => {
  assert.deepEqual([0, 9, 10, 24, 25, 49, 50, 200].map(heatOf), [0, 0, 1, 1, 2, 2, 3, 3]);
});

test("only a streak of 10 or more breaks with a shake", () => {
  assert.equal(breaksStreak(10, 0), true);
  assert.equal(breaksStreak(37, 0), true);
  assert.equal(breaksStreak(9, 0), false);
  assert.equal(breaksStreak(12, 13), false); // still going
  assert.equal(breaksStreak(0, 0), false);
});

test("the shake is two small swings that are over in 220 ms", () => {
  assert.equal(shakeOffset(-5, 8), 0);
  assert.equal(shakeOffset(0, 8), 0);
  assert.equal(shakeOffset(220, 8), 0);
  assert.equal(shakeOffset(5000, 8), 0);
  for (let age = 1; age < 220; age += 3) assert.ok(Math.abs(shakeOffset(age, 8)) <= 8);
  assert.ok(shakeOffset(27, 8) > 0 && shakeOffset(82, 8) < 0); // out, then back the other way
});

const tile = (v, state = "waiting") => ({ id: 1, v, state });

test("a tile every pad has at the same moment was given to everyone", () => {
  const pads = [{ tiles: [tile(0.2), tile(0.5)] }, { tiles: [tile(0.5)] }, { tiles: [tile(0.5), tile(0.9)] }];
  assert.equal(everyoneHas(pads, 0.5), true);
  assert.equal(everyoneHas(pads, 0.2), false); // only one pad has it
  assert.equal(everyoneHas([pads[0]], 0.5), false); // a lone player has nobody to share with
  assert.equal(sameMoment(pads[0].tiles, 0.5001).v, 0.5);
  assert.equal(sameMoment(pads[0].tiles, 0.51), null); // 33 ms of song apart is another tile
});

test("everyone has landed it only when every pad's tile is hit or held", () => {
  const some = [{ tiles: [tile(0.7, "hit")] }, { tiles: [tile(0.7, "waiting")] }];
  assert.equal(everyoneLanded(some, 0.7), false);
  some[1].tiles[0].state = "holding";
  assert.equal(everyoneLanded(some, 0.7), true);
  some[1].tiles[0].state = "missed";
  assert.equal(everyoneLanded(some, 0.7), false); // one player missed: no flash
});

test("a floater goes up its lane first, then across to the score, and ends on it", () => {
  const out = {};
  flightAt(0, 100, 600, 640, 100, out);
  assert.deepEqual([out.x, out.y], [100, 600]);
  flightAt(0.3, 100, 600, 640, 100, out);
  assert.equal(out.x, 100); // still in its lane
  assert.ok(out.y < 400);
  flightAt(1, 100, 600, 640, 100, out);
  assert.deepEqual([out.x, out.y], [640, 100]);
});

test("a duel's lead changes hands only when the old leader no longer leads", () => {
  assert.equal(newLeaders(0, 0b001), 0); // the first score of the song is not a handover
  assert.equal(newLeaders(0b001, 0b001), 0);
  assert.equal(newLeaders(0b001, 0b010), 0b010); // seat 1 led, now seat 2 does
  assert.equal(newLeaders(0b001, 0b011), 0); // seat 2 caught up to a tie: not a handover
  assert.equal(newLeaders(0b011, 0b001), 0); // pulling ahead of a tie is not one either
  assert.equal(newLeaders(0b011, 0b100), 0b100);
});

test("the leaders are the seats on the top score once it is above zero", () => {
  assert.equal(leaderMask([-1, 0, 0, -1]), 0);
  assert.equal(leaderMask([-1, 200, 100, -1]), 0b0010);
  assert.equal(leaderMask([-1, 200, 200, 50]), 0b0110);
});
