import { songs } from "./index.js";
import { songSeconds } from "../game/engine.js";

const EXTRA_SECONDS = 4; // lead-in and score screen, per song

// The songs Nicolo's ear approved, Sun 22 Nov 2026: eight judged Good, three more once their tempo was raised (Better).
// A recommendation comes only from these. To approve another song, add its id here and nothing else. "More songs" lists every song.
export const APPROVED = [
  "mary-lamb", "row-boat", "happy-birthday", "twinkle", "greensleeves", "fur-elise", "take-me-out-to-the-ball-game", "ode-to-joy",
  "saints", "london-bridge", "frere-jacques",
];

// Of `pool` (shortest first), the songs whose play time (plus 4 s each) comes closest to `budget` without going over.
// Tries every combination, which is fine for a dozen songs. Same input, same answer.
function bestSet(pool, budget) {
  const cost = pool.map((s) => songSeconds(s) + EXTRA_SECONDS);
  let best = { mask: 0, total: 0 };
  for (let mask = 1; mask < 1 << pool.length; mask++) {
    let total = 0;
    for (let i = 0; i < pool.length; i++) if (mask & (1 << i)) total += cost[i];
    if (total <= budget && total > best.total) best = { mask, total };
  }
  const songIds = pool.filter((_, i) => best.mask & (1 << i)).reverse().map((s) => s.id); // longest first
  return { songIds, totalSeconds: best.total, fits: songIds.length > 0 };
}

// The recommendation for a wait of `seconds`: approved songs only, whenever at least one of them fits; else any song that fits.
export function pickSongs({ seconds, buffer = 20 }) {
  if (!Number.isFinite(seconds)) throw new Error("The wait must be a number of seconds.");
  const budget = seconds - buffer;
  const approved = bestSet(songs.filter((s) => APPROVED.includes(s.id)), budget);
  return approved.fits ? approved : bestSet(songs, budget);
}
