// Reads a tracking test file (tracktest-<stamp>.json from the stage's test, key G) and prints what it found.
//   node qa/seats/analyze-tracktest.mjs <file.json> [--redetect [--fresh-only]]
// Prints the score for each seat, then every false or extra tap with its time, seat and phase. With --redetect it runs
// the CURRENT src/track/taps.js over the recorded frames and prints the score that detector would have got, so a change to the
// detector can be judged on an old recording. The recorded frames are every screen frame the detector was fed, and --fresh-only
// feeds it only the frames where the camera gave the tracker a new picture (the others show it the same feet again).
import { readFileSync } from "node:fs";
import { createTapDetector } from "../../src/track/taps.js";
import { classifyTaps, scoreTest, falseTaps } from "../../src/stage/tracktest-score.js";

const args = process.argv.slice(2);
const path = args.find((a) => !a.startsWith("--"));
if (!path) { console.error("usage: node qa/seats/analyze-tracktest.mjs <file.json> [--redetect [--fresh-only]]"); process.exit(2); }
let file;
try { file = JSON.parse(readFileSync(path, "utf8")); } catch (e) { console.error(`Cannot read ${path}: ${e.message}`); process.exit(1); }
if (file.kind !== "tracktest" || file.version !== 1) { console.error(`${path} is not a version 1 tracking test file (kind "${file.kind}", version ${file.version}).`); process.exit(1); }

const s = (ms) => (ms / 1000).toFixed(2).padStart(6) + " s";
const phaseName = (id) => file.phases.find((p) => p.id === id)?.label ?? "between phases";

function report(title, f) {
  const score = scoreTest(f);
  console.log(`\n== ${title} ==`);
  console.log(`${f.frames.length} frames recorded, ${f.taps.length} taps, model ${f.model}, facing ${f.facing}${f.speed && f.speed !== 1 ? `, SPEED ${f.speed}x (scores are a smoke test only)` : ""}`);
  console.log("seat  false(still/move/others-turn)  caught      extra  delay ms (spread)  dropped seat frames");
  for (const [id, x] of Object.entries(score.seats)) {
    console.log(`${id.padStart(3)}   ${String(falseTaps(x)).padStart(3)} (${x.falseStill}/${x.falseMove}/${x.falseOthersTurn})`.padEnd(40) + `${x.caught} of ${x.expected}`.padEnd(12) + String(x.extra).padEnd(7) + (x.delayMs === null ? "none" : `${x.delayMs} (${x.delaySpreadMs})`).padEnd(19) + x.droppedSeatFrames);
  }
  console.log(`${score.fps} fresh frames a second (median), longest gap between them ${score.frameGapMaxMs} ms, ${score.missed} beats missed`);
  return score;
}

function listBad(f) {
  const { taps, missed } = classifyTaps(f);
  const bad = taps.filter((t) => ["still", "move", "others", "extra"].includes(t.kind));
  console.log(`\nFalse or extra taps (${bad.length}):`);
  for (const t of bad) console.log(`  ${s(t.atMs)}  seat ${t.spotId}  ${t.kind === "others" ? "in another seat's turn" : t.kind === "extra" ? "matched no beat" : "false tap"}  [${t.phase}] ${phaseName(t.phase)}`);
  const between = taps.filter((t) => t.kind === "between").length;
  if (between) console.log(`  (${between} more taps fell in the 3 seconds before a phase: not scored)`);
  if (missed.length) console.log(`Missed beats (${missed.length}): ` + missed.slice(0, 12).map((m) => `seat ${m.spotId} ${m.phase} @${s(m.beatMs).trim()}`).join(", ") + (missed.length > 12 ? ", ..." : ""));
}

// The same frames through the current detector. `freshOnly` skips the frames that repeat the last picture.
function redetect({ freshOnly }) {
  const detector = createTapDetector();
  const taps = [];
  for (const fr of file.frames) {
    if (freshOnly && fr.fresh === false) continue;
    const feet = fr.seats.flatMap((seat) => seat.feet.map((x) => ({ spotId: seat.spotId, ...x })));
    for (const t of detector.update(fr.t, feet, file.lanes).taps) taps.push({ spotId: t.spotId, atMs: fr.t, x: null });
  }
  return { ...file, taps };
}

console.log(`${path}`);
console.log(`started ${file.startedAt}, ${file.phases.length} phases, ${file.phases.at(-1).toMs / 1000} s${file.video ? `, video ${file.video.file}` : ", no video"}`);
report("score as recorded", file);
listBad(file);
if (args.includes("--redetect")) {
  const freshOnly = args.includes("--fresh-only");
  const again = redetect({ freshOnly });
  report(`score with the current src/track/taps.js${freshOnly ? ", fresh frames only" : ""}`, again);
  listBad(again);
  console.log(`\nRecorded taps ${file.taps.length}, redetected ${again.taps.length}${!freshOnly && file.taps.length === again.taps.length && file.taps.every((t, i) => t.spotId === again.taps[i].spotId && Math.abs(t.atMs - again.taps[i].atMs) < 0.02) ? " (the same taps: the detector has not changed since the recording)" : ""}.`);
}
