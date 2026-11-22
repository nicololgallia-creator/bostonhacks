// The tap review page: opens a test (.json, with its .webm) or a plain seats recording and shows, side by side, what the camera saw
// and what the detector did, on one play head. Keys: Space plays and pauses, Left and Right step a frame, N jumps to the next
// false tap. The thinking is in logic.js; the two canvases are drawn by camera.js and strips.js.
import {
  buildModel, analyse, buildSeries, riseTop, scoreOf, nearestIndex, stepIndex, viewFor, makeAxis, tapAt, nextAfter, liftBefore, riseNear,
  videoToTest, testToVideo, phaseAt, LEAD_MS, MATCH_MS,
} from "./logic.js";
import { drawStrips } from "./strips.js";
import { drawOverlay } from "./camera.js";
import { seatColour } from "./look.js";

const $ = (id) => document.getElementById(id);
const el = { video: $("video"), pic: $("pic"), overlay: $("overlay"), strips: $("strips"), play: $("play"), next: $("next"), mirror: $("mirror"), message: $("message"), picker: $("picker") };
const h = (tag, cls, ...kids) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  e.append(...kids);
  return e;
};

let S = null; // the open test: { model, analysis, series, ts, top, jumpList }
let head = 0; // the play head, in test time (ms)
let playing = false;
let zoom = "all";
let mirror = false;
let dirty = true;
let lastNow = 0;
let drawn = null; // { L, ax } from the last draw of the strips
let drag = null;
let videoFile = null;
let videoUrl = null;
let refs = null; // the nodes the readout updates

const startMs = () => S?.model.video?.startMs ?? 0;
const hasVideo = () => !!el.video.getAttribute("src") && el.video.readyState > 0 && Number.isFinite(el.video.duration);
const fmt = (v, d = 3) => (Number.isFinite(v) ? v.toFixed(d) : "not seen");
const secs = (ms) => `${(ms / 1000).toFixed(2)} s`;

// ---- messages ----

function say(text, info = false) {
  el.message.textContent = text;
  el.message.classList.toggle("info", info);
  el.message.hidden = !text;
}

// ---- opening files ----

async function openFiles(files) {
  say("");
  const list = [...files];
  const vid = list.find((f) => f.type.startsWith("video/") || /\.(webm|mp4|mkv|mov)$/i.test(f.name));
  const json = list.find((f) => /\.json$/i.test(f.name) || f.type === "application/json");
  if (!json && !vid) return say("That is not a test. Pick the test's .json file and its camera video (.webm).");
  if (json) {
    let raw;
    try {
      raw = JSON.parse(await json.text());
    } catch (e) {
      return say(`${json.name} is not valid JSON, so it cannot be opened: ${e.message}`);
    }
    try {
      const model = buildModel(raw);
      // a video opened with the test goes with it; one opened earlier stays only if the test names it
      load(model, json.name, vid ?? (videoFile && (!S || model.video?.file === videoFile.name) ? videoFile : null));
    } catch (e) {
      return say(`${json.name} could not be opened. ${e.message}`);
    }
  } else if (S) {
    attachVideo(vid);
  } else {
    videoFile = vid;
    say(`Got the video ${vid.name}. Now open the test's .json file.`, true);
  }
}

function load(model, name, video) {
  const series = buildSeries(model);
  const analysis = analyse(model);
  const jumpList = [...(analysis.plain ? analysis.taps : analysis.problems.filter((p) => p.kind !== "missed"))].sort((a, b) => a.atMs - b.atMs);
  S = { model, analysis, series, ts: Float64Array.from(model.frames, (f) => f.t), top: riseTop(series), jumpList, name };
  head = model.frames[0].t;
  pause();
  zoom = "all";
  mirror = false;
  el.pic.classList.remove("mirror");
  el.mirror.hidden = !model.facing;
  el.mirror.setAttribute("aria-pressed", "false");
  syncZoomButtons();
  $("empty").hidden = true;
  $("app").hidden = false;
  $("loaded-controls").hidden = false;
  $("file-name").textContent = `${name}: ${model.kind === "tracktest" ? "a guided test" : "a plain recording"}, ${model.frames.length} frames over ${(model.durationMs / 1000).toFixed(1)} s`;
  el.next.textContent = analysis.plain ? "Next tap" : "Next false tap";
  $("n-what").textContent = analysis.plain ? "tap" : "false tap";
  document.querySelectorAll("[data-when]").forEach((li) => { li.hidden = li.dataset.when === (analysis.plain ? "phases" : "plain"); });
  el.next.disabled = !jumpList.length;
  el.strips.style.height = `${28 + 22 + model.spotIds.length * 68}px`;
  el.strips.setAttribute("aria-label", `${model.spotIds.length} seats, foot height against time. ${analysis.taps.length} taps, ${analysis.problems.length} problems.`);
  releaseVideo();
  if (video) attachVideo(video);
  else noVideoNote();
  $("phase-list").hidden = !model.phases.length;
  $("phases").replaceChildren(...model.phases.map((p) => h("li", "", `${p.label} `, h("span", "", `${(p.fromMs / 1000).toFixed(1)} to ${(p.toMs / 1000).toFixed(1)} s`))));
  buildReadout();
  buildScore();
  buildProblems();
  dirty = true;
}

