# duel-fill: a duel player never waits over 4 s

Sat 21 Nov, about 9:30 PM. Edited only `src/game/chart.js` and `src/game/chart.test.js`. `parts.js` and `parts.test.js` needed no change.

## What changed
- In `chart.js`, `dealVersus` still deals each tile to one player, longest-waiting first, with equal counts. Then new `balanceVersus` runs.
- Any player still idle over 4.0 s gets one more tile in their longest gap. It is either a tile another player already has at that moment, or an unused pitched note from `song.backing`. It takes whichever sits nearest the middle of the gap, and it keeps 350 ms from both neighbours.
- Then every player is brought up to the highest count, by the same rule, into the gap where they wait longest.
- If a player has no room for one more tile, the others lose the tile whose loss leaves the smallest hole (the old rule). This did not happen on any real song.
- Holds are decided after that, as before, on the k-th tile of every player. So kinds, hold lengths, order and `maxScore` stay equal.
- `backingLeft` is unchanged. A backing note that two players share leaves the backing once.
- Team mode and the lone player are not touched. `dealTeam` and `dealLone` are the same code.

## The table
Measured on the song files as they are now (after the 9 PM music rebuild), with `chartSpan` and `longestWait`. Only two songs went over 4.0 s. Every other song, 2 to 4 players, was already at or under 4.0 s and its chart did not change (checked by comparing before and after).

| song | players | longest wait before | after | tiles per player before | after |
|---|---|---|---|---|---|
| more-than-a-feeling | 4 | 4.5 s | 3.3 s | 9 | 11 |
| ship-never-returned | 4 | 4.8 s | 3.6 s | 34 | 43 |

Dirty Water is not in the table: with its new backing it is 3.2 s at 2 and 3 players and 2.9 s at 4, so the old 4.1 and 5.0 s are gone without my change.

## Tests (`src/game/chart.test.js`)
- Every song in `songs/`, 2, 3 and 4 players: no player waits over 4.0 s, equal counts, same kinds and hold lengths in order, equal `maxScore`, tiles 350 ms apart.
- A quiet made-up song (a tile every 2 s, 4 players) must have a moment on two players' lists. A busy one (a tile a second) must not: dealing alone is enough.
- A gap closed from the backing: a backing note becomes a tile, no drum does, and `backingLeft` has every other entry once.
- 54 made-up songs (6 spacings, 3 lengths, 3 player counts): equal, and under 4 s where the melody itself has gaps under 4 s.
- Team charts identical: SHA-1 fingerprints of the team tile lists of five songs for 1 to 4 players, taken from the code before my change, and a script check of all 17 songs for 1 to 4 players (68 charts) with zero differences. If a song file is edited, that song's fingerprint check skips itself rather than failing.
- A perfect engine run on Ship That Never Returned with 4 players scores exactly `maxScore` for all four, with no misses.
- Removed: the assertion "no moment is on two players' lists". It is the rule that changed. Replaced the old loose "within 1 s of 4 s" test with the strict one.

## Results
- `node --test src/game/*.test.js`: 64 tests, 64 pass.
- `npm.cmd test`: 527 tests, 525 pass, 0 fail, 1 skipped, 1 todo. The todo is `src/track/taps.test.js:422` ("seat 1 resting alone from 40.7 s makes no taps"), the tracking builder's, and expected: it is marked todo and says so.

## Needs from others
- Session or stage (`main.js`): a shared tile means two players can hit the same backing note, so the same pitch may sound twice at the same moment. It is the same note, so it reads as one louder note. No change needed unless it sounds wrong.
- Floor: two pads may show a tile at the same moment in a duel. Team mode already does that for "together" tiles.

## Not checked
- Real feet on the real floor, and the sound of two players hitting the same note together.
- Whether Nicolo likes shared moments in a duel in play. The 4 s promise now holds, the cost is more tiles for 4 players on Ship That Never Returned (34 to 43).
- Songs edited after 9:30 PM. If one goes over 4.0 s the all-songs test names it.
