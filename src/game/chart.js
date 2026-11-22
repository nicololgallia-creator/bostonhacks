// The chart: which tiles a song gives to which players, and when. Pure logic, no browser calls. parts.js calls it.
//
// 1. Density. The melody comes first. Wherever the team would wait longer than TEAM_WAIT_MS with the song still going, a
//    pitched entry of the song's `backing` fills the gap (on the strongest beat it can find). Drums are never tiles.
// 2. Dealing. Team mode hands the tune round in short runs (RUN_LENGTHS), one player after another in seat order, and on
//    about one tile in TOGETHER_EVERY everyone taps at once. A player who would wait longer than PLAYER_WAIT_MS gets the next tile
//    out of turn. Versus mode deals every tile to one player, longest-waiting first, and every player gets the same number;
//    then a player left waiting longer than PLAYER_WAIT_MS gets one more tile, at a moment a rival also plays or from the backing,
//    and the others are topped up to the same count.
// 3. Holds. A tile is a hold when its note is long enough and about one tile in five is, so holds are spread, not bunched.
//    In versus mode the k-th tile of every player has the same kind and the same length.
// 4. Levels. LEVELS below sets how many tiles and of what kind: Easy thins the tune, spaces it out and has no holds; Hard fills
//    more from the backing and holds and plays-together more often. A level never changes the speed, the timing or the points per tile.
//    Normal is the constants above, so it gives exactly the tiles the game gave before levels existed.
import { HOLD_MS } from "./engine.js";

export const MIN_GAP_MS = 350; // one player's tiles never start closer than this (a foot cannot go faster), and a hold ends this long before the next
export const TEAM_WAIT_MS = 2500; // the whole team waits no longer than this while the song goes on (a guess)
export const PLAYER_WAIT_MS = 4000; // one player waits no longer than this between tiles (a guess)
export const RUN_LENGTHS = [3, 2, 4, 2, 3, 4, 2]; // tiles in a row for one player in team mode, then the next player's run
export const TOGETHER_EVERY = 12; // about one tile in this many is played by everyone at once (a guess)
export const HOLD_SHARE = 1 / 5; // about this share of the tiles are holds, where the song has notes long enough (a guess)
export const ALTERNATE_MS = 1000; // a lone player's tiles closer than this go to opposite feet; further apart, pitch picks the foot

// How many tiles and of what kind, for each level. `gap`: least time between one player's tile starts (never under MIN_GAP_MS).
// `teamWait`, `playerWait`: the longest the team, or one player, waits while the song goes on. `together`: about one tile in this
// many is played by everyone. `holdShare`: about this share of the tiles are holds. `keep`: the share of the tune's notes kept
// (the weakest beats go first). Easy is a guess to be heard by Nicolo (6 s: his rule of 8 PM, no long gaps without tiles).
export const DIFFICULTIES = ["easy", "normal", "hard"];
export const LEVELS = {
  easy: { gap: 700, teamWait: TEAM_WAIT_MS, playerWait: 6000, together: Infinity, holdShare: 0, keep: 0.6 },
  normal: { gap: MIN_GAP_MS, teamWait: TEAM_WAIT_MS, playerWait: PLAYER_WAIT_MS, together: TOGETHER_EVERY, holdShare: HOLD_SHARE, keep: 1 },
  hard: { gap: MIN_GAP_MS, teamWait: 1000, playerWait: 3000, together: 8, holdShare: 1 / 3, keep: 1 },
};
export const difficultyOf = (x) => (DIFFICULTIES.includes(x) ? x : "normal");

const DRUM_POWER = { kick: 3, snare: 2 }; // any other drum counts 0.5
const BASS_BELOW = 48; // a backing entry below this is a bass note: it is used only when nothing higher sounds at that moment
const maxOf = (list, score) => list.reduce((best, x) => (score(x) > score(best) ? x : best));

// The stretch where the song has music: from its first pitched sound (melody or backing, not drums: a count-in click is not
// music) to the end of its last melody note. It never starts before 0, the moment the first beat is due.
export function chartSpan(song) {
  const beatMs = 60000 / song.bpm;
  const starts = [...song.notes, ...(song.backing ?? []).filter((e) => !e.drum)].map((e) => e.beat * beatMs);
  return { from: starts.length ? Math.max(0, Math.min(...starts)) : 0, to: Math.max(0, ...song.notes.map((n) => (n.beat + n.beats) * beatMs)) };
}

// The longest a player sits idle in a part: from the end of one tile (a hold's tail) to the start of the next, counting the
// time before the first tile and after the last. A part with no tiles waits the whole song.
export function longestWait(part, { from, to }) {
  const beatMs = 60000 / part.bpm;
  let idleFrom = from;
  let longest = 0;
  for (const n of part.notes) {
    longest = Math.max(longest, n.beat * beatMs - idleFrom);
    idleFrom = (n.beat + (n.hold ? n.beats : 0)) * beatMs;
  }
  return Math.max(longest, to - idleFrom);
}

