// Tap in place, as pure logic: tells when a foot is in the air and when it has landed (a tap).
// Input is the feet from seats.js: [{ spotId, foot, x, y, shin }], y down the picture, in picture units (0 to 1).
// minLift is set from one real recording (qa/feet/real-taps-1.json: DJI, one seated person, jitter 0.005, lifts 0.04
// to 0.07). Every other number is a starting guess that is not yet tuned on a recording. A different camera height
// or a second recording may need other numbers. A second person sits further back, so the picture units shrink and the
// model's shake grows: the threshold follows the shake each track measures on itself (shakeMultiple).
export const TAP_DEFAULTS = {
  liftRatio: 0.08, // a foot is lifted when higher than its ground by this share of the shin ... (a guess)
  minLift: 0.02, // ... and by at least this much of the picture's height; with no shin this is the floor (from the recording)
  shakeMultiple: 4, // ... and by this many times the shake the foot shows while down (0 turns it off). 5 was the first guess; on the real recording 5 lost a tap or two, 4 did not
  shakeMs: 3000, // the shake is the median frame to frame change over this long: shorter windows jump about, and a person does not change distance in seconds (a guess)
  restShare: 0.6, // a frame counts toward the shake only while the foot is lower than this share of the threshold (tuned on the real recording: 0.75 and up let a busy tapper raise the threshold, 0.5 under-reads a big shake)
  shakeMinSamples: 10, // fewer quiet frames than this and the shake is not trusted: the floor decides (a guess)
  returnFraction: 0.4, // it has landed once within this share of that threshold of the ground: 0.008 at 0.02 (from the recording)
  minLiftMs: 50, // a lift shorter than this is not a tap, unless it rose past twice the threshold (a guess)
  cooldownMs: 150, // after a tap the same foot cannot tap again for this long: the card said 120, but the recording has a landing bounce 146 ms after a tap
  groundEaseMs: 600, // how slowly the ground follows a foot that moves up: the time to cover most of the gap (from the recording)
  groundFallMs: 100, // how fast it follows a foot that moves down (a guess)
  maxLiftMs: 1500, // a lift that has not come back by now was a shift to a new resting height: that is the new ground, no tap (a guess; the longest real lift in the recording is about 1 s)
  lostMs: 500, // a foot missing for longer than this starts over (a guess)
};

// The middle value of a list, not the average: a few big real movements do not drag it.
const median = (xs) => [...xs].sort((a, b) => a - b)[xs.length >> 1];

