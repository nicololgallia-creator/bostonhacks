# tracker-3 report, card T3

## Done
- `src/stage/keystone.js`: `matrix3dFor(corners, width, height)`, `applyKeystone(element)` (also re-applies on window resize, so F for full screen keeps it), `loadCalibration()`, `saveCalibration(changes)` (merges, so `saveCalibration({ corners })` keeps the camera and map). Saved as `pp:calibration`; each part is checked on its own and falls back alone. Test file `keystone.test.js`, 8 tests.
- `src/track/tracked.js`: `createTrackedFeet({ model })` with `start()` (safe to call twice, retries after a failure), `read()`, `fps()`, `stop()`, `ready()`. Extras for setup: `video`, `raw()` (camera feet before the map), `reload()` (picks up a new camera or map without a restart). `?replay=` uses `createReplay`. A camera that is gone is replaced by the first one and its saved map is dropped.
- `src/stage/setup.js` and `setup.css`: four steps (Camera, Straighten the picture, Show the camera the field, Foot check), one on screen at a time, step counter, one instruction, Back and Next, Next off until the step worked. Also a "Close setup" button.
- Wired in `src/stage/main.js` (game-5's report exists): `applyKeystone(canvas)` at start, C key and the session's `calibrate` event open setup, `?feet=camera` uses `createTrackedFeet`, `session.setReady` is called after start and when setup closes. A camera that will not start opens setup by itself, whose first step shows the reason.

## How I checked
- `node --test src/stage/keystone.test.js`: 8 pass. `npm.cmd run build`: passes (also a library build of `setup.js` alone).
- Scripted walk of all four steps with puppeteer, twice: with Chrome's fake camera and with `?replay=/qa/feet/still.json`. Dragged corners with the mouse, nudged with arrows and Shift, clicked three marks in a line (the plain-words error showed, Next stayed off), pressed Redo, clicked four marks, reached the foot check (replay: two glowing dots at the feet), Back and Next worked, Done closed. `pp:calibration` held `cameraId`, `corners` and `cameraToField`. No console errors.
- Wired stage (fake camera, `?feet=camera&demo=1`): a second WebSocket client sent `calibrate` and setup opened; P pressed under setup did nothing to the game; after Done the State's `ready` was `{ camera: true, calibrated: true }`; reload kept the keystone. No camera permission: setup opened alone with "The browser blocked the camera. Click the camera icon in the address bar, choose Allow, and reload." `?feet=mouse` plus C also opens setup.
- Shots at 1280x720 (taken at 0.7 scale, so 896 px wide), all opened: `shots/tracker-3-fake-1-camera.png`, `-2-straighten.png`, `-3a-marks.png`, `-3b-still-empty.png`, `-3c-error.png`, `-3d-clicked.png`, `-4-foot-check.png` (the `fake` ones from the first run), the same set with `replay`, `shots/tracker-3-nocamera.png`, `shots/tracker-3-wired-stage.png` (lobby through a saved keystone), `shots/tracker-3-wired-nocamera.png` (written, not opened).

## Not done
- Not tried with the real DJI or a real projector. Tracking real shoes through the map is untested; only a recording and a fake camera were used.
- Not opened: `tracker-3-wired-nocamera.png`, and the `3b` and `4` fake-camera shots (the same screens as the replay ones I did open).
- No 390px or phone-check, as briefed. Left out: a "reset corners" button, a replay speed, anything for seats and the lag test (T5).

## Needs from others
- Nobody. `main.js` is wired. T5 adds its steps by adding entries to the `STEPS` list in `setup.js`; the counter is `Step n of STEPS.length`, so it will read 1 to 6.
- G5's note about sound needing a key press: not done here, it is not in this card.

## Calls I made
- `openSetup({ stage: { feet }, onClose })`: `stage.feet` is the stage's tracked source. Without one, setup makes its own and stops it on close. `onClose` gets `{ camera, calibrated }`.
- The four marks sit inset (8 and 92 percent across, 10 and 90 percent down), not on the exact corners, so each is whole and clear of the window edge. Those four points are what `solve` matches the clicks to.
- Moving any corner, or choosing another camera, clears the saved camera map, because the map was made for the old picture. Step 2's Next turns on after a corner has moved or when saved corners already exist. Step 3's Next turns on after a successful map or when one is already saved.
- The tracker's clean-up runs once for each new camera frame, so the setup and the stage can both call `read()` without smoothing twice.
- With `?replay=` there is no picture, so the still is a plain dark box. `cameraReason` in `tracked.js` repeats the one in `debug.js`, which is not my file.
- Setup takes the keyboard while open, so P, S, F and Esc do not reach the game under it.