const tileOf = (n, beatMs, power = n.beats * beatMs / 1000) => ({ at: n.beat * beatMs, len: n.beats * beatMs, beat: n.beat, beats: n.beats, midi: n.midi, power });

// How long the team may wait for a tile: the level's teamWait, and less with many players so that each one, taking every n-th tile, still waits playerWait at most.
// In versus every tile goes to one player, so each takes every seats-th tile.
const teamWait = (seats, mode, lv) => Math.min(lv.teamWait, Math.floor(lv.playerWait / Math.max(1, mode === "versus" ? seats : seats - 1)));

// How strong a melody note's beat is: a bar's first beat, a half bar, any whole beat, then the rest; a long note counts a little more.
const strength = (t) => (t.beat % 4 === 0 ? 3 : t.beat % 2 === 0 ? 2 : Number.isInteger(t.beat) ? 1 : 0) + Math.min(1, t.len / 1000) * 0.5;

// The melody, in time order, minus any note that starts too close behind the one before it, and (when the level keeps only
// part of the tune) minus the notes on the weakest beats, the ones right behind another note first. `keep` is a share of the
// notes a foot could play at all (MIN_GAP_MS apart), so a tune the gap has already thinned is not thinned twice.
function melodyTiles(song, beatMs, lv) {
  const sorted = song.notes.map((n) => tileOf(n, beatMs)).sort((a, b) => a.at - b.at);
  const spaced = (gap) => sorted.reduce((kept, t) => (!kept.length || t.at - kept[kept.length - 1].at >= gap ? [...kept, t] : kept), []);
  const kept = spaced(lv.gap);
  const cut = kept.length - Math.round(spaced(MIN_GAP_MS).length * lv.keep);
  if (cut <= 0) return kept;
  const weakest = kept.map((t, i) => i).sort((a, b) => strength(kept[a]) - strength(kept[b]) || kept[a].at - (kept[a - 1]?.at ?? -Infinity) - (kept[b].at - (kept[b - 1]?.at ?? -Infinity)));
  const gone = new Set(weakest.slice(0, cut));
  return kept.filter((_, i) => !gone.has(i));
}

// One pitched tile for each moment the backing sounds a pitch (not a drum). Its power is how strong that beat is: drums that
// hit with it, other notes that start with it, and how long it rings. A candidate too close to a melody note is left out.
function backingTiles(song, beatMs, melody, gap) {
  const moments = new Map();
  (song.backing ?? []).forEach((e, bi) => {
    const m = moments.get(e.beat) ?? { drums: 0, pitched: [] };
    if (e.drum) m.drums += DRUM_POWER[e.drum] ?? 0.5;
    else if (Number.isFinite(e.midi)) m.pitched.push({ ...e, bi });
    moments.set(e.beat, m);
  });
  const out = [];
  for (const [beat, m] of moments) {
    if (!m.pitched.length) continue;
    const high = m.pitched.filter((e) => e.midi >= BASS_BELOW);
    const pick = maxOf(high.length ? high : m.pitched, (e) => e.midi); // the highest sounding note: it is the one that reads as a tune
    const t = tileOf({ beat, midi: pick.midi, beats: pick.beats ?? 1 }, beatMs, m.drums + 0.5 * (m.pitched.length - 1) + Math.min(1, (pick.beats ?? 1) * beatMs / 1000));
    t.bi = pick.bi;
    if (!melody.some((n) => Math.abs(n.at - t.at) < gap)) out.push(t);
  }
  return out.sort((a, b) => a.at - b.at);
}

// The melody plus enough backing tiles that nobody waits longer than `wait`. `occupied` is for a lone player, who is
// busy for as long as a long note rings, so a tile is not put inside one: a gap is measured from where the note ends.
function densify(melody, candidates, { from, to }, occupied, wait, gap) {
  const reach = (t) => t.at + (occupied && t.len >= HOLD_MS ? t.len : 0);
  const line = [];
  let leftReach = from; // where the last placed tile stops being busy
  let floor = from; // no tile may start before this
  const fillUpTo = (rightAt) => {
    while (rightAt - leftReach > wait) {
      const here = candidates.filter((c) => c.at >= floor && c.at <= rightAt - gap);
      if (!here.length) return;
      const soon = here.filter((c) => c.at <= leftReach + wait);
      // The strongest beat that still keeps the wait short, and the further along the better.
      const pick = soon.length ? maxOf(soon, (c) => c.power + (c.at - leftReach) / wait) : here[0];
      line.push(pick);
      leftReach = reach(pick);
      floor = leftReach + gap;
    }
  };
  for (const m of melody) {
    fillUpTo(m.at);
    line.push(m);
    leftReach = reach(m);
    floor = leftReach + gap;
  }
  fillUpTo(to);
  return line;
}

