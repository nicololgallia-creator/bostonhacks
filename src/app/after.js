// What the phone keeps from a finished song, and the small logic the three screens after it share.
// The stage's results State lasts 8 s and then the stage goes back to the lobby, so the phone copies what it needs the
// moment it sees it. The leaderboard, the share image and "Play again?" are all drawn from that copy.
import { songs } from "../songs/index.js";
import { fitting } from "./fit.js";

export const APP_NAME = "Platform Piano"; // the one place the name is written; the name will change

let last = null;

// The copy to keep from a State, or null when it is not a finished song this phone played in.
export function keepable(state, clientId) {
  if (state?.status !== "results" || !state.song) return null;
  const mine = state.players.filter((p) => p.clientId === clientId).map((p) => p.spotId);
  if (!mine.length) return null;
  const { song, players, team, train, transit } = state;
  return { song, players, team, train, transit, mine };
}
export function keepResults(state, clientId) {
  last = keepable(state, clientId) ?? last;
}
export const lastResults = () => last;
export const setResults = (kept) => { last = kept; };

// One row for each seat, best first. A seat's total is its score plus its bonus (the team score adds the same sums).
// Equal totals share a place. The order of equal totals is seat order.
export function rank(players, myClientId) {
  const rows = players.map((p) => ({
    spotId: p.spotId,
    total: p.score + (p.bonus ?? 0),
    bonus: p.bonus ?? 0,
    bonusFor: p.bonusFor ?? "",
    grade: p.grade,
    maxCombo: p.maxCombo,
    perfects: p.counts?.perfect ?? 0,
    mine: p.clientId === myClientId,
  }));
  rows.sort((a, b) => b.total - a.total || a.spotId - b.spotId);
  for (const row of rows) row.place = 1 + rows.filter((r) => r.total > row.total).length;
  return rows;
}

// The two songs to offer for what is left of the ride, never the one just played: the two longest that fit. With fewer than
// two that fit (the ride is nearly over, or its end is not known), the shortest songs fill the gap.
export function twoSongs(secondsLeft, playedId) {
  const fit = Number.isFinite(secondsLeft) ? fitting(secondsLeft) : [];
  const rest = songs.filter((s) => s.id !== playedId);
  return [...new Set([...fit.filter((s) => s.id !== playedId), ...rest])].slice(0, 2);
}

// Seconds of ride left, from the stage's transit, or NaN when the stage did not give an end.
export const rideLeft = (transit, now = Date.now()) => (transit?.endsAt ? (transit.endsAt - now) / 1000 : NaN);
