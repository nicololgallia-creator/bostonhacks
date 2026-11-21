import { songs } from "./index.js";
import { songSeconds } from "../game/engine.js";

const EXTRA_SECONDS = 4; // lead-in and score screen, per song

// The set of different songs whose play time (plus 4 s each) comes closest to seconds - buffer without going over.
// Tries every combination, which is fine for a dozen songs. Same input, same answer.
export function pickSongs({ seconds, buffer = 20 }) {
  if (!Number.isFinite(seconds)) throw new Error("The wait must be a number of seconds.");
  const budget = seconds - buffer;
  const cost = songs.map((s) => songSeconds(s) + EXTRA_SECONDS);
  let best = { mask: 0, total: 0 };
  for (let mask = 1; mask < 1 << songs.length; mask++) {
    let total = 0;
    for (let i = 0; i < songs.length; i++) if (mask & (1 << i)) total += cost[i];
    if (total <= budget && total > best.total) best = { mask, total };
  }
  const songIds = songs.filter((_, i) => best.mask & (1 << i)).reverse().map((s) => s.id); // songs is shortest first
  return { songIds, totalSeconds: best.total, fits: songIds.length > 0 };
}
