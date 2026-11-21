# tracker-2 report, card T2

## Done
- `src/track/homography.js`: `solve(from, to)`, `apply(m, point)`, `invert(m)`. A matrix is a flat array of 9 numbers in row order (so it saves to localStorage as plain JSON). `solve` builds the 8 by 8 system and runs Gaussian elimination with the largest pivot, no package. It throws a plain sentence ("Three of the camera points are in a line. Click four different corners...") when any three of the four points are in a line, when two points are the same, or when there are not four points with numeric x and y. It checks both the camera points and the field points. `apply` returns `null` for a point on the horizon of the view (no place on the field).
- `src/track/pipeline.js`: `createPipeline({ cameraToField, smoothing = 0.5, holdMs = 150, minConfidence = 0.5 })` with `update(nowMs, cameraFeet)` returning `[{ u, v }]` and `setMatrix(m)`.
- Both test files next to them.

## How I checked
- `node --test src/track/homography.test.js src/track/pipeline.test.js`: 18 tests, 18 pass, 0 fail. Covered: four corners map exactly; the crossing of the camera quad's diagonals maps to (0.5, 0.5); a known matrix written out by hand is recovered at four points not given to `solve`; `invert` undoes `apply`; collinear, repeated, wrong-count and non-number points throw; smoothing moves halfway; a foot missing 100 ms is returned and gone at 200 ms; a foot back inside the hold keeps its smoothing; two feet that swap sides while listed in alternating order keep their own histories; a foot more than a fifth away is a new foot; far-outside feet dropped and a foot 0.4 out kept; `setMatrix` keeps the tracked foot; low confidence dropped; null and NaN input never throws.
- No UI, so no screenshot or phone check. Did not run the other suites.

## Not done
- Nothing wired into `stage/main.js` or the camera. Not run on real camera feet.
- Left out on purpose: calibration clicks, saving the matrix, per-foot ids in the output, any use of `person`.

## Needs from others
- None.

## Calls I made
- **smoothing** is the share of the old position kept: `new = old * smoothing + raw * (1 - smoothing)`. 0 follows the camera exactly, 0.5 moves halfway.
- **Tracking and smoothing happen in camera coordinates**, and the matrix is applied last. That is why `setMatrix` loses nothing, and the "fifth of the picture" match distance is in camera units as the card says.
- **Matching** pairs the closest new and tracked feet first, each used once, ignoring `person` (the model can renumber people). Output order is the order feet were first seen, so a consumer can follow a foot by index while none drop. Feet dropped for being far outside the field are still tracked, just not returned.
- **minConfidence**: `camera.js` already filters at 0.5 and gives no confidence number, so the setting only acts on a foot that carries a `confidence` field. A foot without one is kept. If you want it to do more, camera.js (tracker-1's file) would have to pass the visibility through.
- **Hold edge**: a foot is dropped when `nowMs - lastSeen > holdMs`, so at exactly 150 ms it is still returned.
- "Line" tolerance: three points count as in a line when the sine of the angle at the middle point is under 0.001, measured relative to the distances, so it works in camera units or pixels.
- The lean-code hook warned that `make` exists in `camera.js`. That is a private helper inside `createCameraFeet`; my `make` is a local test helper in `pipeline.test.js`. No clash.
