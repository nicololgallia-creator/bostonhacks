import { test } from "node:test";
import assert from "node:assert/strict";
import { createSession, trainFromAddress, trainQuery, DEFAULT_TRAIN, COUNTDOWN_MS, RESULTS_MS, WARM_TAPS, WARM_BEAT_MS, WARM_MAX_MS } from "./session.js";
import { makeLayout } from "./layout.js";
import { TRAVEL_MS, gradeFor } from "../game/engine.js";
import { splitParts, lanesInPad } from "../game/parts.js";

// The old tests start songs and expect the countdown at once: they run with the warm-up off. The warm-up has its own tests
// at the end, which use createSession itself.
function quiet(options) {
  const s = createSession(options);
  s.apply({ type: "set", warmup: false }, 0, { stage: true });
  return s;
}

// 120 bpm, taps at 0, 500 and 1000 ms, song length 1.5 s. Which seat plays which tile is the rules' business
// (game/chart.js): these tests ask splitParts rather than assume a split.
const tiny = { id: "tiny", title: "Tiny Tune", bpm: 120, notes: [{ beat: 0, midi: 60, beats: 1 }, { beat: 1, midi: 64, beats: 1 }, { beat: 2, midi: 67, beats: 1 }] };
const other = { id: "other", title: "Other Tune", bpm: 120, notes: [{ beat: 0, midi: 62, beats: 1 }, { beat: 1, midi: 65, beats: 1 }] };
// Eight different pitches, half a second apart: with 3 seats (3 lanes) the seats get 3, 2 and 3 notes.
const scale = { id: "scale", title: "Scale", bpm: 120, notes: [60, 62, 64, 65, 67, 69, 71, 72].map((midi, beat) => ({ beat, midi, beats: 1 })) };
// A long song: 32 notes of half a second over four pitches, 16 s long. Two seats get 16 notes each.
const long = { id: "long", title: "Long Tune", bpm: 120, notes: Array.from({ length: 32 }, (_, i) => ({ beat: i, midi: [60, 62, 64, 65][i % 4], beats: 1 })) };
const songs = [tiny, other, scale, long];
const START = COUNTDOWN_MS + TRAVEL_MS; // wall time (a start at 0) when the first beat is due

// Feet that play every note of `song` for the seats in `stepping`. `taken` are the seat ids that hold seats, in
// seat order: each takes its part of the song, and its foot lands on the note's lane at the note's time.
const play = (song, taken, stepping = taken, base = 0, mode = "team") => {
  const beatMs = 60000 / song.bpm;
  const parts = splitParts(song, taken.length, { mode });
  return (wall) => {
    const feet = {};
    taken.forEach((id, i) => {
      if (!stepping.includes(id)) return;
      for (const n of parts[i].notes) {
        const d = wall - (base + START + n.beat * beatMs);
        if (d >= 0 && d < (n.hold ? n.beats * beatMs : 100)) (feet[id] ??= []).push({ u: (n.lane + 0.5) / lanesInPad(taken.length), v: 0.9 });
      }
    });
    return feet;
  };
};

// Every phone says it is still there, as the phone page does every 3 seconds.
const alive = (s, t) => { for (const id of ["ann", "ben", "cat"]) s.apply({ type: "here", clientId: id }, t); };
const said = (s, now = 0) => s.snapshot(now).notice?.text ?? null;

// Ticks every 20 ms from `from` to `to` and returns the last view.
function run(s, from, to, feetAt = () => ({})) {
  let v;
  for (let t = from; t <= to; t += 20) { alive(s, t); v = s.tick(t, feetAt(t)); }
  return v;
}

// A session with Ann in seat 1 and Ben in seat 2.
function twoSeated() {
  const s = quiet({ songs });
  s.apply({ type: "join", clientId: "ann" }, 0);
  s.apply({ type: "join", clientId: "ben" }, 0);
  s.apply({ type: "claim", clientId: "ann", spotId: 1 }, 0);
  s.apply({ type: "claim", clientId: "ben", spotId: 2 }, 0);
  return s;
}
const start = (s, songIds = ["tiny"], extra = {}) => s.apply({ type: "start", clientId: "ann", songIds, ...extra }, 0);
const player = (s, spotId, now = 0) => s.snapshot(now).players.find((p) => p.spotId === spotId);
const seatsOf = (s, now = 0) => s.snapshot(now).players.map((p) => [p.clientId, p.spotId]);

test("a new session is a lobby with the State message's exact shape, four seats, team mode, the warm-up on", () => {
  const snap = createSession({ songs }).snapshot(0);
  assert.deepEqual(snap, {
    type: "state", status: "lobby", mode: "team", difficulty: "normal", winner: null, warmup: null, notice: null, layout: makeLayout({ seats: 4 }), train: DEFAULT_TRAIN,
    players: [], team: { score: 0, hits: 0, total: 0, grade: null },
    song: null, queue: [], secondsLeft: 0, transit: null, ready: { camera: false, calibrated: false },
    settings: { volume: 0.8, offsetMs: 120, warmup: true },
  });
  assert.equal(snap.layout.lanes, 2);
});

test("snapshots are copies: changing one changes nothing inside", () => {
  const s = quiet({ songs });
  s.snapshot(0).layout.spots.length = 0;
  assert.equal(s.snapshot(0).layout.spots.length, 4);
});

test("a player in the State is a seat: clientId, spotId, stats, bonus and rank, with no name and no waitMs", () => {
  const snap = twoSeated().snapshot(0);
  const keys = ["bonus", "bonusFor", "clientId", "combo", "counts", "grade", "maxCombo", "multiplier", "rank", "score", "spotId", "total"];
  assert.deepEqual(snap.players.map((p) => Object.keys(p).sort()), [keys, keys]);
  assert.deepEqual(snap.players.map((p) => [p.bonus, p.bonusFor]), [[0, null], [0, null]]);
});

test("join needs only a clientId, joining again changes nothing, and a phone with no seat is not in players", () => {
  const s = quiet({ songs });
  s.apply({ type: "join", clientId: "a" }, 0);
  s.apply({ type: "join", clientId: "a" }, 0);
  assert.equal(s.snapshot(0).players.length, 0);
  assert.equal(said(s), null);
  s.apply({ type: "claim", clientId: "a", spotId: 1 }, 0); // joined, so it can claim
  assert.deepEqual(seatsOf(s), [["a", 1]]);
});

test("claim adds a seat, never moves the phone, and a taken seat is refused", () => {
  const s = twoSeated();
  s.apply({ type: "claim", clientId: "ben", spotId: 1 }, 0);
  assert.equal(said(s), "That seat is taken.");
  assert.deepEqual(seatsOf(s), [["ann", 1], ["ben", 2]]);
  s.apply({ type: "claim", clientId: "ann", spotId: 3 }, 0); // Ann now holds seats 1 and 3
  assert.deepEqual(seatsOf(s), [["ann", 1], ["ben", 2], ["ann", 3]]);
  s.apply({ type: "claim", clientId: "ann", spotId: 3 }, 0); // her own seat again: nothing changes, no refusal for her
  assert.deepEqual(seatsOf(s), [["ann", 1], ["ben", 2], ["ann", 3]]);
  assert.equal(s.snapshot(0).notice.for, "ben"); // still Ben's refusal
});

test("claim: you must have joined, and the seat must exist", () => {
  const s = quiet({ songs });
  s.apply({ type: "claim", clientId: "ghost", spotId: 1 }, 0);
  assert.match(said(s), /Join/);
  s.apply({ type: "join", clientId: "a" }, 0);
  s.apply({ type: "claim", clientId: "a", spotId: 5 }, 0); // the default layout has 4 seats
  assert.equal(said(s), "That seat does not exist.");
  assert.equal(s.snapshot(0).players.length, 0);
});

test("one phone can hold three seats, and all three play the song at the same time", () => {
  const s = quiet({ songs });
  s.apply({ type: "join", clientId: "ann" }, 0);
  for (const spotId of [1, 2, 3]) s.apply({ type: "claim", clientId: "ann", spotId }, 0);
  assert.deepEqual(seatsOf(s), [["ann", 1], ["ann", 2], ["ann", 3]]);
  start(s, ["scale"]);
  assert.equal(s.snapshot(0).status, "countdown");
  assert.deepEqual(s.snapshot(0).players.map((p) => p.total), [3, 2, 3]);
  const view = run(s, 0, START);
  assert.deepEqual(view.pads.map((p) => [p.spotId, p.lanes]), [[1, 1], [2, 1], [3, 1]]); // 3 pads of 1 lane each
  assert.equal(s.snapshot(0).layout.lanes, 1);
  assert.ok(view.pads.every((p) => p.tiles.length > 0), "every pad has tiles at once");
});

// A session with Ann holding seats 1 to n (the layout grows to n pads when n is over 3).
function seated(n) {
  const s = quiet({ songs });
  s.apply({ type: "join", clientId: "ann" }, 0);
  if (n > 3) s.apply({ type: "layout", clientId: "ann", seats: 4 }, 0);
  for (let spotId = 1; spotId <= n; spotId++) s.apply({ type: "claim", clientId: "ann", spotId }, 0);
  return s;
}

test("the State's layout.lanes follows the seats taken in the lobby: 2 for none or one, 1 for two or more", () => {
  const lanes = [0, 1, 2, 3, 4].map((n) => seated(n).snapshot(0).layout.lanes);
  assert.deepEqual(lanes, [2, 2, 1, 1, 1]);
  const s = seated(1);
  s.apply({ type: "join", clientId: "ben" }, 0);
  s.apply({ type: "claim", clientId: "ben", spotId: 2 }, 0);
  assert.equal(s.snapshot(0).layout.lanes, 1);
  s.apply({ type: "release", clientId: "ben", spotId: 2 }, 0);
  assert.equal(s.snapshot(0).layout.lanes, 2, "back to one seat, back to 2 lanes");
});

test("each engine gets the lane count for the seats taken when the song starts, and every note is on that pad", () => {
  for (const [n, lanes] of [[1, 2], [2, 1], [3, 1], [4, 1]]) {
    const s = seated(n);
    start(s, ["scale"]);
    const view = run(s, 0, START);
    assert.deepEqual(view.pads.map((p) => p.lanes), Array(n).fill(lanes), `${n} seats`);
    assert.equal(s.snapshot(START).layout.lanes, lanes);
    assert.ok(view.pads.every((p) => p.tiles.length > 0 && p.tiles.every((t) => t.lane < lanes)), `${n} seats: a tile on every pad, inside its lanes`);
  }
});

test("the lane count is held for the song when a seat is released part way, and for the next song it is read again", () => {
  const s = seated(2);
  start(s, ["long", "long"]);
  run(s, 0, START);
  s.apply({ type: "release", clientId: "ann", spotId: 2 }, START); // one seat is left, but the song keeps 1 lane
  const view = s.tick(START + 20, {});
  assert.deepEqual(view.pads.map((p) => [p.spotId, p.lanes]), [[1, 1]]);
  assert.equal(s.snapshot(START + 20).layout.lanes, 1);
  const end = START + 20 + 16500; // the song is 16 s long
  assert.equal(run(s, START + 20, end).status, "results");
  const next = run(s, end, end + RESULTS_MS + 100);
  assert.equal(next.status, "countdown");
  assert.deepEqual(next.pads.map((p) => [p.spotId, p.lanes]), [[1, 2]], "one seat, 2 lanes again, read at the next song's start");
});

test("in a 1-lane pad either foot landing is a tap; in a 2-lane pad foot 0 is lane 0 and foot 1 is lane 1", () => {
  const hitsWith = (n, u) => {
    const s = seated(n);
    start(s, ["tiny"]);
    // seat 1 plays the first note of the song at its time, with one foot landing at u (pad coordinates)
    run(s, 0, START + 300, (t) => (t >= START - 20 && t < START + 100 ? { 1: [{ u, v: 0.9 }] } : {}));
    return player(s, 1, START + 300).counts;
  };
  for (const u of [0.25, 0.75]) assert.equal(hitsWith(2, u).perfect, 1, `2 seats, foot at ${u}`);
  assert.equal(hitsWith(1, 0.25).perfect, 1, "a lone seat's first note is lane 0: foot 0");
  assert.equal(hitsWith(1, 0.75).perfect, 0, "a lone seat's foot 1 is lane 1, which is the wrong lane for it");
});

