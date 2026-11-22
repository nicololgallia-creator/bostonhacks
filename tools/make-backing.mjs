// Writes the backing of each song in songs/ from its melody: a bass note on the strong pulses, a plain chord pattern
// under it (root, fourth, fifth and the relative minor, chosen from what the melody plays), and a light drum pattern in
// the song's metre. It also puts a four-click count-in at negative beats, so the lead-in is never silent.
// Songs imported from MIDI (make: false) keep their own backing and only get the count-in; make: "drums" also adds the drums, make: "fill" adds bass and chords where the MIDI has a hole.
//
//   node tools/make-backing.mjs [--dry] [song-id ...]     (no ids: every song in SONGS)
//
// Run it again after the melody of a song changes: the backing follows the notes.
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

// pulse: beats in one count (a quarter note, or the dotted quarter in 6/8). bar: beats in a bar.
// start: the beat where the first full bar begins (a pickup comes before it). make: false keeps the song's own backing, make: "drums" keeps its notes and adds drums, "fill" keeps them and fills holes of over HOLE_S seconds with bass and chords.
// key: only where the notes lean on the wrong tonic.
export const SONGS = {
  twinkle: { pulse: 1, bar: 4, start: 0, make: true },
  "mary-lamb": { pulse: 1, bar: 4, start: 0, make: true, key: { tonic: 0, mode: "major" } }, // the notes lean on E; the tune ends on C
  saints: { pulse: 1, bar: 4, start: 3, make: true }, // three-note pickup, then the long note is the downbeat
  "happy-birthday": { pulse: 2, bar: 6, start: 2, make: true }, // 3/4, two eighths of pickup
  "row-boat": { pulse: 3, bar: 6, start: 0, make: true }, // 6/8
  "frere-jacques": { pulse: 2, bar: 8, start: 0, make: true },
  "london-bridge": { pulse: 2, bar: 8, start: 0, make: true },
  "jingle-bells": { pulse: 2, bar: 8, start: 0, make: true, key: { tonic: 0, mode: "major" } }, // the same: mostly E, ends on C
  "ode-to-joy": { pulse: 2, bar: 8, start: 0, make: true },
  "fur-elise": { pulse: 2, bar: 6, start: 2, make: true }, // 3/8 in sixteenths, two of pickup
  "take-me-out-to-the-ball-game": { pulse: 1, bar: 3, start: 0, make: true },
  "ship-never-returned": { pulse: 2, bar: 8, start: 0, make: true },
  greensleeves: { pulse: 3, bar: 6, start: 2, make: "drums" }, // the Mutopia accompaniment has no drums: keep it, add the 6/8 pattern
  "sweet-caroline": { pulse: 8, make: false },
  "dirty-water": { pulse: 3, bar: 12, start: 0, make: "fill" }, // a 3 s hi-hat intro: bass and chords go in where the MIDI plays no pitched note
  "more-than-a-feeling": { pulse: 8, make: false },
  "shipping-up-to-boston": { pulse: 4, bar: 16, start: 0, make: "fill" }, // a 1.4 s hole
};

const MAX_ENTRIES = 1500;
const HOLE_S = 1.2; // a stretch with no pitched note starting or ringing this long gets filled
const MAJOR = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88]; // Krumhansl key profiles
const MINOR = [6.33, 2.68, 3.52, 5.38, 2.6, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17];
// The chords each key may use: root (semitones above the tonic), third, and how likely the chord is.
const CHORDS = {
  major: [[0, 4, 1], [2, 3, 0.4], [4, 3, 0.2], [5, 4, 0.8], [7, 4, 0.9], [9, 3, 0.5]],
  minor: [[0, 3, 1], [3, 4, 0.3], [5, 3, 0.8], [7, 4, 0.9], [8, 4, 0.5], [10, 4, 0.3]],
};

const mod = (n, m) => ((n % m) + m) % m;
const endBeatOf = (song) => Math.max(...song.notes.map((n) => n.beat + n.beats));