function noVideoNote() {
  const v = S.model.video;
  $("video-note").textContent = v
    ? `This test has a camera video, ${v.file}. Drop it on this page to see the picture. Until then the dots show what the camera saw.`
    : "There is no video. The dots show what the camera saw.";
}

function releaseVideo() {
  if (videoUrl) URL.revokeObjectURL(videoUrl);
  videoUrl = null;
  el.video.removeAttribute("src");
  el.video.load();
  el.pic.style.aspectRatio = "";
  videoFile = null;
}

function attachVideo(file, url) {
  releaseVideo();
  videoFile = file ?? null;
  videoUrl = file ? URL.createObjectURL(file) : null;
  el.video.src = url ?? videoUrl;
  const want = S.model.video?.file;
  $("video-note").textContent = file && want && want !== file.name ? `This test says its video is ${want}, and you opened ${file.name}. Check they belong together.` : "";
}

el.video.addEventListener("loadedmetadata", () => {
  if (el.video.videoWidth) el.pic.style.aspectRatio = `${el.video.videoWidth} / ${el.video.videoHeight}`;
  if (el.video.duration === Infinity) {
    // A video saved straight from the browser's recorder has no length in its header. Asking for a time far past the end makes the
    // browser read the whole file and learn it; then it goes back to the start.
    el.video.addEventListener("seeked", () => { el.video.currentTime = 0; }, { once: true });
    el.video.currentTime = 1e101;
  }
});
el.video.addEventListener("loadeddata", () => { seekVideo(); dirty = true; });
el.video.addEventListener("seeked", () => { dirty = true; });
el.video.addEventListener("error", () => {
  const why = el.video.error?.message;
  $("video-note").textContent = `The browser could not play this video${why ? `: ${why}` : "."} The dots still show what the camera saw.`;
  el.video.removeAttribute("src");
});

// ---- the play head ----

function seekVideo() {
  if (!S || !hasVideo()) return;
  const target = Math.min(Math.max(testToVideo(head, startMs()), 0), el.video.duration);
  if (Math.abs(el.video.currentTime - target) > 0.001) el.video.currentTime = target;
}

function setHead(t) {
  head = Math.min(Math.max(t, 0), S.model.durationMs);
  seekVideo();
  dirty = true;
}

function play() {
  if (!S) return;
  if (head >= S.model.durationMs) setHead(0);
  playing = true;
  dirty = true;
}

function pause() {
  playing = false;
  if (el.video.getAttribute("src")) el.video.pause();
  dirty = true;
}

const toggle = () => (playing ? pause() : play());

function jumpToTap(atMs) {
  setHead(atMs - LEAD_MS);
  play();
  const row = document.querySelector(`.row[data-at="${atMs}"]`);
  document.querySelectorAll(".row[aria-current]").forEach((r) => r.removeAttribute("aria-current"));
  row?.setAttribute("aria-current", "true");
}

function nextProblem() {
  if (!S) return;
  const i = nextAfter(S.jumpList, head);
  if (i < 0) say("There are no false taps in this test.", true);
  else {
    say("");
    jumpToTap(S.jumpList[i].atMs);
  }
}

