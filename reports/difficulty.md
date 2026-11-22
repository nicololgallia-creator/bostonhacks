# Difficulty selector (builder-difficulty, Sun 22 Nov)

Three levels, Easy / Normal / Hard. One choice for the whole game. Normal is byte-for-byte the tiles the game gave before.

## The table: 17 songs, 2 seats, team mode

"Tiles" is the total over both players (a tile everyone taps counts once per player). "Wait" is the longest any player sits idle, in seconds. Percent is against Normal.

| Song | Easy tiles | wait | % | Normal tiles | wait | Hard tiles | wait | % |
|---|---|---|---|---|---|---|---|---|
| Mary Had a Little Lamb | 16 | 5.3 | 55 | 29 | 4.0 | 36 | 2.7 | 124 |
| Row, Row, Row Your Boat | 18 | 5.5 | 58 | 31 | 3.7 | 40 | 2.8 | 129 |
| Happy Birthday | 15 | 5.5 | 56 | 27 | 3.7 | 31 | 2.8 | 115 |
| London Bridge | 16 | 5.5 | 62 | 26 | 3.7 | 34 | 2.8 | 131 |
| More Than a Feeling | 19 | 5.6 | 63 | 30 | 3.9 | 44 | 2.8 | 147 |
| Twinkle | 24 | 6.0 | 53 | 45 | 3.0 | 54 | 3.0 | 120 |
| Frere Jacques | 19 | 5.5 | 56 | 34 | 3.7 | 40 | 2.8 | 118 |
| Shipping Up to Boston | 32 | 5.5 | 47 | 68 | 2.8 | 70 | 2.8 | 103 |
| Greensleeves | 32 | 5.2 | 52 | 62 | 3.2 | 70 | 2.4 | 113 |
| When the Saints | 28 | 6.0 | 70 | 40 | 4.0 | 70 | 2.7 | 175 |
| Fur Elise | 37 | 5.6 | 49 | 76 | 3.0 | 93 | 2.6 | 122 |
| Take Me Out to the Ball Game | 38 | 5.5 | 58 | 66 | 3.6 | 82 | 2.7 | 124 |
| Jingle Bells | 38 | 5.5 | 66 | 58 | 3.7 | 78 | 2.8 | 134 |
| Ode to Joy | 40 | 5.5 | 60 | 67 | 3.7 | 77 | 2.8 | 115 |
| Sweet Caroline | 35 | 6.0 | 66 | 53 | 4.0 | 85 | 3.0 | 160 |
| Dirty Water | 57 | 5.8 | 56 | 102 | 3.3 | 110 | 2.9 | 108 |
| The Ship That Never Returned | 74 | 5.4 | 59 | 126 | 3.6 | 156 | 3.0 | 124 |
| **All 17** | **538** | | **57** | **940** | | **1170** | | **124** |

Whole-library totals at other seat counts (Easy / Hard against Normal): 1 seat 64% / 102%, 3 seats 52% / 127%, 4 seats 48% / 119%, duel with 2 seats 61% / 119%, duel with 4 seats 64% / 134%.

## Songs outside the bands, and why

- **Easy (aim 55 to 65%) is too thin on the fast songs:** Shipping Up 47, Fur Elise 49, Greensleeves 52, Twinkle 53. Their tunes are quick, so the 700 ms spacing alone removes most notes, and the backing cannot refill a gap that is already under the wait. Saints (70) and Jingle Bells (66) sit a little high because they are slower tunes that thin only by dropping weak beats.
- **Hard (aim 125 to 150%) is short on:** Shipping Up 103, Dirty Water 108, Greensleeves 113, Ode to Joy 115, Happy Birthday 115. Those songs are already near the 350 ms limit or have no spare backing notes, so there is nothing more to give. Over the band: Saints 175 and Sweet Caroline 160 (very rich backing).
- **Hard with one player barely changes the count (102%).** A lone player is "busy" for as long as a long note rings, so the backing has no room between tiles. Hard for one player is mostly the extra holds. I did not redesign that.
- Holds on Hard: more than Normal on 12 of 17. Shipping Up and Dirty Water have none at any level (their notes are too short to hold).
- Longest wait: Easy never goes over 6.0 s (the test says 6.0 plus a rounding hair). Hard is never longer than Normal's 4 s rule and mostly 2.4 to 3.0 s.

## What changed

- `src/game/chart.js`: new `LEVELS` (gap, teamWait, playerWait, together, holdShare, keep per level), `DIFFICULTIES`, `difficultyOf`. Every function that read MIN_GAP_MS, TEAM_WAIT_MS, PLAYER_WAIT_MS, TOGETHER_EVERY or HOLD_SHARE now reads the level's value. `buildParts(song, seats, mode, level = "normal")`. The old constants are still exported and Normal is built from them.
  - Easy: 700 ms gap, no holds, nobody taps together, 6 s player wait, keeps 60% of the notes a foot could play (weakest beats go first).
  - Hard: 350 ms gap (never lower), team wait 1000 ms, player wait 3000 ms, a together tile about every 8, one hold in three where the note is long enough.
  - Speed, timing windows and points per tile are not touched.
