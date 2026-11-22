import { test } from "node:test";
import assert from "node:assert/strict";
import { songLevel, songTrouble } from "./level.js";
import { songs, songById } from "./index.js";

const tune = (bpm, count) => ({ id: "made-up", title: "Made up", by: "", bpm, notes: Array.from({ length: count }, (_, i) => ({ beat: i, midi: 60 + (i % 5), beats: 1 })), backing: [] });

test("every song gets one of the three levels", () => {
  for (const s of songs) assert.ok(["easy", "medium", "hard"].includes(songLevel(s)), s.id);
});

test("the songs Nicolo named: the two nursery tunes are easy, the three fast ones are hard", () => {
  for (const id of ["mary-lamb", "twinkle"]) assert.equal(songLevel(songById(id)), "easy", id);
  for (const id of ["fur-elise", "shipping-up-to-boston", "dirty-water"]) assert.equal(songLevel(songById(id)), "hard", id);
});

test("the 17 songs split into three groups, none under 4", () => {
  const sizes = ["easy", "medium", "hard"].map((level) => songs.filter((s) => songLevel(s) === level).length);
  for (const n of sizes) assert.ok(n >= 4, `groups ${sizes}`);
});

test("a made-up slow tune is easy and a made-up fast one is hard", () => {
  assert.equal(songLevel(tune(60, 40)), "easy");
  assert.equal(songLevel(tune(150, 100)), "hard");
});

test("a faster tempo never makes a song easier", () => {
  assert.ok(songTrouble(tune(150, 60)) >= songTrouble(tune(90, 60)));
});