// One frame of the page: the clock moves the play head (the video's own time when the video covers it), then everything is drawn.
function frameLoop(now) {
  const dt = Math.min(now - lastNow, 100);
  lastNow = now;
  if (S && playing) {
    const v = el.video;
    const s = startMs();
    if (hasVideo() && head >= s && head < s + v.duration * 1000 && !v.ended) {
      if (v.paused) {
        seekVideo();
        v.play().catch((e) => { pause(); say(`The video would not play: ${e.message}`); });
      } else head = videoToTest(v.currentTime, s);
    } else {
      head += dt;
      if (hasVideo() && !v.paused) v.pause();
    }
    if (head >= S.model.durationMs) {
      head = S.model.durationMs;
      pause();
    }
    dirty = true;
  }
  if (dirty && S) {
    dirty = false;
    render();
  }
  requestAnimationFrame(frameLoop);
}

// ---- drawing ----

function render() {
  const { model, analysis, series, ts, top } = S;
  const i = nearestIndex(ts, head);
  const view = drag?.view ?? viewFor(zoom, head, model.durationMs);
  drawn = drawStrips(el.strips, { model, series, analysis, ts, top, head, view });
  drawOverlay(el.overlay, { model, analysis, frame: model.frames[i], head, mirror: mirror && model.facing });
  el.play.textContent = playing ? "Pause" : "Play";
  refs.time.textContent = `${secs(head)} of ${secs(model.durationMs)}`;
  $("now").dataset.ms = String(Math.round(head));
  const ph = phaseAt(model.phases, head);
  refs.phase.textContent = model.phases.length ? (ph ? ph.label : "No phase is running here") : "";
  const fr = model.frames[i];
  for (const id of model.spotIds) {
    const s = series[id];
    const r = refs.seats[id];
    const limit = Math.max(...s.tracks.map((tr) => tr.thr[i]).filter(Number.isFinite));
    r.text.textContent = `left ${fmt(s.tracks[0].rise[i])}, right ${fmt(s.tracks[1].rise[i])}, threshold ${fmt(limit)}`;
    r.air.textContent = fr.lifted[id] ? "In the air" : "";
  }
}

function buildReadout() {
  const box = $("now");
  const time = h("div", "t");
  const phase = h("div", "phase");
  box.replaceChildren(time, phase);
  refs = { time, phase, seats: {} };
  for (const id of S.model.spotIds) {
    const text = h("span");
    const air = h("span", "air");
    box.append(h("div", "seat", seatChip(id), text, air));
    refs.seats[id] = { text, air };
  }
}

const seatChip = (id) => {
  const sw = h("i");
  sw.style.background = seatColour(id);
  return h("span", "chip", sw, `Seat ${id}`);
};

// ---- score and problems ----

const COLS = [
  ["falseStill", "False taps while still"], ["falseMove", "False taps while moving"], ["falseOthersTurn", "False taps on another seat's turn"],
  ["expected", "Beats"], ["caught", "Beats caught"], ["extra", "Extra taps"], ["delayMs", "Delay (ms)"], ["delaySpreadMs", "Delay spread (ms)"],
];
const BAD = (key, v, row) => (["falseStill", "falseMove", "falseOthersTurn", "extra"].includes(key) && v > 0) || (key === "caught" && v < row.expected);

function buildScore() {
  const { model, analysis } = S;
  const sc = scoreOf(model, analysis);
  const lost = model.spotIds.some((id) => Number.isFinite(sc.seats[id]?.droppedSeatFrames));
  const cols = analysis.plain && sc.source === "computed" ? [["taps", "Taps found"]] : lost ? [...COLS, ["droppedSeatFrames", "Frames the seat was lost"]] : COLS;
  const table = h("table");
  table.setAttribute("aria-label", "Score for each seat");
  table.append(h("thead", "", h("tr", "", h("th", "", "Seat"), ...cols.map(([, label]) => h("th", "", label)))));
  const body = h("tbody");
  for (const id of model.spotIds) {
    const row = sc.seats[id];
    const cells = cols.map(([key]) => {
      const v = row?.[key];
      return h("td", row && BAD(key, v, row) ? "bad" : "", Number.isFinite(v) ? String(key.startsWith("delay") ? Math.round(v) : v) : "–");
    });
    body.append(h("tr", "", h("td", "", seatChip(id)), ...cells));
  }
  table.append(body);
  const source = sc.source === "file" ? "The numbers are the test's own." : analysis.plain
    ? "This is a plain recording: it has no phases, so no tap can be called false. The detector ran here with its current settings."
    : "The file has no score, so these numbers were worked out here from its taps and beats.";
  const speed = sc.fps ? ` Tracking ran at ${sc.fps.toFixed(1)} frames a second.` : ` The frames in the file come ${model.fps.toFixed(1)} a second.`;
  $("score").replaceChildren(table, h("p", "sum", source + speed));
}

