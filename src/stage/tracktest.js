// The guided tracking test, on the floor. It asks seated players to sit still, move, then tap with a metronome, one seat at a
// time at the end, and records what the tracker and the tap detector did the whole while, plus the camera video. At the end it
// shows a score card and downloads tracktest-<stamp>.json (the file contract is in tracktest-score.js) and the .webm.
// Started by key G or ?test=1 in stage/main.js, only with ?feet=seats. One clock for all of it: milliseconds since the
// test began, from performance.now(), the same clock the tap detector stamps its taps with.
import "./tracktest.css";
import { applyKeystone } from "./keystone.js";
import { isFacing } from "../facing.js";
import { themeFor, seatOf, loadFonts } from "../game/floor-look.js";
import { PAD_V } from "../track/seatsource.js";
import { planTest, frameRecord, scoreTest, falseTaps } from "./tracktest-score.js";

const el = (tag, cls, text) => {
  const e = document.createElement(tag);
  e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
};
const round = (x, places) => Math.round(x * 10 ** places) / 10 ** places;
const pad2 = (n) => String(n).padStart(2, "0");
const stampOf = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}-${pad2(d.getHours())}-${pad2(d.getMinutes())}-${pad2(d.getSeconds())}`;
const BITRATE = 1_500_000; // about 1.5 Mbit/s of camera video
const SCHEDULE_AHEAD_MS = 120; // how far ahead a click is handed to the audio clock

// Revoked late: some browsers start the download after the click returns (the same pattern as seats-debug.js).
function download(name, blob) {
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 10000);
}

// One line, for the operator: the test needs seated play.
export function sayNeedsSeats() {
  const note = el("p", "tt-note", "The tracking test needs seated play. Add ?feet=seats to the address and reload.");
  document.body.append(note);
  setTimeout(() => note.remove(), 6000);
}

// Records the camera's own stream. Returns null when there is none to record (a still, a file, a recording, no MediaRecorder).
function startRecorder(feet, sinceStart) {
  const stream = feet.kind === "camera" ? feet.video?.srcObject : null;
  if (!stream || !globalThis.MediaRecorder) return null;
  const mimeType = ["video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm"].find((m) => MediaRecorder.isTypeSupported(m));
  try {
    const chunks = [];
    const recorder = new MediaRecorder(stream, { ...(mimeType ? { mimeType } : {}), videoBitsPerSecond: BITRATE });
    const out = { startMs: null, chunks, recorder };
    recorder.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
    recorder.onstart = () => { out.startMs = sinceStart(); };
    recorder.start(1000);
    return out;
  } catch (err) {
    console.warn("The camera video could not be recorded:", err.message);
    return null;
  }
}

// The recorded video as one Blob, or null when nothing was recorded.
const finishRecorder = (rec) => new Promise((resolve) => {
  if (!rec || rec.recorder.state === "inactive") return resolve(rec?.chunks.length ? new Blob(rec.chunks, { type: "video/webm" }) : null);
  const done = () => resolve(rec.chunks.length ? new Blob(rec.chunks, { type: "video/webm" }) : null);
  rec.recorder.onstop = done;
  setTimeout(done, 3000); // a recorder that never says it has stopped does not hold the files back
  rec.recorder.stop();
});

// The test. `feet` is the seat source (it needs lastFrame, slices, video, kind and model), `layout` the pads on the floor,
// `lineId` the line whose colour is the field. `speed` squeezes the whole run for a scripted check (?testspeed=4).
export function openTrackTest({ feet, layout, lineId, speed = 1, onClose = () => {} }) {
  const spotIds = layout.spots.map((s) => s.id);
  const { phases, endMs } = planTest(spotIds, speed);
  const theme = themeFor(lineId);
  // The same lanes as real play: one for each player when there are two or more, two for a lone player.
  const lanes = Object.fromEntries(spotIds.map((id) => [id, spotIds.length > 1 ? 1 : 2]));
  const clicks = phases.flatMap((p) => (Object.values(p.expect).find((e) => e !== "none")?.beats ?? []).map((ms, i) => ({ ms, accent: i === 0 })));
  if (!document.fonts.check('1em "Lilita One"')) loadFonts();

  // ---- the page ----
  const root = el("div", "tt");
  root.style.setProperty("--tt-field", theme.field);
  const kicker = el("p", "tt-kicker");
  const line = el("p", "tt-line");
  const count = el("p", "tt-count");
  const beat = el("div", "tt-beat");
  const bar = el("div", "tt-bar");
  const fill = el("i", "");
  bar.append(fill);
  const seatDots = new Map(spotIds.map((id) => {
    const spot = layout.spots.find((s) => s.id === id);
    const dot = el("div", "tt-seat", String(id));
    const colour = seatOf(theme, id);
    dot.style.setProperty("--seat", colour.fill);
    dot.style.setProperty("--seat-ink", colour.text);
    dot.style.left = `${(spot.rect.u + spot.rect.w / 2) * 100}%`;
    dot.style.top = `${(spot.rect.v + spot.rect.h * PAD_V) * 100}%`;
    return [id, dot];
  }));
  root.append(kicker, line, count, beat, bar, ...seatDots.values());
  document.body.append(root);
  applyKeystone(root); // the same warp and half turn as the game, so the words read from the players' side

  // ---- the clock, the record, the sound ----
  const startedAt = new Date();
  const t0 = performance.now();
  const sinceStart = () => performance.now() - t0;
  const slices = feet.slices();
  const frames = [];
  const taps = [];
  let lastT = -Infinity;
  let lastN = null;
  let shown = null; // "<phase index>:<announce or run>", so the words are set once for each
  let running = true;
  let next = 0; // the next click to hand to the audio clock
  const recorder = startRecorder(feet, sinceStart);
  const AudioCtx = globalThis.AudioContext ?? globalThis.webkitAudioContext;
  const audio = AudioCtx ? new AudioCtx() : null;
  const resume = () => audio?.resume?.();
  resume();
  addEventListener("keydown", resume);
  addEventListener("pointerdown", resume);

  // A short loud tick, started on the audio clock a moment ahead so it does not wander with the screen's frames.
  function tick(when, accent) {
    const osc = audio.createOscillator();
    const gain = audio.createGain();
    osc.type = "triangle";
    osc.frequency.value = accent ? 1760 : 1320;
    gain.gain.setValueAtTime(0.9, when);
    gain.gain.exponentialRampToValueAtTime(0.001, when + 0.06);
    osc.connect(gain).connect(audio.destination);
    osc.start(when);
    osc.stop(when + 0.07);
  }
  const clicker = setInterval(() => {
    if (!audio || audio.state !== "running") return;
    const now = sinceStart();
    while (next < clicks.length && clicks[next].ms - now < SCHEDULE_AHEAD_MS) {
      const { ms, accent } = clicks[next++];
      if (ms - now > -50) tick(audio.currentTime + Math.max(0, (ms - now) / 1000), accent);
    }
  }, 25);

  // ---- what is on the floor right now ----
  function show(now) {
    const i = Math.max(0, phases.findIndex((p) => now < p.toMs));
    const p = phases[i];
    const ready = now < p.fromMs;
    const key = `${i}:${ready}`;
    if (key !== shown) {
      shown = key;
      kicker.textContent = ready ? `Step ${i + 1} of ${phases.length}: get ready` : `Step ${i + 1} of ${phases.length}`;
      line.textContent = p.label;
    }
    const from = ready ? p.announceFromMs : p.fromMs;
    const to = ready ? p.fromMs : p.toMs;
    fill.style.transform = `scaleX(${Math.max(0, Math.min(1, (to - now) / (to - from)))})`; // the bar runs down to the next change
    count.textContent = ready ? String(Math.max(1, Math.ceil(((p.fromMs - now) / (p.fromMs - p.announceFromMs)) * 3))) : "";
    const interval = p.bpm ? 60000 / (p.bpm * speed) : 0;
    const pulse = !ready && interval ? Math.exp(-((now - p.fromMs) % interval) / Math.min(110, interval * 0.3)) : 0; // 1 on the beat, gone in a moment
    beat.style.opacity = interval && !ready ? String(0.2 + 0.8 * pulse) : "0";
    beat.style.transform = `scale(${0.45 + 0.55 * pulse})`;
    for (const [id, dot] of seatDots) {
      const active = p.expect[id] !== "none";
      dot.style.opacity = interval && !active ? "0.35" : "1";
      dot.style.transform = active && pulse ? `scale(${1 + 0.3 * pulse})` : "none";
    }
  }

  // ---- the end ----
  function card(score) {
    const rows = Object.keys(score.seats).map(Number).map((id) => {
      const s = score.seats[id];
      const row = el("div", "tt-row");
      const dot = seatDots.get(id).cloneNode(true);
      dot.removeAttribute("style");
      const colour = seatOf(theme, id);
      dot.style.setProperty("--seat", colour.fill);
      dot.style.setProperty("--seat-ink", colour.text);
      const stats = el("div", "tt-stats");
      stats.append(
        el("span", "", `False taps: ${falseTaps(s)}`),
        el("span", "", `Caught: ${s.caught} of ${s.expected}`),
        el("span", "", s.delayMs === null ? "Delay: none" : `Delay: ${s.delayMs} ms`),
      );
      row.append(dot, stats);
      return row;
    });
    const wrap = el("div", "tt-card");
    const list = el("div", "tt-rows");
    list.style.setProperty("--cols", String(Math.min(2, spotIds.length)));
    list.append(...rows);
    wrap.append(el("h1", "", "Done."), list, el("p", "tt-total", `${score.fps} frames a second`), el("p", "tt-hint", "Saved to Downloads. Press G or Esc to close."));
    root.replaceChildren(wrap);
  }

  async function finish() {
    running = false;
    clearInterval(clicker);
    const blob = await finishRecorder(recorder);
    const stamp = `tracktest-${stampOf(startedAt)}`;
    const file = {
      version: 1, kind: "tracktest", startedAt: startedAt.toISOString(), facing: isFacing(), speed, lanes, slices,
      model: feet.model ?? "lite",
      video: blob && recorder.startMs !== null ? { file: `${stamp}.webm`, startMs: round(recorder.startMs, 1) } : null,
      phases, frames, taps, score: null,
    };
    file.score = scoreTest(file);
    card(file.score);
    download(`${stamp}.json`, new Blob([JSON.stringify(file)], { type: "application/json" }));
    if (blob) setTimeout(() => download(`${stamp}.webm`, blob), 600); // a second download in the same breath can be blocked
    handle.file = file; // for a scripted check
  }

  // A failure after the run must not leave the floor stuck on the last phase with nothing saved.
  function fail(err) {
    console.error("The tracking test could not finish:", err);
    root.replaceChildren(el("p", "tt-line", `The test could not be saved: ${err.message}`));
  }

  function close() {
    running = false;
    clearInterval(clicker);
    removeEventListener("keydown", resume);
    removeEventListener("pointerdown", resume);
    if (recorder && recorder.recorder.state !== "inactive") { recorder.recorder.ondataavailable = null; recorder.recorder.stop(); } // cut short: the video is thrown away
    audio?.close?.();
    root.remove();
    onClose();
  }

  const handle = {
    // Called by main.js once for each screen frame, right after the seat source's bySpot().
    frame() {
      if (!running) return;
      const r = feet.lastFrame();
      if (r && r.t > lastT && r.t >= t0) {
        lastT = r.t;
        const n = r.poses.reduce((sum, p) => sum + (p.n ?? 0), 0); // each seat counts the pictures it has looked at
        frames.push(frameRecord(r, t0, n !== lastN));
        lastN = n;
        for (const t of r.taps) taps.push({ spotId: t.spotId, atMs: round(t.atMs - t0, 2), x: t.x === null || t.x === undefined ? null : round(t.x, 4) });
      }
      const now = sinceStart();
      if (now >= endMs) return void finish().catch(fail); // finish() stops this at once, so it runs once
      show(now);
    },
    // The lanes the seat source should use while the test runs.
    lanes: () => lanes,
    close,
    file: null,
  };
  return handle;
}
