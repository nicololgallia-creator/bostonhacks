// Turn a MIDI file into songs/<id>.json (the Song shape in PLAN.md) and list it in src/songs/index.js.
//   node tools/midi-to-song.mjs <file.mid> --id <id> --title "<title>" --by "<artist, year>" [--track <n>] [--from <sec>] [--to <sec>] [--replace]
// With only the file, it prints the tracks and the likeliest melody and writes nothing.
// The song keeps the whole melody. Keeping one player's tiles far enough apart for a foot is the chart builder's job (MIN_GAP_MS in src/game/chart.js).
// --replace writes the song again when its id is already in songs/, and keeps its place in src/songs/index.js.
import { existsSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import tonejs from "@tonejs/midi";
import { songSeconds } from "../src/game/engine.js";

const { Midi } = tonejs;
const GRIDS = [1, 2, 3, 4, 6, 8]; // note starts per quarter note, coarsest first
const MAX_BYTES = 5_000_000;
const USAGE = 'Usage: node tools/midi-to-song.mjs <file.mid> --id <id> --title "<title>" --by "<artist, year>" [--track <n>] [--from <sec>] [--to <sec>] [--replace]';

// Kick for kick and toms, snare for snares and claps, hat for everything else (hats, cymbals, percussion).
const drumOf = (midi) => (midi <= 36 || [41, 43, 45, 47, 48, 50].includes(midi) ? "kick" : midi <= 40 ? "snare" : "hat");
const camel = (id) => id.replace(/-([a-z0-9])/g, (_, c) => c.toUpperCase());

function tracksOf(midi) {
  return midi.tracks.map((t, number) => ({
    number,
    name: t.name,
    instrument: t.instrument.name,
    drums: t.instrument.percussion,
    notes: t.notes,
    low: Math.min(...t.notes.map((n) => n.midi)),
    high: Math.max(...t.notes.map((n) => n.midi)),
  }));
}

// The pitched track with the highest average pitch, ignoring tracks with far fewer notes than the busiest one.
function likeliestMelody(tracks) {
  const pitched = tracks.filter((t) => !t.drums && t.notes.length);
  const most = Math.max(...pitched.map((t) => t.notes.length));
  const mean = (t) => t.notes.reduce((s, n) => s + n.midi, 0) / t.notes.length;
  const pick = pitched.filter((t) => t.notes.length >= most / 4).sort((a, b) => mean(b) - mean(a))[0];
  if (!pick) throw new Error("This MIDI file has no pitched notes to use as a melody.");
  return { track: pick, why: `track ${pick.number} has the highest average pitch (midi ${mean(pick).toFixed(0)}) of the pitched tracks with enough notes` };
}

export function convertMidi(bytes, { id, title, by, track, from = 0, to = Infinity } = {}) {
  let midi;
  try {
    midi = new Midi(bytes);
  } catch {
    throw new Error("That file is not a MIDI file. Pick a .mid file.");
  }
  const tracks = tracksOf(midi);
  let melody, why;
  if (track === undefined) ({ track: melody, why } = likeliestMelody(tracks));
  else {
    melody = tracks[track];
    if (!melody) throw new Error(`This file has tracks 0 to ${tracks.length - 1}. There is no track ${track}.`);
    why = `track ${track} chosen with --track`;
  }
  const info = { tracks, melody: melody.number, why };
  if (!id) return { info };

  const cut = (t) => t.notes.filter((n) => n.time >= from && n.time < to);
  const melodyRaw = cut(melody);
  if (!melodyRaw.length) {
    const range = from > 0 || to < Infinity ? ` between ${from} and ${to} seconds` : "";
    throw new Error(`Track ${melody.number} has no notes${range}. Pick another --track or widen --from and --to.`);
  }
  const backRaw = tracks.filter((t) => t !== melody).flatMap((t) => cut(t).map((n) => ({ n, drums: t.drums })));

  // One time grid for everything: the coarsest one every note start sits on, or the finest if none does.
  const tempo = midi.header.tempos[0]?.bpm ?? 120;
  const origin = Math.min(...melodyRaw.map((n) => n.time), ...backRaw.map((b) => b.n.time));
  const quarters = (n) => ((n.time - origin) * tempo) / 60;
  const starts = [...melodyRaw, ...backRaw.map((b) => b.n)].map(quarters);
  const d = GRIDS.find((g) => starts.every((q) => Math.abs(q * g - Math.round(q * g)) <= 0.15)) ?? GRIDS.at(-1);
  const bpm = Math.round(tempo * d * 100) / 100;
  const beatOf = (n) => Math.round(quarters(n) * d);
  const lengthOf = (n) => Math.max(1, Math.round((n.duration * bpm) / 60));

  // Melody: one note per start time (the highest), so the tune stays one line. A note is shortened where the next one starts.
  const top = new Map();
  for (const n of melodyRaw) {
    const b = beatOf(n);
    const have = top.get(b);
    if (!have || n.midi > have.midi) top.set(b, { beat: b, midi: n.midi, length: lengthOf(n) });
  }
  const kept = [...top.values()].sort((a, b) => a.beat - b.beat);
  const lo = Math.min(...kept.map((n) => n.midi));
  const hi = Math.max(...kept.map((n) => n.midi));
  const shift = 12 * Math.round((66 - (lo + hi) / 2) / 12);
  const fold = (m) => {
    m += shift;
    while (m < 48) m += 12;
    while (m > 84) m -= 12;
    return m;
  };
  const notes = kept.map((n, i) => ({ beat: n.beat, midi: fold(n.midi), beats: Math.min(n.length, (kept[i + 1]?.beat ?? Infinity) - n.beat) }));

  // Backing: everything else, as it is, once per beat and sound.
  const seen = new Set();
  const backing = [];
  for (const { n, drums } of backRaw) {
    const beat = beatOf(n);
    const sound = drums ? drumOf(n.midi) : n.midi;
    if (seen.has(`${beat}/${sound}`)) continue;
    seen.add(`${beat}/${sound}`);
    backing.push(drums ? { beat, drum: sound } : { beat, midi: n.midi, beats: lengthOf(n) });
  }
  backing.sort((a, b) => a.beat - b.beat);

  const song = { id, title, by, bpm, notes, ...(backing.length && { backing }) };
  return { info, song };
}

const obj = (o) => `{${Object.entries(o).map(([k, v]) => `"${k}": ${JSON.stringify(v)}`).join(", ")}}`;
const rows = (list) => Array.from({ length: Math.ceil(list.length / 4) }, (_, i) => `    ${list.slice(i * 4, i * 4 + 4).map(obj).join(", ")}`).join(",\n");

export function songToJson(s) {
  const head = `  "id": ${JSON.stringify(s.id)},\n  "title": ${JSON.stringify(s.title)},\n  "by": ${JSON.stringify(s.by)},\n  "bpm": ${s.bpm},`;
  const backing = s.backing ? `,\n  "backing": [\n${rows(s.backing)}\n  ]` : "";
  return `{\n${head}\n  "notes": [\n${rows(s.notes)}\n  ]${backing}\n}\n`;
}

// Adds the import line and the name in the songs list. Returns the text unchanged if the song is already listed.
export function addToIndex(text, id) {
  const path = `../../songs/${id}.json`;
  if (text.includes(`"${path}"`)) return text;
  const name = camel(id);
  if (new RegExp(`\\b${name}\\b`).test(text)) throw new Error(`The name "${name}" is already used in src/songs/index.js. Pick another --id.`);
  const list = /(export const songs = \[[^\]]*)\]/;
  if (!list.test(text)) throw new Error('src/songs/index.js has no "export const songs = [...]" list. Add the song by hand.');
  const eol = text.includes("\r\n") ? "\r\n" : "\n";
  const lastImport = [...text.matchAll(/^import .*;/gm)].at(-1);
  const at = lastImport.index + lastImport[0].length;
  const withImport = `${text.slice(0, at)}${eol}import ${name} from "${path}" with { type: "json" };${text.slice(at)}`;
  return withImport.replace(list, `$1, ${name}]`);
}

