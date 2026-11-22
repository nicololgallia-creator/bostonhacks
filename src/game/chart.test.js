import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { splitParts } from "./parts.js";
import {
  chartSpan, longestWait, backingLeft, LEVELS, difficultyOf, MIN_GAP_MS, TEAM_WAIT_MS, PLAYER_WAIT_MS, RUN_LENGTHS, TOGETHER_EVERY, HOLD_SHARE,
} from "./chart.js";
import { createGame, maxScore, isHold, HOLD_MS } from "./engine.js";
import { songs } from "../songs/index.js";

// A made-up melody: `count` notes of `gapBeats` beats, at 60 bpm (a beat is a second), each `length` beats long.
const tune = (count, { gapBeats = 1, length = 0.4, extra = {} } = {}) => ({
  id: "tune", title: "Tune", by: "Test", bpm: 60, ...extra,
  notes: Array.from({ length: count }, (_, i) => ({ beat: i * gapBeats, midi: 60 + (i % 7), beats: length })),
});
const ms = (song, n) => n.beat * (60000 / song.bpm);
const everyone = (parts) => parts.flatMap((p) => p.notes);

test("the whole team never waits more than 2.5 s while the song goes on, when the backing can fill the gap", () => {
  // Melody every 10 s. Backing (pitched notes and drums) every half second in between.
  const backing = [];
  for (let b = 0; b < 40; b += 0.5) { backing.push({ beat: b, midi: 40 + (b % 5), beats: 0.5 }, { beat: b, drum: b % 2 ? "hat" : "kick" }); }
  const song = tune(4, { gapBeats: 10, length: 0.4, extra: { backing } });
  for (const seats of [1, 2, 3, 4]) {
    const parts = splitParts(song, seats);
    const beats = [...new Set(everyone(parts).map((n) => n.beat))].sort((a, b) => a - b);
    const { from, to } = chartSpan(song);
    const edges = [from / 1000, ...beats.map((b) => b), to / 1000];
    edges.slice(1).forEach((e, i) => assert.ok(e - edges[i] <= TEAM_WAIT_MS / 1000 + 1e-9, `${seats} seats: ${edges[i]} to ${e}`));
    assert.ok(everyone(parts).some((n) => n.bi !== undefined), "some tiles come from the backing");
  }
});

test("a tile from the backing keeps its own pitch and is never a drum", () => {
  const backing = [{ beat: 1, drum: "kick" }, { beat: 2, midi: 45, beats: 1 }, { beat: 2, midi: 57, beats: 1 }, { beat: 2, drum: "snare" }, { beat: 3, drum: "hat" }, { beat: 4, midi: 64, beats: 1 }];
  const song = { ...tune(2, { gapBeats: 6 }), backing };
  const tiles = splitParts(song, 1)[0].notes.filter((n) => n.bi !== undefined);
  assert.ok(tiles.length >= 1);
  for (const t of tiles) {
    const entry = backing[t.bi];
    assert.equal(entry.drum, undefined, "no drum becomes a tile");
    assert.equal(t.midi, entry.midi, "it keeps the pitch of the entry it came from");
  }
  assert.equal(tiles.find((t) => t.beat === 2)?.midi, 57, "of two notes that start together the higher one is used");
});

test("backingLeft is the backing minus the entries that became tiles", () => {
  const backing = [{ beat: 2, midi: 57, beats: 1 }, { beat: 3, drum: "hat" }, { beat: 4, midi: 64, beats: 1 }];
  const song = { ...tune(2, { gapBeats: 6 }), backing };
  const parts = splitParts(song, 2);
  const used = new Set(everyone(parts).filter((n) => n.bi !== undefined).map((n) => n.bi));
  assert.ok(used.size > 0);
  assert.deepEqual(backingLeft(song, parts), backing.filter((_, i) => !used.has(i)));
  assert.deepEqual(backingLeft({ ...song, backing: undefined }, parts), []);
});

