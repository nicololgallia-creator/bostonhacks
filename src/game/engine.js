// The game rules, with no browser calls. Rules are in PLAN.md under "Lanes" and "Play rules".
// Time is in milliseconds of song time: 0 is the moment the first beat is due at the hit line,
// so the clock starts negative while the first tiles are still sliding in.
export const TRAVEL_MS = 2500; // a tile takes this long from v = 0 to the hit line
export const HIT_V = 0.75; // where the hit line is
export const ZONE_V = 0.55; // a lane's square runs from here to v = 1
export const GOOD_MS = 300; // a foot must arrive within this of a tile's time
export const PERFECT_MS = 120;
export const FLICKER_MS = 150; // a square counts as empty only after this long with no foot
export const HOLD_MS = 800; // a note this long or longer is a hold tile
const POINTS = { perfect: 100, good: 50 };
const HOLD_POINTS_PER_BEAT = 20;

export function lanesFor(players) {
  return players <= 1 ? 4 : players === 2 ? 6 : 8;
}

// The song's distinct pitches, sorted low to high, spread evenly over the lanes, low on the left.
export function laneOf(song, midi, lanes) {
  const pitches = [...new Set(song.notes.map((n) => n.midi))].sort((a, b) => a - b);
  const i = pitches.indexOf(midi);
  if (i === -1) throw new Error(`Pitch ${midi} is not in the song "${song.id}".`);
  if (pitches.length === 1) return Math.floor((lanes - 1) / 2);
  return Math.round((i * (lanes - 1)) / (pitches.length - 1));
}

export function songSeconds(song) {
  return (Math.max(...song.notes.map((n) => n.beat + n.beats)) * 60) / song.bpm;
}

export const multiplierFor = (combo) => (combo >= 50 ? 4 : combo >= 25 ? 3 : combo >= 10 ? 2 : 1);

export const gradeFor = (hits, total) => {
  const share = hits / total;
  return share >= 0.95 ? "S" : share >= 0.85 ? "A" : share >= 0.7 ? "B" : "C";
};