function parseArgs(argv) {
  const [file, ...rest] = argv;
  if (!file || file.startsWith("--")) throw new Error(`Give the path of a .mid file first.\n${USAGE}`);
  const opts = {};
  for (let i = 0; i < rest.length; i += 2) {
    const key = rest[i].replace(/^--/, "");
    if (rest[i] === "--replace") {
      opts.replace = true;
      i--; // a switch with no value
      continue;
    }
    if (!["id", "title", "by", "track", "from", "to"].includes(key) || !rest[i].startsWith("--")) throw new Error(`Unknown option ${rest[i]}.\n${USAGE}`);
    if (rest[i + 1] === undefined) throw new Error(`The option --${key} needs a value.`);
    opts[key] = rest[i + 1];
  }
  for (const key of ["track", "from", "to"]) {
    if (opts[key] === undefined) continue;
    const n = Number(opts[key]);
    if (!Number.isFinite(n) || n < 0 || (key === "track" && !Number.isInteger(n))) throw new Error(`--${key} must be ${key === "track" ? "a track number" : "a number of seconds"}, not "${opts[key]}".`);
    opts[key] = n;
  }
  if (opts.from !== undefined && opts.to !== undefined && opts.from >= opts.to) throw new Error("--from must be smaller than --to.");
  return { file, opts };
}

