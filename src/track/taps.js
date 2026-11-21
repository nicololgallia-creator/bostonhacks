// Tap in place, as pure logic: tells when a foot is in the air and when it has landed (a tap).
// Input is the feet from seats.js: [{ spotId, foot, x, y, shin }], y down the picture, in picture units (0 to 1).
// minLift is tuned on two real recordings of the DJI: qa/feet/real-taps-1.json (one seated person, jitter 0.005, lifts 0.04
// to 0.07) and qa/seats/real-two-1.json (two seated people further back: shake 0.001 to 0.002 at rest, lifts 0.015 to 0.04).
// Every other number is a starting guess. A second person sits further back, so the picture units shrink and the model's
// shake can grow: the threshold follows the shake each track measures on itself (shakeMultiple).
export const TAP_DEFAULTS = {
  liftRatio: 0.06, // a foot is lifted when higher than its ground by this share of the shin ... (tuned on the two-person recording, shin about 0.24 to 0.28: 0.055 gave a tap at rest, 0.07 lost real taps)
  minLift: 0.012, // ... and by at least this much of the picture's height; with no shin this is the floor (tuned on the two-person recording: real lifts reach 0.015 to 0.04, rest shake is 0.002)
  shakeMultiple: 4, // ... and by this many times the shake the foot shows while down (0 turns it off). 5 was the first guess; on the real recording 5 lost a tap or two, 4 did not
  shakeMs: 3000, // the shake is the median frame to frame change over this long: shorter windows jump about, and a person does not change distance in seconds (a guess)
  restShare: 0.6, // a frame counts toward the shake only while the foot is lower than this share of the threshold (tuned on the real recording: 0.75 and up let a busy tapper raise the threshold, 0.5 under-reads a big shake)
  restFloor: 0.02, // ... of at least this: with the low minLift a shake of 0.008 would otherwise never count as resting, and the threshold would never rise to meet it (a guess)
  shakeMinSamples: 10, // fewer quiet frames than this and the shake is not trusted: the floor decides (a guess)
  returnFraction: 0.4, // it has landed once within this share of that threshold of the ground (from the recording)
  minLiftMs: 50, // a lift shorter than this is not a tap, unless it rose past twice the threshold (a guess)
  cooldownMs: 150, // after a tap the same foot (or, for a seat with one lane, the same seat) cannot tap again for this long: the recording has a landing bounce 146 ms after a tap
  groundEaseMs: 600, // how slowly the ground follows a foot that moves up: the time to cover most of the gap (from the recording)
  groundFallMs: 100, // how fast it follows a foot that moves down (a guess)
  maxLiftMs: 1500, // a lift that has not come back by now was a shift to a new resting height: that is the new ground, no tap (a guess; the longest real lift in the recording is about 1 s)
  lostMs: 500, // a foot missing for longer than this starts over (a guess)
  gapMs: 10000, // a seat with one lane learns how far apart its two feet usually stand (in x) over this long (a guess)
  gapMinSamples: 10, // fewer two-foot frames than this and the usual gap is not trusted (a guess)
  closeShare: 0.5, // two feet closer than this share of the usual gap are the model putting both on one spot: that frame decides nothing (from the recording: usual gap 0.055, bad frames 0.001 to 0.013)
};

// The middle value of a list, not the average: a few big real movements do not drag it.
const median = (xs) => [...xs].sort((a, b) => a - b)[xs.length >> 1];

