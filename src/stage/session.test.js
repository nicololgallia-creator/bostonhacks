import { test } from "node:test";
import assert from "node:assert/strict";
import { createSession, trainFromAddress, trainQuery, DEFAULT_TRAIN, COUNTDOWN_MS, RESULTS_MS } from "./session.js";
import { makeLayout } from "./layout.js";
import { TRAVEL_MS, gradeFor } from "../game/engine.js";
import { splitParts } from "../game/parts.js";

// 120 bpm, taps at 0, 500 and 1000 ms, song length 1.5 s. With 2 seats (4 lanes) each note takes a third of the
// keyboard: seat 1 plays the first two notes (lanes 0 and 1) and seat 2 the last (lane 3, its lane 1).
const tiny = { id: "tiny", title: "Tiny Tune", bpm: 120, notes: [{ beat: 0, midi: 60, beats: 1 }, { beat: 1, midi: 64, beats: 1 }, { beat: 2, midi: 67, beats: 1 }] };
const other = { id: "other", title: "Other Tune", bpm: 120, notes: [{ beat: 0, midi: 62, beats: 1 }, { beat: 1, midi: 65, beats: 1 }] };
// Eight different pitches, half a second apart: with 3 seats (6 lanes) the seats get 3, 2 and 3 notes.
const scale = { id: "scale", title: "Scale", bpm: 120, notes: [60, 62, 64, 65, 67, 69, 71, 72].map((midi, beat) => ({ beat, midi, beats: 1 })) };
// A long song: 32 notes of half a second over four pitches, 16 s long. Two seats get 16 notes each.
const long = { id: "long", title: "Long Tune", bpm: 120, notes: Array.from({ length: 32 }, (_, i) => ({ beat: i, midi: [60, 62, 64, 65][i % 4], beats: 1 })) };
const songs = [tiny, other, scale, long];
const START = COUNTDOWN_MS + TRAVEL_MS; // wall time (a start at 0) when the first beat is due