test("a gap with no backing in it stays empty: no rhythm is invented", () => {
  const song = tune(3, { gapBeats: 8 });
  assert.deepEqual(everyone(splitParts(song, 1)).map((n) => n.beat), [0, 8, 16]);
});

test("two to four players take the tune in runs of 2 to 4, in seat order, never by pitch", () => {
  const song = tune(24, { gapBeats: 1 }); // 24 tiles a second apart: no player ever waits too long, so the runs stay whole
  const parts = splitParts(song, 2);
  const owners = new Map();
  parts.forEach((p, s) => p.notes.forEach((n) => owners.set(n.beat, [...(owners.get(n.beat) ?? []), s])));
  const seq = song.notes.map((n) => owners.get(n.beat)).filter((o) => o.length === 1).map((o) => o[0]); // tiles played together are not part of a run
  const runs = [];
  for (const s of seq) { if (runs.length && runs.at(-1).s === s) runs.at(-1).n++; else runs.push({ s, n: 1 }); }
  assert.ok(runs.length >= 4, "the tune passes back and forth");
  assert.equal(runs[0].s, 0, "seat 1 starts");
  assert.ok(runs.slice(0, -1).every((r) => r.n >= RUN_LENGTHS.reduce((a, b) => Math.min(a, b))), "a run is at least 2 tiles");
  assert.ok(runs.every((r) => r.n <= Math.max(...RUN_LENGTHS) * 2), "a run is at most 4 tiles, or 2 runs split by a tile played together");
  // Not by pitch: both players get high and low notes.
  parts.forEach((p) => assert.ok(new Set(p.notes.map((n) => n.midi)).size >= 5));
});

test("on about one tile in twelve everyone taps together, one tile each at the same time", () => {
  for (const seats of [2, 3, 4]) {
    const parts = splitParts(tune(48), seats);
    const seen = new Map();
    for (const n of everyone(parts)) seen.set(n.beat, (seen.get(n.beat) ?? 0) + 1);
    const together = [...seen.values()].filter((c) => c === seats).length;
    assert.equal(together, Math.floor(48 / TOGETHER_EVERY), `${seats} seats`);
  }
  // A lone player has nobody to tap with.
  assert.equal(splitParts(tune(48), 1)[0].notes.length, 48);
});

test("a player who would wait more than 4 s gets the next tile out of turn", () => {
  // Four players, a tile every 2 s: handed round one by one each waits 8 s, so tiles are shared out of turn.
  const song = tune(20, { gapBeats: 2 });
  const parts = splitParts(song, 4);
  const span = chartSpan(song);
  for (const p of parts) assert.ok(longestWait(p, span) <= PLAYER_WAIT_MS, `waits ${longestWait(p, span)}`);
});

test("notes of 500 ms or more become holds, with their real length, and about one tile in five is one", () => {
  const song = tune(40, { gapBeats: 2, length: 1.6 }); // 1.6 s notes, 2 s apart: every one could be a hold
  const [only] = splitParts(song, 1);
  const holds = only.notes.filter((n) => n.hold);
  assert.ok(holds.length >= 40 * HOLD_SHARE - 1 && holds.length <= 40 * HOLD_SHARE + 1, `holds: ${holds.length}`);
  // A hold keeps its length unless the next tile is too close: then it stops MIN_GAP_MS short of it.
  holds.forEach((h) => {
    const next = only.notes[only.notes.indexOf(h) + 1];
    const room = next ? ms(song, next) - ms(song, h) - MIN_GAP_MS : Infinity;
    assert.ok(h.beats * 1000 <= Math.min(1600, room) + 1e-6);
    assert.ok(h.beats * 1000 >= HOLD_MS);
  });
  assert.ok(holds.some((h) => h.beats === 1.6), "a hold with room keeps its real length");
  // Short notes are never holds.
  assert.equal(splitParts(tune(40, { gapBeats: 2, length: 0.45 }), 1)[0].notes.filter((n) => n.hold).length, 0);
  // The engine reads the flag: every tile of the part is a hold exactly when the part says so.
  assert.ok(only.notes.every((n) => isHold(n, only.bpm) === n.hold));
});