test("with 1, 2, 3 and 4 seats every note of a song is played by exactly one seat", () => {
  for (const n of [1, 2, 3, 4]) {
    const s = quiet({ songs });
    s.apply({ type: "join", clientId: "ann" }, 0);
    for (let spotId = 1; spotId <= n; spotId++) {
      if (spotId > 3) s.apply({ type: "layout", clientId: "ann", seats: 4 }, 0);
      s.apply({ type: "claim", clientId: "ann", spotId }, 0);
    }
    start(s, ["scale"]);
    const totals = s.snapshot(0).players.map((p) => p.total);
    assert.equal(totals.length, n);
    assert.equal(totals.reduce((a, b) => a + b, 0), scale.notes.length, `${n} seats`);
    assert.equal(s.snapshot(0).team.total, scale.notes.length);
  }
});

test("three seats on one phone all hit their own tiles, and the results end with every seat graded", () => {
  const s = quiet({ songs });
  s.apply({ type: "join", clientId: "ann" }, 0);
  for (const spotId of [1, 2, 3]) s.apply({ type: "claim", clientId: "ann", spotId }, 0);
  start(s, ["scale"]);
  run(s, 0, START + 4400, play(scale, [1, 2, 3]));
  const end = s.snapshot(START + 4400);
  assert.equal(end.status, "results");
  assert.deepEqual(end.players.map((p) => p.counts.perfect), [3, 2, 3]);
  assert.ok(end.players.every((p) => p.grade === "S" && p.score > 0));
  assert.deepEqual([end.team.hits, end.team.total, end.team.grade], [8, 8, "S"]);
});

test("release gives back one seat and keeps the phone's others", () => {
  const s = twoSeated();
  s.apply({ type: "claim", clientId: "ann", spotId: 3 }, 0);
  s.apply({ type: "release", clientId: "ann", spotId: 1 }, 0);
  assert.deepEqual(seatsOf(s), [["ben", 2], ["ann", 3]]);
  assert.equal(said(s), null);
  s.apply({ type: "claim", clientId: "ben", spotId: 1 }, 0); // the freed seat can be taken
  assert.deepEqual(seatsOf(s), [["ben", 1], ["ben", 2], ["ann", 3]]);
});

test("another phone cannot take or release a seat that is not its own", () => {
  const s = twoSeated();
  s.apply({ type: "release", clientId: "ben", spotId: 1 }, 0);
  assert.deepEqual(s.snapshot(0).notice, { for: "ben", text: "That seat is not yours." });
  s.apply({ type: "claim", clientId: "ben", spotId: 1 }, 0);
  assert.equal(said(s), "That seat is taken.");
  s.apply({ type: "release", clientId: "ben", spotId: 3 }, 0); // a free seat is not his either
  assert.equal(said(s), "That seat is not yours.");
  assert.deepEqual(seatsOf(s), [["ann", 1], ["ben", 2]]);
});

test("release from a phone that never joined is ignored, and a release mid-song drops that seat's part", () => {
  const s = twoSeated();
  s.apply({ type: "release", clientId: "ghost", spotId: 1 }, 0);
  assert.equal(said(s), null);
  start(s, ["scale"]);
  run(s, 0, START);
  s.apply({ type: "release", clientId: "ben", spotId: 2 }, START);
  assert.deepEqual(s.tick(START + 20, {}).pads.map((p) => p.spotId), [1]);
  assert.equal(s.snapshot(START + 20).team.total, splitParts(scale, 2)[0].notes.length); // only seat 1's part is left
});

test("leave gives back every seat the phone holds, and an unknown phone leaving does nothing", () => {
  const s = twoSeated();
  s.apply({ type: "claim", clientId: "ann", spotId: 3 }, 0);
  s.apply({ type: "leave", clientId: "ann" }, 0);
  assert.deepEqual(seatsOf(s), [["ben", 2]]);
  s.apply({ type: "join", clientId: "cat" }, 0);
  s.apply({ type: "claim", clientId: "cat", spotId: 1 }, 0);
  assert.deepEqual(seatsOf(s), [["cat", 1], ["ben", 2]]);
  s.apply({ type: "leave", clientId: "nobody" }, 0);
  assert.equal(s.snapshot(0).players.length, 2);
});

test("layout: changes the pads, frees seats that no longer exist, refused while a song plays", () => {
  const s = twoSeated();
  s.apply({ type: "claim", clientId: "ben", spotId: 3 }, 0);
  s.apply({ type: "layout", clientId: "ann", seats: 2 }, 0);
  const snap = s.snapshot(0);
  assert.equal(snap.layout.spots.length, 2);
  assert.equal(snap.layout.lanes, 1); // two seats are taken
  assert.equal("posture" in snap.layout, false);
  assert.deepEqual(seatsOf(s), [["ann", 1], ["ben", 2]]); // seat 3 is gone
  start(s);
  s.apply({ type: "layout", clientId: "ann", seats: 4 }, 100);
  assert.equal(said(s, 100), "The seats cannot change while a song is playing.");
  assert.equal(s.snapshot(100).layout.spots.length, 2);
  s.apply({ type: "stop", clientId: "ann" }, 200);
  s.apply({ type: "layout", clientId: "ann", seats: 4 }, 200);
  assert.equal(s.snapshot(200).layout.spots.length, 4);
});

test("layout: 0 or 5 seats are refused with the reason, wrong types are ignored, a posture is not needed", () => {
  const s = quiet({ songs });
  s.apply({ type: "join", clientId: "ann" }, 0);
  s.apply({ type: "layout", clientId: "ann", seats: 5 }, 0);
  assert.match(said(s), /1 to 4/);
  s.apply({ type: "layout", clientId: "ann", seats: 0 }, 0);
  assert.match(said(s), /1 to 4/);
  const before = s.snapshot(0);
  s.apply({ type: "layout", clientId: "ann", seats: "2" }, 0);
  assert.deepEqual(s.snapshot(0), before); // ignored: not even the notice changed
  s.apply({ type: "layout", clientId: "ann", posture: "standing", seats: 2 }, 0); // an old phone: the posture is ignored
  assert.deepEqual([s.snapshot(0).layout.spots.length, s.snapshot(0).layout.lanes], [2, 2]);
});

test("start is refused with a plain reason when it cannot work", () => {
  const s = quiet({ songs });
  s.apply({ type: "join", clientId: "ann" }, 0);
  start(s);
  assert.equal(said(s), "Pick a seat before starting.");
  s.apply({ type: "claim", clientId: "ann", spotId: 1 }, 0);
  start(s, []);
  assert.equal(said(s), "Pick at least one song.");
  start(s, ["tiny", "nope"]);
  assert.match(said(s), /not in the library/);
  assert.equal(s.snapshot(0).status, "lobby");
  start(s);
  assert.equal(s.snapshot(0).status, "countdown");
  start(s);
  assert.match(said(s), /already running/);
});

test("start needs a seat: a joined phone with no seat is not enough", () => {
  const s = quiet({ songs });
  s.apply({ type: "join", clientId: "a" }, 0);
  s.apply({ type: "join", clientId: "b" }, 0);
  s.apply({ type: "claim", clientId: "b", spotId: 2 }, 0);
  s.apply({ type: "leave", clientId: "b" }, 0);
  start(s, ["tiny"], { clientId: "a" });
  assert.equal(said(s), "Pick a seat before starting.");
  assert.equal(s.snapshot(0).status, "lobby");
});

test("start loads the first song, queues the rest, keeps the transit, counts down 3 seconds, then plays", () => {
  const s = twoSeated();
  start(s, ["tiny", "other"], { transit: { stop: "Kenmore", mode: "platform", endsAt: 1795300000000 } });
  let snap = s.snapshot(0);
  assert.equal(snap.status, "countdown");
  assert.deepEqual(snap.song, { id: "tiny", title: "Tiny Tune", seconds: 2 }); // 1.5 s rounds to 2
  assert.deepEqual(snap.queue, [{ id: "other", title: "Other Tune", seconds: 1 }]);
  assert.deepEqual(snap.transit, { stop: "Kenmore", mode: "platform", endsAt: 1795300000000 });
  assert.equal(snap.secondsLeft, Math.ceil((START + 1500) / 1000));
  assert.equal(s.tick(2900, {}).status, "countdown");
  assert.equal(s.tick(COUNTDOWN_MS, {}).status, "playing");
  snap = s.snapshot(COUNTDOWN_MS);
  assert.equal(snap.status, "playing");
  assert.equal(snap.secondsLeft, Math.ceil((TRAVEL_MS + 1500) / 1000));
  assert.deepEqual(s.drain().filter((e) => e.type === "status").map((e) => e.status), ["countdown", "playing"]);
});

test("a transit that is not null or { stop, mode, endsAt } makes start ignored", () => {
  const s = twoSeated();
  start(s, ["tiny"], { transit: { stop: "Kenmore", mode: "bus", endsAt: 1 } });
  start(s, ["tiny"], { transit: "Kenmore" });
  start(s, ["tiny"], { transit: { stop: 5, mode: "train", endsAt: null } });
  assert.equal(s.snapshot(0).status, "lobby");
  start(s, ["tiny"], { transit: null });
  assert.equal(s.snapshot(0).transit, null);
  assert.equal(s.snapshot(0).status, "countdown");
});

test("two seats score separately: each steps on its own part of the same song", () => {
  const s = twoSeated();
  start(s, ["scale"]);
  const [a, b] = splitParts(scale, 2);
  run(s, 0, START + 4400, play(scale, [1, 2], [1])); // only seat 1 steps
  const ann = player(s, 1, START + 4400);
  const ben = player(s, 2, START + 4400);
  assert.deepEqual(ann.counts, { perfect: a.notes.length, good: 0, miss: 0 });
  assert.equal(ann.combo, a.notes.length);
  assert.ok(ann.score > 0);
  assert.equal(ann.total, a.notes.length);
  assert.equal(ben.total, b.notes.length);
  assert.equal(ben.counts.perfect, 0);
  assert.equal(ben.counts.miss, b.notes.length);
  assert.equal(ben.score, 0);
  const hits = s.drain().filter((e) => e.type === "hit");
  assert.equal(hits.length, a.notes.length);
  assert.ok(hits.every((e) => e.spotId === 1));
});

test("drain gives engine events with their seat, status changes, and is empty after a call", () => {
  const s = twoSeated();
  start(s);
  run(s, 0, START + 120, play(tiny, [1, 2], [1]));
  const events = s.drain();
  const hit = events.find((e) => e.type === "hit");
  assert.equal(hit.spotId, 1);
  assert.equal(hit.midi, 60);
  assert.equal(hit.grade, "perfect");
  assert.deepEqual(s.drain(), []);
});

test("when every engine is done the status is results, grades are in, and 8 seconds later the queue moves on", () => {
  const s = twoSeated();
  start(s, ["tiny", "other"]);
  run(s, 0, START + 1700, play(tiny, [1, 2]));
  assert.equal(s.snapshot(START + 1700).status, "results");
  assert.equal(player(s, 1, START + 1700).grade, "S");
  const resultsFrom = s.drain().find((e) => e.type === "status" && e.status === "results");
  assert.ok(resultsFrom);
  const began = START + 1500; // the first tick at or after the song's end
  assert.equal(s.tick(began + RESULTS_MS - 20, {}).status, "results");
  assert.equal(s.snapshot(began).song.id, "tiny"); // the song stays up for the results
  assert.equal(s.tick(began + RESULTS_MS, {}).status, "countdown");
  const snap = s.snapshot(began + RESULTS_MS);
  assert.equal(snap.song.id, "other");
  assert.deepEqual(snap.queue, []);
  assert.equal(player(s, 1, began + RESULTS_MS).score, 0); // fresh engines for the next song
});

