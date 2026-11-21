# autofit: the software fits the lines to the people

Step 4 now has a "Fit to the people" button. It runs by itself the first time step 4 opens for a seat count with no saved lines. Lines then follow the people slowly. Facing addition (6:25 PM) is built too.

## Done
- `src/track/slices.js` (pure, tested):
  - `fitBounds(hipXs, { n, minSlice, current })`: dividers half way between neighbours' hips. Outer edges beyond the outer hips by half the gap, at least `OUTER_MIN` 0.08. One person: `LONE_HALF` 0.15 each side. A null hip keeps that seat's current lines. A hip that does not rise past the one before it counts as missing (the same person seen twice). Always inside 0 to 1, at least `MIN_SLICE` apart, never past a seen person's hips.
  - Real numbers (hips 0.40 and 0.545): divider 0.4725 (hand-dragged was 0.4674), edges 0.32 and 0.625. Feet at 0.33 to 0.39 and 0.515 to 0.60 are inside.
  - `assignHips` (fewer people found than seats: each goes to the seat whose slice is nearest), `easeBounds`, `seenHips`.
- `src/track/seats.js`: `findHips(source, n)`, the one-off finder (see measurements). Not in the per-frame loop.
- `src/track/seatsource.js`: `fit()`, `needsFit()`, `following()`, `setFollow(on, remember)`. Following runs inside `bySpot` every 100 ms, so it works in setup and in play with no wiring. It uses each seat's own `hipX`, and a pose dropped as a neighbour's counts as no hip.
  - Following moves a divider at most 0.02 of the picture a second, and not at all within 0.01 of its fit. The fit never puts a divider past a neighbour's hip.
  - Until the lines were fitted, dragged or loaded from a save, following moves them for the session only and writes nothing. That keeps "no saved lines" meaning "never fitted". After that every change is saved in `seats:slices:<n>`. The toggle is saved as `seats:follow`.
- `src/stage/setup.js`, step 4: "Fit to the people" (main button, "Finding people..." while it works), "Follow people" toggle (on by default, saved). Dragging a line turns following off for the session, not saved, and a line of text says so. A line under the buttons says "Found all 3 people in 0.9 s." or "Found 2 of 3 people...". A recording shows none of this (its lines are fixed).
- Facing (the lead's addition): `makeSlices` reverses the spot order when `isFacing()`, so the canvas-left pad gets the rightmost slice (bounds stay in camera order). `laneOf` flips for a lone player; Swap feet flips it back. The step 4 numbers follow because they come from the slices. Straighten has the switch "The projector faces the players" with its line under it. It calls `setFacing`, `applyKeystone`, and `feet.setLayout(current)`, which cuts the slices again (and clears the tap log if seats changed places) with no reload. `fieldAt` uses `turned(...)`.
- `src/stage/setup.css`: `.setup-note`.

## Measured (headless Edge, GPU, this busy laptop; other builders were running browsers)
Finding people, `findHips`, one pass each, run twice:

| picture | people | whole frame, numPoses n at 0.3 | after the scan |
|---|---|---|---|
| two.png | 2 | 2 | not needed |
| three.png | 3 | 3 | not needed |
| four.png | 4 | **0** | 4 |
| close2 | 2 | 2 | not needed |
| close3 | 3 | 2 | 3 |
| close4 | 4 | 4 | not needed |

- So the whole-frame pass works at 0.3 on most pictures but fails on four.png (0 found) and close3 (2 of 3). The scan (the same model on 0.4-wide windows every 0.2, distinct hips kept) finds all of them. It runs only when the whole pass finds fewer than n. Both are in `findHips`: whole first, scan as the rescue.
- Time, whole `findHips`: 0.8 to 1.4 s, nearly all of it making the model (a cold first start was 6.7 s). The scan adds almost nothing. In the stage with 3 trackers also running, the button took 0.6 s (2 people), 0.8 to 0.9 s (3 people), 2.9 s (4 people).
- In setup on `?feet=seats&seats=3&src=/qa/seats/three.png`, nothing saved: Step 4 fitted by itself in 0.9 s, lines `[0, 0.317, 0.655, 1]`, every seat "Person found, 2 feet." Same on two.png (2 seats) and four.png (4 seats). From a bad saved cut `[0, 0.1, 0.9, 1]` (rows read "No person found", "Person found", "No person found") the button gave all three "Person found, 2 feet." in 0.8 s.
- With `pp:facing=1` on three.png: rows read 3, 2, 1 left to right. The person on the picture's left carries seat 3, whose pad is the canvas-right pad before the turn. Turning the switch in Straighten with no reload flipped step 4 to 3, 2, 1.
- Does following create taps? A bounds change moves where the model looks, so the model's foot y changes a little. On three.png I moved the dividers by 0.02 and 0.04 and read the feet again: y changed by up to 0.011. Resting noise is about the same (a pass with no change moved one foot 0.008). That is below the tap threshold (median 0.017 in the real recording, floor 0.012), and one follow step moves a divider about 0.002, so it is a tiny share of that. An instant fit (the button) is a bigger jump than following: press it in setup, not mid-song.

## Checks
- `node --test src/track/slices.test.js src/track/seatsource.test.js src/track/seats.test.js src/track/taps.test.js`: 86 tests, 85 pass, 1 `todo` (taps, known). New: fit (real numbers, edges, lone, missing, invariants, same-person hips), assign, follow (rate, dead zone, a person walking toward the neighbour never drags the divider past the neighbour's hip), facing in `makeSlices` and `laneOf`.
- `npm.cmd run build` from PowerShell passes.
- Puppeteer runs above, no console errors. Dragged line: text "Following is off for now because you moved a line..." and the toggle shows off.
- Shots (900 px copies, all opened): `shots/autofit-three-fit-900.png`, `shots/autofit-facing-4-900.png` (step 4 with facing on), `shots/autofit-four-fit-900.png`, `shots/autofit-bad-before-900.png` and `-bad-after-900.png`. `shots/autofit-dragged.png` is full size and not opened.

## Not checked
- Anything on the real camera with real people: the fit with a person behind a table, a lean toward a neighbour in live video, whether following feels too slow or too fast (0.02 a second is a guess), whether `OUTER_MIN` 0.08 and `LONE_HALF` 0.15 are right at the real distance (guesses; the one real recording says 0.07 from hip to foot).
- Facing on the real floor: only the geometry on a still picture. The default lone-foot lane with facing is by the lead's reasoning, not tested with a person.
- No `/web-interface-guidelines` run, same as before: the new controls reuse the existing buttons and tokens.

## Left out
- Nothing in the per-frame loop changed. Fit by video frames over time (averaging several frames) was not built.
- A fit when fewer people than seats are found places only the seen ones and keeps the others' lines.
- `seats.html` does not follow or fit (the card named setup and the stage).

## Needs from others
- Nothing. `src/stage/main.js` is untouched.

## Calls I made
- Following only saves after a fit, a drag or an earlier save, so a reload does not leave half-moved lines that count as "fitted".
- Straighten's switch is shown for every feet source, not only seated, because the keystone turn affects all of them.
