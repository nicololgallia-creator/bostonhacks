import { test } from "node:test";
import assert from "node:assert/strict";
import { pickSongs, APPROVED } from "./pick.js";
import { songs, songById } from "./index.js";
import { songSeconds } from "../game/engine.js";

const cost = (id) => songSeconds(songById(id)) + 4;
const sum = (ids) => ids.reduce((t, id) => t + cost(id), 0);

test("never over the budget, never repeats, longest first, total matches the songs", () => {
  for (let seconds = 0; seconds <= 2400; seconds += 7) {
    const r = pickSongs({ seconds });
    assert.ok(r.totalSeconds <= Math.max(0, seconds - 20) + 1e-9, `${seconds} s: over budget`);
    assert.equal(new Set(r.songIds).size, r.songIds.length, `${seconds} s: repeats a song`);
    assert.ok(Math.abs(sum(r.songIds) - r.totalSeconds) < 1e-9);
    for (let i = 1; i < r.songIds.length; i++) assert.ok(cost(r.songIds[i - 1]) >= cost(r.songIds[i]));
  }
});

test("a wait too short for the shortest song does not fit", () => {
  const shortest = cost(songs[0].id);
  for (const seconds of [-5, 0, 30, Math.floor(shortest + 20) - 1]) {
    assert.deepEqual(pickSongs({ seconds }), { songIds: [], totalSeconds: 0, fits: false });
  }
  assert.equal(pickSongs({ seconds: shortest + 20 + 0.5 }).fits, true);
});

test("a 3 minute wait lands within 20 seconds of the budget", () => {
  const r = pickSongs({ seconds: 180 });
  assert.ok(r.fits && r.totalSeconds <= 160 && r.totalSeconds >= 140, `got ${r.totalSeconds}`);
});

test("a 30 minute wait returns every approved song once", () => {
  const r = pickSongs({ seconds: 1800 });
  assert.deepEqual([...r.songIds].sort(), [...APPROVED].sort());
});

test("the approved list names real songs, eleven of them", () => {
  assert.equal(APPROVED.length, 11);
  for (const id of APPROVED) assert.ok(songById(id), id);
});

test("a recommendation is made of approved songs only, for every ride length on Green B", () => {
  for (const minutes of [1, 3, 5, 8, 11, 13, 16, 18, 20]) {
    const r = pickSongs({ seconds: minutes * 60 });
    console.log(`ride ${String(minutes).padStart(2)} min: ${r.songIds.join(", ") || "(none fits)"}`);
    assert.ok(r.songIds.every((id) => APPROVED.includes(id)), `${minutes} min: ${r.songIds}`);
  }
  // Under 1:00 only the shortest songs fit, and Nicolo's list covers them.
  assert.equal(pickSongs({ seconds: 60 }).fits, true);
});

test("the same input gives the same answer, and a buffer of 0 uses the whole wait", () => {
  assert.deepEqual(pickSongs({ seconds: 240 }), pickSongs({ seconds: 240 }));
  assert.ok(pickSongs({ seconds: 240, buffer: 0 }).totalSeconds > pickSongs({ seconds: 240 }).totalSeconds);
});

test("a wait that is not a number throws a plain message", () => {
  assert.throws(() => pickSongs({ seconds: "soon" }), /number of seconds/);
  assert.throws(() => pickSongs({ seconds: NaN }), /number of seconds/);
});