export function createTapDetector(options = {}) {
  const o = { ...TAP_DEFAULTS, ...options };
  // `${spotId}:${foot}` or `${spotId}:seat` -> { ground, lifted, liftedAt, peak, lastTapAt, seenAt, count, lastY,
  //   above (frames in a row over the threshold), aboveAt, liftCount (feet seen when the lift began),
  //   left ({ count, ground, at } just before the last change), quiet (the last frame was resting), diffs: [{ t, d }] }
  const tracks = new Map();

  // The one signal of a seat with one lane: its highest foot (the smallest y), and how many feet were seen.
  const highest = (feet) => feet.reduce((best, f) => (f.y < best.y ? f : best));

  return {
    // Returns the same feet with `lifted` added, the taps this frame: [{ spotId, foot, atMs }], and `debug`, what each
    // track measured this frame: [{ spotId, foot, ground, threshold, shake }].
    // `lanes` is { [spotId]: lanes in that pad }, 2 when a seat is not in it. A seat with one lane is one signal: any foot of
    // it lifting and landing is a tap, so no foot needs a name and names cannot flip. It comes back as one foot (foot 0, the
    // highest one). A seat with two lanes keeps each foot on its own track.
    update(nowMs, feet, lanes = {}) {
      const taps = [];
      const debug = [];
      const bySeat = new Map(); // spotId -> its feet, for the seats with one lane
      const perFoot = [];
      for (const f of feet) {
        if (lanes[f.spotId] !== 1) perFoot.push(f);
        else bySeat.set(f.spotId, [...(bySeat.get(f.spotId) ?? []), f]);
      }
      const singles = [...bySeat.values()].map((fs) => ({ ...highest(fs), foot: 0, seat: fs.length }));
      const out = [...perFoot, ...singles].map((f) => {
        const key = `${f.spotId}:${f.seat ? "seat" : f.foot}`;
        let t = tracks.get(key);
        if (!t || nowMs - t.seenAt > o.lostMs) {
          t = { ground: f.y, lifted: false, liftedAt: 0, peak: 0, lastTapAt: -Infinity, seenAt: nowMs, count: undefined, lastY: f.y, above: 0, aboveAt: 0, liftCount: undefined, quiet: false, diffs: [] };
          tracks.set(key, t);
        }
        const dt = nowMs - t.seenAt;
        t.seenAt = nowMs;
        const jump = f.y - t.lastY;
        // When a foot comes or goes the highest one can change, and the signal jumps without anything lifting. That frame
        // decides nothing: no lift or landing is read from it, a lift in the making starts over, and a foot that is down
        // just takes its new height as the ground. A foot that is lifted keeps its ground and its lift: while the number
        // of feet is not the one the lift began with, the signal may be the other foot, so it is not compared to that
        // ground at all (moving the ground by the jump instead let the noise of both feet pile up in it).
        const before = t.count;
        const changed = before !== undefined && f.seat !== before;
        t.count = f.seat;
        t.lastY = f.y;

        // The shake: the median frame to frame change over the last shakeMs, counting only frames where the foot rests (not
        // lifted, not over the threshold, and lower than restShare of it), so the rise and the landing of a tap do not
        // count, and neither does a busy tapper's small lifts, which would raise the threshold with them. Slow drift
        // changes little from frame to frame, so it does not count either.
        while (t.diffs.length && t.diffs[0].t < nowMs - o.shakeMs) t.diffs.shift();
        const shake = t.diffs.length >= o.shakeMinSamples ? median(t.diffs.map((d) => d.d)) : 0;
        const threshold = Math.max(o.liftRatio * (Number.isFinite(f.shin) ? f.shin : 0), o.minLift, o.shakeMultiple * shake);

        const held = t.lifted && f.seat !== t.liftCount; // lifted, and the signal may be the other foot
        if (t.lifted && nowMs - t.liftedAt > o.maxLiftMs) {
          // Never came back: a shift to a new resting height.
          t.lifted = false;
          t.above = 0;
          t.ground = f.y;
          t.quiet = false;
        } else if (changed && !t.lifted) {
          // A foot that is back (the same number of feet as just before it went) is compared to the ground it had; a foot
          // that was already in the air when it came back is then still a lift. A different number is a new signal.
          const back = t.left?.count === f.seat && nowMs - t.left.at <= o.lostMs;
          const groundBefore = t.ground;
          t.ground = back ? t.left.ground : f.y;
          t.left = { count: before, ground: groundBefore, at: nowMs };
          t.above = 0;
          t.peak = 0;
          t.quiet = false;
        } else if (changed || held) {
          t.quiet = false;
        } else {
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
                t.liftCount = f.seat;
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
              const long = nowMs - t.liftedAt >= o.minLiftMs || t.peak > 2 * threshold;
              if (long && nowMs - t.lastTapAt >= o.cooldownMs) {
                t.lastTapAt = nowMs;
                taps.push({ spotId: f.spotId, foot: f.foot, atMs: nowMs });
              }
            }
          }
          const quiet = !t.lifted && t.above === 0 && height < threshold * o.restShare;
          if (quiet && t.quiet) t.diffs.push({ t: nowMs, d: Math.abs(jump) });
          t.quiet = quiet;
        }
        debug.push({ spotId: f.spotId, foot: f.foot, ground: t.ground, threshold, shake });
        const { seat, ...foot } = f; // `seat` was only the count of feet, for the line above
        return { ...foot, lifted: t.lifted };
      });
      return { feet: out, taps, debug };
    },
  };
}