test("after the last song the results end in the lobby, and the transit is cleared", () => {
  const s = twoSeated();
  start(s, ["tiny"], { transit: { stop: "Kenmore", mode: "train", endsAt: null } });
  run(s, 0, START + 1700);
  const at = START + 1500;
  assert.equal(s.tick(at + RESULTS_MS, {}).status, "lobby");
  const snap = s.snapshot(at + RESULTS_MS);
  assert.equal(snap.transit, null);
  assert.equal(snap.song, null);
  assert.equal(snap.players.length, 2); // everyone keeps their seat
  assert.equal(snap.players[0].spotId, 1);
});

test("pause freezes every clock and tile, resume carries on from the same place", () => {
  const s = twoSeated();
  start(s, ["tiny"]);
  const before = run(s, 0, START - 600); // tiles are sliding in
  assert.ok(before.pads[0].tiles.length > 0);
  s.apply({ type: "pause", clientId: "ann" }, START - 600);
  assert.equal(s.snapshot(START - 600).status, "paused");
  const secondsLeft = s.snapshot(START - 600).secondsLeft;
  alive(s, START + 9000);
  const paused = s.tick(START + 9000, {}); // a long time later, still paused
  assert.equal(paused.status, "paused");
  assert.deepEqual(paused.pads, before.pads);
  assert.equal(s.snapshot(START + 9000).secondsLeft, secondsLeft);
  s.apply({ type: "resume", clientId: "ann" }, START + 9000);
  assert.equal(s.snapshot(START + 9000).status, "playing");
  const after = s.tick(START + 9000 + 20, {});
  const t0 = before.pads[0].tiles[0];
  const t1 = after.pads[0].tiles.find((t) => t.id === t0.id);
  assert.ok(t1.v > t0.v && t1.v - t0.v < 0.02, `tile moved ${t1.v - t0.v}`); // only one 20 ms frame later
});

test("pause in the countdown resumes into the countdown", () => {
  const s = twoSeated();
  start(s);
  s.tick(1000, {});
  s.apply({ type: "pause", clientId: "ann" }, 1000);
  s.apply({ type: "resume", clientId: "ann" }, 5000);
  assert.equal(s.snapshot(5000).status, "countdown");
  assert.equal(s.tick(5000 + 1900, {}).status, "countdown");
  assert.equal(s.tick(5000 + 2000, {}).status, "playing");
});

test("pause and resume are refused when they make no sense", () => {
  const s = twoSeated();
  s.apply({ type: "pause", clientId: "ann" }, 0);
  assert.match(said(s), /Nothing is playing/);
  start(s);
  s.apply({ type: "resume", clientId: "ann" }, 0);
  assert.match(said(s), /not paused/);
});

test("skip jumps to the next queued song, or ends in the lobby", () => {
  const s = twoSeated();
  s.apply({ type: "skip", clientId: "ann" }, 0);
  assert.match(said(s), /Nothing is playing/);
  start(s, ["tiny", "other"]);
  run(s, 0, 4000);
  s.apply({ type: "skip", clientId: "ann" }, 4000);
  assert.equal(s.snapshot(4000).song.id, "other");
  assert.equal(s.snapshot(4000).status, "countdown");
  s.apply({ type: "skip", clientId: "ann" }, 4100);
  assert.equal(s.snapshot(4100).status, "lobby");
  assert.equal(s.snapshot(4100).song, null);
});

test("stop ends everything and empties the queue", () => {
  const s = twoSeated();
  start(s, ["tiny", "other"]);
  run(s, 0, 1000);
  s.apply({ type: "stop", clientId: "ann" }, 1000);
  const snap = s.snapshot(1000);
  assert.deepEqual([snap.status, snap.song, snap.queue, snap.secondsLeft], ["lobby", null, [], 0]);
  assert.equal(s.tick(2000, {}).pads.length, 0);
  assert.deepEqual(s.drain().filter((e) => e.type === "status").map((e) => e.status), ["countdown", "lobby"]);
});

test("a phone that leaves mid-song loses its pads, and the last one leaving ends the song", () => {
  const s = twoSeated();
  start(s);
  run(s, 0, START);
  s.apply({ type: "leave", clientId: "ben" }, START);
  assert.deepEqual(s.tick(START + 20, {}).pads.map((p) => p.spotId), [1]);
  assert.equal(s.snapshot(START + 20).status, "playing");
  s.apply({ type: "leave", clientId: "ann" }, START + 40);
  assert.equal(s.snapshot(START + 40).status, "lobby");
});

test("seat changes are refused while a song plays and accepted once the results show", () => {
  const s = twoSeated();
  s.apply({ type: "join", clientId: "cat" }, 0);
  start(s);
  s.apply({ type: "claim", clientId: "cat", spotId: 3 }, 100);
  assert.match(said(s, 100), /song is playing/);
  assert.equal(player(s, 3, 100), undefined);
  run(s, 0, START + 1700);
  s.apply({ type: "claim", clientId: "cat", spotId: 3 }, START + 1700);
  assert.equal(player(s, 3, START + 1700).clientId, "cat");
});

test("calibrate changes nothing and is passed on as an event", () => {
  const s = twoSeated();
  const before = s.snapshot(0);
  s.apply({ type: "calibrate", clientId: "ann" }, 0);
  assert.deepEqual(s.snapshot(0), before);
  assert.deepEqual(s.drain(), [{ type: "calibrate" }]);
});

test("set changes volume, the delay and the warm-up switch, clamps wild values, ignores the wrong type", () => {
  const s = createSession({ songs });
  s.apply({ type: "join", clientId: "ann" }, 0);
  s.apply({ type: "set", clientId: "ann", volume: 0.3 }, 0);
  assert.deepEqual(s.snapshot(0).settings, { volume: 0.3, offsetMs: 120, warmup: true });
  s.apply({ type: "set", clientId: "ann", volume: 7, offsetMs: 87.6 }, 0);
  assert.deepEqual(s.snapshot(0).settings, { volume: 1, offsetMs: 88, warmup: true });
  s.apply({ type: "set", clientId: "ann", volume: -2, offsetMs: -99999 }, 0);
  assert.deepEqual(s.snapshot(0).settings, { volume: 0, offsetMs: -1000, warmup: true });
  s.apply({ type: "set", clientId: "ann", volume: "loud", offsetMs: NaN, warmup: "no" }, 0);
  assert.deepEqual(s.snapshot(0).settings, { volume: 0, offsetMs: -1000, warmup: true });
  s.apply({ type: "set", clientId: "ann", warmup: false }, 0);
  assert.equal(s.snapshot(0).settings.warmup, false);
  s.apply({ type: "set", clientId: "ann", warmup: true }, 0);
  assert.equal(s.snapshot(0).settings.warmup, true);
});

test("bad messages are ignored and never throw", () => {
  const s = twoSeated();
  const before = s.snapshot(0);
  const bad = [undefined, null, 5, "start", [], {}, { type: 7 }, { type: "nope" }, { type: "__proto__" }, { type: "constructor" },
    { type: "join" }, { type: "join", clientId: 5 }, { type: "join", clientId: "" }, { type: "join", clientId: "x".repeat(65) },
    { type: "claim" }, { type: "claim", clientId: "ann", spotId: "1" }, { type: "claim", clientId: "ann", spotId: 1.5 },
    { type: "release" }, { type: "release", clientId: "ann" }, { type: "release", clientId: "ann", spotId: "1" }, { type: "release", clientId: {}, spotId: 1 },
    { type: "leave" }, { type: "leave", clientId: {} }, { type: "layout" },
    { type: "start" }, { type: "start", songIds: "tiny" }, { type: "start", songIds: [1, 2] }, { type: "start", songIds: [null] },
    { type: "set" }, { type: "set", volume: null }];
  for (const m of bad) assert.doesNotThrow(() => s.apply(m, 0));
  assert.deepEqual(s.snapshot(0), before);
  assert.deepEqual(s.drain(), []);
  assert.doesNotThrow(() => s.tick(0, null));
  assert.doesNotThrow(() => s.tick(10, { 1: "nonsense" }));
});

test("bad messages mid-song do not disturb the game", () => {
  const s = twoSeated();
  start(s);
  run(s, 0, START - 100);
  for (const m of [null, { type: "start", songIds: ["tiny"] }, { type: "join" }, { type: "resume", clientId: "ann" }, { type: "layout", clientId: "ann", seats: 1 }]) s.apply(m, START);
  assert.equal(s.snapshot(START).status, "playing");
  assert.equal(s.tick(START, {}).pads.length, 2);
});

test("setReady and setLayout are the stage's own controls", () => {
  const s = quiet({ songs });
  s.setReady({ camera: true });
  assert.deepEqual(s.snapshot(0).ready, { camera: true, calibrated: false });
  s.setReady({ calibrated: true });
  assert.deepEqual(s.snapshot(0).ready, { camera: true, calibrated: true });
  const dragged = makeLayout({ seats: 2 });
  dragged.spots[0].rect.u = 0.2;
  assert.equal(s.setLayout(dragged), true);
  assert.equal(s.snapshot(0).layout.spots[0].rect.u, 0.2);
  assert.equal(s.setLayout({ lanes: 2 }), false);
  assert.equal(quiet({ songs, layout: dragged }).snapshot(0).layout.spots[0].rect.u, 0.2);
  assert.equal(quiet({ songs, layout: "junk" }).snapshot(0).layout.spots.length, 4);
});

test("a saved layout from before, with a posture and 3 or 4 lanes, loads as 2 lanes", () => {
  const old = { posture: "standing", lanes: 4, spots: makeLayout({ seats: 2 }).spots };
  const snap = quiet({ songs, layout: old }).snapshot(0);
  assert.deepEqual(snap.layout, makeLayout({ seats: 2 }));
  const s = quiet({ songs });
  assert.equal(s.setLayout(old), true);
  assert.deepEqual(s.snapshot(0).layout, makeLayout({ seats: 2 }));
});

test("tick returns the song clock and the song: negative in the lead-in, frozen while paused, null when idle", () => {
  const s = twoSeated();
  assert.deepEqual([s.tick(0, {}).songMs, s.tick(0, {}).song], [null, null]);
  start(s, ["tiny"]);
  const lead = s.tick(1000, {});
  assert.equal(lead.status, "countdown");
  assert.equal(lead.songMs, 1000 - START);
  assert.equal(lead.song, tiny); // the full song, with its notes
  assert.equal(s.tick(START, {}).songMs, 0); // the first beat is due now
  assert.equal(s.tick(START + 400, {}).songMs, 400);
  s.apply({ type: "pause", clientId: "ann" }, START + 400);
  alive(s, START + 9000);
  assert.equal(s.tick(START + 9000, {}).songMs, 400);
  s.apply({ type: "resume", clientId: "ann" }, START + 9000);
  assert.equal(s.tick(START + 9100, {}).songMs, 500);
  s.apply({ type: "stop", clientId: "ann" }, START + 9100);
  assert.deepEqual([s.tick(START + 9200, {}).songMs, s.tick(START + 9200, {}).song], [null, null]);
});

// ---- Wave 3: parts, the notice, the 10 second rule, restore, the joined-only rule, the lag ----

test("parts: two seats get different tiles from the same song, and each seat's total is its own part's", () => {
  const s = twoSeated();
  start(s, ["long"]);
  const view = run(s, 0, START + 5000);
  const [a, b] = splitParts(long, 2);
  assert.equal(player(s, 1, START).total, a.notes.length);
  assert.equal(player(s, 2, START).total, b.notes.length);
  const beats = new Set([...a.notes, ...b.notes].map((n) => n.beat));
  assert.ok(long.notes.every((n) => beats.has(n.beat)), "every note of the song is somebody's tile"); // some tiles go to both players at once
  assert.notDeepEqual(view.pads[0].tiles, view.pads[1].tiles);
  const misses = s.drain().filter((e) => e.type === "miss"); // nobody steps, so every tile is missed in its own seat
  assert.ok(misses.some((e) => e.spotId === 1) && misses.some((e) => e.spotId === 2));
});

