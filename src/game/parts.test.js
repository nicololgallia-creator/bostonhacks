import test from "node:test";
import assert from "node:assert/strict";
import { splitParts } from "./parts.js";
import { songs } from "../songs/index.js";

// A made-up song from a list of pitches, one note a beat.
const made = (midis, extra = {}) => ({
  id: "made", title: "Made up", by: "Test", bpm: 60, ...extra,
  notes: midis.map((midi, i) => ({ beat: i, midi, beats: 1 })),
});
const ladder = made([60, 62, 64, 65, 67, 69, 71, 72]); // eight pitches, one note each
const distinct = (song) => new Set(song.notes.map((n) => n.midi)).size;

const deepFreeze = (o) => {
  Object.values(o).forEach((v) => typeof v === "object" && v !== null && deepFreeze(v));
  return Object.freeze(o);
};

// Each note of the song, by beat, with its lane on the whole keyboard (seat * 2 + lane).
const keyboard = (parts) => new Map(parts.flatMap((p, seat) => p.notes.map((n) => [n.beat, { midi: n.midi, lane: seat * 2 + n.lane }])).sort((a, b) => a[0] - b[0]));
const loads = (parts) => parts.flatMap((p) => [0, 1].map((l) => p.notes.filter((n) => n.lane === l).length));

// Every rule in the card, for one song and each seat count.
function checkAll(song) {
  const snapshot = JSON.stringify(song);
  for (let seats = 1; seats <= 4; seats++) {
    const parts = splitParts(song, seats);
    const lanes = seats * 2;
    assert.equal(parts.length, seats);
    assert.deepEqual(parts, splitParts(song, seats), "same input, same parts");
    // Every note of the song lands on exactly one seat and one of that seat's 2 lanes.
    assert.equal(parts.reduce((n, p) => n + p.notes.length, 0), song.notes.length, `${seats} seats: every note once`);
    assert.equal(keyboard(parts).size, song.notes.length, "no note on two seats");
    parts.forEach((part) => {
      for (const key of ["id", "title", "by", "bpm", "backing"]) assert.deepEqual(part[key], song[key]);
      assert.ok(part.notes.every((n) => n.lane === 0 || n.lane === 1), "a note's lane is 0 or 1");
      assert.ok(part.notes.every((n, i) => i === 0 || n.beat > part.notes[i - 1].beat), "notes stay in order");
    });
    // Low on the left: a lower pitch's rightmost lane is never right of a higher pitch's leftmost lane.
    const span = new Map();
    for (const { midi, lane } of keyboard(parts).values()) {
      const s = span.get(midi) ?? { min: lane, max: lane };
      span.set(midi, { min: Math.min(s.min, lane), max: Math.max(s.max, lane) });
    }
    const pitches = [...span.keys()].sort((a, b) => a - b);
    pitches.slice(1).forEach((q, i) => assert.ok(span.get(pitches[i]).max <= span.get(q).min, `${pitches[i]} is left of ${q}`));
    // Balanced: with at least 4 notes for each lane, no lane has more than twice the average, and no seat is empty.
    const load = loads(parts);
    if (song.notes.length >= 4 * lanes) {
      const average = song.notes.length / lanes;
      assert.ok(Math.max(...load) <= 2 * average, `${seats} seats: lane loads ${load}`);
    }
    if (song.notes.length >= lanes) parts.forEach((part, s) => assert.ok(part.notes.length > 0, `seat ${s + 1} of ${seats} is empty`));
  }
  assert.equal(JSON.stringify(song), snapshot, "the input song is not changed");
}

test("one pitch a note: the keyboard is cut into equal lanes, low on the left", () => {
  const [only] = splitParts(ladder, 1);
  assert.deepEqual(only.notes.map((n) => [n.midi, n.lane]), [[60, 0], [62, 0], [64, 0], [65, 0], [67, 1], [69, 1], [71, 1], [72, 1]]);
  const [a, b] = splitParts(ladder, 2);
  assert.deepEqual(a.notes.map((n) => [n.midi, n.lane]), [[60, 0], [62, 0], [64, 1], [65, 1]]);
  assert.deepEqual(b.notes.map((n) => [n.midi, n.lane]), [[67, 0], [69, 0], [71, 1], [72, 1]]);
});

