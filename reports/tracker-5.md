# tracker-5, card T5

## Done
- `src/stage/lag.js`: `measureLag(beatTimes, arrivalTimes)` gives `{ offsetMs, used }` (first two beats ignored, nearest step within 400 ms, one step for one beat, median, clamped 0 to 400, rounded to 10, null under four steps). Also `createArrivals()`, the "count of feet in the square went up" detector with the 150 ms gone rule. `lag.test.js`: 13 tests.
- `src/stage/setup.js`: two new steps, so the order is Camera, Straighten, Show the camera the field, **Place the seats**, Foot check, **Lag test** (counter reads 1 to 6).
  - Seats: Sitting or Standing, seat count 1 to 4, "Space them evenly", pads drawn through the keystone in Seat colours with numbers, lane stripes, live foot dots on top and a line "N feet seen, M inside a pad". Drag a pad to move it, drag its corner to resize it, arrow keys do the same for the focused pad or grip (Shift is bigger). Pads stay inside the field and at least a tenth across and down. Each change goes to `setLayout`; a refusal shows "A song is playing, so the seats cannot change now. Stop the song, then try again." and the pad does not move.
  - Lag: a big square in the middle, eight clicks 600 ms apart after a 1.5 s lead, a ring closing onto the square as each click sounds, the square lights when a step is seen. Result "You step about 170 ms after the click. Saved." goes to `setOffset`; under four steps "I only saw 2 steps. Stand where the camera sees your feet and try again."; Skip closes setup and keeps the value. The panel moves to the left for this step so it does not cover the square.
  - Mouse: with a source that has no camera (`?feet=mouse`) setup skips the two camera steps and reads the mouse on the field, so a click is a foot arriving.
- `src/stage/setup.css`: pads, grip, option buttons, side panel. Tokens only.
- `src/stage/main.js` (two small edits): `apply` split into `apply` and `publish` (so a layout set from setup also saves `pp:layout` and goes to the phones), and `setup()` now passes `layout`, `offsetMs`, `setLayout` and `setOffset`.

## How I checked
- `node --test src/stage/lag.test.js`: 13 pass. `npm.cmd run build`: passes.
- Puppeteer on `stage.html?feet=mouse&demo=1` (1280x720) with a `ws` client on the link: pressed C, dragged a corner, Next. Chose Standing and 4 seats: `pp:layout` and the State both showed standing, 4 spots. Dragged pad 4 (it moved and the State matched). Dragged pad 1's corner far past the limit: it stopped at 0.1 by 0.1. Arrow keys moved pad 2 by 0.02. A mouse press inside pad 2 showed "1 foot seen, 1 inside a pad". "Space them evenly" restored even spacing. While a `start` was running, Sitting was refused with the sentence above and the layout stayed standing; after `stop` it worked. Lag: clicked the square 140 ms after each click, the result was 160 to 190 ms (the rest is the script's own delay), `settings.offsetMs` in the State went from 120 to that value. A run with only two steps showed "I only saw 2 steps..." and the offset stayed. No console errors in either run.
- Puppeteer on `stage.html?feet=camera&replay=/qa/feet/still.json&demo=1`: all six steps reached in order, seats step showed "2 feet seen, 2 inside a pad", last button reads Done. No console errors.
- Opened: `shots/tracker-5-2-seats-three.png`, `-2-seats-four.png`, `-2-seats-tiny.png`, `tracker-5-camera-seats.png`, `-4-lag-running.png`, `-4-lag-fewsteps.png`.

## Not done
- Not heard by ear: the click sound (a 1000 Hz beep, 80 ms). Not tried with the real DJI or projector, so the lag number on real hardware is untested.
- Not opened: `tracker-5-1-straighten.png`, `-3-foot-check.png`, `-4-lag-start.png`, `-4-lag-result.png`, `-2-seats-refused.png` (their text was checked in the script).
- Left out: no way to reset a layout to the seated default except "Space them evenly"; the foot dots in the seats step do not say which seat a foot is in beyond the count.

## Needs from others
- Nobody. `PLAN.md` card T3 still shows the old `openSetup({ stage, onClose })` shape; the lead may want to update that line.

## Calls I made
- A stage source with no camera skips steps Camera and Show the camera the field. Before, `?feet=mouse` plus C opened its own camera, which a mouse setup cannot use. It still opens setup.
- Changing Sitting or Standing keeps the pads where they are (only the lanes change). Changing the seat count spaces them evenly again, so a new pad never lands on another.
- A step is counted for one beat only once; the first two beats still take their nearest step so a late step for them cannot be counted again for beat 3.
- Pad drags work through window listeners, not pointer capture, because the mouse stand-in captures the pointer on the field. Under a strong keystone the mouse stand-in is approximate (it uses the field's bounding box, like the stage's own mouse mode); pad dragging is exact (it undoes the keystone).
- The lag square is 40 percent of the field's height, centred at 55 percent down.
- `setLayout` returns false for a broken layout too; the message only names the song because setup never builds a broken one.