test("parts: every seat plays at the same time, so every pad has a tile on the line together", () => {
  const s = twoSeated();
  start(s, ["long"]); // both pads have tiles on the floor in the same frame at some time in the first seconds
  let together = false;
  for (let t = 0; t <= START + 6000; t += 20) {
    alive(s, t);
    together ||= s.tick(t, {}).pads.every((p) => p.tiles.some((tile) => tile.v > 0 && tile.v < 1));
  }
  assert.ok(together, "both pads have tiles on the floor at once");
});

test("parts: seats are dealt in seat order, whoever joined first", () => {
  const s = quiet({ songs });
  s.apply({ type: "join", clientId: "ann" }, 0);
  s.apply({ type: "join", clientId: "ben" }, 0);
  s.apply({ type: "claim", clientId: "ann", spotId: 3 }, 0); // Ann joined first but sits in seat 3
  s.apply({ type: "claim", clientId: "ben", spotId: 1 }, 0);
  start(s, ["scale"]);
  const [first, second] = splitParts(scale, 2);
  assert.notEqual(first.notes.length, second.notes.length); // the premise: the two parts differ, so the order shows
  assert.equal(player(s, 1).total, first.notes.length); // Ben's seat 1 is the first part
  assert.equal(player(s, 3).total, second.notes.length);
});

test("team: the seats added up, the grade only once every part is finished, from gradeFor", () => {
  const s = twoSeated();
  assert.deepEqual(s.snapshot(0).team, { score: 0, hits: 0, total: 0, grade: null });
  start(s, ["scale"]);
  const [a, b] = splitParts(scale, 2);
  const total = a.notes.length + b.notes.length;
  run(s, 0, START + 1400, play(scale, [1, 2], [1])); // only seat 1 steps
  let team = s.snapshot(START + 1400).team;
  assert.equal(team.grade, null); // still playing: no grade yet
  assert.equal(team.total, total);
  assert.equal(team.score, player(s, 1, START + 1400).score);
  run(s, START + 1420, START + 4400, play(scale, [1, 2], [1]));
  team = s.snapshot(START + 4400).team;
  assert.equal(s.snapshot(START + 4400).status, "results");
  assert.deepEqual([team.hits, team.total, team.grade], [a.notes.length, total, gradeFor(a.notes.length, total)]);
  assert.notEqual(team.grade, "S");
});

test("team: two seats that play everything score S together", () => {
  const s = twoSeated();
  start(s, ["tiny"]);
  run(s, 0, START + 1700, play(tiny, [1, 2]));
  const team = s.snapshot(START + 1700).team;
  assert.deepEqual([team.hits, team.total, team.grade], [3, 3, "S"]);
  assert.equal(team.score, player(s, 1, START + 1700).score + player(s, 2, START + 1700).score + 75); // plus the bonuses (seat 1 won both)
});

test("a phone that leaves mid-song leaves its part unplayed, and the team no longer counts it", () => {
  const s = twoSeated();
  start(s, ["long"]);
  run(s, 0, START + 100);
  const [a, b] = splitParts(long, 2);
  assert.equal(s.snapshot(START + 100).team.total, a.notes.length + b.notes.length);
  s.apply({ type: "leave", clientId: "ben" }, START + 100);
  assert.equal(s.snapshot(START + 100).team.total, a.notes.length);
  assert.deepEqual(s.tick(START + 120, {}).pads.map((p) => p.spotId), [1]);
});

test("a seat with no notes in its part is done at once and gives the team nothing to lose", () => {
  const one = { id: "one", title: "One note", bpm: 120, notes: [{ beat: 0, midi: 60, beats: 1 }] };
  const solo = quiet({ songs: [one] });
  solo.apply({ type: "join", clientId: "ann" }, 0);
  for (const spotId of [1, 2, 3]) solo.apply({ type: "claim", clientId: "ann", spotId }, 0);
  solo.apply({ type: "start", clientId: "ann", songIds: ["one"] }, 0);
  assert.deepEqual(solo.snapshot(0).players.map((p) => p.total), [1, 0, 0]); // one note goes to the first lane
  run(solo, 0, START + 1000, play(one, [1, 2, 3]));
  const end = solo.snapshot(START + 1000);
  assert.equal(end.status, "results");
  assert.deepEqual(end.players.map((p) => p.grade), ["S", null, null]);
  assert.equal(end.team.grade, "S");
});

// ---- Wave 5: the train, the QR address, bonuses ----

const RED = { line: "Red", directionId: 0, headsign: "Ashmont/Braintree", atStopId: "place-pktrm", atStopName: "Park Street", car: 3 };

test("train: the default is Green B at Boston University Central, car 2, and the State's train is a copy", () => {
  assert.deepEqual(DEFAULT_TRAIN, { line: "Green-B", directionId: 1, headsign: "Government Center", atStopId: "place-bucen", atStopName: "Boston University Central", car: 2 });
  const s = quiet({ songs });
  assert.deepEqual(s.snapshot(0).train, DEFAULT_TRAIN);
  s.snapshot(0).train.car = 9;
  assert.equal(s.snapshot(0).train.car, 2);
  assert.equal("section" in s.snapshot(0), false);
});

test("train: a saved train is used, a broken one is ignored, and setTrain checks every part", () => {
  assert.deepEqual(quiet({ songs, train: RED }).snapshot(0).train, RED);
  const junk = [undefined, null, "Red", 7, {}, { ...RED, line: "Purple" }, { ...RED, line: "constructor" }, { ...RED, directionId: 2 }, { ...RED, directionId: "0" },
    { ...RED, headsign: "" }, { ...RED, atStopId: 5 }, { ...RED, atStopName: undefined }, { ...RED, car: 0 }, { ...RED, car: 13 }, { ...RED, car: 1.5 }, { ...RED, car: "3" }];
  for (const bad of junk) assert.deepEqual(quiet({ songs, train: bad }).snapshot(0).train, DEFAULT_TRAIN);
  const s = quiet({ songs });
  assert.equal(s.setTrain({ ...RED, extra: "dropped" }), true);
  assert.deepEqual(s.snapshot(0).train, RED);
  for (const bad of junk) assert.equal(s.setTrain(bad), false);
  assert.deepEqual(s.snapshot(0).train, RED); // a refused train changes nothing
});

test("train: the address names the train, and a part that is missing or wrong falls back to the default's", () => {
  assert.deepEqual(trainFromAddress("?demo=1&feet=mouse&line=Red&dir=0&at=place-pktrm&car=3"), { ...RED, atStopName: "place-pktrm" }); // the name is not in the address
  assert.deepEqual(trainFromAddress("?line=Green-B&dir=1&at=place-bucen&car=2"), DEFAULT_TRAIN);
  assert.equal(trainFromAddress(""), null);
  assert.equal(trainFromAddress("?demo=1&feet=mouse"), null); // names none of the four
  assert.deepEqual(trainFromAddress("?car=4"), { ...DEFAULT_TRAIN, car: 4 });
  assert.deepEqual(trainFromAddress("?line=Orange"), { ...DEFAULT_TRAIN, line: "Orange", headsign: "Oak Grove" }); // headsign follows line and direction
  for (const search of ["?line=Nope&dir=7&at=&car=99", "?line=constructor&dir=-1&car=abc", "?line=__proto__&car=0", "?car=2.5", "?car=%E2%82%82"]) {
    assert.deepEqual(trainFromAddress(search), DEFAULT_TRAIN, search);
  }
  assert.equal(quiet({ songs, train: trainFromAddress("?line=Blue&dir=1&at=place-state&car=1") }).snapshot(0).train.headsign, "Wonderland");
});

test("train: the QR address carries the train, and reading it back gives the same train", () => {
  assert.equal(trainQuery(DEFAULT_TRAIN), "?line=Green-B&dir=1&at=place-bucen&car=2");
  assert.equal(trainQuery(RED), "?line=Red&dir=0&at=place-pktrm&car=3");
  const phone = new URL("http://192.168.1.20:5173/" + trainQuery(RED));
  assert.deepEqual(trainFromAddress(phone.search), { ...RED, atStopName: "place-pktrm" });
  for (const line of ["Red", "Mattapan", "Orange", "Blue", "Green-B", "Green-C", "Green-D", "Green-E"]) {
    for (const directionId of [0, 1]) {
      const t = trainFromAddress(trainQuery({ ...DEFAULT_TRAIN, line, directionId }));
      assert.deepEqual([t.line, t.directionId, t.atStopId, t.car], [line, directionId, "place-bucen", 2]);
      assert.deepEqual(quiet({ songs }).setTrain(t), true); // every train the address can make is one the session accepts
    }
  }
});

// Runs from wall time 0 until just past the song's end, so the results show.
const playOut = (s, song, feetAt) => run(s, 0, START + Math.ceil(songMs(song)) + 300, feetAt);
const songMs = (song) => Math.max(...song.notes.map((n) => n.beat + n.beats)) * (60000 / song.bpm);

test("bonus: 50 to the best combo and 25 to the most perfects, split between two seats when each wins one", () => {
  const s = twoSeated();
  start(s, ["long"]);
  const late = play(long, [1, 2], [1], 200); // seat 1 steps every tile 200 ms late: all good, none perfect, never a miss
  const clean = play(long, [1, 2], [2]); // seat 2 is perfect except for one tile in the middle of its part
  const mid = splitParts(long, 2)[1].notes;
  const skip = mid[Math.floor(mid.length / 2)];
  const gapFrom = START + skip.beat * 500 - 50;
  const gapTo = START + skip.beat * 500 + (skip.hold ? skip.beats * 500 : 100) + 50;
  playOut(s, long, (wall) => ({ ...late(wall), ...(wall >= gapFrom && wall < gapTo ? {} : clean(wall)) }));
  const end = s.snapshot(START + 17000);
  assert.equal(end.status, "results");
  const [a, b] = end.players;
  assert.deepEqual([a.counts.perfect, a.counts.miss, a.maxCombo], [0, 0, a.total]); // the premise: seat 1 has the combo
  assert.ok(b.counts.perfect > 0 && b.counts.miss > 0 && b.maxCombo < a.total, "seat 2 has the perfects");
  assert.deepEqual([a.bonus, a.bonusFor], [50, "Best combo"]);
  assert.deepEqual([b.bonus, b.bonusFor], [25, "Most perfects"]);
  assert.equal(end.team.score, a.score + b.score + 75); // the team total includes bonuses
});

test("bonus: one seat that wins both gets 75 and both reasons; the other gets nothing", () => {
  const s = twoSeated();
  start(s, ["tiny"]);
  playOut(s, tiny, play(tiny, [1, 2])); // seat 1 plays two notes, seat 2 one: both step everything
  const [a, b] = s.snapshot(START + 1700).players;
  assert.deepEqual([a.bonus, a.bonusFor], [75, "Best combo, Most perfects"]);
  assert.deepEqual([b.bonus, b.bonusFor], [0, null]);
  assert.equal(s.snapshot(START + 1700).team.score, a.score + b.score + 75);
});

test("bonus: a tie gives the bonus to every seat tied", () => {
  const s = quiet({ songs });
  s.apply({ type: "join", clientId: "ann" }, 0);
  for (const spotId of [1, 2, 3]) s.apply({ type: "claim", clientId: "ann", spotId }, 0);
  start(s, ["scale"]); // the seats' parts are 3, 2 and 3 notes
  playOut(s, scale, play(scale, [1, 2, 3]));
  const end = s.snapshot(START + 4700);
  assert.deepEqual(end.players.map((p) => [p.bonus, p.bonusFor]), [[75, "Best combo, Most perfects"], [0, null], [75, "Best combo, Most perfects"]]);
  assert.equal(end.team.score, end.players.reduce((n, p) => n + p.score + p.bonus, 0));
});

test("bonus: nobody scores a combo or a perfect, nobody gets a bonus", () => {
  const s = twoSeated();
  start(s, ["tiny"]);
  playOut(s, tiny, () => ({})); // nobody steps
  const end = s.snapshot(START + 1700);
  assert.equal(end.status, "results");
  assert.deepEqual(end.players.map((p) => [p.bonus, p.bonusFor]), [[0, null], [0, null]]);
  assert.equal(end.team.score, 0);
});

