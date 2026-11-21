import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createGame, lanesFor, laneOf, songSeconds, multiplierFor, gradeFor, ZONE_V } from "./engine.js";

const twinkle = JSON.parse(readFileSync(new URL("../../songs/twinkle.json", import.meta.url), "utf8"));
// Three tap notes, 120 bpm, so 500 ms apart. On 4 lanes: 60 is lane 0, 64 is lane 2, 67 is lane 3.
const tiny = { id: "tiny", bpm: 120, notes: [{ beat: 0, midi: 60, beats: 1 }, { beat: 1, midi: 64, beats: 1 }, { beat: 2, midi: 67, beats: 1 }] };
// Two taps in lane 0, 400 ms apart, and one note in lane 3.
const pair = { id: "pair", bpm: 150, notes: [{ beat: 0, midi: 60, beats: 1 }, { beat: 1, midi: 60, beats: 1 }, { beat: 5, midi: 67, beats: 1 }] };
// A 2 second hold in lane 0 (tail at 2000 ms), then a tap in lane 3.
const holdSong = { id: "hold", bpm: 120, notes: [{ beat: 0, midi: 60, beats: 4 }, { beat: 5, midi: 64, beats: 1 }] };
// Sixty taps 400 ms apart, alternating lanes 0 and 3.
const long = { id: "long", bpm: 150, notes: Array.from({ length: 60 }, (_, i) => ({ beat: i, midi: i % 2 ? 64 : 60, beats: 1 })) };

const L0 = [{ u: 0.1, v: 0.9 }]; // a foot in lane 0 of 4
const L3 = [{ u: 0.9, v: 0.9 }];
const NONE = [];

// Feeds frames every 20 ms from `from` to `to`; feetAt(t) says where the feet are.
function run(game, from, to, feetAt) {
  const events = [];
  let r;
  for (let t = from; t <= to; t += 20) {
    r = game.update(t, feetAt(t));
    events.push(...r.events);
  }
  return { r, events };
}
const types = (events) => events.map((e) => e.type);

test("lane counts follow the player count", () => {
  assert.deepEqual([1, 2, 3, 4].map(lanesFor), [4, 6, 8, 8]);
});

test("pitch maps to a lane, low on the left, evenly spread", () => {
  assert.equal(laneOf(twinkle, 60, 4), 0);
  assert.equal(laneOf(twinkle, 69, 4), 3);
  assert.equal(laneOf(twinkle, 60, 8), 0);
  assert.equal(laneOf(twinkle, 69, 8), 7);
  const lanes = [60, 62, 64, 65, 67, 69].map((m) => laneOf(twinkle, m, 8));
  assert.deepEqual(lanes, [...lanes].sort((a, b) => a - b));
  assert.equal(new Set(lanes).size, 6);
});

test("song length counts the last note's own length", () => {
  assert.equal(songSeconds(tiny), 1.5);
  assert.equal(songSeconds(twinkle), (48 * 60) / 100);
});

test("a foot arriving within 120 ms of a tap tile is perfect", () => {
  const r = createGame({ song: tiny, players: 1 }).update(-100, L0);
  assert.equal(r.counts.perfect, 1);
  assert.equal(r.score, 100);
  assert.deepEqual(r.events.map((e) => [e.type, e.grade, e.lane, e.midi]), [["hit", "perfect", 0, 60]]);
});

test("a foot arriving within 300 ms of a tap tile is good", () => {
  const r = createGame({ song: tiny, players: 1 }).update(200, L0);
  assert.equal(r.counts.good, 1);
  assert.equal(r.score, 50);
  assert.equal(r.events[0].grade, "good");
});

test("an arrival with no tile in reach costs nothing, and a tile nobody reaches is a miss", () => {
  const game = createGame({ song: tiny, players: 1 });
  const early = game.update(-320, L0);
  assert.equal(early.counts.good + early.counts.perfect + early.counts.miss, 0);
  assert.equal(early.events.length, 0);
  const late = game.update(320, L0);
  assert.equal(late.counts.miss, 1);
  assert.deepEqual(types(late.events), ["miss"]);
});

