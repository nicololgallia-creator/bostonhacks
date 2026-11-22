// The tracking test's pure logic: the plan (what is asked, when, and which beats are expected), one recorded frame, and the
// score. No browser calls, so the same file scores a recording in the browser and in qa/seats/analyze-test.mjs.
// The file format (version 1, kind "tracktest") is written by tracktest.js; the review page reads it.

export const LEAD_MS = 3000; // each phase is announced this long before it starts
export const TOLERANCE_MS = 300; // a tap this close to a beat is that beat's tap

const STEPS = [
  { id: "still", label: "Sit still. Feet flat.", ms: 10000 },
  { id: "move", label: "Move around, but do not tap. Cross your legs, lean, shuffle.", ms: 10000 },
  { id: "beat", label: "Everyone: tap with the beat. Either foot.", ms: 15000, bpm: 100 },
  { id: "fast", label: "Faster. Switch feet each beat.", ms: 10000, bpm: 150 },
];
const SOLO = (id) => ({ id: `solo-${id}`, label: `Only Player ${id} taps. Everyone else: still.`, ms: 8000, bpm: 100, only: id });

// The whole run as a list of phases, in order: { id, label, announceFromMs, fromMs, toMs, bpm?, expect }.
// `expect` is { [spotId]: "none" | { beats: [ms, ...] } }. With one seat there is nobody else to catch, so no solo phases.
// `speed` squeezes the clock (and speeds the beats up by the same factor) so a scripted run takes seconds.
export function planTest(spotIds, speed = 1) {
  const steps = [...STEPS, ...(spotIds.length > 1 ? spotIds.map(SOLO) : [])];
  let at = 0;
  const phases = steps.map((s) => {
    const announceFromMs = at;
    const fromMs = at + LEAD_MS / speed;
    const toMs = fromMs + s.ms / speed;
    at = toMs;
    const interval = s.bpm ? 60000 / (s.bpm * speed) : 0;
    const beats = s.bpm ? Array.from({ length: Math.floor((toMs - fromMs) / interval + 1e-9) }, (_, k) => Math.round((fromMs + k * interval) * 100) / 100) : [];
    const expect = Object.fromEntries(spotIds.map((id) => [id, !s.bpm || (s.only !== undefined && s.only !== id) ? "none" : { beats }]));
    return { id: s.id, label: s.label, announceFromMs, fromMs, toMs, ...(s.bpm ? { bpm: s.bpm } : {}), expect };
  });
  return { phases, endMs: at };
}

const round = (x, places) => Math.round(x * 10 ** places) / 10 ** places;

// One frame of the file from the seat source's lastFrame() (see seatsource.js). `t0` is when the test began on the
// same clock. `fresh` is true when the camera gave the tracker a new picture since the frame before: the detector is fed
// on every screen frame, so a frame that is not fresh shows the detector the same feet again.
export function frameRecord(r, t0, fresh) {
  return {
    t: round(r.t - t0, 2),
    fresh,
    seats: r.poses.map((p) => ({
      spotId: p.spotId,
      hipX: p.hipX === null || p.hipX === undefined ? null : round(p.hipX, 4),
      dropped: !!p.dropped,
      n: p.n ?? 0,
      feet: r.read.filter((f) => f.spotId === p.spotId).map((f) => ({ foot: f.foot, x: round(f.x, 5), y: round(f.y, 5), shin: round(f.shin, 5) })),
    })),
    debug: r.debug.map((d) => ({ spotId: d.spotId, foot: d.foot, ground: round(d.ground, 5), threshold: round(d.threshold, 5), shake: round(d.shake, 5) })),
    lifted: r.lifted,
  };
}

// The middle of a list, and any share of the way through it (0.25 and 0.75 give the middle half's edges).
const quantile = (sorted, p) => {
  const i = (sorted.length - 1) * p;
  const lo = Math.floor(i);
  return sorted[lo] + (sorted[Math.ceil(i)] - sorted[lo]) * (i - lo);
};

