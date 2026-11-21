# lanes, card X5 (wave 7): fewer lanes

## Done
- `src/game/parts.js`: new `lanesInPad(taken)` (2 for 0 or 1 seat, 1 for 2 or more). `splitParts(song, seats)`: one seat gets the whole song over 2 lanes (lanes 0 and 1, as before). Two to four seats get the balanced keyboard over 2, 3 or 4 lanes, one lane a seat, so every note carries `lane: 0`. The balancing code is unchanged; only the lanes a seat owns went from 2 to `lanesInPad(seats)`.
- `src/stage/session.js`: `loadNext` sets `songLanes = lanesInPad(taken seats)` and gives every engine that count. It is held for the song (a seat released part way does not change it) and read again when the next queued song loads. The State's `layout.lanes` is `lanesInPad(seats taken)` in the lobby and `songLanes` from the song's start until it ends (countdown, playing, paused, results).
- `src/stage/layout.js`: logic unchanged (a stored layout still has 2 lanes, a lone player's pad); comment says where the State's number comes from.
- Feet to lanes needed no change: the engine's `laneAt` with 1 lane puts every foot in lane 0, so either foot landing is a tap; with 2 lanes foot 0 (u 0.25) is lane 0 and foot 1 (u 0.75) is lane 1. Tested through the session.

## How I checked
- `node --test src/game/parts.test.js src/stage/session.test.js src/stage/layout.test.js src/game/engine.test.js`: 125 pass, 0 fail.
- `npm.cmd run build` from PowerShell: built.
- `shots/lanes-demo.png` and `shots/lanes-demo2.png` (opened), `stage.html?demo=1&feet=mouse&autostart=1` at 1280x720: three pads, one lane each, tiles sliding on all three pads over the two shots (no pad has one every instant, which is the music), console errors: none.
- New or rewritten tests:
  - `parts.test.js`: `lanesInPad` for 0 to 4 seats. Every real song and the made-up songs, for 1 to 4 seats: every note on exactly one seat, `lane` below the lanes in a pad (all 0 for 2 to 4 seats), a lone seat uses both lanes 0 and 1, no seat more than 2 notes from another once there are 4 notes a lane. Exact lane for a ladder song on 1 to 4 seats. A repeated note is dealt round the lanes.
  - `session.test.js`: State `layout.lanes` for 0, 1, 2, 3, 4 taken seats and back to 2 when a second seat is released in the lobby. Each engine's lane count for 1 to 4 seats at the start of a song, with every tile inside its lanes and on every pad. Lane count held when a seat is released mid-song and read again at the next song. Either foot taps in a 1-lane pad; foot 0 is lane 0 and foot 1 is lane 1 in a 2-lane pad. Older tests that assumed 2 lanes a pad updated (the `play` helper, the 3-seat pads, the 2-seat layout).
  - `layout.test.js`: only a test title changed.

Notes for each seat, 2 / 3 / 4 seats, every real song (printed by `parts.test.js`):

| song | notes | pitches | 2 seats | 3 seats | 4 seats |
|---|---|---|---|---|---|
| mary-lamb | 26 | 4 | 13/13 | 9/8/9 | 6/7/6/7 |
| row-boat | 27 | 6 | 14/13 | 9/9/9 | 7/7/6/7 |
| happy-birthday | 25 | 8 | 12/13 | 8/9/8 | 6/6/7/6 |
| london-bridge | 24 | 6 | 12/12 | 8/8/8 | 6/6/6/6 |
| more-than-a-feeling | 25 | 7 | 13/12 | 8/8/9 | 6/7/6/6 |
| twinkle | 42 | 6 | 21/21 | 14/14/14 | 11/10/11/10 |
| frere-jacques | 32 | 7 | 16/16 | 11/10/11 | 8/8/8/8 |
| shipping-up-to-boston | 63 | 6 | 32/31 | 21/21/21 | 16/16/15/16 |
| greensleeves | 58 | 9 | 29/29 | 19/20/19 | 15/14/15/14 |
| saints | 31 | 5 | 16/15 | 10/11/10 | 8/8/7/8 |
| fur-elise | 70 | 9 | 35/35 | 23/24/23 | 18/17/17/18 |
| jingle-bells | 51 | 5 | 25/26 | 17/17/17 | 13/13/12/13 |
| ode-to-joy | 62 | 6 | 31/31 | 21/20/21 | 15/16/16/15 |
| sweet-caroline | 36 | 12 | 18/18 | 12/12/12 | 9/9/9/9 |
| dirty-water | 94 | 9 | 47/47 | 31/32/31 | 23/24/24/23 |
| seven-nation-army | 83 | 6 | 41/42 | 28/27/28 | 21/20/21/21 |
| ship-never-returned | 111 | 10 | 55/56 | 37/37/37 | 28/27/28/28 |

Largest gap between seats on any real song: 2 notes (never over). A lone seat is the whole song over 2 lanes.

## Not done
- Nothing from the card.
- Not checked: playing the demo by hand with a mouse in 1-lane pads (the session tests drive the feet for both lane counts); sound was not listened to.

## Needs from others
Every place outside my files that depends on lanes per pad or a note's `lane`. I read them but did not change them.
- `src/game/render.js`: uses `pad.lanes` (lines 239 to 264) and `layout.lanes` (lines 138, 352 to 354). Both are correct because the State's `layout.lanes` follows the seats and the pad's lanes follow the engine, but line 138 (hit flash x, `e.lane` over `layout.lanes`) and the lobby's empty-seat lane animation (352 to 354) are only right while the State's `layout.lanes` matches the song: it does, from the start of a song to its end. The lobby animation now shows 1 lane once two seats are taken, 2 with none or one.
- `src/phone/main.js` (lines 223 to 266): builds the seat picker from `layout.lanes` and caches by `${layout.lanes}:${spot ids}`, so the seat map redraws as seats are taken; the `FALLBACK_LAYOUT` (2 lanes) is only used before the first State. No change needed. `src/phone/` text that says "two lanes" or "one for each foot": none found by search.
- `src/stage/setup.js` (line 547): draws `layout.lanes` lanes in each pad on the setup page from the State's layout, so it shows 1 lane once two seats are taken. If the setup page should always show the pad as a lone player's 2 lanes, it should not read the State.
- `src/stage/main.js` (line 177) and `src/track/seatsource.js`: already take each pad's lanes (`padLanes`, `ONE_LANE_U`). No change needed.
- `src/floor-pilot/`: its own pad drawing already follows the rule.
- `PLAN.md` "Wave 3b" and `docs/HOW-IT-WORKS.md` still say every pad has 2 lanes. The lead should change them.
- `qa/e2e/*`: anything that taps `(n.lane + 0.5) / 2` for every note is wrong with two or more seats; use the pad's `lanes` from the State.

## Calls I made
- `layout.lanes` of a stored layout stays 2 (the setup page and `pp:layout` save the layout, and 2 is a lone player's pad); the session overrides it only in the State's snapshot.
- `lanesInPad` lives in `parts.js` (game logic) and `session.js` imports it, so the rule is written once.
- With zero seats taken in the lobby the State says 2 lanes (the rule: "2 with zero or one seat").
- Left out: nothing added beyond the card.
