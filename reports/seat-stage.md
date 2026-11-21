# seat-stage, card T8

## Done
- `src/track/seatsource.js`: `createSeatSource({ video, src, layout, model, perFrame })` returns `{ start, stop, fps, ready, bySpot }`.
  - Slices: one equal slice for each pad, left to right by the pad's place on the floor, across the saved edges (`seats:edges`, same validation as seats.html: bad or missing edges use the whole picture).
  - It runs `createSeatFeet` then `createTapDetector`. `bySpot(lanes)` gives `{ [spotId]: [{ u, v, lifted }] }`, every pad in the layout present, empty when its feet are not seen. `v` is 0.8. A foot the tracker loses is left out, so the engine's 150 ms wait still applies to it.
  - New rule (Nicolo, 5:25 PM): `lanes` is `{ [spotId]: lanes in that pad }`, 2 when unknown. With 2 lanes foot 0 is `u` 0.25 and foot 1 is 0.75, swapped for a seat in `pp:seat-swap` (an array of spot ids). With 1 lane both feet are `u` 0.5 and the swap does nothing. `lifted` is kept, so with both feet on one square one foot lifting and landing is an arrival.
  - `video` is optional. With none, it makes one, puts it on the page for good (fixed, 2 px, opacity 0.01, never moved, hidden with `display: none`, or removed, and re-played if paused) and opens `src` (a video file, looped) or the camera saved by seats.html (`seats:camera`, first camera if that one is unplugged). Every failure carries its plain reason (no camera, blocked, in use, bad video address, missing model).
  - `fps()` is the slowest seat's frames a second. `ready()` is `{ camera, calibrated: true }` (no field map is used).
  - Also exported and tested: `makeSlices`, `padFeet` (the pure part), `glowFeet`.
- `src/track/seatsource.test.js`: 11 tests. Slices (equal, by floor order, bad edges), lanes and `lifted`, the swap for named pads only, one lane and two lanes, a lone foot, an unknown seat dropped, the glow, and two runs through the real tap detector and engine (a bob in place hits one tap tile with 2 lanes and with 1 lane; a foot resting all song hits nothing).
- `src/stage/main.js` (small edits): `?feet=seats` picks the source (`?src=`, `?model=`, `?perframe=N` are passed on). In `frame()` a source with `bySpot` hands it straight to `session.tick` (lanes from the previous frame's `view.pads`, one frame behind at a song start); other sources are unchanged and `read()` is still called once. The floor glow for this source is drawn by `glowFeet` at the pad's lane for each foot that is down. The pad's own lit lane now ignores lifted feet (no effect on mouse or camera feet, which have no `lifted`). The failure path opens setup only for a source with a picture to line up (`feetSource.raw`, the camera map), so a seated source's real reason shows on the stage. `render.js` is untouched.

## How I checked
- `node --test src/track/seatsource.test.js`: 11 pass. Build from PowerShell passes.
- `stage.html?demo=1&feet=seats&src=/qa/seats/bob.mp4&autostart=1`, three seats, headless Edge, 45 s, State read from the page's WebSocket sends: no console errors. Seat 2 (the person is in the middle slice) went from 0 to 200 points with 4 goods, combo rising to 2 then resetting on misses, all as the person bobbed. Seats 1 and 3 (empty slices) only collected misses. Shot opened: `shots/seat-stage-12.png` (three pads, pink glow at the middle of seat 2's pad while the foot is down; the pads show one lane each, which is the new rule) and `shots/seat-stage-20.png` (countdown). 1280x720 shots; I read 900 px copies.
- `?feet=mouse&demo=1&autostart=1` still plays, State changes, no errors.
- `?feet=seats&src=/qa/seats/nope.mp4` and `?feet=seats` with no camera in headless show the plain reason on the stage (opened both).

## Left out, and what only a real camera can prove
- Taps are not passed separately: `lifted` going false is the landing and the engine reads that, so the "taps" list is not needed.
- The slices are read once at start. Changing the layout's seat count or the edges in seats.html needs a stage reload. Nothing here writes `pp:seat-swap`; no screen sets it yet.
- Hits in the video run were all "good", none "perfect": the video's bobbing is not timed to the tiles, so this says nothing about timing accuracy.
- Not measured: how fast three or four slices run on the real laptop with the GPU while the game draws (`?perframe=N` is there if it is slow); whether the real DJI at the real height gives clean lifts (the tap numbers come from one recording); the real lag of the pose model against the tiles (setup's offset still applies).
- Some headless screenshots came out fully black (about one in four); the ones kept are not.
- `reports/seats-track.md` did not exist when I started; I worked from `seats.js` and `seats-debug.js` directly.
- `makeSlices` and `cameraReason` exist as private copies in `seats-debug.js`, `debug.js` and `tracked.js`; they are not exported and those files are outside this card, so I kept short copies.