export function createTapDetector(options = {}) {
  const o = { ...TAP_DEFAULTS, ...options };
  // One track per foot. Key `${spotId}:${foot}` (a foot with its own lane: the model's name), or `${spotId}:L` / `${spotId}:R`
  // (a seat with one lane: the foot on the left or the right of the picture).
  // { ground, lifted, liftedAt, peak, lastTapAt, seenAt, frame, lastY, x, above (frames in a row over the threshold), aboveAt,
  //   quiet (the last frame was resting), diffs: [{ t, d }] }
  const tracks = new Map();
  // Per seat with one lane: { gaps: [{ t, g }] (x distance of its two feet), lastTapAt }
  const seats = new Map();
  let frame = 0;

  // Moves one foot's track by one frame. `gate()` gives the object that holds lastTapAt: the track itself, or the seat, so a
  // seat taps once per cooldown. Returns { landed, tap }.
  function step(nowMs, key, f, gate, debug) {
    let t = tracks.get(key);
    if (!t || nowMs - t.seenAt > o.lostMs) {
      t = { ground: f.y, lifted: false, liftedAt: 0, peak: 0, lastTapAt: -Infinity, seenAt: nowMs, frame, lastY: f.y, x: f.x, above: 0, aboveAt: 0, quiet: false, diffs: [] };
      tracks.set(key, t);
    }
    const dt = nowMs - t.seenAt;
    const jump = f.y - t.lastY;
    // A foot not seen on the frame just before cannot show a frame to frame change.
    const continuous = t.frame === frame - 1;
    t.seenAt = nowMs;
    t.frame = frame;
    t.lastY = f.y;
    t.x = f.x;

    // The shake: the median frame to frame change over the last shakeMs, counting only frames where the foot rests (not
    // lifted, not over the threshold, and lower than restShare of it), so the rise and the landing of a tap do not
    // count, and neither does a busy tapper's small lifts, which would raise the threshold with them. Slow drift
    // changes little from frame to frame, so it does not count either.
    while (t.diffs.length && t.diffs[0].t < nowMs - o.shakeMs) t.diffs.shift();
    const shake = t.diffs.length >= o.shakeMinSamples ? median(t.diffs.map((d) => d.d)) : 0;
    const threshold = Math.max(o.liftRatio * (Number.isFinite(f.shin) ? f.shin : 0), o.minLift, o.shakeMultiple * shake);
    debug.push({ spotId: f.spotId, foot: key.endsWith(":R") ? 1 : key.endsWith(":L") ? 0 : f.foot, ground: t.ground, threshold, shake });

    const result = { landed: false, tap: false };
    if (t.lifted && nowMs - t.liftedAt > o.maxLiftMs) {
      // Never came back: a shift to a new resting height.
      t.lifted = false;
      t.above = 0;
      t.ground = f.y;
      t.quiet = false;
      return result;
    }
    // The ground follows the lowest points of the foot (largest y). It eases down fairly fast, so one noisy low
    // frame does not set it, and eases up slowly, and only while the foot is down, so a foot held in the air
    // does not drag it along.
    if (f.y > t.ground) t.ground += (f.y - t.ground) * (1 - Math.exp(-dt / o.groundFallMs));
    else if (!t.lifted) t.ground += (f.y - t.ground) * (1 - Math.exp(-dt / o.groundEaseMs));

    const height = t.ground - f.y;
    if (!t.lifted) {
      if (height > threshold) {
        // Over the threshold. One frame is not enough, unless it is past twice the threshold.
        if (++t.above === 1) t.aboveAt = nowMs;
        t.peak = Math.max(t.peak, height);
        if (t.above >= 2 || height > 2 * threshold) {
          t.lifted = true;
          t.liftedAt = t.aboveAt;
        }
      } else {
        t.above = 0;
        t.peak = 0;
      }
    } else {
      t.peak = Math.max(t.peak, height);
      if (height <= threshold * o.returnFraction) {
        // Landed. A lift seen for one slow frame still counts when it rose past twice the threshold.
        t.lifted = false;
        t.above = 0;
        result.landed = true;
        const long = nowMs - t.liftedAt >= o.minLiftMs || t.peak > 2 * threshold;
        if (long && nowMs - gate().lastTapAt >= o.cooldownMs) {
          gate().lastTapAt = nowMs;
          result.tap = true;
        }
      }
    }
    const quiet = !t.lifted && t.above === 0 && height < Math.max(threshold, o.restFloor) * o.restShare;
    if (quiet && t.quiet && continuous) t.diffs.push({ t: nowMs, d: Math.abs(jump) });
    t.quiet = quiet;
    return result;
  }

  // Which track each foot of a seat with one lane goes to, as [[foot, "L" or "R"], ...]. Two feet: the smaller x is the left
  // track, the other the right. One foot: the track whose last x is nearest ("L" when there is none yet). Two feet closer
  // than closeShare of the usual gap: none, that frame decides nothing.
  function assign(nowMs, spotId, fs) {
    if (fs.length === 1) {
      const known = ["L", "R"].filter((side) => tracks.has(`${spotId}:${side}`));
      const dist = (side) => Math.abs(tracks.get(`${spotId}:${side}`).x - fs[0].x);
      return [[fs[0], known.length ? known.reduce((a, b) => (dist(b) < dist(a) ? b : a)) : "L"]];
    }
    const sorted = [...fs].sort((p, q) => p.x - q.x);
    const [a, b] = [sorted[0], sorted.at(-1)]; // more than two feet: the outer pair
    const { gaps } = seats.get(spotId);
    while (gaps.length && gaps[0].t < nowMs - o.gapMs) gaps.shift();
    gaps.push({ t: nowMs, g: b.x - a.x });
    const usual = gaps.length >= o.gapMinSamples ? median(gaps.map((x) => x.g)) : 0;
    return b.x - a.x < o.closeShare * usual ? [] : [[a, "L"], [b, "R"]];
  }

  return {
    // Returns the same feet with `lifted` added, the taps this frame: [{ spotId, foot, atMs }], and `debug`, what each
    // track measured this frame: [{ spotId, foot, ground, threshold, shake }] (a seat with one lane: foot 0 is its left track,
    // foot 1 its right).
    // `lanes` is { [spotId]: lanes in that pad }, 2 when a seat is not in it. A seat with one lane tracks each foot on its own,
    // by its place in the picture (left or right), so names cannot flip; a tap of either is a tap of the seat. It comes back as
    // one foot (foot 0): the highest one seen (its x and y), `lifted` while any of its feet is in the air, but false on the
    // frame one of them lands. A seat with two lanes keeps each foot on its own track by the model's name.
    update(nowMs, feet, lanes = {}) {
      frame++;
      const taps = [];
      const debug = [];
      const bySeat = new Map(); // spotId -> its feet, for the seats with one lane
      const out = [];
      for (const f of feet) {
        if (lanes[f.spotId] === 1) {
          bySeat.set(f.spotId, [...(bySeat.get(f.spotId) ?? []), f]);
          continue;
        }
        const key = `${f.spotId}:${f.foot}`;
        const r = step(nowMs, key, f, () => tracks.get(key), debug);
        if (r.tap) taps.push({ spotId: f.spotId, foot: f.foot, atMs: nowMs });
        out.push({ ...f, lifted: tracks.get(key).lifted });
      }
      for (const [spotId, fs] of bySeat) {
        if (!seats.has(spotId)) seats.set(spotId, { gaps: [], lastTapAt: -Infinity });
        const seat = seats.get(spotId);
        let landed = false;
        for (const [f, side] of assign(nowMs, spotId, fs)) {
          const r = step(nowMs, `${spotId}:${side}`, f, () => seat, debug);
          landed ||= r.landed;
          if (r.tap) taps.push({ spotId, foot: 0, atMs: nowMs });
        }
        const air = ["L", "R"].some((side) => {
          const t = tracks.get(`${spotId}:${side}`);
          return t?.lifted && nowMs - t.seenAt <= o.lostMs;
        });
        const top = fs.reduce((best, f) => (f.y < best.y ? f : best));
        out.push({ ...top, foot: 0, lifted: air && !landed });
      }
      return { feet: out, taps, debug };
    },
  };
}
