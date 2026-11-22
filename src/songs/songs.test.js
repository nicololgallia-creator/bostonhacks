import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { songs, songById } from "./index.js";
import { songSeconds } from "../game/engine.js";

const dir = new URL("../../songs/", import.meta.url);
const files = readdirSync(dir).filter((f) => f.endsWith(".json"));

test("index lists every file in songs/, shortest first", () => {
  assert.equal(songs.length, files.length);
  for (const f of files) assert.ok(songById(f.replace(".json", "")), `${f} is missing from src/songs/index.js`);
  for (let i = 1; i < songs.length; i++) assert.ok(songSeconds(songs[i - 1]) <= songSeconds(songs[i]));
  assert.equal(songById("nope"), undefined);
});

for (const f of files) {
  test(f, () => {
    const song = JSON.parse(readFileSync(new URL(f, dir), "utf8"));
    assert.equal(song.id, f.replace(".json", ""));
    assert.ok(song.title && song.by, "title and by are required");
    assert.ok(song.bpm > 0);
    const secondsApart = (a, b) => ((b.beat - a.beat) * 60) / song.bpm;
    song.notes.forEach((n, i) => {
      assert.ok(Number.isInteger(n.midi) && n.midi >= 48 && n.midi <= 84, `note ${i}: midi ${n.midi} is outside 48 to 84`);
      assert.ok(n.beats > 0, `note ${i}: length must be above 0`);
      const prev = song.notes[i - 1];
      if (!prev) return;
      assert.ok(n.beat > prev.beat, `note ${i} is not after the note before it`);
      assert.ok(prev.beat + prev.beats <= n.beat, `note ${i - 1} runs into note ${i}`);
      // 0.1 s is a sanity floor only (Sun 22 Nov). A song file holds the real tune, close notes and all. Keeping one player's tiles
      // far enough apart for a foot is the chart builder's job (MIN_GAP_MS in game/chart.js), never the song file's.
      assert.ok(secondsApart(prev, n) >= 0.1, `notes ${i - 1} and ${i} start only ${secondsApart(prev, n).toFixed(2)} s apart`);
    });
    console.log(`${song.title}: ${songSeconds(song).toFixed(1)} s`);
  });
}
