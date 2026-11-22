import { test } from "node:test";
import assert from "node:assert/strict";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import tonejs from "@tonejs/midi";
import { addToIndex, convertMidi, run } from "./midi-to-song.mjs";

const { Midi } = tonejs;
const real = new URL("../qa/midi/greensleeves.mid", import.meta.url);

// A MIDI file built in memory. A track is { drums?, notes: [{ midi, time, duration }] } with times in seconds at 120 bpm.
function makeMidi(tracks, bpm = 120) {
  const m = new Midi();
  m.header.setTempo(bpm);
  for (const t of tracks) {
    const tr = m.addTrack();
    if (t.drums) tr.channel = 9;
    t.notes.forEach((n) => tr.addNote(n));
  }
  return Buffer.from(m.toArray());
}
const at = (...pairs) => pairs.map(([midi, time, duration = 0.5]) => ({ midi, time, duration }));
const meta = { id: "t", title: "T", by: "B" };

function checkSongRules(song) {
  song.notes.forEach((n, i) => {
    assert.ok(n.midi >= 48 && n.midi <= 84, `note ${i} midi ${n.midi}`);
    assert.ok(n.beats > 0);
    if (i) {
      const prev = song.notes[i - 1];
      assert.ok(n.beat > prev.beat && prev.beat + prev.beats <= n.beat, `note ${i} overlaps`);
    }
  });
}

test("the real Mutopia file converts: melody from the treble, backing from the bass, rules hold", () => {
  const { song, info } = convertMidi(readFileSync(real), { ...meta, id: "greensleeves" });
  assert.equal(info.melody, 0);
  checkSongRules(song);
  assert.deepEqual(song.notes.slice(0, 3).map((n) => n.midi), [69, 72, 74]); // A, C, D: the tune's opening
  assert.ok(song.backing.length > 100 && song.backing.every((b) => b.midi < 64));
});

test("with no --track it picks the high pitched track and lists every track", () => {
  const bytes = makeMidi([{ notes: at([40, 0], [43, 1], [45, 2], [47, 3]) }, { notes: at([72, 0], [74, 1], [76, 2], [77, 3]) }, { drums: true, notes: at([36, 0], [38, 0.5]) }]);
  const { info } = convertMidi(bytes);
  assert.equal(info.tracks.length, 3);
  assert.equal(info.melody, 1);
  assert.match(info.why, /highest average pitch/);
});

test("when notes start together the highest is kept, and low notes move up whole octaves", () => {
  const { song } = convertMidi(makeMidi([{ notes: at([36, 0], [43, 0], [40, 1], [47, 1], [38, 2]) }]), meta);
  assert.deepEqual(song.notes.map((n) => n.midi), [67, 71, 62]); // 43, 47 and 38, all moved up two octaves
  checkSongRules(song);
});

test("notes close together are all kept, and a note is shortened where the next one starts", () => {
  // 120 bpm: a quarter is 0.5 s. The notes at 0.25 s and 0.75 s sit off the beat, and the first one rings 0.5 s.
  const { song } = convertMidi(makeMidi([{ notes: at([60, 0], [62, 0.25, 0.25], [64, 0.75, 0.25], [65, 1]) }]), meta);
  assert.deepEqual(song.notes.map((n) => [n.beat, n.midi]), [[0, 60], [1, 62], [3, 64], [4, 65]]);
  assert.equal(song.bpm, 240);
  assert.equal(song.notes[0].beats, 1); // it would ring for 2 grid steps, and the next note starts after 1
  checkSongRules(song);
});

test("two notes with the same start keep only the higher one", () => {
  const { song } = convertMidi(makeMidi([{ notes: at([60, 0], [67, 0], [62, 1]) }]), meta);
  assert.deepEqual(song.notes.map((n) => n.midi), [67, 62]);
});