// The key from the notes, weighted by length, with the first and last note counted extra.
export function keyOf(notes) {
  const weight = Array(12).fill(0);
  for (const n of notes) weight[n.midi % 12] += n.beats;
  weight[notes[0].midi % 12] += 3;
  weight[notes.at(-1).midi % 12] += 3;
  let best = null;
  for (const mode of ["major", "minor"]) {
    for (let tonic = 0; tonic < 12; tonic++) {
      const profile = mode === "major" ? MAJOR : MINOR;
      const xs = weight.map((_, i) => weight[(i + tonic) % 12]);
      const mx = xs.reduce((a, b) => a + b) / 12;
      const mp = profile.reduce((a, b) => a + b) / 12;
      let num = 0, dx = 0, dp = 0;
      xs.forEach((x, i) => { num += (x - mx) * (profile[i] - mp); dx += (x - mx) ** 2; dp += (profile[i] - mp) ** 2; });
      const r = num / Math.sqrt(dx * dp);
      if (!best || r > best.r) best = { tonic, mode, r };
    }
  }
  return best;
}

// One chord for each window of the bar grid, the best fit to the melody with a pull towards plain chord moves.
function chordPlan(song, key, { pulse, bar, start }) {
  const windowLen = bar / pulse >= 4 ? bar / 2 : bar;
  const first = start - Math.ceil(start / windowLen) * windowLen; // a window that begins at or before beat 0
  const end = endBeatOf(song);
  const count = Math.ceil((end - first) / windowLen);
  const options = CHORDS[key.mode].map(([root, third, prior]) => ({ root: mod(key.tonic + root, 12), third, prior, pcs: [0, third, 7].map((i) => mod(key.tonic + root + i, 12)) }));

  const fit = (chord, a, b) => {
    let score = (chord.prior * 0.25 * (b - a)) / pulse;
    for (const n of song.notes) {
      const overlap = Math.min(b, n.beat + n.beats) - Math.max(a, n.beat);
      if (overlap <= 0) continue;
      const on = n.beat >= a ? 1.5 : 1; // a note that starts in the window counts more than one that only rings into it
      score += (chord.pcs.includes(n.midi % 12) ? 1 : -0.6) * overlap * on;
    }
    return score;
  };
  // A chord's pull towards the next one: staying put, or a fifth down (V to I, I to IV).
  const move = (from, to) => (from === to ? 0.4 : mod(from.root - to.root, 12) === 7 ? 0.3 : 0);

  let rows = [];
  for (let w = 0; w < count; w++) {
    const a = first + w * windowLen;
    const tonicBonus = w === count - 1 ? 2 : w === 0 ? 1 : 0;
    rows.push(options.map((c, i) => ({ c, score: fit(c, a, a + windowLen) + (i === 0 ? tonicBonus : 0), from: -1 })));
  }
  rows[0].forEach((cell) => { cell.total = cell.score; });
  for (let w = 1; w < count; w++) {
    rows[w].forEach((cell) => {
      let best = -Infinity;
      rows[w - 1].forEach((prev, j) => {
        const v = prev.total + move(prev.c, cell.c);
        if (v > best) { best = v; cell.from = j; }
      });
      cell.total = cell.score + best;
    });
  }
  let at = rows.at(-1).reduce((bi, cell, i, all) => (cell.total > all[bi].total ? i : bi), 0);
  const chosen = [];
  for (let w = count - 1; w >= 0; w--) { chosen[w] = rows[w][at].c; at = rows[w][at].from; }
  return { chordAt: (beat) => chosen[Math.min(count - 1, Math.max(0, Math.floor((beat - first) / windowLen)))] };
}

// Three notes close to the last chord's, so the chords glide instead of jumping. Around midi 52 to 67.
function voicing(chord, previous) {
  const pool = [];
  for (const pc of chord.pcs) for (let m = 50; m <= 70; m++) if (m % 12 === pc) pool.push(m);
  const target = previous ?? [55, 60, 64];
  let best = null;
  for (const a of pool) for (const b of pool) for (const c of pool) {
    if (!(a < b && b < c) || new Set([a, b, c].map((m) => m % 12)).size < 3) continue;
    const cost = [a, b, c].reduce((s, m, i) => s + Math.abs(m - target[i]), 0);
    if (!best || cost < best.cost) best = { cost, notes: [a, b, c] };
  }
  return best.notes;
}