const table = (tracks) =>
  ["track  notes  low-high  name / instrument", ...tracks.map((t) => `${String(t.number).padEnd(7)}${String(t.notes.length).padEnd(7)}${(t.notes.length ? `${t.low}-${t.high}` : "-").padEnd(10)}${t.name || "(no name)"} / ${t.drums ? "drums" : t.instrument}`)].join("\n");

// Returns the text to print. Writes files under root only when --id, --title and --by are all given.
export function run(argv, root = fileURLToPath(new URL("..", import.meta.url))) {
  const { file, opts } = parseArgs(argv);
  if (!existsSync(file)) throw new Error(`There is no file at ${file}. Check the path.`);
  if (statSync(file).size > MAX_BYTES) throw new Error("That file is too large to read as a song. Use a MIDI file under 5 MB.");
  const given = ["id", "title", "by"].filter((k) => opts[k]);
  if (given.length && given.length < 3) throw new Error(`Give --id, --title and --by together. Missing: ${["id", "title", "by"].filter((k) => !opts[k]).map((k) => `--${k}`).join(", ")}.`);
  if (opts.id && !/^[a-z][a-z0-9-]*$/.test(opts.id)) throw new Error("The --id may only use lowercase letters, numbers and dashes, and must start with a letter.");
  const songPath = `${root}/songs/${opts.id}.json`;
  if (opts.id && existsSync(songPath) && !opts.replace) throw new Error(`The id "${opts.id}" is already used by songs/${opts.id}.json. Pick another --id, or add --replace to write it again.`);
  if (opts.replace && !opts.id) throw new Error("--replace goes with --id, --title and --by.");
  if (opts.replace && !existsSync(songPath)) throw new Error(`--replace needs an existing song, and there is no songs/${opts.id}.json. Leave out --replace to add a new song.`);

  const { info, song } = convertMidi(readFileSync(file), opts);
  const out = [];
  if (opts.track === undefined) out.push(table(info.tracks), `Melody: ${info.why}. Re-run with --track <n> to pick another.`);
  if (!song) return out.concat("Nothing written. Add --id, --title and --by to write the song.").join("\n");

  const indexPath = `${root}/src/songs/index.js`;
  const index = addToIndex(readFileSync(indexPath, "utf8"), song.id);
  writeFileSync(songPath, songToJson(song));
  writeFileSync(indexPath, index);
  out.push(`Wrote songs/${song.id}.json: ${song.notes.length} melody notes, ${song.backing?.length ?? 0} backing notes, bpm ${song.bpm}, ${songSeconds(song).toFixed(1)} s. Listed in src/songs/index.js.`);
  return out.join("\n");
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    console.log(run(process.argv.slice(2)));
  } catch (err) {
    console.error(`Error: ${err.message}`);
    process.exit(1);
  }
}