test("bonus: none while the song plays or when it is skipped, and the next song starts clean", () => {
  const s = twoSeated();
  start(s, ["tiny", "other"]);
  run(s, 0, START + 600, play(tiny, [1, 2])); // seat 1 has hit its first notes, the song is not over
  assert.deepEqual(s.snapshot(START + 600).players.map((p) => p.bonus), [0, 0]);
  s.apply({ type: "skip", clientId: "ann" }, START + 700); // a skipped song pays nothing
  assert.deepEqual(s.snapshot(START + 700).players.map((p) => [p.bonus, p.bonusFor]), [[0, null], [0, null]]);
  const from = START + 700;
  const feet = (wall) => play(other, [1, 2], [1, 2], from)(wall);
  run(s, from, from + START + 1200, feet);
  assert.equal(s.snapshot(from + START + 1200).status, "results");
  assert.equal(s.snapshot(from + START + 1200).players[0].bonus, 75);
});

test("bonus: cleared when the next song starts and when the game goes back to the lobby", () => {
  const s = twoSeated();
  start(s, ["tiny", "other"]);
  run(s, 0, START + 1700, play(tiny, [1, 2]));
  assert.equal(player(s, 1, START + 1700).bonus, 75);
  const began = START + 1500;
  assert.equal(s.tick(began + RESULTS_MS, {}).status, "countdown");
  assert.deepEqual(s.snapshot(began + RESULTS_MS).players.map((p) => [p.bonus, p.bonusFor]), [[0, null], [0, null]]);
  s.apply({ type: "stop", clientId: "ann" }, began + RESULTS_MS + 100);
  assert.deepEqual(s.snapshot(began + RESULTS_MS + 100).players.map((p) => [p.bonus, p.bonusFor]), [[0, null], [0, null]]);
});

test("bonus: a seat that left before the end is not counted, and a seat with no notes gets nothing", () => {
  const s = twoSeated();
  start(s, ["long"]);
  run(s, 0, START + 100);
  s.apply({ type: "leave", clientId: "ben" }, START + 100); // seat 1 plays the rest alone
  run(s, START + 120, START + 16800, play(long, [1, 2], [1]));
  const end = s.snapshot(START + 16800);
  assert.equal(end.status, "results");
  assert.deepEqual(end.players.map((p) => [p.spotId, p.bonus]), [[1, 75]]);
  const one = { id: "one", title: "One note", bpm: 120, notes: [{ beat: 0, midi: 60, beats: 1 }] };
  const solo = quiet({ songs: [one] });
  solo.apply({ type: "join", clientId: "ann" }, 0);
  for (const spotId of [1, 2, 3]) solo.apply({ type: "claim", clientId: "ann", spotId }, 0);
  solo.apply({ type: "start", clientId: "ann", songIds: ["one"] }, 0);
  run(solo, 0, START + 1000, play(one, [1, 2, 3]));
  assert.deepEqual(solo.snapshot(START + 1000).players.map((p) => p.bonus), [75, 0, 0]);
});

test("notice: { for, text }, for the phone that sent the refused command, gone after 4 seconds", () => {
  const s = twoSeated();
  s.apply({ type: "claim", clientId: "ben", spotId: 1 }, 1000);
  assert.deepEqual(s.snapshot(1000).notice, { for: "ben", text: "That seat is taken." });
  assert.equal(s.snapshot(4999).notice.for, "ben");
  assert.equal(s.snapshot(5000).notice, null);
  s.apply({ type: "stop", clientId: "ann" }, 6000); // refused: nothing is playing
  assert.deepEqual(s.snapshot(6000).notice, { for: "ann", text: "Nothing is playing to stop." });
  s.apply({ type: "claim", clientId: "ben", spotId: 1 }, 7000); // a newer refusal replaces it
  assert.equal(s.snapshot(7000).notice.for, "ben");
  s.apply({ type: "stop" }, 8000, { stage: true }); // the laptop's own key: the notice is for everyone
  assert.deepEqual(s.snapshot(8000).notice, { for: null, text: "Nothing is playing to stop." });
});

test("notice: the sender's next accepted command clears it, another phone's command or a here does not", () => {
  const s = twoSeated();
  s.apply({ type: "claim", clientId: "ben", spotId: 1 }, 0);
  s.apply({ type: "here", clientId: "ben" }, 100);
  s.apply({ type: "claim", clientId: "ann", spotId: 1 }, 200); // Ann already holds seat 1: accepted, but it is not Ben's notice
  assert.equal(said(s, 200), "That seat is taken.");
  s.apply({ type: "claim", clientId: "ben", spotId: 3 }, 300);
  assert.equal(said(s, 300), null);
});

test("a refusal made when two phones start at once is for the one that was refused only", () => {
  const s = twoSeated();
  start(s, ["tiny"]);
  s.apply({ type: "start", clientId: "ben", songIds: ["tiny"] }, 0);
  assert.deepEqual(s.snapshot(0).notice, { for: "ben", text: "A song is already running. Stop it first." });
});

test("a phone that goes quiet for over 10 seconds is removed and its seat is free, in the lobby", () => {
  const s = twoSeated();
  s.tick(10000, {});
  assert.equal(s.snapshot(10000).players.length, 2); // exactly 10 s: still there
  s.apply({ type: "here", clientId: "ann" }, 10000);
  s.tick(10001, {});
  assert.deepEqual(seatsOf(s, 10001), [["ann", 1]]); // Ben went quiet
  s.apply({ type: "join", clientId: "cat" }, 10002);
  s.apply({ type: "claim", clientId: "cat", spotId: 2 }, 10002);
  assert.equal(player(s, 2, 10002).clientId, "cat"); // his seat is free again
});

test("a silent phone loses all its seats, and the other phones keep theirs", () => {
  const s = twoSeated();
  s.apply({ type: "claim", clientId: "ben", spotId: 3 }, 0); // Ben holds seats 2 and 3
  s.apply({ type: "here", clientId: "ann" }, 10000);
  s.tick(10001, {});
  assert.deepEqual(seatsOf(s, 10001), [["ann", 1]]);
  start(s, ["scale"]);
  assert.equal(s.snapshot(10001).players[0].total, scale.notes.length); // Ann's one seat plays the whole song
});

test("any message counts as the phone being there, not only here", () => {
  const s = twoSeated();
  for (let t = 5000; t <= 30000; t += 5000) s.apply({ type: "claim", clientId: "ann", spotId: 1 }, t);
  s.tick(30000, {});
  assert.deepEqual(seatsOf(s, 30000), [["ann", 1]]);
});

test("during a song a quiet phone keeps its seats (phones lock while players look at the floor); the wait starts when the song ends", () => {
  const s = twoSeated();
  start(s, ["long"]);
  const quiet = (from, to) => { for (let t = from; t <= to; t += 20) s.tick(t, {}); }; // ticks with no phone saying a word
  quiet(0, 15000); // 15 s of countdown and play
  assert.equal(s.snapshot(15000).status, "playing");
  assert.deepEqual(seatsOf(s, 15000), [["ann", 1], ["ben", 2]]);
  quiet(15020, 25000); // the song ends by itself, between 21 and 25 s
  assert.equal(s.snapshot(25000).status, "results");
  s.apply({ type: "here", clientId: "ann" }, 49000);
  s.tick(50000, {}); // under 30 s after the song: Ben still has time to wake his phone
  assert.deepEqual(seatsOf(s, 50000), [["ann", 1], ["ben", 2]]);
  s.apply({ type: "here", clientId: "ann" }, 55000);
  s.tick(55500, {}); // over 30 s: Ben is gone, Ann spoke and stays
  assert.deepEqual(seatsOf(s, 55500), [["ann", 1]]);

  const r = twoSeated();
  start(r, ["tiny"]);
  run(r, 0, START + 1700, play(tiny, [1, 2]));
  assert.equal(r.snapshot(START + 1700).status, "results");
  r.apply({ type: "here", clientId: "ann" }, START + 31000);
  r.tick(START + 32000, {}); // Ben has been quiet since the song ended at about START + 1700
  assert.deepEqual(seatsOf(r, START + 32000), [["ann", 1]]);
});

test("here from a phone that never joined is ignored", () => {
  const s = quiet({ songs });
  s.apply({ type: "here", clientId: "stranger" }, 0);
  assert.equal(s.snapshot(0).players.length, 0);
  assert.equal(said(s), null);
});

test("restore: a reloaded stage gives back the seats, one phone with several, and they still fall under the 10 second rule", () => {
  const s = quiet({ songs });
  s.restore([{ clientId: "ann", spotId: 1 }, { clientId: "ben", spotId: 3 }, { clientId: "ann", spotId: 2 }], 500);
  assert.deepEqual(seatsOf(s, 500), [["ann", 1], ["ann", 2], ["ben", 3]]);
  assert.equal(said(s, 500), null); // nothing was playing
  s.apply({ type: "here", clientId: "ann" }, 9000);
  s.tick(10501, {});
  assert.deepEqual(seatsOf(s, 10501), [["ann", 1], ["ann", 2]]);
});

test("restore: a stage that restarted mid-song comes back in the lobby with a notice for everyone", () => {
  const s = quiet({ songs });
  s.restore([{ clientId: "ann", spotId: 1 }], 0, true);
  const snap = s.snapshot(100);
  assert.equal(snap.status, "lobby");
  assert.deepEqual(snap.notice, { for: null, text: "The floor restarted. Start the song again." });
  assert.equal(s.snapshot(4000).notice, null);
  assert.equal(snap.players[0].spotId, 1);
  s.apply({ type: "start", clientId: "ann", songIds: ["tiny"] }, 200); // and they can start straight away
  assert.equal(s.snapshot(200).status, "countdown");
});

test("restore: broken, duplicate and impossible entries are skipped, and it never throws", () => {
  const s = quiet({ songs });
  const saved = [null, 5, "x", {}, { clientId: "", spotId: 1 }, { clientId: "d", spotId: 9 }, { clientId: "e", spotId: 1 },
    { clientId: "f", spotId: 1 }, { clientId: "e", spotId: 2 }, { clientId: "g", spotId: "1" }, { clientId: "h", spotId: null },
    { clientId: "old", name: "Old", spotId: 3 }]; // a save from before names were dropped still loads
  assert.doesNotThrow(() => s.restore(saved, 0, true));
  // Seat 9 does not exist, so Dee's phone is known but holds no seat; Fay wanted Eve's seat; the second "e" adds seat 2.
  assert.deepEqual(seatsOf(s), [["e", 1], ["e", 2], ["old", 3]]);
  for (const junk of [undefined, null, "players", {}, 4]) assert.doesNotThrow(() => quiet({ songs }).restore(junk, 0));
});

test("restore does nothing on a session that already has phones, and no notice for an empty list", () => {
  const s = twoSeated();
  s.restore([{ clientId: "zed", spotId: 3 }], 0, true);
  assert.deepEqual(seatsOf(s), [["ann", 1], ["ben", 2]]);
  const e = quiet({ songs });
  e.restore([], 0, true);
  assert.equal(e.snapshot(0).notice, null);
});

test("game commands are accepted only from a phone that has joined", () => {
  const s = twoSeated();
  const before = s.snapshot(0);
  for (const m of [{ type: "start", songIds: ["tiny"] }, { type: "pause" }, { type: "skip" }, { type: "stop" }, { type: "calibrate" }, { type: "set", volume: 0 }, { type: "layout", seats: 1 }]) {
    s.apply(m, 0); // no clientId
    s.apply({ ...m, clientId: "" }, 0);
  }
  assert.deepEqual(s.snapshot(0), before); // ignored: not even a notice
  assert.deepEqual(s.drain(), []);
  s.apply({ type: "start", clientId: "stranger", songIds: ["tiny"] }, 0); // a phone that has not joined is told to
  assert.deepEqual(s.snapshot(0).notice, { for: "stranger", text: "Join before you use the controls." });
  assert.equal(s.snapshot(0).status, "lobby");
  s.apply({ type: "set", clientId: "stranger", volume: 0 }, 0);
  assert.equal(s.snapshot(0).settings.volume, 0.8);
});