test("--from and --to keep only that section, and beat 0 is its first note", () => {
  const bytes = makeMidi([{ notes: at([60, 0], [62, 1], [64, 2], [65, 3], [67, 4]) }]);
  const { song } = convertMidi(bytes, { ...meta, from: 2, to: 4 });
  assert.deepEqual(song.notes.map((n) => [n.beat, n.midi]), [[0, 64], [2, 65]]);
});

test("other tracks become backing, and drums map to kick, snare and hat", () => {
  const bytes = makeMidi([
    { notes: at([72, 0], [74, 1]) },
    { notes: at([48, 0, 1]) },
    { drums: true, notes: at([36, 0, 0.1], [38, 0.5, 0.1], [42, 1, 0.1], [49, 1, 0.1], [41, 1.5, 0.1]) },
  ]);
  const { song } = convertMidi(bytes, { ...meta, track: 0 });
  const drums = song.backing.filter((b) => b.drum);
  assert.deepEqual(drums.map((b) => b.drum), ["kick", "snare", "hat", "kick"]); // 42 and 49 land on one beat as one hat
  assert.ok(drums.every((b) => b.midi === undefined));
  assert.deepEqual(song.backing.find((b) => b.midi), { beat: 0, midi: 48, beats: 2 });
});

test("a song with no other tracks has no backing key", () => {
  const { song } = convertMidi(makeMidi([{ notes: at([60, 0], [62, 1]) }]), meta);
  assert.equal("backing" in song, false);
});

test("the grid follows the file: eighth notes give a finer grid than quarters", () => {
  const quarters = convertMidi(makeMidi([{ notes: at([60, 0], [62, 0.5], [64, 1]) }]), meta).song;
  const eighths = convertMidi(makeMidi([{ notes: at([60, 0], [62, 0.25], [64, 1]) }]), meta).song;
  assert.equal(quarters.bpm, 120);
  assert.equal(eighths.bpm, 240);
});

test("bad input gets a plain reason", () => {
  assert.throws(() => convertMidi(Buffer.from("not a midi file at all")), /not a MIDI file/);
  assert.throws(() => convertMidi(makeMidi([{ notes: at([60, 0]) }]), { ...meta, track: 5 }), /no track 5/);
  assert.throws(() => convertMidi(makeMidi([{ notes: at([60, 0]) }, { notes: [] }]), { ...meta, track: 1 }), /no notes/);
  assert.throws(() => convertMidi(makeMidi([{ notes: at([60, 0]) }]), { ...meta, from: 10 }), /no notes between 10/);
  assert.throws(() => convertMidi(makeMidi([{ drums: true, notes: at([36, 0]) }])), /no pitched notes/);
});

// The command line, run against a scratch copy of songs/ and src/songs/index.js.
function scratchRoot() {
  const root = mkdtempSync(join(tmpdir(), "midi-to-song-"));
  mkdirSync(join(root, "songs"));
  mkdirSync(join(root, "src/songs"), { recursive: true });
  cpSync(new URL("../src/songs/index.js", import.meta.url), join(root, "src/songs/index.js"));
  return root;
}
const arg = (root, ...rest) => run([fileURLToPath(real), ...rest], root);

test("--replace writes an existing song again and keeps its place in the list, and is refused without it or for a new id", () => {
  const root = scratchRoot();
  try {
    arg(root, "--id", "my-song", "--title", "My Song", "--by", "Someone, 1900");
    const listed = readFileSync(join(root, "src/songs/index.js"), "utf8");
    assert.throws(() => arg(root, "--id", "my-song", "--title", "My Song", "--by", "x"), /add --replace/);
    const out = arg(root, "--id", "my-song", "--title", "Again", "--by", "x", "--replace", "--from", "0", "--to", "20");
    assert.match(out, /Wrote songs.my-song.json/);
    assert.equal(JSON.parse(readFileSync(join(root, "songs/my-song.json"), "utf8")).title, "Again");
    assert.equal(readFileSync(join(root, "src/songs/index.js"), "utf8"), listed);
    assert.throws(() => arg(root, "--id", "other", "--title", "t", "--by", "b", "--replace"), /no songs.other.json/);
    assert.throws(() => arg(root, "--replace"), /goes with --id/);
  } finally {
    rmSync(root, { recursive: true });
  }
});

