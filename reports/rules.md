# rules: holds need a fresh foot, a chart with enough tiles, versus split

Sat 21 Nov, about 8:40 PM. Files: `src/game/engine.js`, `engine.test.js`, `parts.js`, `parts.test.js`, and new `src/game/chart.js`, `chart.test.js`. No other file touched.

## What changed in the rules

**A. Holds (engine.js).**
- A hold starts only with an arrival (a foot that lands inside the good window), exactly like a tap. The old rule "a foot already standing there starts it as good" is gone. A hold nobody lands on is a miss when its window passes.
- Holds are kept by staying down to the end. Leaving early ends them as before (past half is good, before half is a miss).
- After a hold the foot is still down, so the next tile needs a lift and a landing. No new code for that: taps already work this way.
- `HOLD_MS` is now 500. A note can carry `hold: true|false`, and that wins over its length (`isHold(note, bpm)`). The chart sets it on every tile.
- New `HOLD_GRACE_MS = 400`. A hold survives a square that is empty for less than this long.
- New `maxScore(part)`: the score of an all-perfect run, built from the engine's own `pointsFor`, multiplier and hold points.

**What a one-lane seat means for a hold (read from `seatsource.js` and `taps.js`).** A seat with one lane hands the engine one foot, `lifted` while ANY of its feet is in the air and false on a landing frame. So when you hold with one foot and step with the other, the engine sees "lifted" for as long as the step takes. Without a grace that would end every hold the moment you shift your weight. So yes, the engine needs a grace: 400 ms, named, with a test (`a one-lane seat whose other foot steps does not lose its hold`). A step of 340 ms keeps the hold. A step of 500 ms loses it. A real early release now registers 400 ms late, but it is scored by when the foot left, so the delay costs nothing. Two limits of that one signal:
1. A player who stands on one foot all song and steps with the other can still start holds, because the other foot's landing is an arrival. Closing that needs a per-foot signal from tracking, not a rule here.
2. A foot the tracker loses (missing, not lifted) waits out the 150 ms flicker and then the grace: 550 ms in all.
In a two-lane pad (a lone player) each foot has its own lane and its own `lifted`, so none of this applies.

**B. Chart (`chart.js`, called by `splitParts`).**
- Density: melody first. Where the team would wait over 2.5 s (the song still going, from its first pitched sound to the end of its last melody note), the strongest pitched entry of `song.backing` in that gap becomes a tile. Strength is the drums hitting with it (kick 3, snare 2, other 0.5), other notes starting with it, and its length. Drums are never tiles. A tile keeps the pitch of the entry it came from. With 3 or 4 players the gap limit shrinks (4 s divided by players minus one, 2 s and 1.33 s) so each player still gets a tile in time. Songs with no backing are not filled: no rhythm is invented.
- Back and forth (team, 2 to 4 players): runs of 3, 2, 4, 2, 3, 4, 2 tiles, player after player in seat order. Runs shrink on a sparse song, down to 1, so the others do not wait too long. About one tile in 12 (the strongest of each block of 12) is played by everyone at once. A player who would wait over 4 s gets the next tile out of turn.
- A lone player has two lanes. Tiles closer than 1 s go to opposite feet. Further apart, pitch picks the foot (low left, high right).
- Holds: a note of 500 ms or more can be a hold, and about one tile in five is (an even spread, never two in a row unless the song has nothing else). A hold keeps its real length unless the next tile of that player is closer than 350 ms after its tail, then it is cut to fit. A note under 500 ms is never a hold. Notes that qualify but were not picked stay taps.
- No tile of one player starts less than 350 ms after the previous one (or its tail).

**C. Versus (`splitParts(song, seats, { mode: "versus" })`).** One timeline of tiles (same density rules), dealt to the player who has waited longest, with every player getting the same number. The few tiles over are dropped where their loss leaves the smallest hole. Then the k-th tile of every player gets the same kind and the same hold length (the shortest room any of them has). A player's tiles are their own: no beat is on two lists. With one seat it is the same as team. Tests: equal count, equal holds in the same order, equal `maxScore`, for 2, 3 and 4 players on the five required songs plus made-up ones. A scripted perfect run through the real engine scores exactly `maxScore`, and a rival's run scores the same.

`splitParts` keeps its return shape. Notes gained `hold` and, only on tiles made from backing, `bi` (the backing index). New exports in `chart.js`: `backingLeft(song, parts)`, `chartSpan`, `longestWait`, and the named constants.

## Targets reached

