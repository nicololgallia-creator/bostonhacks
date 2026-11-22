// Makes public/qa-fixtures/tracktest-made.json: a tracktest file (version 1) built from the real two-person recording, so
// review.html can be tried before a real guided test exists. The frames and the taps are real: the current detector ran over
// qa/seats/real-two-1.json. The phases and the beats are INVENTED to fit it: rest from 5 to 22 s, both players tapping 22 to 39.6 s,
// then seat 2 leaves. Each beat sits within 100 ms of a real tap, except that every 9th tap has no beat (an extra tap) and the two
// biggest gaps in each seat's taps get a beat nobody tapped (a missed beat). There is no score, so the page works it out.
//   node qa/seats/make-tracktest.mjs
import { readFileSync, writeFileSync } from "node:fs";
import { buildModel } from "../../src/review/logic.js";

const raw = JSON.parse(readFileSync("qa/seats/real-two-1.json", "utf8"));
const m = buildModel(raw);
const round = (x, d = 4) => (typeof x === "number" ? +x.toFixed(d) : x);

const BEAT = [22000, 39600];
const expect = {};
for (const id of m.spotIds) {
  const mine = m.taps.filter((t) => t.spotId === id && t.atMs >= BEAT[0] && t.atMs < BEAT[1]).map((t) => t.atMs);
  const beats = mine.map((t, k) => t + ((k * 37) % 21 - 10) * 10).filter((_, k) => k % 9 !== 4);
  const gaps = mine.slice(1).map((t, k) => ({ at: (t + mine[k]) / 2, gap: t - mine[k] })).sort((a, b) => b.gap - a.gap).slice(0, 2);
  expect[id] = { beats: [...beats, ...gaps.map((g) => Math.round(g.at))].sort((a, b) => a - b) };
}

const none = Object.fromEntries(m.spotIds.map((id) => [id, "none"]));
const out = {
  version: 1,
  kind: "tracktest",
  note: "Made by qa/seats/make-tracktest.mjs from qa/seats/real-two-1.json. Frames and taps are real. Phases, beats and facing are invented.",
  startedAt: "2026-11-21T22:00:00.000Z",
  facing: true,
  lanes: m.lanes,
  slices: m.slices.map((s) => ({ spotId: s.spotId, x0: round(s.x0), x1: round(s.x1) })),
  model: raw.model,
  video: null,
  phases: [
    { id: "still", label: "Sit still and do not tap", fromMs: 5000, toMs: 22000, expect: none },
    { id: "beat", label: "Both players tap on the beat", fromMs: 22000, toMs: 39600, expect },
    { id: "move", label: "Seat 2 gets up, seat 1 sits", fromMs: 39600, toMs: 42200, expect: none },
  ],
  frames: m.frames.map((f) => ({
    t: f.t,
    seats: f.seats.map((s) => ({ spotId: s.spotId, hipX: s.hipX, feet: s.feet.map((x) => ({ foot: x.foot, x: round(x.x), y: round(x.y), shin: round(x.shin) })) })),
    debug: f.debug.map((d) => ({ spotId: d.spotId, foot: d.foot, ground: round(d.ground), threshold: round(d.threshold), shake: round(d.shake) })),
    lifted: f.lifted,
  })),
  taps: m.taps.map((t) => ({ spotId: t.spotId, atMs: t.atMs, x: round(t.x), y: round(t.y) })),
};
writeFileSync("public/qa-fixtures/tracktest-made.json", JSON.stringify(out));
console.log(`${out.frames.length} frames, ${out.taps.length} taps, beats ${m.spotIds.map((id) => expect[id].beats.length).join(" and ")}`);
