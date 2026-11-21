# game-2, card G2

## Done
- `src/game/engine.js`: rebuilt to "Play rules". Tap tiles need a foot to arrive (steady foot count in the square goes up), within 300 ms good and 120 ms perfect. Hold tiles (0.8 s or longer) start on arrival or on a foot already standing at the tile's time (good), finish by staying to 150 ms before the tail, good if left after half, miss if left sooner. 150 ms flicker rule, combo, x1/x2/x3/x4 at 10/25/50, score, grade bands, and the full Engine output shape. Pure logic. Also exports `multiplierFor` and `gradeFor`.
- `src/game/engine.test.js`: 22 tests, one or more per rule in the card (arrival perfect and good, standing foot, one arrival one tile, second foot, flicker under and over 150 ms, hold complete, half, early, standing start, unstarted hold, multiplier steps, score sum, reset on miss, grade bands, song end).
- `src/track/mouse.js`: foot is down only while the button is held. A click shorter than one frame is still shown for one read.
- `src/game/synth.js`: `noteOn(midi)` returns a function that fades the note out.
- `src/game/render.js`, `src/stage/main.js`: smallest changes. Hold tile drawn from `vTail` to `v` (head stays on the line while held, lit); score and combo shown (with the multiplier from x2); sounds from `events`; results screen shows grade and score.

## How I checked
- `node --test src/game/engine.test.js`: 22 pass. `npm.cmd run build`: passes.
- Scripted a real browser run at 1280x720 (scratchpad `play.mjs`): clicked six tap tiles, then held the button on the hold tile through its tail. Shots (read at 896 px): `shots/game-2-approach.png` (hold tile sliding in, combo 4), `shots/game-2-hold.png` (hold lit on the line, 600 and combo 6), `shots/game-2-after.png` (hold completed: 740, so 600 plus 140). Second run with the mouse resting on lanes and no click: `shots/game-2-rest.png` shows 0 and combo 0. I opened all four.
- Console: only the `/favicon.ico` 404 that game-1 reported.
- Not checked: sound by ear. `noteOn` ran without errors in the hold run, but I cannot hear it. Nicolo should hold a hold tile and listen for the note ringing and stopping.

## Not done
- No look polish, as the card says. The idle screen text is unchanged.
- `?feet=` other than mouse still gets the mouse (unchanged from G1).

## Needs from others
- None. A favicon is still missing (no page owns one).

## Calls I made
- Score uses the multiplier after the hit adds to the combo, so the 10th hit already scores x2.
- A hold is judged when it ends, not when it starts: completing it adds the grade's points plus 20 per beat, leaving after half adds good points only (no per-beat bonus), leaving early is a miss. Its start gives sound and a flash only.
- Events: a hold ends with `holdEnd`, and an early leave also sends `miss` so the thud and combo reset have one trigger. An expired tile sends `miss` with the lane centre as `u`.
- Where several tiles are in reach, an arrival takes the nearest, and the earlier one on a tie.
- `grade` in the output is null until the song is done.