test("a hold is never closer than 350 ms to the next tile of the same player", () => {
  for (const song of songs) for (let seats = 1; seats <= 4; seats++) for (const p of splitParts(song, seats)) {
    p.notes.forEach((n, i) => {
      if (!n.hold || i === p.notes.length - 1) return;
      const gap = ms(song, p.notes[i + 1]) - (ms(song, n) + n.beats * (60000 / song.bpm));
      assert.ok(gap >= MIN_GAP_MS - 1e-6, `${song.id}, ${seats} seats: ${gap}`);
    });
  }
});

test("no player waits more than 4 s between tiles, in team mode, on every real song for 1 to 4 players", () => {
  for (const song of songs) for (let seats = 1; seats <= 4; seats++) {
    const span = chartSpan(song);
    for (const p of splitParts(song, seats)) {
      const wait = longestWait(p, span);
      assert.ok(wait <= PLAYER_WAIT_MS + 1e-6, `${song.id}, ${seats} seats: waits ${(wait / 1000).toFixed(1)} s`);
    }
  }
});

// ---- versus

const FIVE = ["sweet-caroline", "twinkle", "ode-to-joy", "shipping-up-to-boston", "ship-never-returned"].map((id) => songs.find((s) => s.id === id));

test("versus: every player has their own tiles but the same number, the same holds in the same order, the same top score", () => {
  assert.ok(FIVE.every(Boolean));
  for (const song of [...FIVE, tune(30), tune(31, { gapBeats: 2, length: 1.5 }), tune(7)]) {
    for (let seats = 2; seats <= 4; seats++) {
      const parts = splitParts(song, seats, { mode: "versus" });
      const where = `${song.id}, ${seats} players`;
      const first = parts[0].notes;
      parts.forEach((p) => {
        assert.equal(p.notes.length, first.length, `${where}: same number of tiles`);
        p.notes.forEach((n, k) => {
          assert.equal(n.hold, first[k].hold, `${where}: tile ${k} is the same kind`);
          if (n.hold) assert.equal(n.beats, first[k].beats, `${where}: tile ${k} is held as long`);
        });
        assert.equal(maxScore(p), maxScore(parts[0]), `${where}: same top score`);
      });
    }
  }
});

test("versus with one player is the same as team", () => {
  for (const song of FIVE) assert.deepEqual(splitParts(song, 1, { mode: "versus" }), splitParts(song, 1));
});

// The checks every duel chart passes, for any song and 2 to 4 players.
function checkVersus(song, seats, longestAllowed = PLAYER_WAIT_MS) {
  const parts = splitParts(song, seats, { mode: "versus" });
  const where = `${song.id}, ${seats} players`;
  const span = chartSpan(song);
  parts.forEach((p) => {
    assert.equal(p.notes.length, parts[0].notes.length, `${where}: same number of tiles`);
    assert.equal(maxScore(p), maxScore(parts[0]), `${where}: same top score`);
    p.notes.forEach((n, k) => {
      assert.equal(n.hold, parts[0].notes[k].hold, `${where}: tile ${k} is the same kind`);
      if (n.hold) assert.equal(n.beats, parts[0].notes[k].beats, `${where}: tile ${k} is held as long`);
      if (k) assert.ok(ms(song, n) - ms(song, p.notes[k - 1]) >= MIN_GAP_MS - 1e-6, `${where}: tiles 350 ms apart`);
    });
    const wait = longestWait(p, span);
    assert.ok(wait <= longestAllowed + 1e-6, `${where}: a player waits ${(wait / 1000).toFixed(1)} s`);
  });
  return parts;
}

test("versus: on every song, 2 to 4 players, nobody waits more than 4 s and everything is still equal", () => {
  for (const song of songs) for (let seats = 2; seats <= 4; seats++) checkVersus(song, seats);
});