test("a foot in the wrong lane, or above the square, hits nothing", () => {
  const game = createGame({ song: tiny, players: 1 });
  assert.equal(game.update(0, L3).counts.perfect, 0);
  assert.equal(game.update(20, [{ u: 0.1, v: ZONE_V - 0.05 }]).counts.perfect, 0);
  assert.equal(game.update(400, NONE).counts.miss, 1);
});

test("a foot standing still on the square does not hit a tap", () => {
  const game = createGame({ song: tiny, players: 1 });
  const { r, events } = run(game, -1000, 320, () => L0);
  assert.equal(r.counts.perfect + r.counts.good, 0);
  assert.deepEqual(types(events), ["miss"]);
});

test("one arrival hits only one tile, and a second foot arriving hits the next", () => {
  const game = createGame({ song: pair, players: 1 }); // tiles at 0 and 400 ms, both in reach at 200
  const first = game.update(200, L0);
  assert.equal(first.events.length, 1);
  assert.equal(first.events[0].midi, 60);
  assert.equal(first.counts.good, 1);
  assert.equal(game.update(220, L0).events.length, 0); // still standing: nothing
  const both = [{ u: 0.1, v: 0.9 }, { u: 0.15, v: 0.9 }];
  const second = game.update(300, both);
  assert.equal(second.events.length, 1);
  assert.equal(second.events[0].midi, 60);
  assert.deepEqual([second.counts.good, second.counts.perfect], [1, 1]); // 100 ms from the second tile
});

test("a foot that flickers out for under 150 ms is not a new arrival", () => {
  const game = createGame({ song: tiny, players: 1 });
  // Standing from far before the tile, gone for 120 ms, back at 200 ms (the tile at 0 is still in reach).
  const { r } = run(game, -1000, 300, (t) => (t >= 100 && t < 200 ? NONE : L0));
  assert.equal(r.counts.perfect + r.counts.good, 0);
});

test("a foot gone for longer than 150 ms is a new arrival when it comes back", () => {
  const game = createGame({ song: tiny, players: 1 });
  const { r } = run(game, -1000, 300, (t) => (t >= 100 && t < 280 ? NONE : L0));
  assert.equal(r.counts.good, 1);
});

test("a hold tile is drawn from its head to a tail further up", () => {
  const t = createGame({ song: holdSong, players: 1 }).update(0, NONE).tiles.find((x) => x.kind === "hold");
  assert.ok(Math.abs(t.v - 0.75) < 1e-9);
  assert.ok(Math.abs(t.vTail - 0.15) < 1e-9); // 2000 ms later is 0.6 of the way back
  const tap = createGame({ song: tiny, players: 1 }).update(0, NONE).tiles.find((x) => x.kind === "tap");
  assert.equal(tap.vTail, tap.v);
});

test("a hold held to its end completes with its grade and pays per beat", () => {
  const game = createGame({ song: holdSong, players: 1 });
  const { r, events } = run(game, -200, 2100, (t) => (t >= -60 && t <= 1900 ? L0 : NONE));
  assert.deepEqual(events.filter((e) => e.lane === 0).map((e) => [e.type, e.grade]), [["holdStart", "perfect"], ["holdEnd", "perfect"]]);
  assert.equal(r.counts.perfect, 1);
  assert.equal(r.score, 100 + 20 * 4);
  assert.equal(r.combo, 1);
});

test("a hold left after half counts as good and keeps the combo", () => {
  const game = createGame({ song: holdSong, players: 1 });
  const { r, events } = run(game, -200, 1500, (t) => (t >= -60 && t <= 1000 ? L0 : NONE));
  assert.deepEqual(types(events), ["holdStart", "holdEnd"]);
  assert.equal(events[1].grade, "good");
  assert.equal(r.counts.good, 1);
  assert.equal(r.counts.miss, 0);
  assert.equal(r.combo, 1);
  assert.equal(r.score, 50);
});

test("a hold left early is a miss and resets the combo", () => {
  const game = createGame({ song: holdSong, players: 1 });
  const { r, events } = run(game, -200, 1500, (t) => (t >= -60 && t <= 400 ? L0 : NONE));
  assert.deepEqual(types(events), ["holdStart", "holdEnd", "miss"]);
  assert.equal(r.counts.miss, 1);
  assert.equal(r.combo, 0);
  assert.equal(r.tiles.find((x) => x.kind === "hold").state, "missed");
});

