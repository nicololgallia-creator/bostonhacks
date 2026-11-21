# tracker-4 report, card T4

## Done
- `src/track/record.js`: `createRecorder()` (`add(nowMs, feet)`, `toJSON()`, plus `count()` for the page), `createReplay(recording, now)` with `start()`, `read()`, `fps()`, `stop()` like `createCameraFeet`, and `loadRecording(url)` for the page. Replay plays in real time and loops (the last frame stays up for one frame gap, then it restarts). A bad file throws a plain-words error.
- `src/track/record.test.js`: 7 tests, all pass. Times start at zero, frame for a given time, loop, one-frame recording, fps, empty recorder, and 8 kinds of bad file.
- `src/track/debug.js`: a Record button (created in JS, so `track.html` is untouched) that records until pressed again and downloads `feet-<date>.json`; `?replay=/qa/feet/<name>.json` runs the page from a recording on a black 16:9 box (a recording has no picture). Camera picker, model switch and Record are hidden in replay mode.
- `qa/feet/still.json`: 21 frames over about 3 s, 2 feet each, recorded with the real Record button from `track.html?src=/qa/person.jpg`.

## How I checked
- `node --test src/track/record.test.js`: 7 pass, 0 fail.
- Recorded `still.json` by driving the Record button in headless Edge (puppeteer): button text switched to "Stop and save", a file downloaded, no console errors.
- `node tools/shot.mjs "http://localhost:5173/track.html?replay=/qa/feet/still.json" shots/T4-replay.png --wait 3000 --w 900 --h 600`: two yellow foot dots, "7 fps, replay, 2 feet", console errors none. Opened and looked at it.
- Bad files in the browser: a missing file shows "The recording /qa/feet/nope.json is not a JSON file." and an empty one shows "That recording cannot be used: it has no frames. Record again and keep recording for a few seconds." (the temporary empty file is deleted).

## Not done
- Record when the camera has not started (nothing recorded) shows "Nothing was recorded..." This path I wrote but did not click.
- No 390px check, per the brief. I did not run `npm.cmd run build` or the whole suite, per the brief.

## Needs from others
- None. `poses()` returns `[]` on a replay so `debug.js` draws it unchanged; the pipeline and calibration read a replay exactly like the camera source.

## Calls I made
- Record button is made in `debug.js`, not `track.html`, because the card lists `debug.js` and not the page.
- Replay has no camera picture, so dots draw on a plain dark 16:9 box. `still.json` came from a portrait photo, so its dots sit in that box, not on the person.
- Left out: a file picker for replays, a speed control, and a replay that records the picture too.
- Lean-code hook said `read` already exists in `camera.js`: the matching names are deliberate, the replay must have the same shape as the camera source.