- `src/game/parts.js`: `splitParts(song, seats, { mode, difficulty })`. A bad level throws, like a bad mode.
- `src/stage/session.js`: new `difficulty` message (lobby only, same as `mode`; a bad value is ignored, a running song says "A song is running. Change the level when it ends."). `start` may carry `difficulty` (anything else becomes "normal", none keeps the lobby's). `snapshot().difficulty` is the lobby's choice, or the running song's. Passed to `splitParts`.
- `src/stage/main.js`: the second `splitParts` caller (the backing minus the tiles) gets `snap.difficulty`, and the draw view carries it.
- `src/game/floor-screens.js`: a gold plate with "Easy" or "Hard" beside the Team / Duel pill in the lobby, and on the results board beside "Team score" or the "1v1" tag. Nothing is drawn for Normal.
- `src/app/screens/song.js` + new `song.css`: the three-way choice under the ticket, same pills as Team / Duel, radio group, 48 px tall, global focus ring, one line that changes with the choice. Remembered in `localStorage` (`pp:difficulty`). It is sent as a `difficulty` message when picked, and `seats.js` sends it again in `start`.
- `src/app/screens/seats.js`: one field, `difficulty: app.trip.difficulty`, in the start message (a file outside the list, but it is the one that carries `mode`).
- Tests: `src/game/chart-normal.fixture.json` (fingerprints of all 136 Normal charts, captured before chart.js changed), 6 new tests in chart.test.js, 4 in session.test.js, and the exact-shape State test now has `difficulty`.
- `qa/e2e/demo-path.mjs`: step 3 now taps Hard on the phone, waits for the lobby to say hard, and at "playing" checks the stage's tile total equals the Hard split and beats the Normal split (36 against 29 on Mary Had a Little Lamb).

## Checked

- `node --test`: 564 pass, 0 fail, 1 todo (was 554 pass). Normal matches today's output for 17 songs x 1 to 4 players x team and duel. Duels are equal in tile count, kinds, holds and max score at every level, with made-up tunes too. Easy has no holds, keeps 700 ms, waits at most 6 s. Hard never goes under 350 ms and waits at most 4 s. A bad level: `splitParts` throws, the session makes it "normal". `backingLeft` agrees with the tiles at every level (every backing entry is a tile or left, never both, no drum is a tile).
- `npm.cmd run build` from PowerShell: passes.
- `node qa/e2e/demo-path.mjs --base http://localhost:4187`: 8 of 8, with the new Hard check inside step 3.
- Screenshots, opened and looked at (preview on 4187, now stopped):
  - `shots/difficulty-song-easy-390.png`, `difficulty-song-normal-390.png`, `difficulty-song-hard-390.png`: the selector fits, nothing overlaps the ticket or the buttons, the note changes. `difficulty-song-focus-390.png`: focus ring on the first pill. At 390 and 360 px the page has no sideways scroll and no pill overflows.
  - `shots/difficulty-floor-lobby-versus-hard.png` (Duel + Hard plate), `difficulty-floor-results-versus-hard.png` and `difficulty-floor-results-team-easy.png`: the plate reads the right way up and sits clear of the other text. `difficulty-floor-lobby-team-easy.png` and `difficulty-floor-lobby-team-normal.png` exist but I did not open them.
- No console errors on the stage or the phone in the runs.

## Calls I made

- The phone sends the `difficulty` message when you pick a level (and when the song screen opens with a remembered one), only while the lobby is showing, so a running song does not push a refusal onto a phone. The start message carries it as well, so the start never depends on that earlier message.
- Another phone in the game sees the level on the floor (lobby and results). Its own screens do not show it: the snapshot carries `difficulty`, so a later card can.
- The selector pulls 0.5 rem closer to the ticket and the buttons than the rest of the screen, to keep "Play this song" high. At 390 x 844 it starts at about 842 px, so on a real phone with browser bars it is a short scroll away, as "See more songs" already was.
- Hard teamWait 1000 ms is a compromise: 800 ms gave 137% overall but cut holds on dense songs below Normal's, which is the opposite of "more holds".

## Not checked:

It has not run on the real floor or a real phone, and nobody has played each level, so Easy and Hard counts are numbers, not feel. No ear check of the Hard backing tiles (many are bass or off-melody backing notes). The Easy and Normal lobby labels were not opened as pictures. `phone-check.mjs` was not run; I measured sideways scroll myself at 390 and 360 px. Easy leaves fast songs under the 55% band and Hard barely changes a lone player's count, as above.

## Needs from others

- Docs: PLAN.md "Wave 9 additions" does not list the `difficulty` message or State field yet (lead owns PLAN.md). I did not touch it.
- I did not run git. New files to add: `src/app/screens/song.css`, `src/game/chart-normal.fixture.json`, the nine `shots/difficulty-*` pictures, and `reports/difficulty.md`. Pushing to main deploys.
