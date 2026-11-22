// How hard a song is: "easy", "medium" or "hard". Worked out from what one player's feet have to do, so it never depends on
// how many people play. Pure logic, no browser calls.
import { splitParts } from "../game/parts.js";

const WINDOW_S = 10; // the busiest stretch is measured over this many seconds
const QUICK_MS = 600; // a tile this soon after the one before is a quick step
export const MEDIUM_FROM = 1.65; // a guess, tuned on the 17 songs (see reports/level.md)
export const HARD_FROM = 2.45;

// The most tiles a player gets in any WINDOW_S seconds, per second, plus twice the share of tiles that come under
// QUICK_MS after the one before. A steady slow tune scores about 1; a run of quick steps scores 3 or more.
export function songTrouble(song) {
  const [part] = splitParts(song, 1);
  const beatMs = 60000 / part.bpm;
  const at = part.notes.map((n) => Math.round(n.beat * beatMs)).sort((a, b) => a - b);
  if (at.length < 2) return 0;
  let busiest = 0;
  let end = 0;
  for (let i = 0; i < at.length; i++) {
    while (end < at.length && at[end] - at[i] < WINDOW_S * 1000) end++;
    busiest = Math.max(busiest, end - i);
  }
  const quick = at.slice(1).filter((t, i) => t - at[i] < QUICK_MS).length;
  return busiest / WINDOW_S + (2 * quick) / (at.length - 1);
}

export function songLevel(song) {
  const trouble = songTrouble(song);
  return trouble >= HARD_FROM ? "hard" : trouble >= MEDIUM_FROM ? "medium" : "easy";
}
