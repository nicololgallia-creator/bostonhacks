// A made-up song for the floor pilot: 120 BPM, 24 s, notes dealt across the players the way the
// real game deals them (fewest notes first). Everything is a pure function of the seed and the
// time, so the scene can be drawn at any moment, for any screenshot, with no state.
//
// Lanes: two or more players get one lane each (either foot taps it). One player gets a pad of
// two lanes, one per foot.

export const BEAT = 0.5; // seconds per beat
export const SONG = 24; // seconds
export const TARGET = [872, 1069, 401, 942]; // final scores of seats 1 to 4, Nicolo's whiteboard
export const BONUS = [25, 50, 0, 0]; // shown beside the final score

// Chance a tap is missed, and chance a hit is Perfect (not Great), per seat.
const MISS = [0.08, 0, 0.4, 0.1];
const PERFECT = [0.7, 0.9, 0.35, 0.6];
const GAP = 0.75;
const POINTS = { perfect: 100, great: 70, miss: 0 };

export const lanesPerPad = (players) => (players === 1 ? 2 : 1);

function rng(seed) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Notes: { seat 0-3, lane (0 for one-lane pads; 0 left foot or 1 right foot for a solo pad),
// t (hit time, s), dur (hold length, s), grade "perfect" | "great" | "miss" }.
// A lane is never asked to take two notes closer than GAP seconds, so cars never touch.
export function buildChart(players = 4, seed = 11) {
  const rand = rng(seed);
  const lanes = lanesPerPad(players);
  const notes = [];
  const free = (seat, lane, t, dur) =>
    notes.every((n) => n.seat !== seat || n.lane !== lane || t + dur + GAP <= n.t || n.t + n.dur + GAP <= t);
  const add = (seat, lane, t, dur = 0) => notes.push({ seat, lane, t, dur });

  add(0, lanes - 1, 9, 1); // two holds, placed first so the random notes work around them
  add(players - 1, 0, 15, 1);
  const seats = [...Array(players).keys()];
  for (let step = 10; step <= 90; step++) {
    const t = step * 0.25;
    if (rand() > (step % 2 === 0 ? 0.8 : 0.4) * (players === 1 ? 0.6 : 1)) continue;
    const counts = seats.map((seat) => notes.filter((n) => n.seat === seat).length);
    const tie = seats.map(rand); // drawn first, so every engine takes the same number of random numbers
    const order = [...seats].sort((a, b) => counts[a] - counts[b] || tie[a] - tie[b]);
    const first = rand() < 0.5 ? 0 : lanes - 1;
    for (const seat of order) {
      const pick = [first, lanes - 1 - first].find((l) => free(seat, l, t, 0));
      if (pick !== undefined) { add(seat, pick, t); break; }
    }
  }
  notes.sort((a, b) => a.t - b.t);
  for (const n of notes) {
    if (!n.dur && rand() < MISS[n.seat]) n.grade = "miss";
    else n.grade = rand() < PERFECT[n.seat] ? "perfect" : "great";
  }
  if (!notes.some((n) => n.grade === "miss")) notes.find((n) => n.seat === 0 && !n.dur && n.t > 6).grade = "miss"; // the loop always shows one
  return { players, notes, events: seatEvents(notes, players) };
}

// Per seat: the moments the score or combo changes, in order, with the points each one adds.
function seatEvents(notes, players) {
  return [...Array(players).keys()].map((seat) => {
    const list = [];
    for (const n of notes.filter((x) => x.seat === seat)) {
      list.push({ t: n.t, pts: POINTS[n.grade], hit: n.grade !== "miss" });
      if (n.dur) list.push({ t: n.t + n.dur, pts: n.dur * 100, hit: true });
    }
    return list.sort((a, b) => a.t - b.t);
  });
}

// Score, combo and the time of the last change for each seat, at song time s.
// Scores are scaled so every seat ends exactly on its whiteboard number.
export function standing(chart, s) {
  return chart.events.map((list, seat) => {
    const total = list.reduce((sum, ev) => sum + ev.pts, 0);
    let got = 0, combo = 0, last = -99;
    for (const ev of list) {
      if (ev.t > s) break;
      got += ev.pts;
      combo = ev.hit ? combo + 1 : 0;
      last = ev.t;
    }
    return { score: Math.round((TARGET[seat] * got) / total), combo, last };
  });
}
