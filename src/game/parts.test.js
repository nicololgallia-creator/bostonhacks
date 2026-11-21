import test from "node:test";
import assert from "node:assert/strict";
import { splitParts, phrasesOf } from "./parts.js";
import { songs } from "../songs/index.js";

// A made-up song from [beat, beats] pairs. Pitch does not matter to the split.
const made = (bpm, pairs, extra = {}) => ({
  id: "made", title: "Made up", by: "Test", bpm, ...extra,
  notes: pairs.map(([beat, beats], i) => ({ beat, midi: 60 + (i % 5), beats })),
});
const row = (start, count, beats = 1) => Array.from({ length: count }, (_, i) => [start + i * beats, beats]);
const ranges = (song) => phrasesOf(song).map((p) => [p.from, p.to]);

const deepFreeze = (o) => {
  Object.values(o).forEach((v) => typeof v === "object" && v !== null && deepFreeze(v));
  return Object.freeze(o);
};

const REAL = new Set(songs);
const OVER = []; // real songs that break the 2x balance, printed with the table

// Every rule in the card, for one song and each seat count.
function checkAll(song) {
  const snapshot = JSON.stringify(song);
  const phrases = phrasesOf(song);
  assert.equal(phrases[0].from, 0);
  assert.equal(phrases.at(-1).to, song.notes.length);
  phrases.slice(1).forEach((p, i) => assert.equal(p.from, phrases[i].to, "phrases touch with no gap or overlap"));
  const finale = phrases.at(-1);
  const beatsOf = (notes) => notes.map((n) => n.beat);

  assert.deepEqual(splitParts(song, 1), [song], "one seat gets the whole song");
  for (let seats = 1; seats <= 4; seats++) {
    const parts = splitParts(song, seats);
    assert.equal(parts.length, seats);
    assert.deepEqual(parts, splitParts(song, seats), "same input, same parts");
    parts.forEach((part) => {
      for (const key of ["id", "title", "by", "bpm", "backing"]) assert.deepEqual(part[key], song[key]);
      assert.ok(part.notes.every((n, i) => i === 0 || n.beat > part.notes[i - 1].beat), "notes stay in order");
    });
    // Before the finale every note is in exactly one part; the finale is in every part.
    phrases.forEach((p, i) => {
      for (const note of song.notes.slice(p.from, p.to)) {
        const holders = parts.filter((part) => beatsOf(part.notes).includes(note.beat)).length;
        assert.equal(holders, i === phrases.length - 1 ? seats : 1, `phrase ${i} note at beat ${note.beat}`);
      }
    });
    parts.forEach((part) => finale && assert.ok(beatsOf(song.notes.slice(finale.from)).every((b) => beatsOf(part.notes).includes(b))));
    if (phrases.length >= seats) parts.forEach((part) => assert.ok(part.notes.length > 0, "no empty part"));
    // Notes each seat has before the finale, and who got each phrase.
    const owner = phrases.slice(0, -1).map((p) => parts.findIndex((part) => beatsOf(part.notes).includes(song.notes[p.from].beat)));
    const before = parts.map((_, s) => phrases.slice(0, -1).reduce((sum, p, i) => sum + (owner[i] === s ? p.to - p.from : 0), 0));
    // Dealing to the seat with the fewest notes keeps seats within one phrase of each other.
    const biggest = Math.max(0, ...phrases.slice(0, -1).map((p) => p.to - p.from));
    assert.ok(Math.max(...before) - Math.min(...before) <= biggest, `notes before the finale ${before}`);
    // When a song has at least twice as many phrases as seats, no seat has more than twice another's
    // notes. A real song can break this when one phrase is far bigger than the rest: see the table.
    const unbalanced = seats > 1 && phrases.length >= 2 * seats && Math.max(...before) > 2 * Math.min(...before);
    if (REAL.has(song)) unbalanced && OVER.push(`${song.id} with ${seats} seats: ${before.join("/")}`);
    else assert.ok(!unbalanced, `notes before the finale ${before}`);
    // No seat plays two phrases in a row when another seat has fewer notes.
    const have = new Array(seats).fill(0);
    owner.forEach((s, i) => {
      if (seats > 1 && i > 0 && owner[i - 1] === s) assert.ok(have.every((n, o) => o === s || n >= have[s]), `seat ${s} twice in a row`);
      have[s] += phrases[i].to - phrases[i].from;
    });
  }
  assert.equal(JSON.stringify(song), snapshot, "the input song is not changed");
}

