import test from "node:test";
import assert from "node:assert/strict";
import { keepable, rank, twoSongs, rideLeft } from "./after.js";
import { songs } from "../songs/index.js";
import { songSeconds } from "../game/engine.js";

const player = (spotId, score, bonus = 0, over = {}) => ({ clientId: `c${spotId}`, spotId, score, bonus, bonusFor: bonus ? "Best combo" : null, maxCombo: 10, counts: { perfect: 5, good: 2, miss: 1 }, grade: "B", ...over });

test("rank puts the best total first, and a total is score plus bonus", () => {
  const rows = rank([player(1, 872, 25), player(2, 1019, 50), player(3, 401), player(4, 942)], "c1");
  assert.deepEqual(rows.map((r) => [r.spotId, r.total, r.place]), [[2, 1069, 1], [4, 942, 2], [1, 897, 3], [3, 401, 4]]);
});

test("a bonus can lift a seat over one with a higher score", () => {
  const rows = rank([player(1, 990), player(2, 960, 50)], "c1");
  assert.deepEqual(rows.map((r) => r.spotId), [2, 1]);
});

test("equal totals share a place and keep seat order", () => {
  const rows = rank([player(3, 500), player(1, 500), player(2, 100)], "c1");
  assert.deepEqual(rows.map((r) => [r.spotId, r.place]), [[1, 1], [3, 1], [2, 3]]);
});

test("rows mark the seats of this phone, and carry perfects and best combo", () => {
  const rows = rank([player(1, 100, 0, { clientId: "me", maxCombo: 14 }), player(2, 50)], "me");
  assert.deepEqual(rows.map((r) => r.mine), [true, false]);
  assert.equal(rows[0].maxCombo, 14);
  assert.equal(rows[0].perfects, 5);
});

test("a finished song is kept only when this phone has a seat in it", () => {
  const state = { status: "results", song: { id: "twinkle", title: "Twinkle", seconds: 29 }, players: [player(1, 10), player(2, 20)], team: { score: 30 }, train: null, transit: null };
  assert.deepEqual(keepable(state, "c2").mine, [2]);
  assert.equal(keepable(state, "someone-else"), null);
  assert.equal(keepable({ ...state, status: "playing" }, "c2"), null);
  assert.equal(keepable({ ...state, status: "lobby" }, "c2"), null);
});

test("two songs: the two longest that fit the ride, never the one just played", () => {
  const left = 400;
  const longestFirst = songs.filter((s) => songSeconds(s) + 4 <= left - 20).reverse();
  assert.ok(longestFirst.length >= 3);
  assert.deepEqual(twoSongs(left, "nothing").map((s) => s.id), longestFirst.slice(0, 2).map((s) => s.id));
  assert.deepEqual(twoSongs(left, longestFirst[0].id).map((s) => s.id), longestFirst.slice(1, 3).map((s) => s.id));
});

test("two songs: with no ride left or an unknown end, the two shortest", () => {
  const shortest = songs.slice(0, 2).map((s) => s.id);
  assert.deepEqual(twoSongs(-30, "x").map((s) => s.id), shortest);
  assert.deepEqual(twoSongs(NaN, "x").map((s) => s.id), shortest);
  assert.deepEqual(twoSongs(NaN, shortest[0]).map((s) => s.id), [shortest[1], songs[2].id]);
});

test("two songs: a ride with room for one is still offered two, none twice", () => {
  const room = songSeconds(songs[0]) + 4 + 20 + 0.01; // only the shortest song fits
  assert.deepEqual(twoSongs(room, "x").map((s) => s.id), [songs[0].id, songs[1].id]);
  assert.deepEqual(twoSongs(room, songs[0].id).map((s) => s.id), [songs[1].id, songs[2].id]);
});

test("ride left is in seconds, or NaN with no end", () => {
  assert.equal(rideLeft({ endsAt: 70000 }, 10000), 60);
  assert.ok(Number.isNaN(rideLeft(null)));
  assert.ok(Number.isNaN(rideLeft({ endsAt: null })));
});