// One player: every tile, each its own moment.
function dealLone(line) {
  const list = line.map((t) => ({ ...t }));
  return { lists: [list], groups: list.map((t) => [t]) };
}

// Team mode: the tune handed round in runs. Returns, for each player, their tiles, and the groups of tiles that are one
// moment of the song (one tile for a run, several when everyone or several players play it together).
function dealTeam(line, seats, { from, to }, lv) {
  const lists = Array.from({ length: seats }, () => []);
  const groups = [];
  const lastAt = Array(seats).fill(from);
  const together = new Set(); // the strongest tile in each full block of lv.together tiles
  for (let s = 0; s + lv.together <= line.length; s += lv.together) together.add(line.indexOf(maxOf(line.slice(s, s + lv.together), (t) => t.power)));
  // A run is shorter when the song is so sparse that a long run would make the others wait too long (down to 1 in the worst case).
  const gap = line.length ? Math.max(to - from, 1) / line.length : 1;
  const runLength = (i) => Math.max(1, Math.min(RUN_LENGTHS[i % RUN_LENGTHS.length], Math.floor((lv.playerWait / gap - 1) / (seats - 1))));
  let holder = 0;
  let run = 0;
  let left = runLength(0);
  line.forEach((tile, i) => {
    const nextAt = line[i + 1]?.at ?? to;
    const late = lists.map((_, p) => p).filter((p) => nextAt - lastAt[p] > lv.playerWait); // would wait too long if passed over
    const takers = together.has(i) ? lists.map((_, p) => p) : late.length ? late : [holder];
    if (takers.length === 1 && takers[0] === holder && !together.has(i)) {
      left -= 1;
      if (left === 0) { holder = (holder + 1) % seats; run += 1; left = runLength(run); }
    }
    const group = takers.map((p) => { const copy = { ...tile }; lists[p].push(copy); lastAt[p] = tile.at; return copy; });
    groups.push(group);
  });
  return { lists, groups };
}

// Takes out the tile whose loss leaves the smallest hole (the weaker one on a tie).
function dropSmallestHole(tiles, { from, to }) {
  const hole = (i) => (tiles[i + 1]?.at ?? to) - (tiles[i - 1]?.at ?? from);
  tiles.splice(tiles.map((_, i) => i).sort((a, b) => hole(a) - hole(b) || tiles[a].power - tiles[b].power)[0], 1);
}

// The stretches one player is idle: from `a` (the start of their tile, or the song's start) to `b` (the next tile, or the song's end).
// `lo` and `hi` bound where one more tile of theirs may start and still keep MIN_GAP_MS from both neighbours.
function gapsOf(list, { from, to }, gap) {
  const edges = [from, ...list.map((t) => t.at), to];
  return edges.slice(1).map((b, i) => ({ a: edges[i], b, lo: i ? edges[i] + gap : from, hi: b - gap }));
}

// In a duel one moment of the song may be played by two players at once. Where dealing one tile to one player leaves a player
// waiting over PLAYER_WAIT_MS, give them one more tile: another player's tile or an unused backing note, whichever sits nearest the
// middle of their gap. Then every player is brought to the same count by the same rule, into the gap where they wait longest.
// `pool` is every tile that could be played. Lists stay in time order. A player with no candidate for a gap keeps the gap.
function balanceVersus(lists, pool, span, lv) {
  const addTo = (p, wanted) => {
    const stuck = new Set();
    for (;;) {
      const gap = gapsOf(lists[p], span, lv.gap).filter((g) => wanted(g) && !stuck.has(g.a)).sort((x, y) => (y.b - y.a) - (x.b - x.a))[0];
      if (!gap) return false;
      const fits = pool.filter((c) => c.at >= gap.lo && c.at <= gap.hi);
      if (!fits.length) { stuck.add(gap.a); continue; }
      const pick = fits.reduce((best, c) => (Math.max(c.at - gap.a, gap.b - c.at) < Math.max(best.at - gap.a, gap.b - best.at) ? c : best));
      lists[p].push({ ...pick });
      lists[p].sort((x, y) => x.at - y.at);
      return true;
    }
  };
  lists.forEach((_, p) => { while (addTo(p, (g) => g.b - g.a > lv.playerWait)); });
  const target = Math.max(...lists.map((l) => l.length));
  lists.forEach((list, p) => { while (list.length < target && addTo(p, () => true)); });
  const least = Math.min(...lists.map((l) => l.length)); // only when a player has no room left for one more tile
  lists.forEach((list) => { while (list.length > least) dropSmallestHole(list, span); });
}

