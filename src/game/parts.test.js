import test from "node:test";
import assert from "node:assert/strict";
import { splitParts, lanesInPad } from "./parts.js";
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

// Each note of the song, by beat, with its lane on the whole keyboard (seat * lanes in a pad + lane).
const keyboard = (parts) => new Map(parts.flatMap((p, seat) => p.notes.map((n) => [n.beat, { midi: n.midi, lane: seat * lanesInPad(parts.length) + n.lane }])).sort((a, b) => a[0] - b[0]));
const loads = (parts) => parts.flatMap((p) => Array.from({ length: lanesInPad(parts.length) }, (_, l) => p.notes.filter((n) => n.lane === l).length));

// Every rule in the card, for one song and each seat count.
function checkAll(song) {
  const snapshot = JSON.stringify(song);
  for (let seats = 1; seats <= 4; seats++) {
    const parts = splitParts(song, seats);
    const perSeat = lanesInPad(seats);
    const lanes = seats * perSeat; // 2, 2, 3, 4
    assert.equal(parts.length, seats);
    assert.deepEqual(parts, splitParts(song, seats), "same input, same parts");
    // Every note of the song lands on exactly one seat. A lone seat's notes use lanes 0 and 1, every other seat's are all lane 0.
    assert.equal(parts.reduce((n, p) => n + p.notes.length, 0), song.notes.length, `${seats} seats: every note once`);
    assert.equal(keyboard(parts).size, song.notes.length, "no note on two seats");
    parts.forEach((part) => {
      for (const key of ["id", "title", "by", "bpm", "backing"]) assert.deepEqual(part[key], song[key]);
      assert.ok(part.notes.every((n) => n.lane >= 0 && n.lane < perSeat), `a note's lane is below ${perSeat}`);
      assert.ok(part.notes.every((n, i) => i === 0 || n.beat > part.notes[i - 1].beat), "notes stay in order");
    });
    // A lone seat's notes use both lanes (one for each foot) once it has two notes to give.
    if (seats === 1 && song.notes.length >= 2) assert.deepEqual([...new Set(parts[0].notes.map((n) => n.lane))].sort(), [0, 1], "a lone seat uses both lanes");
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
    // No seat has more than two notes more than another, once there are enough notes for the keyboard to fill.
    if (song.notes.length >= 4 * lanes && seats > 1) {
      const sizes = parts.map((p) => p.notes.length);
      assert.ok(Math.max(...sizes) - Math.min(...sizes) <= 2, `${song.id}, ${seats} seats: ${sizes}`);
    }
    if (song.notes.length >= lanes) parts.forEach((part, s) => assert.ok(part.notes.length > 0, `seat ${s + 1} of ${seats} is empty`));
  }
  assert.equal(JSON.stringify(song), snapshot, "the input song is not changed");
}

test("lanes in a pad: 2 for none or one seat taken, 1 for two, three or four", () => {
  assert.deepEqual([0, 1, 2, 3, 4].map(lanesInPad), [2, 2, 1, 1, 1]);
});

test("one seat: the whole song over 2 lanes, low on the left", () => {
  const [only] = splitParts(ladder, 1);
  assert.deepEqual(only.notes.map((n) => [n.midi, n.lane]), [[60, 0], [62, 0], [64, 0], [65, 0], [67, 1], [69, 1], [71, 1], [72, 1]]);
});

test("two, three and four seats: one lane a seat, every note lane 0, the song spread over 2, 3 and 4 lanes", () => {
  const [a, b] = splitParts(ladder, 2);
  assert.deepEqual(a.notes.map((n) => [n.midi, n.lane]), [[60, 0], [62, 0], [64, 0], [65, 0]]);
  assert.deepEqual(b.notes.map((n) => [n.midi, n.lane]), [[67, 0], [69, 0], [71, 0], [72, 0]]);
  const three = splitParts(ladder, 3);
  assert.deepEqual(three.map((p) => p.notes.map((n) => n.midi)), [[60, 62, 64], [65, 67], [69, 71, 72]]);
  const four = splitParts(ladder, 4);
  assert.deepEqual(four.map((p) => p.notes.map((n) => n.midi)), [[60, 62], [64, 65], [67, 69], [71, 72]]);
  for (const parts of [three, four]) assert.ok(parts.every((p) => p.notes.every((n) => n.lane === 0)));
});

test("a pitch that is played much more takes more width: its notes share the lanes and alternate", () => {
  // Six notes on 60 and two on 72, one seat: 60 covers 1.5 lanes, so lane 0 gets 4 of its notes and lane 1 gets 2,
  // dealt in time order. 72 sits inside lane 1, so lane 1 ends with 4 notes too.
  const song = made([60, 60, 60, 60, 60, 60, 72, 72]);
  const [only] = splitParts(song, 1);
  assert.deepEqual(only.notes.map((n) => n.lane), [0, 1, 0, 0, 1, 0, 1, 1]);
  assert.deepEqual(loads([only]), [4, 4]);
});

test("a note repeated many times is dealt round the lanes instead of hammering one", () => {
  const same = made(Array(8).fill(60));
  assert.deepEqual(splitParts(same, 1)[0].notes.map((n) => n.lane), [0, 1, 0, 1, 0, 1, 0, 1]);
  const two = splitParts(same, 2); // two lanes, one a seat, taken in turn
  assert.deepEqual([...keyboard(two).values()].map((k) => k.lane), [0, 1, 0, 1, 0, 1, 0, 1]);
  assert.deepEqual(two.map((p) => p.notes.length), [4, 4]);
  assert.deepEqual(splitParts(same, 4).map((p) => p.notes.length), [2, 2, 2, 2]);
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

