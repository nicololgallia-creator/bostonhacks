// Splits one song across 1 to 4 seats. Pure logic, no browser calls. The rules are in chart.js.
// Everyone plays at the same time. A lone player has 2 lanes (one for each foot). With 2 to 4 players each has ONE lane
// and either foot plays it, so every note carries `lane: 0`.
import { buildParts } from "./chart.js";

// The lanes in one pad when `taken` seats are playing (with none taken it is a lone player's pad).
export const lanesInPad = (taken) => (taken >= 2 ? 1 : 2);

export const MODES = ["team", "versus"];

// Returns `seats` songs, each the same song with only that seat's tiles. Each tile is a note of the song's own shape plus:
//   lane  0 or 1 for a lone seat, always 0 with two or more
//   hold  true when it is a held tile (its `beats` is then the length to hold), false when it is a tap
//   bi    only on a tile made from the song's backing: the index of that backing entry (see backingLeft in chart.js)
// "team": the players share one tune, handed round in short runs. "versus": every player gets their own tiles, the same
// number of them, the same holds in the same order. Versus with one seat is the same as team.
export function splitParts(song, seats, { mode = "team" } = {}) {
  if (!Number.isInteger(seats) || seats < 1 || seats > 4) {
    throw new Error(`A song can be split for 1 to 4 players, not ${seats}.`);
  }
  if (!MODES.includes(mode)) throw new Error(`A song is split in the "team" or "versus" mode, not "${mode}".`);
  return buildParts(song, seats, mode);
}