test("a foot already standing on a hold's square at its time starts it as good", () => {
  const game = createGame({ song: holdSong, players: 1 });
  const { r, events } = run(game, -600, 200, (t) => (t <= 200 ? L0 : NONE));
  assert.deepEqual(events.map((e) => [e.type, e.grade]), [["holdStart", "good"]]);
  assert.equal(r.tiles.find((x) => x.kind === "hold").state, "holding");
});

test("a hold nobody starts is a miss", () => {
  const { r, events } = run(createGame({ song: holdSong, players: 1 }), -200, 400, () => NONE);
  assert.deepEqual(types(events), ["miss"]);
  assert.equal(r.counts.miss, 1);
});

// Plays the long song: a perfect foot on every tile, except the indexes in `skip`.
function playLong(skip = []) {
  const game = createGame({ song: long, players: 1 });
  const feetAt = (t) => {
    const i = Math.round(t / 400);
    return Math.abs(t - i * 400) <= 20 && i >= 0 && i < 60 && !skip.includes(i) ? (i % 2 ? L3 : L0) : NONE;
  };
  const marks = {};
  for (let t = -200; t <= 25000; t += 20) {
    const r = game.update(t, feetAt(t));
    if (t === 3600) marks.ten = r; // the 10th tile
    if (t === 9600) marks.twentyFive = r;
    if (t === 19600) marks.fifty = r;
    marks.last = r;
  }
  return marks;
}

test("the multiplier steps up at 10, 25 and 50 combo", () => {
  assert.deepEqual([0, 9, 10, 24, 25, 49, 50, 80].map(multiplierFor), [1, 1, 2, 2, 3, 3, 4, 4]);
  const m = playLong();
  assert.deepEqual([m.ten.combo, m.ten.multiplier], [10, 2]);
  assert.deepEqual([m.twentyFive.combo, m.twentyFive.multiplier], [25, 3]);
  assert.deepEqual([m.fifty.combo, m.fifty.multiplier], [50, 4]);
});

test("the score adds each hit times the multiplier it earned", () => {
  const m = playLong().last;
  // 9 hits at x1, 15 at x2, 25 at x3, 11 at x4, all perfect (100).
  assert.equal(m.score, 100 * (9 + 15 * 2 + 25 * 3 + 11 * 4));
  assert.equal(m.counts.perfect, 60);
  assert.equal(m.maxCombo, 60);
});

test("a miss resets the combo and the multiplier", () => {
  const m = playLong([30]).last;
  assert.equal(m.counts.miss, 1);
  assert.equal(m.maxCombo, 30);
  assert.equal(m.combo, 29);
  assert.equal(m.multiplier, 3);
});

test("grade bands: S from 95%, A from 85%, B from 70%, else C", () => {
  assert.deepEqual([[95, "S"], [94, "A"], [85, "A"], [84, "B"], [70, "B"], [69, "C"]].map(([h]) => gradeFor(h, 100)), ["S", "A", "A", "B", "B", "C"]);
  assert.equal(playLong().last.grade, "S");
  assert.equal(playLong([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17]).last.grade, "B"); // 42 of 60 is 70%
});

test("the song ends once every tile is judged", () => {
  const game = createGame({ song: tiny, players: 1 });
  const mid = game.update(1000, NONE);
  assert.equal(mid.done, false);
  assert.equal(mid.grade, null);
  const end = game.update(2000, NONE);
  assert.equal(end.done, true);
  assert.equal(end.counts.miss, end.total);
  assert.equal(end.grade, "C");
});

test("createGame takes a lane count for one pad, and still takes players", () => {
  const pad = createGame({ song: tiny, lanes: 3 });
  assert.equal(pad.lanes, 3);
  assert.deepEqual(pad.update(0, NONE).tiles.map((t) => t.lane), [0, 1, 2]);
  const r = pad.update(500, [{ u: 0.5, v: 0.9 }]); // the middle of 3 lanes is lane 1, the second tile
  assert.deepEqual(r.events.map((e) => [e.type, e.lane, e.grade]), [["hit", 1, "perfect"], ["miss", 0, "miss"]]);
  assert.equal(createGame({ song: tiny, players: 2 }).lanes, 6);
});