test("versus: a quiet song gives two players a tile at the same moment instead of making one wait", () => {
  // A tile every 2 s and four players: one tile each would leave every player 8 s idle.
  const song = tune(20, { gapBeats: 2 });
  const parts = checkVersus(song, 4);
  const holders = new Map();
  parts.forEach((p, s) => p.notes.forEach((n) => holders.set(n.beat, [...(holders.get(n.beat) ?? []), s])));
  assert.ok([...holders.values()].some((who) => who.length > 1), "some moment is on two players' lists");
  // With a tile every second the deal alone is enough: nobody needs a shared moment.
  const busy = splitParts(tune(40, { gapBeats: 1 }), 4, { mode: "versus" });
  const beats = busy.flatMap((p) => p.notes.map((n) => n.beat));
  assert.equal(new Set(beats).size, beats.length, "dealing alone was enough");
});

test("versus: a gap can be closed with a backing note, and backingLeft still has every other entry once", () => {
  // Melody only at the start and the end, 12 s apart; the backing has pitched notes between. Two players: the melody alone leaves a 12 s wait.
  const backing = [4, 6, 8, 10].map((beat) => ({ beat, midi: 52, beats: 0.4 })).concat([{ beat: 5, drum: "kick" }, { beat: 3, midi: 50, beats: 0.4 }]);
  const song = { ...tune(2, { gapBeats: 12 }), backing };
  const parts = checkVersus(song, 2);
  const used = everyone(parts).filter((n) => n.bi !== undefined).map((n) => n.bi);
  assert.ok(used.length > 0, "a backing note became a tile");
  assert.equal(backing[used[0]].drum, undefined);
  const left = backingLeft(song, parts);
  assert.equal(left.length, backing.length - new Set(used).size, "each backing entry that became a tile leaves the backing once, even when two players have it");
  assert.ok(left.every((e) => !used.some((bi) => backing[bi] === e)));
});

test("versus, many made-up songs: equal and never waiting over 4 s where the song has the tiles for it", () => {
  for (const gapBeats of [0.5, 0.8, 1, 1.5, 2, 3]) for (const count of [5, 17, 31]) for (let seats = 2; seats <= 4; seats++) {
    const song = tune(count, { gapBeats, length: 0.4 });
    // A song whose own melody leaves more than 4 s between two notes cannot be helped without inventing rhythm.
    const melodyGap = gapBeats * 1000 <= PLAYER_WAIT_MS;
    checkVersus(song, seats, melodyGap ? PLAYER_WAIT_MS : Infinity);
  }
});

test("team charts are exactly what they were before the duel change (five songs, 1 to 4 players)", () => {
  // [fingerprint of the song's data, fingerprints of the team chart for 1, 2, 3 and 4 players], taken from the code before duels could share tiles.
  const before = {
    "sweet-caroline": ["569dc29a3e02", ["54f5327dd51e", "11edc1cbe89a", "624019010449", "fbda77a73a0e"]],
    "twinkle": ["ad2954b384a7", ["90a1c009fd80", "f75829f8a596", "4b3bae894397", "45c9f597def8"]],
    "ode-to-joy": ["44c7103472f5", ["b746d6b817fa", "f5a00f16499c", "5a8a35a46e2f", "aaf871616561"]],
    "shipping-up-to-boston": ["9ed195e2bf0d", ["c300ff6c6744", "54883ec38a15", "b56ecb7f8b76", "8d7142c20c87"]],
    "ship-never-returned": ["41885099be52", ["9028dc0e01f0", "94405f77b15d", "dd330010249a", "c96c3ac8aeb8"]],
  };
  const print = (x) => createHash("sha1").update(JSON.stringify(x)).digest("hex").slice(0, 12);
  for (const [id, [songPrint, chartPrints]] of Object.entries(before)) {
    const song = songs.find((s) => s.id === id);
    if (print({ bpm: song.bpm, notes: song.notes, backing: song.backing }) !== songPrint) continue; // the song file was edited since: this snapshot no longer describes it
    chartPrints.forEach((want, i) => assert.equal(print(splitParts(song, i + 1).map((p) => p.notes)), want, `${id}, ${i + 1} players`));
  }
});