// At 120 bpm a beat is 0.5 s, so a 2-beat note is 1 s (a hold) and a 1-beat note is 0.5 s.
const LONG_END = made(120, [[0, 1], [1, 1], [2, 2], [4, 1], [5, 1], [6, 2], ...row(8, 4)]);

test("a note of 0.8 seconds or longer ends its phrase", () => {
  assert.deepEqual(ranges(LONG_END), [[0, 3], [3, 6], [6, 10]]);
  // 150 bpm is 0.4 s a beat: a 2-beat note is exactly 0.8 s and ends the phrase.
  assert.deepEqual(ranges(made(150, [...row(0, 5), [5, 2], ...row(7, 5)])), [[0, 6], [6, 11]]);
});

test("a note just under 0.8 seconds does not end a phrase", () => {
  // 1.95 beats is 0.78 s: the phrase runs on to the 4 second limit and the stub after it joins.
  assert.deepEqual(ranges(made(150, [...row(0, 5), [5, 1.95], ...row(6.95, 5)])), [[0, 11]]);
});

test("a silence of 0.6 seconds or longer ends the phrase before it", () => {
  // 100 bpm is 0.6 s a beat, so a one-beat gap is exactly 0.6 s.
  assert.deepEqual(ranges(made(100, [...row(0, 4), ...row(5, 4)])), [[0, 4], [4, 8]]);
  // A half-beat gap is 0.3 s: no break.
  assert.deepEqual(ranges(made(100, [...row(0, 4), [4.5, 1], [5.5, 1]])), [[0, 6]]);
});

test("a phrase that has run 4 seconds is closed", () => {
  // 120 bpm, half a second a beat, 24 notes of 0.5 s: three phrases of exactly 4 s.
  assert.deepEqual(ranges(made(120, row(0, 24))), [[0, 8], [8, 16], [16, 24]]);
});

test("a phrase is not closed before it has run 2 seconds: it runs on into the next", () => {
  // The lone 0.5 s note before a 1 s rest would end a phrase, but it has run only 0.5 s.
  const song = made(120, [[0, 1], [1, 1], [2, 2], [4, 1], ...row(7, 4)]);
  assert.deepEqual(ranges(song), [[0, 3], [3, 8]]);
});

test("a run of long notes under 2 seconds apart does not collapse the song into one phrase", () => {
  // 130 bpm, a long note every 0.9 s: phrases close at 2 s or more, never earlier.
  const song = made(130, Array.from({ length: 20 }, (_, i) => [i * 2, 2]));
  const phrases = phrasesOf(song);
  assert.ok(phrases.length >= 6, `only ${phrases.length} phrases`);
});

test("a short last phrase joins the one before it, so the finale is never a stub", () => {
  assert.deepEqual(ranges(made(120, [[0, 1], [1, 1], [2, 2], [6, 1]])), [[0, 4]]);
});

test("a short first phrase runs on into the next", () => {
  const song = made(120, [[0, 1], [3, 1], [4, 1], [5, 2], ...row(7, 4)]);
  assert.deepEqual(ranges(song), [[0, 4], [4, 8]]);
});

test("different beat sizes give the same phrases for the same seconds", () => {
  const fast = made(240, LONG_END.notes.map((n) => [n.beat * 2, n.beats * 2]));
  assert.deepEqual(ranges(fast), ranges(LONG_END));
});

test("two seats pass the tune from player to player and share the finale", () => {
  const [one, two] = splitParts(LONG_END, 2); // phrases A, B, finale
  assert.deepEqual(one.notes.map((n) => n.beat), [0, 1, 2, 8, 9, 10, 11]);
  assert.deepEqual(two.notes.map((n) => n.beat), [4, 5, 6, 8, 9, 10, 11]);
});

test("a song with fewer phrases than seats still gives every seat the finale", () => {
  const song = made(120, LONG_END.notes.slice(0, 6).map((n) => [n.beat, n.beats])); // 2 phrases, 4 seats
  const parts = splitParts(song, 4);
  assert.equal(phrasesOf(song).length, 2);
  assert.deepEqual(parts[0].notes.map((n) => n.beat), [0, 1, 2, 4, 5, 6]);
  for (const part of parts.slice(1)) assert.deepEqual(part.notes.map((n) => n.beat), [4, 5, 6]);
});

