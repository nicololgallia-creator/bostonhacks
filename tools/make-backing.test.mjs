import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { SONGS, countIn, keyOf, longestSilence, makeBacking, setBacking } from "./make-backing.mjs";

const dir = new URL("../songs/", import.meta.url);
const files = readdirSync(dir).filter((f) => f.endsWith(".json"));
const load = (id) => JSON.parse(readFileSync(new URL(`${id}.json`, dir), "utf8"));

test("every song file has a line in SONGS, and the other way round", () => {
  assert.deepEqual(files.map((f) => f.replace(".json", "")).sort(), Object.keys(SONGS).sort());
});

for (const id of Object.keys(SONGS)) {
  test(`${id}: a full backing from the count-in to the end`, () => {
    const song = load(id);
    const back = song.backing;
    assert.ok(back?.length > 0 && back.length <= 1500, `${id}: ${back?.length} backing entries`);
    assert.deepEqual(back.slice(0, 4), countIn(SONGS[id].pulse), "the first four entries are the count-in");
    assert.ok(back.slice(4).every((e) => e.beat >= 0), "nothing but the count-in comes before beat 0");
    assert.ok(back.some((e) => e.midi < 52), "a bass line");
    assert.ok(back.some((e) => e.drum === "kick" || e.drum === "snare"), "drums");
    const silence = longestSilence(song);
    assert.ok(silence <= 1.5, `${id}: ${silence.toFixed(1)} s with nothing sounding`);
  });
}

test("the key is found from the melody", () => {
  assert.deepEqual(pick(keyOf(load("twinkle").notes)), { tonic: 0, mode: "major" });
  assert.deepEqual(pick(keyOf(load("fur-elise").notes)), { tonic: 9, mode: "minor" });
  assert.deepEqual(pick(keyOf(load("ship-never-returned").notes)), { tonic: 2, mode: "major" });
});

test("a generated backing ends on the home chord and stays inside the song", () => {
  const song = load("twinkle");
  const back = makeBacking(song, SONGS.twinkle);
  const end = Math.max(...song.notes.map((n) => n.beat + n.beats));
  assert.ok(back.every((e) => e.beat < end));
  const lastBass = back.filter((e) => e.midi && e.midi < 52).at(-1);
  assert.equal(lastBass.midi % 12, 0, "the last bass note is C");
});

test("setBacking changes only the backing list", () => {
  const text = '{\n  "id": "x",\n  "notes": [\n    {"beat": 0, "midi": 60, "beats": 1}\n  ]\n}\n';
  const once = setBacking(text, [{ beat: 0, drum: "kick" }]);
  assert.ok(once.includes('"notes": [\n    {"beat": 0, "midi": 60, "beats": 1}\n  ],\n  "backing": ['));
  assert.deepEqual(JSON.parse(once).backing, [{ beat: 0, drum: "kick" }]);
  const twice = setBacking(once, [{ beat: 1, drum: "hat" }]);
  assert.deepEqual(JSON.parse(twice).backing, [{ beat: 1, drum: "hat" }]);
  assert.deepEqual(JSON.parse(twice).notes, JSON.parse(text).notes);
});

const pick = ({ tonic, mode }) => ({ tonic, mode });