test("the stage's own keys need no join", () => {
  const s = twoSeated();
  s.apply({ type: "start", songIds: ["tiny"] }, 0, { stage: true });
  assert.equal(s.snapshot(0).status, "countdown");
  s.apply({ type: "pause" }, 100, { stage: true });
  assert.equal(s.snapshot(100).status, "paused");
});

test("a lag set during a song is stored, and takes over at the next song without moving the song clock", () => {
  const s = twoSeated();
  const clock = (wall) => wall - s.offsetMs(); // the stage runs on the wall clock minus the lag in use
  s.apply({ type: "start", clientId: "ann", songIds: ["tiny", "other"] }, clock(0));
  s.apply({ type: "set", clientId: "ann", offsetMs: 300 }, clock(1000));
  assert.equal(s.snapshot(clock(1000)).settings.offsetMs, 300); // what the phones see
  assert.equal(s.offsetMs(), 120); // the clock has not moved
  assert.equal(s.tick(clock(1000), {}).songMs, 1000 - START); // unchanged: 1000 ms after the start
  s.apply({ type: "skip", clientId: "ann" }, clock(2000)); // the next song starts at wall 2000
  assert.equal(s.offsetMs(), 300);
  assert.equal(s.tick(clock(2000 + START - 20), {}).songMs, -20); // the first beat is START after the start, on the new clock
  assert.equal(s.tick(clock(2000 + START), {}).songMs, 0);
});

test("a lag set in the lobby is used at once", () => {
  const s = twoSeated();
  s.apply({ type: "set", clientId: "ann", offsetMs: 220 }, 0);
  assert.equal(s.offsetMs(), 220);
});

// ---- Wave 9: modes, four seats in any order, the warm-up ----

// A session with the seats given as { spotId: clientId }, all phones joined. `warm: false` runs with the warm-up off.
function room(seatsBy, { warm = true } = {}) {
  const s = warm ? createSession({ songs }) : quiet({ songs });
  for (const id of new Set(Object.values(seatsBy))) s.apply({ type: "join", clientId: id }, 0);
  for (const [spotId, id] of Object.entries(seatsBy)) s.apply({ type: "claim", clientId: id, spotId: +spotId }, 0);
  return s;
}
const statusOf = (s, now) => s.snapshot(now).status;
const statuses = (s) => s.drain().filter((e) => e.type === "status").map((e) => e.status);
// One tap by each seat in `spotIds`: a foot lands at t, stays until t + 300, then is up. Taps are 600 ms apart.
function tapOnce(s, spotIds, t) {
  const down = Object.fromEntries(spotIds.map((id) => [id, [{ u: 0.5, v: 0.9 }]]));
  s.tick(t, down);
  s.tick(t + 20, down);
  s.tick(t + 300, {});
  s.tick(t + 340, {});
}
const tapTimes = (s, spotId, now) => s.snapshot(now).warmup.players[spotId].tapAtMs;

test("mode: the lobby holds the last one chosen, a phone sets it, anything else is ignored", () => {
  const s = room({ 1: "ann", 2: "ben" }, { warm: false });
  assert.equal(s.snapshot(0).mode, "team");
  s.apply({ type: "mode", clientId: "ben", mode: "versus" }, 0);
  assert.equal(s.snapshot(0).mode, "versus");
  assert.equal(said(s), null);
  for (const mode of ["banana", undefined, 3, null]) s.apply({ type: "mode", clientId: "ann", mode }, 0);
  assert.equal(s.snapshot(0).mode, "versus");
  assert.equal(said(s), null);
  s.apply({ type: "mode", clientId: "stranger", mode: "team" }, 0); // never joined
  assert.equal(s.snapshot(0).mode, "versus");
  assert.match(said(s), /Join before/);
  s.apply({ type: "mode", clientId: "ann", mode: "team" }, 0);
  assert.equal(s.snapshot(0).mode, "team");
});

test("mode: refused with a plain sentence once a song has begun, until the lobby is back", () => {
  const s = room({ 1: "ann", 2: "ben" });
  start(s, ["tiny"]); // warmup
  s.apply({ type: "mode", clientId: "ann", mode: "versus" }, 0);
  assert.equal(said(s, 0), "A song is running. Change the mode when it ends.");
  assert.equal(statusOf(s, 0), "warmup");
  assert.equal(s.snapshot(0).mode, "team");
  s.apply({ type: "skipWarmup", clientId: "ann" }, 100);
  s.apply({ type: "mode", clientId: "ann", mode: "versus" }, 100);
  assert.match(said(s, 100), /Change the mode when it ends/); // countdown
  run(s, 100, 100 + START + 1700);
  assert.equal(statusOf(s, 100 + START + 1700), "results");
  s.apply({ type: "mode", clientId: "ben", mode: "versus" }, 100 + START + 1700);
  assert.equal(s.snapshot(100 + START + 1700).notice.for, "ben");
  s.apply({ type: "stop", clientId: "ann" }, 100 + START + 1800);
  s.apply({ type: "mode", clientId: "ann", mode: "versus" }, 100 + START + 1800);
  assert.equal(s.snapshot(100 + START + 1800).mode, "versus");
});

test("start: mode versus is versus, any other value is team, and none keeps what the lobby shows", () => {
  const modeAfter = (setup, extra) => {
    const s = room({ 1: "ann", 2: "ben" }, { warm: false });
    if (setup) s.apply({ type: "mode", clientId: "ann", mode: setup }, 0);
    start(s, ["tiny"], extra);
    return s.snapshot(0).mode;
  };
  assert.equal(modeAfter(null, { mode: "versus" }), "versus");
  assert.equal(modeAfter(null, { mode: "banana" }), "team");
  assert.equal(modeAfter("versus", { mode: "banana" }), "team");
  assert.equal(modeAfter("versus", { mode: 7 }), "team");
  assert.equal(modeAfter("versus", {}), "versus"); // an older phone sends none: the floor already shows versus
  assert.equal(modeAfter(null, {}), "team");
  const s = room({ 1: "ann", 2: "ben" }, { warm: false });
  start(s, ["nope"], { mode: "versus" }); // a refused start changes nothing
  assert.equal(s.snapshot(0).mode, "team");
});

test("versus with one seat runs as team for that song, and the lobby still shows versus afterwards", () => {
  const s = room({ 3: "ann" }, { warm: false });
  start(s, ["tiny"], { mode: "versus" });
  assert.equal(s.snapshot(0).mode, "team");
  run(s, 0, START + 1700, play(tiny, [3]));
  const end = s.snapshot(START + 1700);
  assert.equal(end.status, "results");
  assert.equal(end.winner, null);
  assert.deepEqual(end.players.map((p) => p.rank), [null]);
  assert.equal(end.players[0].bonus, 75); // team rules: the bonuses are paid
  s.apply({ type: "stop", clientId: "ann" }, START + 1800);
  assert.equal(s.snapshot(START + 1800).mode, "versus");
});

test("versus: the session splits the song with the mode and each seat's total is its own part's", () => {
  const s = room({ 1: "ann", 2: "ben" }, { warm: false });
  start(s, ["long"], { mode: "versus" });
  const [a, b] = splitParts(long, 2, { mode: "versus" });
  assert.deepEqual(s.snapshot(0).players.map((p) => p.total), [a.notes.length, b.notes.length]);
  assert.equal(a.notes.length, b.notes.length, "the same number of tiles for each player");
});

test("versus: results name the winner and rank everyone, and pay no bonus", () => {
  const s = seated(2);
  start(s, ["long"], { mode: "versus" });
  const during = run(s, 0, START + 2000, play(long, [1, 2], [1], 0, "versus")); // only seat 1 steps
  assert.equal(during.status, "playing");
  assert.equal(s.snapshot(START + 2000).winner, null, "no winner while the song plays");
  assert.deepEqual(s.snapshot(START + 2000).players.map((p) => p.rank), [1, 2], "ranks are live");
  run(s, START + 2020, START + 16300, play(long, [1, 2], [1], 0, "versus"));
  const end = s.snapshot(START + 16300);
  assert.equal(end.status, "results");
  assert.equal(end.mode, "versus");
  const [a, b] = end.players;
  assert.deepEqual([a.rank, b.rank], [1, 2]);
  assert.deepEqual(end.winner, { spotId: 1, score: a.score });
  assert.ok(a.score > 0 && b.score === 0);
  assert.deepEqual(end.players.map((p) => [p.bonus, p.bonusFor]), [[0, null], [0, null]]);
  assert.equal(end.team.score, a.score + b.score);
});

test("versus: a tie at the top has no winner and shares rank 1; a rank skips after a tie", () => {
  const tie = seated(2);
  start(tie, ["long"], { mode: "versus" });
  run(tie, 0, START + 16300, play(long, [1, 2], [1, 2], 0, "versus")); // both play every tile perfectly
  const end = tie.snapshot(START + 16300);
  assert.equal(end.status, "results");
  assert.equal(end.players[0].score, end.players[1].score);
  assert.ok(end.players[0].score > 0);
  assert.equal(end.winner, null);
  assert.deepEqual(end.players.map((p) => p.rank), [1, 1]);

  const third = seated(3);
  start(third, ["long"], { mode: "versus" });
  run(third, 0, START + 16300, play(long, [1, 2, 3], [2], 0, "versus")); // only the middle seat plays
  const ranks = third.snapshot(START + 16300).players.map((p) => p.rank);
  assert.deepEqual(ranks, [2, 1, 2]); // 1, then the two that scored nothing share 2
  assert.equal(third.snapshot(START + 16300).winner.spotId, 2);

  const none = seated(2);
  start(none, ["tiny"], { mode: "versus" });
  run(none, 0, START + 1700);
  assert.deepEqual(none.snapshot(START + 1700).players.map((p) => p.rank), [1, 1]);
  assert.equal(none.snapshot(START + 1700).winner, null);
});

test("versus: the winner is gone when the next song loads, and with one seat left nobody wins by default", () => {
  const s = seated(2);
  start(s, ["tiny", "other"], { mode: "versus" });
  run(s, 0, START + 1700, play(tiny, [1, 2], [1, 2], 0, "versus"));
  const at = START + 1500 + RESULTS_MS;
  s.tick(at, {});
  assert.equal(s.snapshot(at).status, "countdown");
  assert.equal(s.snapshot(at).winner, null);
  assert.deepEqual(s.snapshot(at).players.map((p) => p.rank), [1, 1]); // everyone at 0 again
  s.apply({ type: "release", clientId: "ann", spotId: 2 }, at + 20);
  assert.equal(s.snapshot(at + 20).mode, "versus"); // fixed for the song
  run(s, at + 20, at + START + 1500, play(other, [1], [1], at));
  const end = s.snapshot(at + START + 1500);
  assert.equal(end.status, "results");
  assert.equal(end.winner, null);
});

test("team mode has no winner and no rank", () => {
  const s = twoSeated();
  start(s, ["tiny"]);
  run(s, 0, START + 1700, play(tiny, [1, 2]));
  const end = s.snapshot(START + 1700);
  assert.equal(end.status, "results");
  assert.deepEqual([end.mode, end.winner], ["team", null]);
  assert.deepEqual(end.players.map((p) => p.rank), [null, null]);
});

test("four seats: any phone takes any free seat, and a song plays on the taken seats only", () => {
  const s = room({ 4: "ann", 2: "ben" }, { warm: false }); // seat 4 first, seat 2 second, 1 and 3 empty
  assert.deepEqual(seatsOf(s), [["ben", 2], ["ann", 4]]);
  assert.equal(s.snapshot(0).layout.spots.length, 4);
  assert.equal(s.snapshot(0).layout.lanes, 1); // two taken seats, whichever they are
  start(s, ["scale"]);
  const view = run(s, 0, START);
  assert.deepEqual(view.pads.map((p) => [p.spotId, p.lanes]), [[2, 1], [4, 1]]);
  const totals = s.snapshot(START).players.map((p) => [p.spotId, p.total]);
  assert.deepEqual(totals.map(([id]) => id), [2, 4]);
  assert.equal(totals[0][1] + totals[1][1], scale.notes.length);
  assert.ok(view.pads.every((p) => p.tiles.length > 0 && p.tiles.every((t) => t.lane === 0)));
  assert.equal(statusOf(s, START), "playing");
});