test("a perfect run through the engine scores exactly maxScore, and a versus rival scores the same", () => {
  // A foot that lands on each tile's time, stays down through a hold, and lifts between tiles.
  const perfect = (part) => {
    const beatMs = 60000 / part.bpm;
    const game = createGame({ song: part, lanes: 1 });
    let last;
    for (let t = -300; t <= (part.notes.at(-1).beat + part.notes.at(-1).beats) * beatMs + 600; t += 20) {
      const down = part.notes.some((n) => t >= n.beat * beatMs && t < n.beat * beatMs + (n.hold ? n.beats * beatMs : 40));
      last = game.update(t, down ? [{ u: 0.5, v: 0.9, lifted: false }] : []);
    }
    return last;
  };
  const song = songs.find((s) => s.id === "ode-to-joy");
  const [a, b] = splitParts(song, 2, { mode: "versus" });
  const ra = perfect(a);
  const rb = perfect(b);
  assert.equal(ra.score, maxScore(a));
  assert.equal(rb.score, ra.score);
  assert.equal(ra.counts.miss + rb.counts.miss, 0);
  assert.equal(ra.grade, "S");
  // A duel where players share moments: all four still reach the same top score by a perfect run.
  const shared = splitParts(songs.find((s) => s.id === "ship-never-returned"), 4, { mode: "versus" });
  const results = shared.map(perfect);
  results.forEach((r, i) => { assert.equal(r.score, maxScore(shared[i])); assert.equal(r.score, results[0].score); assert.equal(r.counts.miss, 0); });
});

// ---- levels (easy, normal, hard)

const LEVEL_NAMES = ["easy", "normal", "hard"];
const total = (parts) => parts.reduce((n, p) => n + p.notes.length, 0);

test("normal is exactly the tiles the game gave before levels: every song, 1 to 4 players, team and duel", () => {
  // chart-normal.fixture.json holds a fingerprint of each chart, taken from the code before levels existed.
  const before = JSON.parse(readFileSync(new URL("./chart-normal.fixture.json", import.meta.url), "utf8"));
  const print = (x) => createHash("sha1").update(JSON.stringify(x)).digest("hex").slice(0, 16);
  assert.equal(Object.keys(before).length, songs.length);
  for (const song of songs) for (const mode of ["team", "versus"]) for (let seats = mode === "team" ? 1 : 2; seats <= 4; seats++) {
    const want = before[song.id][`${mode}${seats}`];
    assert.equal(print(splitParts(song, seats, { mode }).map((p) => p.notes)), want, `${song.id}, ${mode}, ${seats} players: default level`);
    assert.equal(print(splitParts(song, seats, { mode, difficulty: "normal" }).map((p) => p.notes)), want, `${song.id}, ${mode}, ${seats} players: "normal"`);
  }
});

test("a duel is equal at every level: the same number of tiles, the same kinds and holds, the same top score", () => {
  for (const difficulty of LEVEL_NAMES) for (const song of [...songs, tune(30), tune(31, { gapBeats: 2, length: 1.5 }), tune(7)]) for (let seats = 2; seats <= 4; seats++) {
    const parts = splitParts(song, seats, { mode: "versus", difficulty });
    const where = `${difficulty}, ${song.id}, ${seats} players`;
    parts.forEach((p) => {
      assert.equal(p.notes.length, parts[0].notes.length, `${where}: same number of tiles`);
      assert.equal(maxScore(p), maxScore(parts[0]), `${where}: same top score`);
      p.notes.forEach((n, k) => {
        assert.equal(n.hold, parts[0].notes[k].hold, `${where}: tile ${k} is the same kind`);
        if (n.hold) assert.equal(n.beats, parts[0].notes[k].beats, `${where}: tile ${k} is held as long`);
      });
    });
  }
});