test("the finale lasts at least 2 seconds unless the whole song is shorter", () => {
  for (const song of [...songs, LONG_END, made(130, Array.from({ length: 20 }, (_, i) => [i * 2, 2]))]) {
    const phrases = phrasesOf(song);
    const last = song.notes.slice(phrases.at(-1).from);
    const seconds = ((last.at(-1).beat + last.at(-1).beats - last[0].beat) * 60) / song.bpm;
    assert.ok(phrases.length === 1 || seconds >= 2 - 1e-9, `${song.id} finale ${seconds}`);
  }
});

test("each phrase goes to the seat with the fewest notes, so one seat does not get far more", () => {
  const long = (b) => [[b, 1], [b + 1, 1], [b + 2, 2]]; // a 3-note, 2 second phrase
  const song = made(120, [...row(0, 8), ...long(8), ...long(12), ...long(16), ...long(20), ...row(24, 4)]);
  const [one, two] = splitParts(song, 2);
  const beats = (part) => part.notes.map((n) => n.beat).filter((b) => b < 24);
  assert.deepEqual(beats(one), [0, 1, 2, 3, 4, 5, 6, 7, 20, 21, 22]); // 8 notes, then 3 more
  assert.deepEqual(beats(two), [8, 9, 10, 12, 13, 14, 16, 17, 18]); // three phrases while behind
});

test("on a tie the seat that has waited longest gets the phrase", () => {
  const long = (b) => [[b, 1], [b + 1, 1], [b + 2, 2]];
  const song = made(120, [...long(0), ...long(4), ...long(8), ...long(12), ...row(16, 4)]);
  const [a, b, c] = splitParts(song, 3);
  const has = (part, beat) => part.notes.some((n) => n.beat === beat);
  assert.ok(has(a, 0) && has(b, 4) && has(c, 8), "first three phrases go to seats 1, 2, 3");
  assert.ok(has(a, 12) && !has(b, 12) && !has(c, 12), "all tied at 3 notes: seat 1 waited longest");
});

test("a one-phrase song gives every seat the whole song", () => {
  const song = made(60, [[0, 1], [1, 1]]);
  splitParts(song, 3).forEach((part) => assert.deepEqual(part.notes, song.notes));
});

test("backing is kept unchanged on every part", () => {
  const backing = [{ beat: 0, midi: 36, beats: 2 }, { beat: 0, drum: "kick" }];
  const song = made(60, row(0, 12), { backing });
  splitParts(song, 3).forEach((part) => assert.deepEqual(part.backing, backing));
  checkAll(song);
});

test("a deeply frozen input is accepted and the made-up songs pass every rule", () => {
  const songsMade = [
    made(60, [[0, 1], [1, 2], [3, 1], [4, 2], [6, 1], [7, 1]]),
    made(120, row(0, 24)),
    made(100, [...row(0, 4), ...row(5, 4), ...row(10, 4), ...row(15, 4)]),
    made(60, [[0, 1], [1, 1]]),
    made(90, row(0, 40, 0.75)),
  ];
  songsMade.forEach((song) => checkAll(deepFreeze(song)));
});

test("a song with no notes gives empty parts", () => {
  assert.deepEqual(phrasesOf({ bpm: 60, notes: [] }), []);
  assert.deepEqual(splitParts({ id: "x", bpm: 60, notes: [] }, 2).map((p) => p.notes), [[], []]);
});

test("a wrong seat count gets a plain message", () => {
  const song = made(60, row(0, 4));
  for (const bad of [0, 5, 2.5, "2", undefined]) {
    assert.throws(() => splitParts(song, bad), /1 to 4 players/);
  }
});

test("every real song passes every rule, with the table printed", () => {
  const lines = ["song".padEnd(26) + "phrases  notes  2 seats   3 seats   4 seats"];
  for (const song of songs) {
    checkAll(song);
    const sizes = [2, 3, 4].map((n) => splitParts(song, n).map((p) => p.notes.length).join("/"));
    lines.push(
      song.id.padEnd(26) + String(phrasesOf(song).length).padEnd(9) + String(song.notes.length).padEnd(7) +
        sizes.map((s) => s.padEnd(10)).join(""),
    );
  }
  console.log("\n" + lines.join("\n"));
  console.log("Over 2x before the finale (phrases >= 2 x seats): " + (OVER.join("; ") || "none"));
});