const KIND = { false: "False tap", extra: "Extra tap", missed: "Missed beat" };

function detail(p) {
  const { series, ts } = S;
  if (p.kind === "missed") {
    const r = riseNear(series, ts, p.spotId, p.atMs);
    if (!r) return `No tap within ${MATCH_MS} ms, and no foot was seen there.`;
    const air = r.frames ? ` The seat was in the air for ${r.frames} frame${r.frames === 1 ? "" : "s"}.` : "";
    const past = r.over > 0 ? " It rose past the threshold, but no landing was counted." : "";
    return `No tap within ${MATCH_MS} ms. The foot rose at most ${fmt(r.peak)} over its ground, and its threshold was ${fmt(r.thr)}.${past}${air}`;
  }
  const l = liftBefore(series, ts, p.spotId, p.atMs);
  if (!l) return "No foot was seen around this tap.";
  return `The foot rose ${fmt(l.over)} over its threshold (${fmt(l.peak)} against ${fmt(l.thr)}), in the air for ${l.frames} frame${l.frames === 1 ? "" : "s"}, ${Math.round(l.ms)} ms.`;
}

function buildProblems() {
  const { analysis, model } = S;
  const box = $("problems");
  if (analysis.plain) {
    box.replaceChildren(h("p", "sum", `No phases in this file, so no tap is called a problem. The detector found ${analysis.taps.length} taps. Press N to go through them, or click a tap mark.`));
    return;
  }
  const count = (k) => analysis.problems.filter((p) => p.kind === k).length;
  const sum = h("p", "sum", analysis.problems.length
    ? `${count("false")} false taps, ${count("extra")} extra taps, ${count("missed")} missed beats. Click a row to see it. Pressing N goes to the next false or extra tap.`
    : "No problems: every tap was on a beat, none came in a phase that expects none, and no beat was missed.");
  const list = h("ul", "rows");
  for (const p of analysis.problems) {
    const b = h("button", `row${p.kind === "missed" ? "" : " bad"}`, h("span", "time", secs(p.atMs)), seatChip(p.spotId), h("span", "kind", KIND[p.kind]),
      h("span", "phase", p.phase ? p.phase.label : "Between phases"), h("span", "what", detail(p)));
    b.type = "button";
    b.dataset.at = String(p.atMs);
    b.addEventListener("click", () => jumpToTap(p.atMs));
    list.append(h("li", "", b));
  }
  box.replaceChildren(sum, list);
}

// ---- the strips: scrub and click ----

const stripPoint = (e) => {
  const r = el.strips.getBoundingClientRect();
  return { x: e.clientX - r.left, y: e.clientY - r.top };
};

function tapUnder(x, y, view) {
  if (!drawn || x < drawn.L.plotLeft || x > drawn.L.plotRight) return -1;
  const row = drawn.L.rows.findIndex((r) => y >= r.top && y < r.bottom);
  if (row < 0) return -1;
  const ax = makeAxis(view[0], view[1], drawn.L.plotLeft, drawn.L.plotRight);
  return tapAt(S.analysis.taps, ax.toT(x), S.model.spotIds[row], ((view[1] - view[0]) / (drawn.L.plotRight - drawn.L.plotLeft)) * 7);
}

const currentView = () => viewFor(zoom, head, S.model.durationMs);

el.strips.addEventListener("pointerdown", (e) => {
  if (!S || e.button !== 0) return;
  el.strips.setPointerCapture(e.pointerId);
  const { x, y } = stripPoint(e);
  const view = currentView();
  drag = { view, wasPlaying: playing, startX: e.clientX, tap: tapUnder(x, y, view), scrubbing: false };
  if (drag.tap < 0) scrubStart(x);
});

function scrubStart(x) {
  drag.scrubbing = true;
  pause();
  scrubTo(x);
}