test("three and four seats number the lanes left to right across the seats", () => {
  // 6 lanes over 8 notes: each lane has 8/6 notes, so a pitch can sit across a lane edge: a lone note goes to the lane that holds most of its width.
  const three = splitParts(ladder, 3);
  assert.equal(three.reduce((n, p) => n + p.notes.length, 0), 8);
  assert.deepEqual([...keyboard(three).values()].map((k) => k.lane), [0, 1, 1, 2, 3, 4, 4, 5]);
  const four = splitParts(ladder, 4);
  assert.deepEqual(four.map((p) => p.notes.map((n) => n.lane)), [[0, 1], [0, 1], [0, 1], [0, 1]]);
});

test("a pitch that is played much more takes more width: its notes share the lanes and alternate", () => {
  // Six notes on 60 and two on 72, one seat: 60 covers 1.5 lanes, so lane 0 gets 4 of its notes and lane 1 gets 2,
  // dealt in time order. 72 sits inside lane 1, so lane 1 ends with 4 notes too.
  const song = made([60, 60, 60, 60, 60, 60, 72, 72]);
  const [only] = splitParts(song, 1);
  assert.deepEqual(only.notes.map((n) => n.lane), [0, 1, 0, 0, 1, 0, 1, 1]);
  assert.deepEqual(loads([only]), [4, 4]);
});

test("a note repeated many times alternates between neighbouring feet instead of hammering one", () => {
  const same = made(Array(8).fill(60));
  assert.deepEqual(splitParts(same, 1)[0].notes.map((n) => n.lane), [0, 1, 0, 1, 0, 1, 0, 1]);
  const two = splitParts(same, 2); // four lanes, taken in turn
  assert.deepEqual([...keyboard(two).values()].map((k) => k.lane), [0, 1, 2, 3, 0, 1, 2, 3]);
  assert.deepEqual(two.map((p) => p.notes.length), [4, 4]);
});

test("every seat plays at the same time: a part keeps its notes' own beats", () => {
  const [a, b] = splitParts(ladder, 2);
  assert.deepEqual(a.notes.map((n) => n.beat), [0, 1, 2, 3]);
  assert.deepEqual(b.notes.map((n) => n.beat), [4, 5, 6, 7]);
});

test("backing is kept unchanged on every part", () => {
  const backing = [{ beat: 0, midi: 36, beats: 2 }, { beat: 0, drum: "kick" }];
  const song = made([60, 62, 64, 65, 67, 69], { backing });
  splitParts(song, 3).forEach((part) => assert.deepEqual(part.backing, backing));
  checkAll(song);
});

test("a deeply frozen input is accepted and the made-up songs pass every rule", () => {
  const songsMade = [
    ladder,
    made([60, 62, 60, 62]),
    made([48, 55, 60, 64, 67, 72, 76, 79, 84, 60, 55, 48]),
    made([60, 60, 60]),
    made(Array(40).fill(60)),
    made([...Array(30).fill(60), ...Array(6).fill(64), 67, 72]),
    made(Array.from({ length: 40 }, (_, i) => 60 + ((i * 7) % 13))),
  ];
  songsMade.forEach((song) => checkAll(deepFreeze(song)));
});

test("a song with no notes gives empty parts", () => {
  assert.deepEqual(splitParts({ id: "x", bpm: 60, notes: [] }, 2).map((p) => p.notes), [[], []]);
});

test("a wrong seat count gets a plain message", () => {
  for (const bad of [0, 5, 2.5, "2", undefined]) {
    assert.throws(() => splitParts(ladder, bad), /1 to 4 players/);
  }
});

test("every real song passes every rule, with the table printed", () => {
  const lines = ["song".padEnd(26) + "notes  pitches  2 seats    3 seats       4 seats"];
  for (const song of songs) {
    checkAll(song);
    const sizes = [2, 3, 4].map((n) => splitParts(song, n).map((p) => p.notes.length).join("/"));
    lines.push(song.id.padEnd(26) + String(song.notes.length).padEnd(7) + String(distinct(song)).padEnd(9) + sizes.map((s) => s.padEnd(13)).join(""));
  }
  console.log("\n" + lines.join("\n"));
});