// Sorts every tap into what it was: "still", "move" or "others" (a false tap, in the phase named), "caught" (matched a beat,
// `beatMs` says which), "extra" (in a beat phase, matched no beat), or "between" (in the 3 seconds before a phase: not scored).
// Each tap and each beat is used once: the closest pairs within TOLERANCE_MS are matched first. `missed` lists beats nobody caught.
export function classifyTaps(file) {
  const seatIds = file.slices.map((s) => s.spotId);
  const out = [];
  const missed = [];
  const phaseAt = (t) => file.phases.find((p) => t >= p.fromMs && t < p.toMs);
  for (const tap of file.taps) {
    const p = phaseAt(tap.atMs);
    const mine = { spotId: tap.spotId, atMs: tap.atMs, phase: p?.id ?? null };
    if (!p) out.push({ ...mine, kind: "between" });
    else if (p.expect[tap.spotId] === "none" || p.expect[tap.spotId] === undefined) {
      out.push({ ...mine, kind: p.id === "still" ? "still" : p.id === "move" ? "move" : "others" });
    } else out.push({ ...mine, kind: "extra" }); // a beat phase: changed to "caught" below when a beat takes it
  }
  for (const p of file.phases) {
    for (const spotId of seatIds) {
      const e = p.expect[spotId];
      if (!e || e === "none") continue;
      const pool = out.filter((o) => o.spotId === spotId && o.atMs >= p.fromMs - TOLERANCE_MS && o.atMs < p.toMs + TOLERANCE_MS && (o.kind === "extra" || o.kind === "between"));
      const pairs = e.beats.flatMap((beatMs, b) => pool.map((o) => ({ b, beatMs, o, d: Math.abs(o.atMs - beatMs) }))).filter((x) => x.d <= TOLERANCE_MS).sort((a, c) => a.d - c.d);
      const usedBeat = new Set();
      const usedTap = new Set();
      for (const { b, beatMs, o } of pairs) {
        if (usedBeat.has(b) || usedTap.has(o)) continue;
        usedBeat.add(b);
        usedTap.add(o);
        Object.assign(o, { kind: "caught", beatMs, phase: p.id });
      }
      e.beats.forEach((beatMs, b) => { if (!usedBeat.has(b)) missed.push({ spotId, phase: p.id, beatMs }); });
    }
  }
  return { taps: out.sort((a, b) => a.atMs - b.atMs), missed };
}

// The score for each seat, and for the run. See the card in the brief for what each number means.
export function scoreTest(file) {
  const { taps, missed } = classifyTaps(file);
  const seats = {};
  for (const { spotId } of file.slices) {
    const mine = taps.filter((t) => t.spotId === spotId);
    const count = (kind) => mine.filter((t) => t.kind === kind).length;
    const caught = mine.filter((t) => t.kind === "caught");
    const lags = caught.map((t) => t.atMs - t.beatMs).sort((a, b) => a - b);
    const expected = file.phases.reduce((n, p) => n + (p.expect[spotId]?.beats?.length ?? 0), 0);
    seats[spotId] = {
      falseStill: count("still"),
      falseMove: count("move"),
      falseOthersTurn: count("others"),
      expected,
      caught: caught.length,
      // In a beat phase only: a tap between beats. A "between" tap (in the 3 s before a phase) is not counted.
      extra: count("extra"),
      delayMs: lags.length ? Math.round(quantile(lags, 0.5)) : null,
      delaySpreadMs: lags.length ? Math.round(quantile(lags, 0.75) - quantile(lags, 0.25)) : null,
      droppedSeatFrames: 0,
    };
  }
  // Frames. A frame that is not fresh is the same picture shown to the detector again: it does not count for the rate.
  const fresh = file.frames.filter((f) => f.fresh !== false);
  for (const f of fresh) {
    for (const spotId of Object.keys(seats)) {
      const s = f.seats.find((x) => String(x.spotId) === spotId);
      if (!s || !s.feet.length) seats[spotId].droppedSeatFrames++;
    }
  }
  const perSecond = new Map();
  for (const f of fresh) perSecond.set(Math.floor(f.t / 1000), (perSecond.get(Math.floor(f.t / 1000)) ?? 0) + 1);
  const keys = [...perSecond.keys()].sort((a, b) => a - b);
  // The first and last seconds are partial; leave them out when there are enough others.
  const whole = keys.length >= 3 ? keys.slice(1, -1) : keys;
  const rates = whole.map((k) => perSecond.get(k)).sort((a, b) => a - b);
  const gaps = fresh.slice(1).map((f, i) => f.t - fresh[i].t);
  return {
    seats,
    fps: rates.length ? Math.round(quantile(rates, 0.5) * 10) / 10 : 0,
    frameGapMaxMs: gaps.length ? Math.round(Math.max(...gaps)) : 0,
    missed: missed.length,
  };
}

export const falseTaps = (s) => s.falseStill + s.falseMove + s.falseOthersTurn;