function scrubTo(x) {
  const ax = makeAxis(drag.view[0], drag.view[1], drawn.L.plotLeft, drawn.L.plotRight);
  setHead(ax.toT(x));
}

el.strips.addEventListener("pointermove", (e) => {
  if (!S) return;
  const { x, y } = stripPoint(e);
  if (!drag) {
    el.strips.style.cursor = tapUnder(x, y, currentView()) >= 0 ? "pointer" : "ew-resize";
    return;
  }
  if (!drag.scrubbing && Math.abs(e.clientX - drag.startX) > 4) scrubStart(x);
  else if (drag.scrubbing) scrubTo(x);
});

el.strips.addEventListener("pointerup", () => {
  if (!drag) return;
  const d = drag;
  drag = null;
  if (d.tap >= 0 && !d.scrubbing) jumpToTap(S.analysis.taps[d.tap].atMs);
  else if (d.wasPlaying) play();
  dirty = true;
});
el.strips.addEventListener("pointercancel", () => { drag = null; dirty = true; });

// ---- controls and keys ----

function syncZoomButtons() {
  document.querySelectorAll("[data-zoom]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.zoom === String(zoom))));
}

document.querySelectorAll("[data-zoom]").forEach((b) => b.addEventListener("click", () => {
  zoom = b.dataset.zoom === "all" ? "all" : Number(b.dataset.zoom);
  syncZoomButtons();
  dirty = true;
}));
el.play.addEventListener("click", toggle);
el.next.addEventListener("click", nextProblem);
el.mirror.addEventListener("click", () => {
  mirror = !mirror;
  el.mirror.setAttribute("aria-pressed", String(mirror));
  el.pic.classList.toggle("mirror", mirror);
  dirty = true;
});
$("open").addEventListener("click", () => el.picker.click());
$("open-big").addEventListener("click", () => el.picker.click());
el.picker.addEventListener("change", () => { openFiles(el.picker.files); el.picker.value = ""; });

// Space plays and pauses wherever focus is, so it still works after a button was clicked; Enter presses a focused button.
document.addEventListener("keydown", (e) => {
  if (!S || e.ctrlKey || e.metaKey || e.altKey) return;
  if (e.key === " ") {
    e.preventDefault();
    if (!e.repeat) toggle();
  } else if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
    e.preventDefault();
    pause();
    setHead(S.ts[stepIndex(S.ts, head, e.key === "ArrowRight" ? 1 : -1)]);
  } else if (e.key === "n" || e.key === "N") {
    e.preventDefault();
    nextProblem();
  }
});
document.addEventListener("keyup", (e) => { if (S && e.key === " ") e.preventDefault(); }); // a button would press itself on key up

// ---- drag and drop, and a file named in the address ----

let dragDepth = 0;
const dropBox = $("drop");
window.addEventListener("dragenter", (e) => { e.preventDefault(); dragDepth++; dropBox.hidden = false; });
window.addEventListener("dragleave", () => { dragDepth = Math.max(0, dragDepth - 1); dropBox.hidden = dragDepth === 0; });
window.addEventListener("dragover", (e) => e.preventDefault());
window.addEventListener("drop", (e) => {
  e.preventDefault();
  dragDepth = 0;
  dropBox.hidden = true;
  openFiles(e.dataTransfer.files);
});
new ResizeObserver(() => { dirty = true; }).observe(document.body);
document.fonts?.ready.then(() => { dirty = true; });

async function openFromAddress() {
  const params = new URLSearchParams(location.search);
  const file = params.get("file");
  if (!file) return;
  let res;
  try {
    res = await fetch(file);
  } catch (e) {
    return say(`Could not reach ${file}: ${e.message}`);
  }
  if (!res.ok) return say(`The server has no file at ${file} (it answered ${res.status}).`);
  const text = await res.text();
  let raw;
  try {
    raw = JSON.parse(text);
  } catch (e) {
    return say(text.trimStart().startsWith("<") ? `The server has no file at ${file}: it answered with a web page.` : `${file} is not valid JSON: ${e.message}`);
  }
  try {
    load(buildModel(raw), file.split("/").pop(), null);
  } catch (e) {
    return say(`${file} could not be opened. ${e.message}`);
  }
  const video = params.get("video");
  if (video) attachVideo(null, video);
}

requestAnimationFrame(frameLoop);
openFromAddress();
