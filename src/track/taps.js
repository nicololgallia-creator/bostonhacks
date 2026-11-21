// Tap in place, as pure logic: tells when a foot is in the air and when it has landed (a tap).
// Input is the feet from seats.js: [{ spotId, foot, x, y, shin }], y down the picture, in picture units (0 to 1).
// minLift is set from one real recording (qa/feet/real-taps-1.json: DJI, one seated person, jitter 0.005, lifts 0.04
// to 0.07). Every other number is a starting guess that is not yet tuned on a recording. A different camera height
// or a second recording may need other numbers.
export const TAP_DEFAULTS = {
  liftRatio: 0.08, // a foot is lifted when higher than its ground by this share of the shin ... (a guess)
  minLift: 0.02, // ... and by at least this much of the picture's height; with no shin this is the threshold (from the recording)
  returnFraction: 0.4, // it has landed once within this share of that threshold of the ground: 0.008 at 0.02 (from the recording)
  minLiftMs: 50, // a lift shorter than this is not a tap, unless it rose past twice the threshold (a guess)
  cooldownMs: 150, // after a tap the same foot cannot tap again for this long: the card said 120, but the recording has a landing bounce 146 ms after a tap
  groundEaseMs: 600, // how slowly the ground follows a foot that moves up: the time to cover most of the gap (from the recording)
  groundFallMs: 100, // how fast it follows a foot that moves down (a guess)
  maxLiftMs: 3000, // a foot "lifted" this long has a wrong ground: take its height as the new ground, no tap (a guess)
  lostMs: 500, // a foot missing for longer than this starts over (a guess)
};

export function createTapDetector(options = {}) {
  const o = { ...TAP_DEFAULTS, ...options };
  const tracks = new Map(); // `${spotId}:${foot}` or `${spotId}:seat` -> { ground, lifted, liftedAt, peak, lastTapAt, seenAt, count, lastY }

  // The one signal of a seat with one lane: its highest foot (the smallest y), and how many feet were seen.
  const highest = (feet) => feet.reduce((best, f) => (f.y < best.y ? f : best));

  return {
    // Returns the same feet with `lifted` added, and the taps this frame: [{ spotId, foot, atMs }].
    // `lanes` is { [spotId]: lanes in that pad }, 2 when a seat is not in it. A seat with one lane is one signal: any foot of
    // it lifting and landing is a tap, so no foot needs a name and names cannot flip. It comes back as one foot (foot 0, the
    // highest one). A seat with two lanes keeps each foot on its own track.
    update(nowMs, feet, lanes = {}) {
      const taps = [];
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
          t = { ground: f.y, lifted: false, liftedAt: 0, peak: 0, lastTapAt: -Infinity, seenAt: nowMs, count: undefined, lastY: f.y };
          tracks.set(key, t);
        }
        const dt = nowMs - t.seenAt;
        t.seenAt = nowMs;
        // When a foot comes or goes the highest one can change, and the signal jumps without anything lifting. While the
        // seat is down, the ground moves with the jump, so a foot that dropped out and came back is not read as a lift.
        if (f.seat !== t.count && t.count !== undefined && !t.lifted) t.ground += f.y - t.lastY;
        t.count = f.seat;
        t.lastY = f.y;

        // The ground follows the lowest points of the foot (largest y). It eases down fairly fast, so one noisy low
        // frame does not set it, and eases up slowly, and only while the foot is down, so a foot held in the air
        // does not drag it along.
        if (f.y > t.ground) t.ground += (f.y - t.ground) * (1 - Math.exp(-dt / o.groundFallMs));
        else if (!t.lifted) t.ground += (f.y - t.ground) * (1 - Math.exp(-dt / o.groundEaseMs));

        const threshold = Math.max(o.liftRatio * (Number.isFinite(f.shin) ? f.shin : 0), o.minLift);
        const height = t.ground - f.y;
        if (!t.lifted && height > threshold) {
          t.lifted = true;
          t.liftedAt = nowMs;
          t.peak = height;
        } else if (t.lifted && nowMs - t.liftedAt > o.maxLiftMs) {
          t.lifted = false;
          t.ground = f.y;
        } else if (t.lifted) {
          t.peak = Math.max(t.peak, height);
          if (height <= threshold * o.returnFraction) {
            // Landed. A lift seen for one slow frame still counts when it rose past twice the threshold.
            t.lifted = false;
            const long = nowMs - t.liftedAt >= o.minLiftMs || t.peak > 2 * threshold;
            if (long && nowMs - t.lastTapAt >= o.cooldownMs) {
              t.lastTapAt = nowMs;
              taps.push({ spotId: f.spotId, foot: f.foot, atMs: nowMs });
            }
          }
        }
        const { seat, ...foot } = f; // `seat` was only the count of feet, for the line above
        return { ...foot, lifted: t.lifted };
      });
      return { feet: out, taps };
    },
  };
}
