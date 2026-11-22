# floor-2: warm-up, duel, four seats, sound banner, holds

## Done
- `src/game/floor-warmup.js` (new): the warm-up screen. "Tap your foot 4 times" across the top, a thin bar for the time left of `maxMs`. At each taken seat's pad: 4 dots that fill as taps arrive (new dot pops), the foot zone flashes white on every `beatMs`, the next dot breathes on the same beat, a tick and a seat-colour flood when `ready`, "Lift your foot higher" on a white plate in the last 6 s. Seats nobody took are not drawn. A pause that began in the warm-up keeps drawing it, frozen.
- `src/game/floor-duel.js` (new): in a duel each player's score on a plate in their seat colour, flush with the far end of their lane (tiles come out from under it). Counts up, bumps on each hit, the leader's plate has a butter-yellow ring (ink outside, gold inside).
- `src/game/floor-screens.js`: duel header ("Duel" and a gold "1v1", "1v1v1" or "1v1v1v1"; team keeps "Team" and its score). Duel results ranked by `rank` (ties share a rank), gold "Winner" tag on the winner's row, "Tie" plate and "Tie" tags when `winner` is null, no grade card, no bonus tags. Lobby: a white "Team" or "Duel" plate beside the train line, free seats say "Open" and are quieter. `drawSoundBanner`, `litLanes` exported.
- `src/game/tiles.js`: `draw` split into `paint`; only taken seats get a pad (the old grey "Seat N" boxes are gone); warm-up, duel plates and the sound banner wired in. Holds: full length, ring at the head, line and bar at the tail; held = seat colour with ink marks; missed = dull with a cross near its far end.
- `src/game/floor-look.js`: `isDuel(view)`, `matchup(n)`. `src/game/floor-look.test.js` (new): 3 tests (isDuel, matchup, litLanes).

## How I checked
- Built copy at http://localhost:4173, puppeteer plus a raw `ws` phone (join, claim, mode, start). Screenshots in `shots/floor-2/`, each with a `-900.png` copy; I opened these: `lobby-900`, `lobby-duel-900`, `sound-lobby-900`, `warmup-half-900` (seats 2 and 4 of four, one ready), `warmup-late` (seat 2 not ready, "Lift your foot higher"), `duel-900` (200 vs 0, leader ring), `duel-red` (Red, three seats, 1v1v1), `warmup-half-blue-facing` (Blue, `facing=1`, upside down), `results-versus-win` (1280), `results-versus-tie-900`, `hold-waiting`, `hold-held-900`, `hold-missed`, `pause-warmup`, `stress-2-shown`, `stress-3-resized`.
- Seats 2 and 4 taken out of four: before, the song drew grey "Seat 1" and "Seat 3" boxes and the warm-up nothing at all (`play-base.png`, `lobby-base.png`). Now only pads 2 and 4 exist, each at its real place.
- Tab hidden 3 s then shown, a resize to 1000x600 and back: dots, bar and pads identical, nothing doubled (`stress-*`). A paused warm-up: two frames 1.5 s apart differ by 0.0000.
- Motion in the warm-up: two frames 300 ms apart differ in 7.4% of pixels.
- No console errors in any run. `npm.cmd test`: 506 pass, 0 fail, 1 skipped, 1 todo (not mine). `npm.cmd run build` passes.

## Not checked
- A real projector, real feet, whether the scores read from a seat across the floor.
- The "Winner" screen at 900 px (I opened the 1280 one). Four-seat duel (checked 2 and 3 players). A lone player's warm-up with 2 lanes.
- A real tracker's warm-up taps: all taps were the mouse.
- The beat pulse is timed from `performance.now()`, but `startedAtMs` is on the stage clock, which runs `offsetMs` behind. The pulse is early by that lag (about 120 ms by default). Not measured on the floor.
- The link relay is shared with other builders' stages, so the `state` my script read was sometimes another stage's. The screenshots are of my own page.

## Needs from others
- Lead (`src/stage/main.js`): add `clockOffsetMs: session.offsetMs()` to the `draw({...})` view if you want the beat pulse and time bar exact; `floor-warmup.js` then subtracts it from `now`. Optional.

## Calls I made
- Plate text uses the seat's text colour: ink on three seat colours, white on cap blue (ink on cap blue is about 3.3:1).
- The sound banner sits where the train line is in the lobby (the QR code stays clear; the mode plate and train line are hidden until sound is on) and across the middle of the picture in every other status.
- Mascot in the lobby is 8% smaller so "Open" under the third seat clears its tentacles.
- A duel's header and results show only when at least two seats are left; with one seat left the team screens show.
- Hold marks shrink on short holds so head and tail both show; a hold slab whose tail was cut short by the next tile shows the cut end.