// Feet that play every note of `song` for the seats in `stepping`. `taken` are the seat ids that hold seats, in
// seat order: each takes its part of the song, and its foot lands on the note's lane at the note's time.
const play = (song, taken, stepping = taken, base = 0) => {
  const beatMs = 60000 / song.bpm;
  const parts = splitParts(song, taken.length);
  return (wall) => {
    const feet = {};
    taken.forEach((id, i) => {
      if (!stepping.includes(id)) return;
      for (const n of parts[i].notes) {
        const d = wall - (base + START + n.beat * beatMs);
        if (d >= 0 && d < 100) (feet[id] ??= []).push({ u: (n.lane + 0.5) / 2, v: 0.9 });
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
  const s = createSession({ songs });
  s.apply({ type: "join", clientId: "ann" }, 0);
  s.apply({ type: "join", clientId: "ben" }, 0);
  s.apply({ type: "claim", clientId: "ann", spotId: 1 }, 0);
  s.apply({ type: "claim", clientId: "ben", spotId: 2 }, 0);
  return s;
}
const start = (s, songIds = ["tiny"], extra = {}) => s.apply({ type: "start", clientId: "ann", songIds, ...extra }, 0);
const player = (s, spotId, now = 0) => s.snapshot(now).players.find((p) => p.spotId === spotId);
const seatsOf = (s, now = 0) => s.snapshot(now).players.map((p) => [p.clientId, p.spotId]);

test("a new session is a lobby with the State message's exact shape", () => {
  const snap = createSession({ songs }).snapshot(0);
  assert.deepEqual(snap, {
    type: "state", status: "lobby", notice: null, layout: makeLayout({ seats: 3 }), train: DEFAULT_TRAIN,
    players: [], team: { score: 0, hits: 0, total: 0, grade: null },
    song: null, queue: [], secondsLeft: 0, transit: null, ready: { camera: false, calibrated: false },
    settings: { volume: 0.8, offsetMs: 120 },
  });
  assert.equal(snap.layout.lanes, 2);
});

test("snapshots are copies: changing one changes nothing inside", () => {
  const s = createSession({ songs });
  s.snapshot(0).layout.spots.length = 0;
  assert.equal(s.snapshot(0).layout.spots.length, 3);
});

test("a player in the State is a seat: clientId, spotId, stats and bonus, with no name and no waitMs", () => {
  const snap = twoSeated().snapshot(0);
  const keys = ["bonus", "bonusFor", "clientId", "combo", "counts", "grade", "maxCombo", "multiplier", "score", "spotId", "total"];
  assert.deepEqual(snap.players.map((p) => Object.keys(p).sort()), [keys, keys]);
  assert.deepEqual(snap.players.map((p) => [p.bonus, p.bonusFor]), [[0, null], [0, null]]);
});

test("join needs only a clientId, joining again changes nothing, and a phone with no seat is not in players", () => {
  const s = createSession({ songs });
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
  const s = createSession({ songs });
  s.apply({ type: "claim", clientId: "ghost", spotId: 1 }, 0);
  assert.match(said(s), /Join/);
  s.apply({ type: "join", clientId: "a" }, 0);
  s.apply({ type: "claim", clientId: "a", spotId: 4 }, 0); // the default layout has 3 seats
  assert.equal(said(s), "That seat does not exist.");
  assert.equal(s.snapshot(0).players.length, 0);
});

test("one phone can hold three seats, and all three play the song at the same time", () => {
  const s = createSession({ songs });
  s.apply({ type: "join", clientId: "ann" }, 0);
  for (const spotId of [1, 2, 3]) s.apply({ type: "claim", clientId: "ann", spotId }, 0);
  assert.deepEqual(seatsOf(s), [["ann", 1], ["ann", 2], ["ann", 3]]);
  start(s, ["scale"]);
  assert.equal(s.snapshot(0).status, "countdown");
  assert.deepEqual(s.snapshot(0).players.map((p) => p.total), [3, 2, 3]);
  const view = run(s, 0, START);
  assert.deepEqual(view.pads.map((p) => [p.spotId, p.lanes]), [[1, 2], [2, 2], [3, 2]]); // 3 pads of 2 lanes each
  assert.ok(view.pads.every((p) => p.tiles.length > 0), "every pad has tiles at once");
});

test("with 1, 2, 3 and 4 seats every note of a song is played by exactly one seat", () => {
  for (const n of [1, 2, 3, 4]) {
    const s = createSession({ songs });
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
  const s = createSession({ songs });
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
  start(s, ["tiny"]);
  run(s, 0, START);
  s.apply({ type: "release", clientId: "ben", spotId: 2 }, START);
  assert.deepEqual(s.tick(START + 20, {}).pads.map((p) => p.spotId), [1]);
  assert.equal(s.snapshot(START + 20).team.total, 2); // only seat 1's part is left
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
  assert.equal(snap.layout.lanes, 2);
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
  const s = createSession({ songs });
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
  const s = createSession({ songs });
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
  const s = createSession({ songs });
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
  start(s);
  run(s, 0, START + 1400, play(tiny, [1, 2], [1])); // only seat 1 steps
  const ann = player(s, 1, START + 1400);
  const ben = player(s, 2, START + 1400);
  assert.deepEqual(ann.counts, { perfect: 2, good: 0, miss: 0 }); // seat 1 plays the first two notes
  assert.equal(ann.combo, 2);
  assert.ok(ann.score > 0);
  assert.equal(ann.total, 2);
  assert.equal(ben.total, 1); // seat 2 plays the last one
  assert.equal(ben.counts.perfect, 0);
  assert.equal(ben.counts.miss, 1);
  assert.equal(ben.score, 0);
  const hits = s.drain().filter((e) => e.type === "hit");
  assert.equal(hits.length, 2);
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

test("set changes volume and the delay, clamps wild values, ignores the wrong type", () => {
  const s = createSession({ songs });
  s.apply({ type: "join", clientId: "ann" }, 0);
  s.apply({ type: "set", clientId: "ann", volume: 0.3 }, 0);
  assert.deepEqual(s.snapshot(0).settings, { volume: 0.3, offsetMs: 120 });
  s.apply({ type: "set", clientId: "ann", volume: 7, offsetMs: 87.6 }, 0);
  assert.deepEqual(s.snapshot(0).settings, { volume: 1, offsetMs: 88 });
  s.apply({ type: "set", clientId: "ann", volume: -2, offsetMs: -99999 }, 0);
  assert.deepEqual(s.snapshot(0).settings, { volume: 0, offsetMs: -1000 });
  s.apply({ type: "set", clientId: "ann", volume: "loud", offsetMs: NaN }, 0);
  assert.deepEqual(s.snapshot(0).settings, { volume: 0, offsetMs: -1000 });
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
  const s = createSession({ songs });
  s.setReady({ camera: true });
  assert.deepEqual(s.snapshot(0).ready, { camera: true, calibrated: false });
  s.setReady({ calibrated: true });
  assert.deepEqual(s.snapshot(0).ready, { camera: true, calibrated: true });
  const dragged = makeLayout({ seats: 2 });
  dragged.spots[0].rect.u = 0.2;
  assert.equal(s.setLayout(dragged), true);
  assert.equal(s.snapshot(0).layout.spots[0].rect.u, 0.2);
  assert.equal(s.setLayout({ lanes: 2 }), false);
  assert.equal(createSession({ songs, layout: dragged }).snapshot(0).layout.spots[0].rect.u, 0.2);
  assert.equal(createSession({ songs, layout: "junk" }).snapshot(0).layout.spots.length, 3);
});

test("a saved layout from before, with a posture and 3 or 4 lanes, loads as 2 lanes", () => {
  const old = { posture: "standing", lanes: 4, spots: makeLayout({ seats: 2 }).spots };
  const snap = createSession({ songs, layout: old }).snapshot(0);
  assert.deepEqual(snap.layout, makeLayout({ seats: 2 }));
  const s = createSession({ songs });
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
  assert.equal(a.notes.length + b.notes.length, long.notes.length); // every note once
  assert.notDeepEqual(view.pads[0].tiles, view.pads[1].tiles);
  const misses = s.drain().filter((e) => e.type === "miss"); // nobody steps, so every tile is missed in its own seat
  assert.ok(misses.some((e) => e.spotId === 1) && misses.some((e) => e.spotId === 2));
});

test("parts: every seat plays at the same time, so every pad has a tile on the line together", () => {
  const s = twoSeated();
  start(s, ["long"]); // the two seats' notes alternate, so both pads have a tile close to the line together
  const view = run(s, 0, START + 1000);
  assert.ok(view.pads.every((p) => p.tiles.some((t) => t.v > 0.5 && t.v < 1)), "both pads have tiles near the line");
});

test("parts: seats are dealt in seat order, whoever joined first", () => {
  const s = createSession({ songs });
  s.apply({ type: "join", clientId: "ann" }, 0);
  s.apply({ type: "join", clientId: "ben" }, 0);
  s.apply({ type: "claim", clientId: "ann", spotId: 3 }, 0); // Ann joined first but sits in seat 3
  s.apply({ type: "claim", clientId: "ben", spotId: 1 }, 0);
  start(s, ["tiny"]);
  const [first, second] = splitParts(tiny, 2);
  assert.deepEqual([first.notes.length, second.notes.length], [2, 1]);
  assert.equal(player(s, 1).total, 2); // Ben's seat 1 plays the low notes
  assert.equal(player(s, 3).total, 1);
});

test("team: the seats added up, the grade only once every part is finished, from gradeFor", () => {
  const s = twoSeated();
  assert.deepEqual(s.snapshot(0).team, { score: 0, hits: 0, total: 0, grade: null });
  start(s, ["tiny"]);
  run(s, 0, START + 1400, play(tiny, [1, 2], [1])); // only seat 1 steps
  let team = s.snapshot(START + 1400).team;
  assert.deepEqual([team.hits, team.total, team.grade], [2, 3, null]); // still playing: no grade yet
  assert.equal(team.score, player(s, 1, START + 1400).score);
  run(s, START + 1420, START + 1700);
  team = s.snapshot(START + 1700).team;
  assert.equal(s.snapshot(START + 1700).status, "results");
  assert.deepEqual([team.hits, team.total, team.grade], [2, 3, gradeFor(2, 3)]);
  assert.equal(team.grade, "C");
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
  const solo = createSession({ songs: [one] });
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
  const s = createSession({ songs });
  assert.deepEqual(s.snapshot(0).train, DEFAULT_TRAIN);
  s.snapshot(0).train.car = 9;
  assert.equal(s.snapshot(0).train.car, 2);
  assert.equal("section" in s.snapshot(0), false);
});

test("train: a saved train is used, a broken one is ignored, and setTrain checks every part", () => {
  assert.deepEqual(createSession({ songs, train: RED }).snapshot(0).train, RED);
  const junk = [undefined, null, "Red", 7, {}, { ...RED, line: "Purple" }, { ...RED, line: "constructor" }, { ...RED, directionId: 2 }, { ...RED, directionId: "0" },
    { ...RED, headsign: "" }, { ...RED, atStopId: 5 }, { ...RED, atStopName: undefined }, { ...RED, car: 0 }, { ...RED, car: 13 }, { ...RED, car: 1.5 }, { ...RED, car: "3" }];
  for (const bad of junk) assert.deepEqual(createSession({ songs, train: bad }).snapshot(0).train, DEFAULT_TRAIN);
  const s = createSession({ songs });
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
  assert.equal(createSession({ songs, train: trainFromAddress("?line=Blue&dir=1&at=place-state&car=1") }).snapshot(0).train.headsign, "Wonderland");
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
      assert.deepEqual(createSession({ songs }).setTrain(t), true); // every train the address can make is one the session accepts
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
  const clean = play(long, [1, 2], [2]); // seat 2 is perfect except for a gap of two tiles
  playOut(s, long, (wall) => ({ ...late(wall), ...(wall >= START + 7500 && wall < START + 8600 ? {} : clean(wall)) }));
  const end = s.snapshot(START + 17000);
  assert.equal(end.status, "results");
  const [a, b] = end.players;
  assert.deepEqual([a.counts.perfect, a.counts.miss, a.maxCombo], [0, 0, 16]); // the premise: seat 1 has the combo
  assert.ok(b.counts.perfect > 0 && b.counts.miss > 0 && b.maxCombo < 16, "seat 2 has the perfects");
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
  const s = createSession({ songs });
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
  const solo = createSession({ songs: [one] });
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

test("the 10 second rule also works during a song and in the results, and the last phone going ends the song", () => {
  const s = twoSeated();
  start(s, ["long"]);
  run(s, 0, 9000);
  for (let t = 9020; t <= 19100; t += 20) { s.apply({ type: "here", clientId: "ann" }, t); s.tick(t, {}); } // only Ann is still there
  assert.deepEqual(seatsOf(s, 19100), [["ann", 1]]);
  assert.deepEqual(s.tick(19120, {}).pads.map((p) => p.spotId), [1]);
  assert.equal(s.snapshot(19120).status, "playing");
  s.tick(29121, {}); // Ann goes quiet too: nobody is left to play
  assert.equal(s.snapshot(29121).status, "lobby");
  assert.equal(s.snapshot(29121).players.length, 0);

  const r = twoSeated();
  start(r, ["tiny"]);
  run(r, 0, START + 1700, play(tiny, [1, 2]));
  assert.equal(r.snapshot(START + 1700).status, "results");
  r.apply({ type: "here", clientId: "ann" }, START + 5000);
  r.tick(START + 12000, {}); // Ben has been quiet since START + 1700
  assert.deepEqual(seatsOf(r, START + 12000), [["ann", 1]]);
});

test("here from a phone that never joined is ignored", () => {
  const s = createSession({ songs });
  s.apply({ type: "here", clientId: "stranger" }, 0);
  assert.equal(s.snapshot(0).players.length, 0);
  assert.equal(said(s), null);
});

test("restore: a reloaded stage gives back the seats, one phone with several, and they still fall under the 10 second rule", () => {
  const s = createSession({ songs });
  s.restore([{ clientId: "ann", spotId: 1 }, { clientId: "ben", spotId: 3 }, { clientId: "ann", spotId: 2 }], 500);
  assert.deepEqual(seatsOf(s, 500), [["ann", 1], ["ann", 2], ["ben", 3]]);
  assert.equal(said(s, 500), null); // nothing was playing
  s.apply({ type: "here", clientId: "ann" }, 9000);
  s.tick(10501, {});
  assert.deepEqual(seatsOf(s, 10501), [["ann", 1], ["ann", 2]]);
});

test("restore: a stage that restarted mid-song comes back in the lobby with a notice for everyone", () => {
  const s = createSession({ songs });
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
  const s = createSession({ songs });
  const saved = [null, 5, "x", {}, { clientId: "", spotId: 1 }, { clientId: "d", spotId: 9 }, { clientId: "e", spotId: 1 },
    { clientId: "f", spotId: 1 }, { clientId: "e", spotId: 2 }, { clientId: "g", spotId: "1" }, { clientId: "h", spotId: null },
    { clientId: "old", name: "Old", spotId: 3 }]; // a save from before names were dropped still loads
  assert.doesNotThrow(() => s.restore(saved, 0, true));
  // Seat 9 does not exist, so Dee's phone is known but holds no seat; Fay wanted Eve's seat; the second "e" adds seat 2.
  assert.deepEqual(seatsOf(s), [["e", 1], ["e", 2], ["old", 3]]);
  for (const junk of [undefined, null, "players", {}, 4]) assert.doesNotThrow(() => createSession({ songs }).restore(junk, 0));
});

test("restore does nothing on a session that already has phones, and no notice for an empty list", () => {
  const s = twoSeated();
  s.restore([{ clientId: "zed", spotId: 3 }], 0, true);
  assert.deepEqual(seatsOf(s), [["ann", 1], ["ben", 2]]);
  const e = createSession({ songs });
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
