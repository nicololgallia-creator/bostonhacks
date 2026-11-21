import test from "node:test";
import assert from "node:assert/strict";
import { createFakeFloor } from "./mock.js";
import { COUNTDOWN_MS } from "../stage/session.js";

// Time moves in 100 ms ticks; the phone says "here" every 3 s, as the app does, so the floor keeps its seats.
const run = (floor, from, ms) => { for (let t = from; t <= from + ms; t += 100) { if (t % 3000 === 0) floor.apply({ type: "here", clientId: "me" }, t); floor.tick(t); } return from + ms; };

test("the fake floor opens with another phone holding seat 2", () => {
  const floor = createFakeFloor({ seats: 3 });
  floor.tick(0);
  const state = floor.state(0);
  assert.equal(state.type, "state");
  assert.equal(state.status, "lobby");
  assert.deepEqual(state.layout.spots.map((s) => s.id), [1, 2, 3]);
  assert.deepEqual(state.players.map((p) => p.spotId), [2]);
  assert.equal(state.train.line, "Green-B");
});

test("a phone joins, takes two seats, starts a song, and the floor counts down and plays to the end", () => {
  const floor = createFakeFloor({ seats: 3 });
  floor.tick(0);
  floor.apply({ type: "join", clientId: "me" }, 0);
  floor.apply({ type: "claim", clientId: "me", spotId: 1 }, 0);
  floor.apply({ type: "claim", clientId: "me", spotId: 3 }, 0);
  floor.apply({ type: "claim", clientId: "me", spotId: 2 }, 0); // already taken by the other phone
  assert.equal(floor.state(0).notice.text, "That seat is taken.");
  floor.apply({ type: "start", clientId: "me", songIds: ["twinkle"], transit: { stop: "Kenmore", mode: "train", endsAt: 600000 } }, 0);
  let state = floor.state(0);
  assert.equal(state.status, "countdown");
  assert.equal(state.song.id, "twinkle");
  assert.deepEqual(state.players.map((p) => p.spotId), [1, 2, 3]);
  assert.equal(state.transit.stop, "Kenmore");
  let t = run(floor, 100, COUNTDOWN_MS + 200);
  assert.equal(floor.state(t).status, "playing");
  t = run(floor, t, 12000);
  state = floor.state(t);
  assert.equal(state.status, "playing");
  assert.ok(state.team.score > 0, "the fake player scores");
  assert.ok(state.players.some((p) => p.counts.miss > 0), "and misses a few");
  while (floor.state(t).status === "playing" && t < 120000) t = run(floor, t, 100);
  assert.equal(floor.state(t).status, "results");
  assert.ok(floor.state(t).players.every((p) => p.grade), "every seat has a grade");
});

test("the other phone keeps its seat for longer than the ten second rule", () => {
  const floor = createFakeFloor({ seats: 3 });
  const t = run(floor, 0, 30000);
  assert.deepEqual(floor.state(t).players.map((p) => p.spotId), [2]);
});

test("a stop before anyone holds a seat is refused with the stage's own words", () => {
  const floor = createFakeFloor({ seats: 2, others: [] });
  floor.tick(0);
  floor.apply({ type: "join", clientId: "me" }, 0);
  floor.apply({ type: "start", clientId: "me", songIds: ["twinkle"], transit: null }, 0);
  assert.equal(floor.state(0).notice.text, "Pick a seat before starting.");
});