const bassOf = (pc) => 38 + mod(pc - 38, 12); // D2 up to C#3

// The whole backing for a song: count-in, bass, chords, drums.
export function makeBacking(song, { pulse, bar, start, key = keyOf(song.notes) }) {
  const { chordAt } = chordPlan(song, key, { pulse, bar, start });
  const end = endBeatOf(song);
  const out = [];
  const bass = (beat, midi, beats) => out.push({ beat, midi, beats });
  const drum = (beat, kind) => out.push({ beat, drum: kind });
  let last = null;
  const chord = (beat, c, beats) => {
    if (!last || last.c !== c) last = { c, notes: voicing(c, last?.notes) };
    last.notes.forEach((midi) => out.push({ beat, midi, beats }));
  };

  const pulses = bar / pulse;
  for (let barStart = start - Math.ceil(start / bar) * bar; barStart < end; barStart += bar) {
    const lastBar = barStart + bar >= end; // the song ends on the root, not the fifth
    const at = (beat, f) => { if (beat >= 0 && beat < end) f(beat, chordAt(Math.max(0, beat))); };
    const bassNote = (c, fifth) => (fifth ? ((m) => (m > 52 ? m - 12 : m))(bassOf(c.root) + 7) : bassOf(c.root));
    if (pulses === 4) {
      for (let j = 0; j < 4; j++) {
        const b = barStart + j * pulse;
        at(b, (t, c) => (j % 2 === 0 ? bass(t, bassNote(c, j === 2 && !lastBar), pulse * 2) : chord(t, c, pulse)));
        at(b, (t) => drum(t, j % 2 === 0 ? "kick" : "snare"));
        at(b, (t) => drum(t, "hat"));
        if (pulse >= 2) at(b + pulse / 2, (t) => drum(t, "hat"));
      }
    } else if (pulses === 3) {
      for (let j = 0; j < 3; j++) {
        const b = barStart + j * pulse;
        at(b, (t, c) => (j === 0 ? bass(t, bassNote(c, false), pulse * 2) : chord(t, c, pulse)));
        at(b, (t) => drum(t, j === 0 ? "kick" : "hat"));
        if (pulse >= 2 && j > 0) at(b + pulse / 2, (t) => drum(t, "hat"));
      }
    } else if (pulses === 2 && pulse === 3) { // 6/8: bass on the two big beats, chords on the small ones
      for (let j = 0; j < 2; j++) {
        const b = barStart + j * pulse;
        at(b, (t, c) => bass(t, bassNote(c, j === 1 && !lastBar), pulse));
        at(b + 1, (t, c) => chord(t, c, 1));
        at(b + 2, (t, c) => chord(t, c, 1));
        at(b, (t) => drum(t, j === 0 ? "kick" : "snare"));
        for (let k = 1; k < 3; k++) at(b + k, (t) => drum(t, "hat"));
      }
    } else throw new Error(`${song.id}: bar ${bar} with pulse ${pulse} is not a metre make-backing knows (4, 3 or 6/8 pulses).`);
  }
  return [...countIn(pulse), ...out.sort((a, b) => a.beat - b.beat)];
}

export const countIn = (pulse) => [-4, -3, -2, -1].map((n, i) => ({ beat: n * pulse, drum: i === 0 ? "click" : "tick" }));

// The longest stretch, in seconds from the first beat to the end of the melody, where nothing in the backing sounds.
export function longestSilence(song, backing = song.backing ?? []) {
  const sec = 60 / song.bpm;
  const end = endBeatOf(song) * sec;
  const spans = backing.filter((e) => e.beat >= 0).map((e) => [e.beat * sec, e.beat * sec + (e.drum ? 0.15 : Math.min(e.beats * sec, 3))]).sort((a, b) => a[0] - b[0]);
  let reach = 0, worst = 0;
  for (const [a, b] of spans) {
    worst = Math.max(worst, a - reach);
    reach = Math.max(reach, b);
  }
  return Math.max(worst, end - reach);
}

