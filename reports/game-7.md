# game-7, card X3 (wave 3b)

## Done
- `src/game/parts.js`: `splitParts(song, seats)` is now a balanced one-keyboard split (lead's call after the first table). With n seats there are 2n lanes laid out low to high; each pitch takes a width equal to its share of the notes. A pitch inside one lane sends all its notes there; a pitch that crosses lanes shares its notes in proportion to its width in each, by smooth weighted round robin in time order (a lone note goes to the lane with most of its width). Seat = `floor(lane / 2)`, and each note carries `lane` 0 or 1 for its pad. It no longer uses `laneOf`. `phrasesOf` and all the phrase rules are deleted. `engine.js`: a note's own `lane` wins, else `laneOf`; a part with no notes has grade null (not "C").
- `src/stage/layout.js`: always 2 lanes (`LANES`), `makeLayout({ seats })`, no posture, `postures` or `lanesFor`. `isLayout` is replaced by `asLayout(x)`: a clean 2-lane copy or null, so a saved layout with a posture or 3 or 4 lanes loads as 2 lanes with the same pads.
- `src/stage/session.js`: seats, not people. `phones` (clientId, last heard) and `owner` (spotId to clientId). No names, no `waitMs`. `claim` adds and never moves, `release` frees one seat ("That seat is not yours." for a seat that is not the phone's), `leave` and the 10 second rule free all of a phone's seats, `restore` takes `[{ clientId, spotId }]`. `players` has one entry per taken seat. Every seat plays the whole song at once.
- `src/stage/setup.js`: the Sitting or Standing row and its texts are gone; the seat count button for the same count keeps the pads. `src/stage/main.js` (3 small edits): `pp:players` saves `{ clientId, spotId }`, demo guests join without names, `GUESTS` removed.

## How I checked
- `node --test src/game/parts.test.js src/game/engine.test.js src/stage/layout.test.js src/stage/session.test.js`: 106 pass, 0 fail. `npm.cmd run build` from PowerShell passes.
- New tests: every note on exactly one seat and one of 2 lanes with 1 to 4 seats (all real songs); "a lower pitch's rightmost lane is never right of a higher pitch's leftmost lane" (true as built); with at least 4 notes for each lane no lane has more than twice the average, and no seat is empty when notes >= lanes (all real songs and made-up ones); a repeated note alternates between feet; a pitch played more takes more width; no empty seat when pitches >= lanes; one phone holds three seats and all three hit; release keeps the others; a silent phone loses all its seats; another phone cannot take or release a seat that is not its own; old saved layouts and old `pp:players` saves load.
- `stage.html?demo=1&feet=mouse&autostart=1`: `shots/game-7-play.png` and `shots/game-7-play2.png` (opened): three pads of 2 lanes with different tiles at once, no console errors. One raw-link phone holding seats 1 to 3 (`shots/game-7-onephone.png`, opened): totals 12/16/14 for Twinkle, release of seat 2 mid-song left `[1,3]` and team total 42 to 26. Setup (key C) seats step opened: 2 lanes per pad, no posture buttons, `pp:layout` has no posture.

Notes per seat after the balanced keyboard (the table the test prints), 2 / 3 / 4 seats:

| song | notes | pitches | 2 seats | 3 seats | 4 seats |
|---|---|---|---|---|---|
| mary-lamb | 26 | 4 | 13/13 | 9/9/8 | 7/6/6/7 |
| row-boat | 27 | 6 | 14/13 | 9/9/9 | 7/7/6/7 |
| happy-birthday | 25 | 8 | 12/13 | 8/9/8 | 6/6/7/6 |
| london-bridge | 24 | 6 | 12/12 | 8/8/8 | 6/6/6/6 |
| more-than-a-feeling | 25 | 7 | 13/12 | 8/8/9 | 6/7/6/6 |
| twinkle | 42 | 6 | 21/21 | 14/14/14 | 11/10/11/10 |
| frere-jacques | 32 | 7 | 16/16 | 11/10/11 | 8/8/8/8 |
| shipping-up-to-boston | 63 | 6 | 32/31 | 21/21/21 | 16/16/15/16 |
| greensleeves | 58 | 9 | 29/29 | 19/20/19 | 15/14/15/14 |
| saints | 31 | 5 | 16/15 | 10/11/10 | 8/7/8/8 |
| fur-elise | 70 | 9 | 35/35 | 23/24/23 | 18/17/17/18 |
| jingle-bells | 51 | 5 | 26/25 | 17/17/17 | 13/13/12/13 |
| ode-to-joy | 62 | 6 | 31/31 | 21/20/21 | 16/15/15/16 |
| sweet-caroline | 36 | 12 | 18/18 | 12/12/12 | 9/9/9/9 |
| dirty-water | 94 | 9 | 47/47 | 31/32/31 | 24/23/24/23 |
| seven-nation-army | 83 | 6 | 41/42 | 28/27/28 | 21/20/21/21 |
| ship-never-returned | 111 | 10 | 55/56 | 37/37/37 | 28/27/28/28 |
## Not done
- Nothing from the card. The phone page, `render.js` and the qa scripts still use the old shapes (see below); I did not touch them.
- `node qa/e2e/*` scripts were not run: they drive the old phone page.

## Needs from others
- **Lopsided seats: fixed** with the balanced keyboard (the lead's instruction); the first table (mary-lamb 3/21/2) is gone. `session.test.js` had numbers tied to the old split (tiny now splits 2/1, a single note goes to seat 1); I updated those lines in my own test file, no logic changed.
- **phone-4 (`src/phone/`):** `main.js` sends `join` with `name` (the stage now ignores it) and reads `p.name`; `play.js` line 119 shows `p.name`; `mock.js` and `settings.js` still send and use `posture` (`makeLayout({ posture })` still works, the stage ignores the posture and `layout` messages without one are fine). A phone that holds several seats shows up once per seat in `players`, and `release` needs its own button. The refusal text for a command from a phone that has not joined is now "Join before you use the controls."
- **floor-1 (`src/game/render.js`):** `layout.lanes` is always 2 and `players` has no `name`; line 369 already guards `player?.name`, so any name drawing there can go. Several pads can share one `clientId`.
- **tester (`qa/e2e/*.mjs`):** they read `p.name` and `layout.posture` and click the old name form; they need updating after the phone is rebuilt.
- **lead:** PLAN.md "Messages from a phone" (join with name, `posture` in `layout`) and `docs/HOW-IT-WORKS.md` still describe the old shapes.

## Calls I made
- `join` is idempotent and needs only a clientId. A phone with no seat is not in `players`, so `pp:players` no longer saves seatless phones; after a stage reload such a phone must join again before its next command.
- `layout` still accepts a message that carries `posture` (ignored), so an older phone page keeps working until phone-4 lands.
- `release` mid-song is allowed: the seat is freed and its part is dropped, like a phone leaving. `claim` mid-song is still refused.
- A seat whose part has no notes is done at once and shows no grade; the team grade is still given once every seat is done.
- Left out: a cap on seats per phone (a phone may hold all 4).