// Versus mode: dealing gives every tile to one player, the one who has waited longest, and every player the same number.
// The few tiles over (a count that does not divide by the players) are the ones whose loss leaves the smallest hole. Then
// balanceVersus lets a player share a moment with a rival where the deal left them waiting too long.
function dealVersus(line, seats, span, lv, spare = []) {
  const { from } = span;
  const tiles = [...line];
  for (let extra = tiles.length % seats; extra > 0; extra--) dropSmallestHole(tiles, span);
  const lists = Array.from({ length: seats }, () => []);
  const lastAt = Array(seats).fill(from);
  const quota = tiles.length / seats;
  for (const tile of tiles) {
    const open = lists.map((_, p) => p).filter((p) => lists[p].length < quota);
    const ready = open.filter((p) => !lists[p].length || tile.at - lastAt[p] >= lv.gap);
    // Longest wait first; a player with no tile yet has waited since the song began, so goes before anyone who has had one. Then the lower seat.
    const who = maxOf(ready.length ? ready : open, (p) => (lists[p].length ? tile.at - lastAt[p] : 1e9) - p * 1e-6);
    lists[who].push({ ...tile });
    lastAt[who] = tile.at;
  }
  balanceVersus(lists, [...line, ...spare], span, lv);
  return { lists, groups: Array.from({ length: lists[0].length }, (_, k) => lists.map((l) => l[k])) };
}

// Decides which tiles are holds. A group is one moment (the same tile for several players, or in versus the k-th tile of
// every player): it is a hold only if the shortest room any of them has is long enough, so all of them get the same length.
function decideHolds(groups, lists, beatMs, lv) {
  lists.forEach((list) => list.forEach((t, i) => { t.room = (list[i + 1]?.at ?? Infinity) - t.at - lv.gap; }));
  let credit = 0;
  for (const group of groups) {
    credit = Math.min(1, credit + lv.holdShare);
    const length = Math.min(...group.map((t) => Math.min(t.len, t.room)));
    const hold = credit >= 1 && length >= HOLD_MS;
    if (hold) credit -= 1;
    // One length in beats for the whole group, so a float sum cannot make two equal holds differ: the note's own beats when it is the shortest.
    const whole = group.find((t) => t.len === length);
    group.forEach((t) => { t.hold = hold; t.holdBeats = whole ? whole.beats : length / beatMs; });
  }
}

// A lone player's two lanes: feet take turns, and where the tiles are far enough apart for that not to matter, pitch picks.
function laneLone(list) {
  const pitches = list.map((t) => t.midi).sort((a, b) => a - b);
  const middle = pitches[Math.floor(pitches.length / 2)];
  list.forEach((t, i) => { t.lane = i && t.at - list[i - 1].at < ALTERNATE_MS ? 1 - list[i - 1].lane : t.midi >= middle ? 1 : 0; });
}

// The tiles of each of `seats` players, as parts of the song. `mode` is "team" or "versus" (versus needs two or more players).
// `level` is one of DIFFICULTIES: the same level for every player, so a duel stays equal.
export function buildParts(song, seats, mode, level = "normal") {
  const lv = LEVELS[level];
  const beatMs = 60000 / song.bpm;
  const span = chartSpan(song);
  const melody = melodyTiles(song, beatMs, lv);
  const candidates = backingTiles(song, beatMs, melody, lv.gap);
  const line = densify(melody, candidates, span, seats === 1 && lv.holdShare > 0, teamWait(seats, mode, lv), lv.gap);
  const { lists, groups } = seats === 1 ? dealLone(line) : mode === "versus" ? dealVersus(line, seats, span, lv, candidates.filter((c) => !line.includes(c))) : dealTeam(line, seats, span, lv);
  decideHolds(groups, lists, beatMs, lv);
  if (seats === 1) laneLone(lists[0]);
  return lists.map((list) => ({
    ...song,
    notes: list.map((t) => ({
      beat: t.beat, midi: t.midi, beats: t.hold ? t.holdBeats : t.beats,
      lane: t.lane ?? 0, hold: t.hold, ...(t.bi === undefined ? {} : { bi: t.bi }),
    })),
  }));
}

// The backing the song still plays by itself once its tiles are played by the players: every entry that did not become a tile.
// (A tile made from a backing note sounds when it is hit, so the same note must not also sound on its own.)
export function backingLeft(song, parts) {
  const used = new Set(parts.flatMap((p) => p.notes.filter((n) => n.bi !== undefined).map((n) => n.bi)));
  return (song.backing ?? []).filter((_, bi) => !used.has(bi));
}