test("the command writes the song file and lists it in index.js once, even when run twice", () => {
  const root = scratchRoot();
  try {
    const out = arg(root, "--id", "my-song", "--title", "My Song", "--by", "Someone, 1900");
    assert.match(out, /Melody: track 0/);
    assert.match(out, /Wrote songs\/my-song\.json/);
    const song = JSON.parse(readFileSync(join(root, "songs/my-song.json"), "utf8"));
    assert.equal(song.id, "my-song");
    assert.equal(song.title, "My Song");
    let index = readFileSync(join(root, "src/songs/index.js"), "utf8");
    assert.equal(index.match(/my-song\.json/g).length, 1);
    assert.match(index, /export const songs = \[.*\bmySong\]/s);
    rmSync(join(root, "songs/my-song.json"));
    arg(root, "--id", "my-song", "--title", "My Song", "--by", "x", "--track", "0");
    index = readFileSync(join(root, "src/songs/index.js"), "utf8");
    assert.equal(index.match(/my-song\.json/g).length, 1);
    assert.equal(index.match(/\bmySong\b/g).length, 2); // the import and the list
  } finally {
    rmSync(root, { recursive: true });
  }
});

test("the command with only a file prints the tracks and writes nothing", () => {
  const root = scratchRoot();
  try {
    const out = arg(root);
    assert.match(out, /treble/);
    assert.match(out, /Nothing written/);
    assert.equal(existsSync(join(root, "songs/undefined.json")), false);
  } finally {
    rmSync(root, { recursive: true });
  }
});

test("the command refuses bad input with the fix", () => {
  const root = scratchRoot();
  try {
    writeFileSync(join(root, "songs/taken.json"), "{}");
    writeFileSync(join(root, "bad.mid"), "hello");
    assert.throws(() => run([join(root, "nope.mid"), "--id", "a", "--title", "t", "--by", "b"], root), /There is no file at/);
    assert.throws(() => run([join(root, "bad.mid"), "--id", "a", "--title", "t", "--by", "b"], root), /not a MIDI file/);
    assert.throws(() => arg(root, "--id", "taken", "--title", "t", "--by", "b"), /already used by songs\/taken\.json/);
    assert.throws(() => arg(root, "--id", "../evil", "--title", "t", "--by", "b"), /lowercase letters/);
    assert.throws(() => arg(root, "--id", "a"), /Missing: --title, --by/);
    assert.throws(() => arg(root, "--id", "a", "--title", "t", "--by", "b", "--track", "x"), /must be a track number/);
    assert.throws(() => arg(root, "--id", "a", "--title", "t", "--by", "b", "--from", "9", "--to", "3"), /smaller than --to/);
    assert.throws(() => arg(root, "--colour", "red"), /Unknown option/);
    assert.throws(() => run([], root), /Give the path/);
    assert.equal(existsSync(join(root, "songs/a.json")), false);
  } finally {
    rmSync(root, { recursive: true });
  }
});

test("addToIndex adds once, keeps Windows line endings, and refuses a clashing name", () => {
  const text = 'import a from "../../songs/a.json" with { type: "json" };\r\n\r\nexport const songs = [a];\r\n';
  const once = addToIndex(text, "new-one");
  assert.equal(addToIndex(once, "new-one"), once);
  assert.equal(once, 'import a from "../../songs/a.json" with { type: "json" };\r\nimport newOne from "../../songs/new-one.json" with { type: "json" };\r\n\r\nexport const songs = [a, newOne];\r\n');
  assert.throws(() => addToIndex(text, "songs"), /already used/);
  assert.throws(() => addToIndex("nothing here", "x"), /no "export const songs/);
});
