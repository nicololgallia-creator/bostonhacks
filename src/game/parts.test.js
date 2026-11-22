import test from "node:test";
import assert from "node:assert/strict";
import { splitParts, lanesInPad } from "./parts.js";
import { MIN_GAP_MS, ALTERNATE_MS } from "./chart.js";
import { songs } from "../songs/index.js";

// A made-up song from a list of pitches, one note a beat, a second apart.
const made = (midis, extra = {}) => ({
  id: "made", title: "Made up", by: "Test", bpm: 60, ...extra,
  notes: midis.map((midi, i) => ({ beat: i, midi, beats: 0.4 })),
});
const ladder = made([60, 62, 64, 65, 67, 69, 71, 72]);

const deepFreeze = (o) => {
  Object.values(o).forEach((v) => typeof v === "object" && v !== null && deepFreeze(v));
  return Object.freeze(o);
};

// The rules every part follows, for one song, seat count and mode. The chart rules themselves are in chart.test.js.
function checkShape(song, seats, mode) {
  const snapshot = JSON.stringify(song);
  const parts = splitParts(song, seats, { mode });
  const perSeat = lanesInPad(seats);
  const where = `${song.id}, ${seats} seats, ${mode}`;
  assert.equal(parts.length, seats, where);
  assert.deepEqual(parts, splitParts(song, seats, { mode }), `${where}: same input, same parts`);
  const beatMs = 60000 / song.bpm;
  parts.forEach((part) => {
    for (const key of ["id", "title", "by", "bpm", "backing"]) assert.deepEqual(part[key], song[key], where);
    part.notes.forEach((n, i) => {
      assert.ok(Number.isFinite(n.beat) && Number.isFinite(n.midi) && n.beats > 0, `${where}: a note is whole`);
      assert.ok(Number.isInteger(n.lane) && n.lane >= 0 && n.lane < perSeat, `${where}: a note's lane is below ${perSeat}`);
      assert.equal(typeof n.hold, "boolean", where);
      if (i) assert.ok((n.beat - part.notes[i - 1].beat) * beatMs >= MIN_GAP_MS - 1e-6, `${where}: tiles at least ${MIN_GAP_MS} ms apart`);
    });
  });
  assert.equal(JSON.stringify(song), snapshot, "the input song is not changed");
  return parts;
}

test("lanes in a pad: 2 for none or one seat taken, 1 for two, three or four", () => {
  assert.deepEqual([0, 1, 2, 3, 4].map(lanesInPad), [2, 2, 1, 1, 1]);
});

test("a wrong seat count or mode gets a plain message", () => {
  for (const bad of [0, 5, 2.5, "2", undefined]) assert.throws(() => splitParts(ladder, bad), /1 to 4 players/);
  assert.throws(() => splitParts(ladder, 2, { mode: "solo" }), /"team" or "versus"/);
});

test("a song with no notes gives empty parts, in both modes", () => {
  for (const mode of ["team", "versus"]) {
    assert.deepEqual(splitParts({ id: "x", bpm: 60, notes: [] }, 2, { mode }).map((p) => p.notes), [[], []]);
  }
});

test("one seat has two lanes, the other seat counts have one lane each", () => {
  assert.deepEqual([...new Set(splitParts(ladder, 1)[0].notes.map((n) => n.lane))].sort(), [0, 1]);
  for (const seats of [2, 3, 4]) {
    splitParts(made(Array(24).fill(60)), seats).forEach((p) => assert.ok(p.notes.every((n) => n.lane === 0)));
  }
});

test("a lone player's feet take turns when the tiles are close, and pitch picks where they are far apart", () => {
  const [only] = splitParts(ladder, 1); // a second apart: under ALTERNATE_MS the foot changes, over it pitch decides
  assert.ok(ALTERNATE_MS <= 1000);
  const far = splitParts(made([60, 72, 60, 72, 60, 72, 60, 72], { bpm: 30 }), 1)[0]; // two seconds apart: low is left, high is right
  assert.deepEqual(far.notes.map((n) => n.lane), [0, 1, 0, 1, 0, 1, 0, 1]);
  const close = splitParts(made([60, 60, 60, 60, 60, 60], { bpm: 120 }), 1)[0]; // half a second apart: always the other foot
  assert.ok(close.notes.every((n, i) => i === 0 || n.lane !== close.notes[i - 1].lane));
  assert.equal(only.notes.length, ladder.notes.length);
});

test("a deeply frozen input is accepted, and made-up songs keep the shape in every mode", () => {
  const songsMade = [
    ladder,
    made([60, 62, 60, 62]),
    made([48, 55, 60, 64, 67, 72, 76, 79, 84, 60, 55, 48]),
    made([60, 60, 60]),
    made(Array(40).fill(60)),
    made([...Array(30).fill(60), ...Array(6).fill(64), 67, 72]),
  ];
  for (const song of songsMade) for (const mode of ["team", "versus"]) for (let seats = 1; seats <= 4; seats++) checkShape(deepFreeze(song), seats, mode);
});

test("every real song keeps the shape for 1 to 4 players, in both modes", () => {
  for (const song of songs) for (const mode of ["team", "versus"]) for (let seats = 1; seats <= 4; seats++) checkShape(song, seats, mode);
});

test("every note of a real song that a foot can follow is on a tile for someone, with its own beat and pitch (team mode)", () => {
  for (const song of songs) {
    for (let seats = 1; seats <= 4; seats++) {
      const tiles = new Set(splitParts(song, seats).flatMap((p) => p.notes.map((n) => `${n.beat}:${n.midi}`)));
      // A tune note that starts under MIN_GAP_MS after the tile before it is left to the band: a foot cannot follow it (chart.js, melodyTiles).
      let last = -Infinity;
      for (const n of [...song.notes].sort((x, y) => x.beat - y.beat)) {
        const at = (n.beat * 60000) / song.bpm;
        if (at - last < MIN_GAP_MS) continue;
        last = at;
        assert.ok(tiles.has(`${n.beat}:${n.midi}`), `${song.id}, ${seats} seats: note at beat ${n.beat} is missing`);
      }
    }
  }
});