test("four seats: every seat is a seat, a fifth does not exist, and a taken one is refused", () => {
  const s = room({ 1: "ann", 2: "ben", 3: "cat", 4: "dan" }, { warm: false });
  assert.deepEqual(s.snapshot(0).players.map((p) => p.spotId), [1, 2, 3, 4]);
  s.apply({ type: "claim", clientId: "ann", spotId: 5 }, 0);
  assert.equal(said(s), "That seat does not exist.");
  s.apply({ type: "claim", clientId: "ben", spotId: 4 }, 0);
  assert.equal(said(s), "That seat is taken.");
  start(s, ["scale"]);
  assert.equal(s.snapshot(0).layout.lanes, 1);
  assert.deepEqual(run(s, 0, START).pads.map((p) => p.spotId), [1, 2, 3, 4]);
});

test("the State names the taken seats in players: nothing more is needed in the lobby", () => {
  const s = room({ 3: "ann", 1: "ben" });
  assert.deepEqual(s.snapshot(0).players.map((p) => p.spotId), [1, 3]);
  assert.equal("taken" in s.snapshot(0), false);
});

// ---- the warm-up ----

test("warm-up: a start from the lobby begins in warmup with the exact warmup block, and the song is loaded", () => {
  const s = room({ 1: "ann", 2: "ben" });
  start(s, ["tiny", "other"]);
  const snap = s.snapshot(0);
  assert.equal(snap.status, "warmup");
  assert.deepEqual(snap.warmup, {
    need: 4, beatMs: 600, maxMs: 15000, startedAtMs: 0,
    players: { 1: { taps: 0, ready: false, tapAtMs: [] }, 2: { taps: 0, ready: false, tapAtMs: [] } },
  });
  assert.deepEqual([WARM_TAPS, WARM_BEAT_MS, WARM_MAX_MS], [4, 600, 15000]);
  assert.equal(snap.song.id, "tiny");
  assert.deepEqual(snap.queue.map((q) => q.id), ["other"]);
  assert.equal(snap.layout.lanes, 1);
  assert.deepEqual(statuses(s), ["warmup"]);
  s.snapshot(0).warmup.players[1].tapAtMs.push(5); // a copy
  assert.deepEqual(s.snapshot(0).warmup.players[1].tapAtMs, []);
});

test("warm-up: what the floor reads is safe and honest: pads with no tiles, no song clock, the length held", () => {
  const s = room({ 1: "ann", 2: "ben" });
  start(s, ["tiny"]);
  for (const t of [0, 2000, 9000]) {
    const view = s.tick(t, {});
    assert.equal(view.status, "warmup");
    assert.equal(view.songMs, null);
    assert.equal(view.song, tiny);
    assert.deepEqual(view.pads.map((p) => [p.spotId, p.lanes, p.tiles.length]), [[1, 1, 0], [2, 1, 0]]);
    const snap = s.snapshot(t);
    assert.equal(snap.secondsLeft, Math.ceil((1500 + START) / 1000)); // the song and the lead-in, held still
    assert.deepEqual(snap.players.map((p) => [p.score, p.grade]), [[0, null], [0, null]]);
    assert.deepEqual(snap.team, { score: 0, hits: 0, total: 3, grade: null });
  }
  assert.deepEqual(s.drain().filter((e) => e.type !== "status"), []);
});

test("warm-up: an arrival in a pad is a tap; a foot that stays, a lifted foot and a flicker are not", () => {
  const s = room({ 1: "ann", 2: "ben" });
  start(s, ["tiny"]);
  s.tick(0, {});
  const foot = { u: 0.5, v: 0.9 };
  s.tick(100, { 1: [foot] }); // lands: tap 1
  s.tick(120, { 1: [foot] });
  s.tick(900, { 1: [foot] }); // stays for a long time: nothing more
  assert.deepEqual(tapTimes(s, 1, 900), [100]);
  s.tick(1000, { 1: [] }); // gone for a moment ...
  s.tick(1080, { 1: [foot] }); // ... and back inside 150 ms: the same foot flickering
  assert.deepEqual(tapTimes(s, 1, 1080), [100]);
  s.tick(1100, { 1: [{ ...foot, lifted: true }] }); // in the air: not standing
  s.tick(1500, { 1: [{ ...foot, lifted: true }] });
  s.tick(1520, { 1: [] });
  s.tick(2000, { 1: [foot] }); // a real new landing
  assert.deepEqual(tapTimes(s, 1, 2000), [100, 2000]);
  s.tick(2100, { 1: [foot, foot] }); // a second foot joins one that is standing: that is an arrival too
  assert.deepEqual(tapTimes(s, 1, 2100), [100, 2000, 2100]);
  s.tick(2600, { 1: [] });
  s.tick(3000, { 1: [foot, foot] }); // two feet land in one frame: one tap
  assert.equal(s.snapshot(3000).warmup.players[1].taps, 4);
  assert.equal(s.snapshot(3000).warmup.players[2].taps, 0, "the other seat saw nothing");
  const events = s.drain().filter((e) => e.type === "warmupTap");
  assert.deepEqual(events.map((e) => [e.spotId, e.taps, e.atMs]), [[1, 1, 100], [1, 2, 2000], [1, 3, 2100], [1, 4, 3000]]);
});

test("warm-up: a foot already standing when it begins is not a tap, and bad feet never throw", () => {
  const s = room({ 1: "ann", 2: "ben" });
  start(s, ["tiny"]);
  s.tick(0, { 1: [{ u: 0.5, v: 0.9 }] }); // first frame: sets the level only
  s.tick(20, { 1: [{ u: 0.5, v: 0.9 }] });
  assert.equal(s.snapshot(20).warmup.players[1].taps, 0);
  for (const feet of [null, undefined, "x", { 1: "nonsense", 2: [null, 5, {}] }]) assert.doesNotThrow(() => s.tick(40, feet));
  assert.doesNotThrow(() => s.tick(60, { 3: [{ u: 0.5, v: 0.9 }] })); // a pad that is not in the game
});

test("warm-up: it ends and the countdown begins the moment every taken seat has made 4 taps", () => {
  const s = room({ 1: "ann", 2: "ben" });
  start(s, ["tiny"]);
  s.drain();
  s.tick(0, {});
  for (let k = 0; k < 3; k++) tapOnce(s, [1, 2], 100 + 600 * k);
  tapOnce(s, [1], 100 + 600 * 3); // seat 1 is ready, seat 2 has 3 taps
  assert.equal(statusOf(s, 2000), "warmup");
  assert.deepEqual(s.snapshot(2000).warmup.players[1], { taps: 4, ready: true, tapAtMs: [100, 700, 1300, 1900] });
  assert.deepEqual([s.snapshot(2000).warmup.players[2].taps, s.snapshot(2000).warmup.players[2].ready], [3, false]);
  const last = 2500;
  const view = s.tick(last, { 2: [{ u: 0.5, v: 0.9 }] }); // seat 2's fourth tap
  assert.equal(view.status, "countdown");
  assert.equal(view.songMs, -START, "the song clock starts here: the 3 s countdown and the slide-in are still ahead");
  assert.equal(s.snapshot(last).warmup, null);
  assert.equal(s.snapshot(last).notice, null, "everyone was ready: nothing to say");
  assert.deepEqual(statuses(s), ["countdown"]);
  assert.equal(s.tick(last + COUNTDOWN_MS - 20, {}).status, "countdown");
  assert.equal(s.tick(last + COUNTDOWN_MS, {}).status, "playing");
});

test("warm-up: after 15 seconds the seats that are not ready play anyway, and their phone is told why", () => {
  const s = room({ 1: "ann", 2: "ben", 3: "ben" });
  start(s, ["scale"]);
  s.tick(0, {});
  for (let k = 0; k < 4; k++) tapOnce(s, [1], 100 + 600 * k); // only Ann's seat gets ready
  assert.equal(s.tick(WARM_MAX_MS - 20, {}).status, "warmup");
  const view = s.tick(WARM_MAX_MS, {});
  assert.equal(view.status, "countdown");
  assert.deepEqual(view.pads.map((p) => p.spotId), [1, 2, 3], "all three seats play");
  assert.deepEqual(s.snapshot(WARM_MAX_MS).notice, { for: "ben", text: "The floor did not see your taps. Lift your foot higher." });
  assert.equal(s.snapshot(WARM_MAX_MS + 4000).notice, null);
});

test("warm-up: when several phones are not ready the notice is for everyone, and a ready phone gets none", () => {
  const s = room({ 1: "ann", 2: "ben" });
  start(s, ["tiny"]);
  s.tick(WARM_MAX_MS, {});
  assert.deepEqual(s.snapshot(WARM_MAX_MS).notice, { for: null, text: "The floor did not see your taps. Lift your foot higher." });
  const t = room({ 1: "ann", 2: "ben" });
  start(t, ["tiny"]);
  t.tick(0, {});
  for (let k = 0; k < 4; k++) tapOnce(t, [2], 100 + 600 * k);
  t.tick(WARM_MAX_MS, {});
  assert.equal(t.snapshot(WARM_MAX_MS).notice.for, "ann"); // Ben was ready
});

test("warm-up: the 15 seconds count from the start, not from the first tick", () => {
  const s = room({ 1: "ann" });
  s.apply({ type: "start", clientId: "ann", songIds: ["tiny"] }, 5000);
  assert.equal(s.tick(5000 + WARM_MAX_MS - 20, {}).status, "warmup");
  assert.equal(s.tick(5000 + WARM_MAX_MS, {}).status, "countdown");
  assert.equal(s.snapshot(5000).warmup, null);
});

test("warm-up: skipWarmup from a seat-holding phone or the stage starts the countdown; others are refused or ignored", () => {
  const make = () => { const s = room({ 1: "ann", 2: "ann" }); s.apply({ type: "join", clientId: "ben" }, 0); start(s, ["tiny"]); s.drain(); return s; };
  let s = make();
  s.apply({ type: "skipWarmup", clientId: "ann" }, 500);
  assert.equal(statusOf(s, 500), "countdown");
  assert.equal(s.snapshot(500).notice, null, "a skip is a choice: no 'did not see your taps'");
  assert.equal(s.tick(500, {}).songMs, -START);
  assert.deepEqual(statuses(s), ["countdown"]);

  s = make();
  s.apply({ type: "skipWarmup", clientId: "ben" }, 500); // joined, no seat
  assert.equal(statusOf(s, 500), "warmup");
  assert.deepEqual(s.snapshot(500).notice, { for: "ben", text: "Take a seat to skip the warm-up." });
  s.apply({ type: "skipWarmup", clientId: "stranger" }, 500); // never joined: also not a seat holder
  assert.equal(statusOf(s, 500), "warmup");
  for (const m of [{ type: "skipWarmup" }, { type: "skipWarmup", clientId: "" }, { type: "skipWarmup", clientId: 7 }]) s.apply(m, 600);
  assert.equal(statusOf(s, 600), "warmup");
  assert.equal(s.snapshot(600).notice.for, "stranger", "a message with no clientId changes nothing, not even the notice");
  s.apply({ type: "skipWarmup" }, 700, { stage: true }); // the laptop
  assert.equal(statusOf(s, 700), "countdown");

  s = room({ 1: "ann" }, { warm: false }); // outside the warm-up: ignored quietly
  s.apply({ type: "skipWarmup", clientId: "ann" }, 0);
  start(s, ["tiny"]);
  s.apply({ type: "skipWarmup", clientId: "ann" }, 10);
  assert.equal(statusOf(s, 10), "countdown");
  assert.equal(said(s, 10), null);
});

test("warm-up: settings.warmup false skips it, true brings it back, and the setting is read at each start", () => {
  const s = room({ 1: "ann", 2: "ben" });
  s.apply({ type: "set", clientId: "ann", warmup: false }, 0);
  start(s, ["tiny"]);
  assert.equal(statusOf(s, 0), "countdown");
  s.apply({ type: "stop", clientId: "ann" }, 10);
  s.apply({ type: "set", clientId: "ann", warmup: true }, 10);
  start(s, ["tiny"]);
  assert.equal(statusOf(s, 10), "warmup");
  s.apply({ type: "set", clientId: "ann", warmup: false }, 20); // mid warm-up: it does not end this one
  assert.equal(statusOf(s, 20), "warmup");
});