Team mode: **no player waits more than 4.0 s between tiles on any of the 17 songs, for 1, 2, 3 and 4 players** (tested, `chartSpan` to the song's end, a hold counted until its tail). Whole team: gaps over 2.5 s are filled wherever the backing has a pitched note that fits. Songs with no backing keep their melody gaps (the longest is 3.7 s).

"Wait" is the longest idle time of the worst player: from the end of one tile to the start of the next, counting the time before the first tile and after the last. Songs measured 8:35 PM. The song files were changing under me (count-in clicks, new backing on several songs), so numbers may move a little.

| song | tiles before | tiles after (1 player) | 1 player wait (s) | 2 players | 3 players | 4 players | holds after (1p / 4p) |
|---|---|---|---|---|---|---|---|
| mary-lamb | 26 | 26 | 0.7 to 1.3 | 4.0 to 4.0 | 5.3 to 3.3 | 6.0 to 2.7 | 12% / 16% |
| row-boat | 27 | 27 | 0.5 to 2.8 | 6.5 to 3.7 | 11.5 to 3.7 | 11.5 to 2.8 | 11% / 16% |
| happy-birthday | 25 | 25 | 0.5 to 1.8 | 5.5 to 3.7 | 10.6 to 3.7 | 10.6 to 3.7 | 16% / 12% |
| london-bridge | 24 | 24 | 0.5 to 1.8 | 5.5 to 3.7 | 6.5 to 3.7 | 10.2 to 3.7 | 17% / 16% |
| more-than-a-feeling | 25 | 25 | 2.2 to 2.2 | 8.8 to 3.9 | 9.0 to 3.9 | 11.9 to 3.9 | 12% / 9% |
| twinkle | 42 | 42 | 0.6 to 0.6 | 5.4 to 3.0 | 7.2 to 3.6 | 8.4 to 3.0 | 14% / 16% |
| frere-jacques | 32 | 32 | 0.5 to 1.8 | 9.2 to 3.7 | 12.9 to 3.7 | 12.9 to 3.7 | 16% / 20% |
| shipping-up-to-boston | 63 | 63 | 0.9 to 0.9 | 7.7 to 2.8 | 8.8 to 3.8 | 15.2 to 3.9 | 0% / 0% |
| greensleeves | 58 | 58 | 0.8 to 1.2 | 4.8 to 3.2 | 6.4 to 4.0 | 9.2 to 3.6 | 5% / 18% |
| saints | 31 | 31 | 1.3 to 3.3 | 6.7 to 4.0 | 13.3 to 4.0 | 13.3 to 2.7 | 13% / 14% |
| fur-elise | 70 | 70 | 0.9 to 1.3 | 5.6 to 3.0 | 9.4 to 3.9 | 9.4 to 2.6 | 11% / 19% |
| take-me-out-to-the-ball-game | 60 | 60 | 0.9 to 1.8 | 7.3 to 3.6 | 8.2 to 3.6 | 14.1 to 3.2 | 12% / 9% |
| jingle-bells | 51 | 51 | 0.5 to 3.7 | 5.5 to 3.7 | 11.1 to 3.7 | 10.6 to 3.7 | 18% / 16% |
| ode-to-joy | 62 | 62 | 0.5 to 1.8 | 8.3 to 3.7 | 11.1 to 3.7 | 14.3 to 3.7 | 19% / 15% |
| sweet-caroline | 36 | 41 | 4.5 to 4.0 | 22.5 to 4.0 | 30.0 to 4.0 | 44.5 to 4.0 | 12% / 13% |
| dirty-water | 94 | 94 | 3.2 to 3.2 | 8.4 to 3.7 | 9.2 to 3.9 | 9.9 to 3.7 | 0% / 0% |
| ship-never-returned | 111 | 111 | 1.2 to 3.6 | 12.6 to 3.6 | 18.6 to 3.6 | 19.2 to 3.6 | 17% / 17% |

"Before" is the old pitch split with the old 800 ms holds. How to read it:
- **Tiles:** a lone player still plays every melody note. Only Sweet Caroline gained tiles for one player (5 from backing), because only its melody gaps exceeded 2.5 s and had a backing note to use. Most songs now have the backing the songs builder added, but their melody gaps were already short. With more players the same song has more tiles in all: Sweet Caroline is 75 moments for 4 players, up from 36, because the tighter gap limit pulls in backing.
- **1 player wait went up on paper** (0.5 to 1.8 and so on). That is the metric, not the song: old holds were long legato notes, so the foot was "busy" until the next tile. Now most tiles are taps, so the time from one tap to the next counts as idle. Tile start to tile start is unchanged.
- **Holds** are 11 to 19% on most songs, under the 20% aim because a hold needs 500 ms of note and 350 ms of room. Shipping Up to Boston and Dirty Water have no note of 500 ms or more, so no holds. Greensleeves has 5% for one player because its notes are short at its tempo.
- **Together tiles** (everyone at once) are 2 to 6 per song for 2 to 4 players, up to 19 on Sweet Caroline with 4 players and 17 on Ship That Never Returned, where the long gaps force them.

Versus (every player the same tiles count and top score, tested): for 2, 3 and 4 players, tiles each and longest wait: Sweet Caroline 25/25/19 tiles, 4.0/3.0/4.0 s. Twinkle 21/14/12, 1.8/2.4/2.4 s. Ode to Joy 31/23/17, 2.8/2.8/3.7 s. Shipping Up to Boston 31/21/15, 1.4/1.9/2.8 s. Ship That Never Returned 61/46/34, 3.0/3.6/4.8 s. **Versus does not always keep the 4 s promise**: Dirty Water 3 and 4 players (4.1, 5.0 s), More Than a Feeling 4 players (4.5 s), Ship That Never Returned 4 players (4.8 s). Every tile goes to one player there, so a player takes every fourth tile, and a song with 1 to 3 s between tiles cannot give 4 players a tile each every 4 s without repeating tiles. Repeating them would break "not the same tiles". Full per-song versus numbers: run the script in the scratchpad or ask me.

## Tests

- `node --test src/game/*.test.js`: 57 tests, all pass. Changed tests, each with its reason:
  - `engine.test.js`: fixtures `tiny`, `holdSong`, `mixed` had 500 ms notes that are now holds (HOLD_MS 500), so their `beats` went from 1 to 0.5 (a tap of 250 ms); `songSeconds(tiny)` 1.5 to 1.25.
  - "a foot already standing on a hold's square starts it as good" became "does not start it: the hold is missed" (rule A).
  - "lifting ends it at once" became "ends it after the grace" (rule A grace). "A hold left after half" runs longer for the same reason.
  - `parts.test.js` is rewritten: the old tests described the pitch split (low on the left, balanced by pitch, seats within two notes of each other, backing unchanged on every part). Those are the old rules.
  - New: standing still through three holds scores nothing; lift, land, stay makes the hold; land then lift early ends it; a tap right after a hold needs a new landing; the one-lane step grace; versus equal counts, holds and `maxScore` for 2, 3, 4 players on five songs; a perfect engine run equals `maxScore`; density, runs, together tiles, holds, the 4 s wait on all songs.
- `npm.cmd test`: 492 tests, 6 fail, 1 todo. None of the 6 is in my files:
  - **3 are mine to flag, in `src/track/seatsource.test.js`** (lines 110, 139, 154: "a bob in place...", "one lane: one foot lifting...", "one lane with the seat-mode detector..."). Their song is `bpm: 60, beats: 0.5`, a 500 ms note, which is a hold under the new 500 ms rule. Fix: `beats: 0.5` to `beats: 0.4` in the three `song` lines. I checked the cause by running them against the engine; I did not edit the file.
  - 1 is `src/app/mock.test.js` ("a phone joins..."): the status is `warmup`, not `countdown`. That is the session builder's warm-up work.
  - 2 are the songs builder's backing tests (greensleeves backing, generated backing).

## Scripted play on the built copy

Built with `npm.cmd run build` (passes). Page `http://localhost:4173/stage.html?seats=2&demo=1&autostart=1&facing=0`, no console errors.
- Screenshots `shots/rules-stage-a-900.png` (0:25) and `shots/rules-stage-b-900.png` (0:22), opened and looked at. In the first, pad 1 has three tiles and pad 2 none (a run of three). In the second, pad 2 has a tall tile (a hold) while pad 1 has three. The tiles move between the pads in runs.
- Mouse held down once on pad 1 and never lifted, 24 s: the score stayed 0 (the only number drawn was the seat label). Control, same page, the mouse clicked every 0.5 s on pad 1 for 12 s: the score read 820. Script: `scratchpad/play.mjs`.
- "No pad is empty for more than 4 s" is shown by the chart test on the data (every part, every song), not by the screenshots.

## Numbers that are guesses

2.5 s team wait, 4 s player wait, 350 ms gap, one tile in 12 together, one tile in five holds, 1 s for the lone player's feet to alternate, 400 ms hold grace, the run lengths 3, 2, 4, 2, 3, 4, 2, and the beat strength weights (kick 3, snare 2, other 0.5). All are named constants at the top of `chart.js` or `engine.js`.

## Needs from others

1. **session/stage (owner: session):** a tile made from a backing note sounds when it is hit, and `synth.backing` also plays that backing entry by itself, so it would sound twice. Give the synth `{ ...song, backing: backingLeft(song, parts) }` (from `chart.js`) instead of the plain song in `main.js` line 229. Until then, hitting a backing tile doubles the note.
2. **src/track/seatsource.test.js (lead):** the three fixtures above, `beats: 0.5` to `0.4`.
3. **render (floor):** a together tile is drawn twice at the same time on two pads, which is right. A `hold` tile is now often shorter than the note; nothing to change.

## Not checked

- Real feet on the real floor: whether a 400 ms grace feels right when the free foot steps, whether runs of 3 or 4 feel like passing a ball, whether a backing tile sounds right next to the melody.
- Sound: nobody listened to a backing tile played with its own pitch.
- The versus screen and the warm-up in session.js (the session builder's).
- No AI call or matcher touched, so no `qa/ai-cases.json` change and no `ai-check` run.