// `lanes` is how many lanes the pad has. `players` still works for the old stage: it picks the lanes.
export function createGame({ song, players, lanes = lanesFor(players) }) {
  const beatMs = 60000 / song.bpm;
  const tiles = song.notes.map((n, id) => {
    const ms = n.beats * beatMs;
    return {
      id, lane: laneOf(song, n.midi, lanes), midi: n.midi, beats: n.beats,
      at: n.beat * beatMs, tail: n.beat * beatMs + ms, kind: ms >= HOLD_MS ? "hold" : "tap",
      state: "waiting", grade: null,
    };
  });
  const endMs = songSeconds(song) * 1000;
  // Per lane: raw foot counts seen in the last FLICKER_MS, the last time a foot was there, and the
  // steady count (the most feet seen in that span) that arrivals are judged on.
  const squares = Array.from({ length: lanes }, () => ({ samples: [], lastSeen: -Infinity, count: 0 }));
  const counts = { perfect: 0, good: 0, miss: 0 };
  let score = 0;
  let combo = 0;
  let maxCombo = 0;

  const laneAt = (u) => (u < 0 || u > 1 ? -1 : Math.min(lanes - 1, Math.floor(u * lanes)));
  const vAt = (nowMs, ms) => (HIT_V * (nowMs - (ms - TRAVEL_MS))) / TRAVEL_MS;

  return {
    lanes,
    total: tiles.length,
    // feet: [{ u, v }]. Returns what to draw and what happened this frame.
    update(nowMs, feet) {
      const events = [];
      const footIn = (lane) => feet.find((f) => f.v >= ZONE_V && f.v <= 1 && laneAt(f.u) === lane);
      const emit = (type, t, grade) => {
        const f = footIn(t.lane);
        events.push({ type, lane: t.lane, midi: t.midi, grade, u: f ? f.u : (t.lane + 0.5) / lanes, v: f ? f.v : HIT_V });
      };
      // A tile is judged: a hit adds to the combo, a miss resets it.
      const judge = (t, grade, extra = 0) => {
        t.grade = grade;
        if (grade === "miss") {
          counts.miss++;
          combo = 0;
          return;
        }
        counts[grade]++;
        combo++;
        maxCombo = Math.max(maxCombo, combo);
        score += (POINTS[grade] + extra) * multiplierFor(combo);
      };
      const miss = (t) => { t.state = "missed"; judge(t, "miss"); emit("miss", t, "miss"); };
      const gradeAt = (t) => (Math.abs(nowMs - t.at) <= PERFECT_MS ? "perfect" : "good");

      // 1. Steady foot count per lane, and how many feet arrived this frame.
      const arrivals = squares.map((sq, lane) => {
        const raw = feet.filter((f) => f.v >= ZONE_V && f.v <= 1 && laneAt(f.u) === lane).length;
        if (raw > 0) sq.lastSeen = nowMs;
        sq.samples = sq.samples.filter((s) => s.at > nowMs - FLICKER_MS);
        sq.samples.push({ at: nowMs, raw });
        const before = sq.count;
        sq.count = Math.max(...sq.samples.map((s) => s.raw));
        return Math.max(0, sq.count - before);
      });

      // 2. Each arrival hits the nearest waiting tile in its lane that is within reach.
      arrivals.forEach((n, lane) => {
        for (let i = 0; i < n; i++) {
          let best = null;
          for (const t of tiles) {
            if (t.lane !== lane || t.state !== "waiting" || Math.abs(nowMs - t.at) > GOOD_MS) continue;
            if (!best || Math.abs(nowMs - t.at) < Math.abs(nowMs - best.at)) best = t;
          }
          if (!best) continue;
          const grade = gradeAt(best);
          if (best.kind === "tap") {
            best.state = "hit";
            judge(best, grade);
            emit("hit", best, grade);
          } else {
            best.state = "holding";
            best.grade = grade;
            emit("holdStart", best, grade);
          }
        }
      });

      for (const t of tiles) {
        const sq = squares[t.lane];
        // 3. A foot already standing on a hold tile's square at its time starts it, as good.
        if (t.kind === "hold" && t.state === "waiting" && nowMs >= t.at && nowMs <= t.at + GOOD_MS && sq.count > 0) {
          t.state = "holding";
          t.grade = "good";
          emit("holdStart", t, "good");
        }
        // 4. A held tile is finished by staying to the end or by leaving.
        if (t.state === "holding") {
          const stayed = nowMs >= t.tail - FLICKER_MS && sq.lastSeen >= t.tail - FLICKER_MS;
          if (stayed || sq.count === 0) {
            t.state = "hit";
            if (stayed) judge(t, t.grade, HOLD_POINTS_PER_BEAT * t.beats);
            else if (sq.lastSeen - t.at >= (t.tail - t.at) / 2) judge(t, "good");
            else { t.state = "missed"; judge(t, "miss"); }
            emit("holdEnd", t, t.grade);
            if (t.state === "missed") emit("miss", t, "miss");
          }
        }
        // 5. A tile nobody reached in time is a miss.
        if (t.state === "waiting" && nowMs > t.at + GOOD_MS) miss(t);
      }

      const drawn = [];
      for (const t of tiles) {
        const v = vAt(nowMs, t.at);
        const vTail = t.kind === "hold" ? vAt(nowMs, t.tail) : v;
        if (v > -0.2 && vTail < 1.2) drawn.push({ id: t.id, lane: t.lane, kind: t.kind, v, vTail, state: t.state });
      }
      const done = nowMs >= endMs && tiles.every((t) => t.state !== "waiting" && t.state !== "holding");
      const hits = counts.perfect + counts.good;
      return {
        tiles: drawn, events, score, combo, maxCombo, multiplier: multiplierFor(combo), counts: { ...counts },
        total: tiles.length, done, grade: done ? gradeFor(hits, tiles.length) : null,
      };
    },
  };
}