// The generated bass and chords that start inside a hole of the song's own pitched backing.
export function fillHoles(song, own, made) {
  const sec = 60 / song.bpm;
  const spans = own.filter((e) => e.midi && e.beat >= 0).map((e) => [e.beat * sec, e.beat * sec + Math.min(e.beats * sec, 1.5)]).sort((a, b) => a[0] - b[0]);
  const holes = [];
  let reach = 0;
  for (const [a, b] of spans) {
    if (a - reach > HOLE_S) holes.push([reach, a]);
    reach = Math.max(reach, b);
  }
  return made.filter((e) => e.midi && e.beat >= 0 && holes.some(([a, b]) => e.beat * sec >= a && e.beat * sec < b));
}

const obj = (o) => `{${Object.entries(o).map(([k, v]) => `"${k}": ${JSON.stringify(v)}`).join(", ")}}`;
const rows = (list) => Array.from({ length: Math.ceil(list.length / 4) }, (_, i) => `    ${list.slice(i * 4, i * 4 + 4).map(obj).join(", ")}`).join(",\n");

// Replaces only the "backing" list in the file's text (the notes and the head are never rewritten).
export function setBacking(text, list) {
  const block = `  "backing": [\n${rows(list)}\n  ]`;
  const has = /,\s*"backing": \[[^\]]*\]/;
  if (has.test(text)) return text.replace(has, () => `,\n${block}`);
  const end = /\s*\]\s*\}\s*$/;
  if (!end.test(text)) throw new Error("This song file does not end with the notes list and a closing brace, so the backing cannot be added by script.");
  return text.replace(end, () => `\n  ],\n${block}\n}\n`);
}

function run(argv, root = fileURLToPath(new URL("..", import.meta.url))) {
  const dry = argv.includes("--dry");
  const ids = argv.filter((a) => !a.startsWith("--"));
  const unknown = ids.filter((id) => !SONGS[id]);
  if (unknown.length) throw new Error(`No entry in SONGS for ${unknown.join(", ")}. Add one in tools/make-backing.mjs.`);
  const lines = [];
  for (const id of ids.length ? ids : Object.keys(SONGS)) {
    const file = `${root}/songs/${id}.json`;
    const text = readFileSync(file, "utf8");
    const song = JSON.parse(text);
    const how = SONGS[id];
    const own = (song.backing ?? []).filter((e) => e.beat >= 0 && (how.make !== "drums" || !e.drum));
    const made = how.make ? makeBacking(song, how) : [];
    const extra = how.make === "drums" ? made.filter((e) => e.drum && e.beat >= 0) : how.make === "fill" ? fillHoles(song, own, made) : [];
    const list = how.make === true ? made : [...countIn(how.pulse), ...[...own, ...extra].sort((a, b) => a.beat - b.beat)];
    if (list.length > MAX_ENTRIES) throw new Error(`${id}: ${list.length} backing entries, over the ${MAX_ENTRIES} limit.`);
    if (!dry) writeFileSync(file, setBacking(readFileSync(file, "utf8"), list)); // read again just before writing: nothing else is touched
    const key = how.make === true ? how.key ?? keyOf(song.notes) : null;
    const drums = list.filter((e) => e.drum).length;
    lines.push(`${id.padEnd(30)} ${key ? `${["C", "C#", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"][key.tonic]} ${key.mode}`.padEnd(9) : "kept     "} entries ${String(list.length).padStart(4)} (drums ${String(drums).padStart(3)}) longest silence ${longestSilence(song, list).toFixed(1)} s`);
  }
  return lines.join("\n");
}

if (process.argv[1] && import.meta.url === new URL(`file:///${process.argv[1].replaceAll("\\", "/")}`).href) {
  try {
    console.log(run(process.argv.slice(2)));
  } catch (err) {
    console.error(`Error: ${err.message}`);
    process.exit(1);
  }
}