test("warm-up: only the first song after the lobby; the next in a queue, and the same people playing again, skip it", () => {
  const s = room({ 1: "ann", 2: "ben" });
  start(s, ["tiny", "other"]);
  s.apply({ type: "skipWarmup" }, 0, { stage: true });
  run(s, 0, START + 1700, play(tiny, [1, 2]));
  const at = START + 1500 + RESULTS_MS;
  assert.equal(s.tick(at, {}).status, "countdown", "the second song of the queue goes straight to the countdown");
  s.apply({ type: "skip", clientId: "ann" }, at + 10); // the queue is over: back to the lobby
  assert.equal(statusOf(s, at + 10), "lobby");
  start(s, ["tiny"]); // play again, same two people in the same two seats
  assert.equal(statusOf(s, 0), "countdown");
  s.apply({ type: "stop", clientId: "ann" }, 20);
  s.apply({ type: "release", clientId: "ben", spotId: 2 }, 20); // a different line-up needs the warm-up again
  s.apply({ type: "join", clientId: "cat" }, 20);
  s.apply({ type: "claim", clientId: "cat", spotId: 2 }, 20);
  start(s, ["tiny"]);
  assert.equal(statusOf(s, 20), "warmup");
});

test("warm-up: a warm-up that never finished (stopped) happens again at the next start; a timed-out one counts as done", () => {
  const s = room({ 1: "ann" });
  start(s, ["tiny"]);
  s.apply({ type: "stop", clientId: "ann" }, 100);
  start(s, ["tiny"]);
  assert.equal(statusOf(s, 0), "warmup");
  s.tick(WARM_MAX_MS, {}); // nobody tapped, it timed out
  s.apply({ type: "stop", clientId: "ann" }, WARM_MAX_MS + 10);
  start(s, ["tiny"]);
  assert.equal(statusOf(s, 0), "countdown");
});

test("warm-up: pause, resume and stop behave as in the countdown; the clock does not run while paused", () => {
  const s = room({ 1: "ann", 2: "ben" });
  start(s, ["tiny"]);
  s.tick(0, {});
  s.tick(5000, {});
  s.apply({ type: "pause", clientId: "ann" }, 5000);
  assert.equal(statusOf(s, 5000), "paused");
  assert.equal(s.snapshot(5000).warmup.startedAtMs, 0, "the warm-up block stays up while paused");
  assert.equal(s.tick(60000, {}).songMs, null);
  assert.equal(s.snapshot(60000).secondsLeft, Math.ceil((1500 + START) / 1000));
  s.tick(61000, { 1: [{ u: 0.5, v: 0.9 }] });
  s.apply({ type: "skipWarmup", clientId: "ann" }, 61000);
  assert.equal(statusOf(s, 61000), "paused", "a paused warm-up cannot be skipped");
  s.apply({ type: "resume", clientId: "ann" }, 65000);
  assert.equal(statusOf(s, 65000), "warmup");
  assert.equal(s.snapshot(65000).warmup.startedAtMs, 60000, "the 60 s stopped do not count");
  assert.equal(s.tick(65000 + 9000, {}).status, "warmup");
  assert.equal(s.tick(60000 + WARM_MAX_MS, {}).status, "countdown", "15 s of warm-up in all");
  s.apply({ type: "stop", clientId: "ann" }, 80000);
  assert.deepEqual([statusOf(s, 80000), s.snapshot(80000).warmup], ["lobby", null]);
  start(s, ["tiny"]);
  s.apply({ type: "pause", clientId: "ann" }, 2);
  s.apply({ type: "stop", clientId: "ann" }, 3); // stop from a pause that began in the warm-up
  assert.deepEqual([statusOf(s, 3), s.snapshot(3).warmup], ["lobby", null]);
});

test("warm-up: a phone that goes quiet keeps its seats, and the last seat leaving ends it", () => {
  const s = room({ 1: "ann", 2: "ben" });
  start(s, ["tiny"]);
  for (let t = 0; t <= WARM_MAX_MS - 20; t += 20) s.tick(t, {}); // no phone says a word for 15 s
  assert.equal(statusOf(s, WARM_MAX_MS - 20), "warmup");
  assert.deepEqual(seatsOf(s, WARM_MAX_MS - 20), [["ann", 1], ["ben", 2]]);
  s.apply({ type: "leave", clientId: "ben" }, 100);
  assert.deepEqual(s.snapshot(100).warmup.players, { 1: { taps: 0, ready: false, tapAtMs: [] } });
  s.apply({ type: "leave", clientId: "ann" }, 120);
  assert.deepEqual([statusOf(s, 120), s.snapshot(120).warmup], ["lobby", null]);
});

test("warm-up: a seat given up by its phone does not hold the others back, and seats cannot change meanwhile", () => {
  const s = room({ 1: "ann", 2: "ben" });
  start(s, ["tiny"]);
  s.tick(0, {});
  for (let k = 0; k < 4; k++) tapOnce(s, [1], 100 + 600 * k);
  assert.equal(statusOf(s, 2500), "warmup");
  s.apply({ type: "claim", clientId: "ann", spotId: 3 }, 2500);
  assert.match(said(s, 2500), /song is playing/);
  s.apply({ type: "layout", clientId: "ann", seats: 2 }, 2500);
  assert.match(said(s, 2500), /cannot change/);
  s.apply({ type: "release", clientId: "ben", spotId: 2 }, 2600);
  assert.equal(s.tick(2620, {}).status, "countdown");
  assert.deepEqual(s.tick(2640, {}).pads.map((p) => p.spotId), [1]);
});

test("warm-up: skip in the warm-up goes to the next song's countdown, or the lobby when there is none", () => {
  const s = room({ 1: "ann", 2: "ben" });
  start(s, ["tiny", "other"]);
  s.apply({ type: "skip", clientId: "ann" }, 50);
  assert.deepEqual([statusOf(s, 50), s.snapshot(50).song.id, s.snapshot(50).warmup], ["countdown", "other", null]);
  s.apply({ type: "stop", clientId: "ann" }, 60);
  start(s, ["tiny"]);
  s.apply({ type: "skip", clientId: "ann" }, 70);
  assert.deepEqual([statusOf(s, 70), s.snapshot(70).song], ["lobby", null]);
});

test("warm-up: a lag set during it takes over when the countdown begins, without moving the song clock", () => {
  const s = room({ 1: "ann", 2: "ben" });
  const clock = (wall) => wall - s.offsetMs();
  s.apply({ type: "start", clientId: "ann", songIds: ["tiny"] }, clock(0));
  s.apply({ type: "set", clientId: "ann", offsetMs: 300 }, clock(1000));
  assert.equal(s.offsetMs(), 120);
  s.apply({ type: "skipWarmup" }, clock(5000), { stage: true });
  assert.equal(s.offsetMs(), 300);
  assert.equal(s.tick(clock(5000 + START - 20), {}).songMs, -20);
  assert.equal(s.tick(clock(5000 + START), {}).songMs, 0);
});

test("warm-up: the demo's way, a stage start with the warm-up off, still goes straight to the countdown", () => {
  const s = createSession({ songs });
  for (const spotId of [1, 2, 3, 4]) { s.apply({ type: "join", clientId: `guest-${spotId}` }, 0); s.apply({ type: "claim", clientId: `guest-${spotId}`, spotId }, 0); }
  s.apply({ type: "set", warmup: false }, 0, { stage: true });
  s.apply({ type: "start", songIds: ["tiny"], transit: null }, 0, { stage: true });
  assert.equal(statusOf(s, 0), "countdown");
});

test("the new messages are ignored when malformed and never throw", () => {
  const s = room({ 1: "ann", 2: "ben" });
  const before = s.snapshot(0);
  for (const m of [{ type: "mode" }, { type: "mode", clientId: "ann" }, { type: "mode", clientId: {}, mode: "versus" }, { type: "skipWarmup", clientId: [] }, { type: "set", clientId: "ann", warmup: 1 }]) {
    assert.doesNotThrow(() => s.apply(m, 0));
  }
  assert.deepEqual(s.snapshot(0), before);
});

// ---- levels

test("level: the lobby holds the last one chosen, a phone sets it, anything else is ignored", () => {
  const s = room({ 1: "ann", 2: "ben" }, { warm: false });
  assert.equal(s.snapshot(0).difficulty, "normal");
  s.apply({ type: "difficulty", clientId: "ben", difficulty: "hard" }, 0);
  assert.equal(s.snapshot(0).difficulty, "hard");
  assert.equal(said(s), null);
  for (const difficulty of ["banana", undefined, 3, null, "HARD"]) s.apply({ type: "difficulty", clientId: "ann", difficulty }, 0);
  assert.equal(s.snapshot(0).difficulty, "hard");
  assert.equal(said(s), null);
  s.apply({ type: "difficulty", clientId: "stranger", difficulty: "easy" }, 0); // never joined
  assert.equal(s.snapshot(0).difficulty, "hard");
  assert.match(said(s), /Join before/);
  s.apply({ type: "difficulty", clientId: "ann", difficulty: "easy" }, 0);
  assert.equal(s.snapshot(0).difficulty, "easy");
});

test("level: a start carries it, a level that is not one of the three is normal, none keeps the lobby's, and a running song refuses a change", () => {
  const levelAfter = (setup, extra) => {
    const s = room({ 1: "ann", 2: "ben" }, { warm: false });
    if (setup) s.apply({ type: "difficulty", clientId: "ann", difficulty: setup }, 0);
    start(s, ["tiny"], extra);
    return s.snapshot(0).difficulty;
  };
  assert.equal(levelAfter(null, { difficulty: "hard" }), "hard");
  assert.equal(levelAfter(null, { difficulty: "easy" }), "easy");
  assert.equal(levelAfter("hard", { difficulty: "banana" }), "normal");
  assert.equal(levelAfter("hard", { difficulty: 7 }), "normal");
  assert.equal(levelAfter("hard", {}), "hard"); // an older phone sends none: the floor already shows hard
  assert.equal(levelAfter(null, {}), "normal");
  const s = room({ 1: "ann", 2: "ben" }, { warm: false });
  start(s, ["nope"], { difficulty: "hard" }); // a refused start changes nothing
  assert.equal(s.snapshot(0).difficulty, "normal");
  start(s, ["tiny"], { difficulty: "easy" });
  s.apply({ type: "difficulty", clientId: "ann", difficulty: "hard" }, 10);
  assert.equal(said(s, 10), "A song is running. Change the level when it ends.");
  assert.equal(s.snapshot(10).difficulty, "easy");
});

test("level: the session splits the song with it, so the seats' tiles are the level's, and the stage's sound split agrees", () => {
  const totals = {};
  for (const difficulty of ["easy", "normal", "hard"]) {
    const s = room({ 1: "ann", 2: "ben" }, { warm: false });
    start(s, ["long"], { difficulty });
    const snap = s.snapshot(0);
    assert.equal(snap.difficulty, difficulty);
    const parts = splitParts(long, 2, { mode: "team", difficulty }); // what main.js asks for, from snap.mode and snap.difficulty
    assert.deepEqual(snap.players.map((p) => p.total), parts.map((p) => p.notes.length), `${difficulty}: the same tiles`);
    totals[difficulty] = snap.team.total;
  }
  assert.ok(totals.hard > totals.normal && totals.normal > totals.easy, JSON.stringify(totals));
});

test("level: a duel started at any level gives every seat the same number of tiles", () => {
  for (const difficulty of ["easy", "normal", "hard"]) {
    const s = room({ 1: "ann", 2: "ben" }, { warm: false });
    start(s, ["long"], { mode: "versus", difficulty });
    const [a, b] = s.snapshot(0).players;
    assert.equal(a.total, b.total, `${difficulty}: the same number of tiles`);
  }
});