test("easy has no holds, keeps each player's tiles 700 ms apart, and nobody waits more than 6 s", () => {
  for (const mode of ["team", "versus"]) for (const song of songs) for (let seats = mode === "team" ? 1 : 2; seats <= 4; seats++) {
    const span = chartSpan(song);
    for (const p of splitParts(song, seats, { mode, difficulty: "easy" })) {
      const where = `${song.id}, ${mode}, ${seats} players`;
      assert.ok(p.notes.every((n) => !n.hold), `${where}: no holds`);
      p.notes.forEach((n, k) => { if (k) assert.ok(ms(song, n) - ms(song, p.notes[k - 1]) >= LEVELS.easy.gap - 1e-6, `${where}: tiles 700 ms apart`); });
      assert.ok(longestWait(p, span) <= 6000 + 1e-6, `${where}: waits ${(longestWait(p, span) / 1000).toFixed(1)} s`);
    }
  }
  assert.equal(LEVELS.easy.together, Infinity, "nobody taps together on easy: no tile is played by every player");
  const parts = splitParts(tune(48), 3, { difficulty: "easy" });
  const seen = new Map();
  for (const n of everyone(parts)) seen.set(n.beat, (seen.get(n.beat) ?? 0) + 1);
  assert.ok([...seen.values()].every((c) => c === 1));
});

test("hard never goes under 350 ms between a player's tiles, never waits more than Normal allows (4 s), and has more tiles and holds than normal", () => {
  for (const mode of ["team", "versus"]) for (const song of songs) for (let seats = mode === "team" ? 1 : 2; seats <= 4; seats++) {
    const span = chartSpan(song);
    for (const p of splitParts(song, seats, { mode, difficulty: "hard" })) {
      const where = `${song.id}, ${mode}, ${seats} players`;
      p.notes.forEach((n, k) => { if (k) assert.ok(ms(song, n) - ms(song, p.notes[k - 1]) >= MIN_GAP_MS - 1e-6, `${where}: tiles ${MIN_GAP_MS} ms apart`); });
      assert.ok(longestWait(p, span) <= PLAYER_WAIT_MS + 1e-6, `${where}: waits ${(longestWait(p, span) / 1000).toFixed(1)} s`);
    }
  }
  const sum = (difficulty, f) => songs.reduce((n, song) => n + f(splitParts(song, 2, { difficulty })), 0);
  assert.ok(sum("hard", total) >= 1.2 * sum("normal", total), "hard has at least a fifth more tiles");
  assert.ok(sum("easy", total) <= 0.65 * sum("normal", total), "easy has well under two thirds of the tiles");
  const holds = (parts) => parts.reduce((n, p) => n + p.notes.filter((t) => t.hold).length, 0);
  assert.ok(sum("hard", holds) > sum("normal", holds), "hard has more holds");
});

test("a level that is not easy, normal or hard is refused by splitParts", () => {
  assert.throws(() => splitParts(songs[0], 2, { difficulty: "extreme" }), /"easy", "normal" or "hard"/);
  assert.equal(difficultyOf("extreme"), "normal");
  assert.equal(difficultyOf(undefined), "normal");
  assert.equal(difficultyOf("hard"), "hard");
});

test("backingLeft agrees with the parts at every level: an entry is a tile or backing, never both, never lost", () => {
  for (const difficulty of LEVEL_NAMES) for (const mode of ["team", "versus"]) for (const song of songs) for (let seats = mode === "team" ? 1 : 2; seats <= 4; seats++) {
    const parts = splitParts(song, seats, { mode, difficulty });
    const used = new Set(everyone(parts).filter((n) => n.bi !== undefined).map((n) => n.bi));
    const left = backingLeft(song, parts);
    assert.equal(left.length, song.backing.length - used.size, `${difficulty}, ${song.id}, ${mode}, ${seats}: every entry is a tile or left`);
    assert.ok(left.every((e) => !used.has(song.backing.indexOf(e))), `${difficulty}, ${song.id}: no entry both`);
    assert.ok([...used].every((bi) => !song.backing[bi].drum), "no drum is a tile");
  }
});
