# tracktest: one guided test that gives numbers and a recording

Press G on the stage with `?feet=seats` (or open it with `&test=1`). The floor takes over with six steps, records everything, and at the end shows a score card and downloads `tracktest-<yyyy-mm-dd-hh-mm-ss>.json` and the `.webm`. Other modes show one line saying the test needs `?feet=seats`.

## Read this first (three things the lead must know)
1. **Screen frames repeat the same feet to the tap detector, and that makes false taps.** `bySpot()` runs on every screen frame (60 Hz), the camera and pose model give about 30 new pictures a second, so the detector sees each picture two or more times. I fed the real two-person recording (`qa/seats/real-two-1.json`) through the current `taps.js` three ways, rest 5 to 22 s (the tuned target is 0 taps):
   - each camera frame once (how `taps-feet` tuned it): seat 1 **0**, seat 2 **0**. Tapping 22 to 39.6 s: **29** and **37**.
   - at 60 Hz with repeats (how the stage runs it): rest seat 1 **0**, seat 2 **2**. Tapping **32** and **38**.
   - at 120 Hz: the same as 60 Hz.
   Cause: a lift needs "two frames over the threshold", and a repeated frame counts as a second frame; the shake median also fills with zeros from repeats. This is a likely source of "taps go off when they should not". The fix is small and not mine: in `seatsource.js` only call `taps.update` when a seat's `n` changed. The test file marks every frame `fresh` or not, and the script's `--fresh-only` shows what the detector gives without repeats. One run of the test on the real floor will tell whether this is the main cause.
2. **The script is named `qa/seats/analyze-tracktest.mjs`, not `analyze-test.mjs`.** `node --test` runs every file ending `-test.mjs`, so the asked name made `npm test` fail. Same command, same options.
3. **The file has extra fields beyond the contract (all additive, nothing removed or renamed):** top level `speed`; `phases[].announceFromMs` and `phases[].bpm`; `frames[].fresh` (false when the camera gave no new picture since the frame before); `frames[].seats[].dropped` and `.n` (the pose count of that seat); `score.seats`, `score.fps`, `score.frameGapMaxMs`, `score.missed`. `frames[]` has one entry for every screen frame the detector was fed (not only new pictures), so a viewer should draw by `t` and can skip `fresh:false`. `lanes` is what the test used: one lane per seat with two or more seats, two with one seat (the same as real play, even when no phone has claimed a seat).

## What I built
- `src/stage/tracktest-score.js` (pure) with `src/stage/tracktest-score.test.js` (13 tests): `planTest` (phases, announce times, beats), `frameRecord` (one frame of the file), `classifyTaps` (every tap labelled: still, move, others-turn, caught with its beat, extra, between phases) and `scoreTest`. `caught` is a tap within 300 ms of a beat, closest pairs first, each tap and beat used once. `delayMs` is the median of tap minus beat, `delaySpreadMs` the middle half's width. `fps` is the median fresh frames a second, `frameGapMaxMs` the longest gap between fresh frames, `droppedSeatFrames` the fresh frames where a seat had no feet.
- `src/stage/tracktest.js` and `tracktest.css`: the overlay, called through `applyKeystone(element)` so it takes the same warp and half turn. Field is the line's half-way colour, ink `#141413`, Lilita One and Nunito from `floor-look.js` (`themeFor`, `seatOf`, `loadFonts`). Nothing under 7.15 vh (1/14 of the height). One instruction at a time, a countdown bar, a 3, 2, 1 before each step, each seat's number in its colour at its pad's foot square. A beat shows as an ink disc that swells in the middle and the active seats' numbers swell; in a solo step the other seats dim. The click is a Web Audio triangle tick, gain 0.9, scheduled on the audio clock 120 ms ahead; a higher tone on the first beat of a step. The video is `MediaRecorder` on the seat source's camera stream (webm, 1.5 Mbit/s, vp9 then vp8 then plain webm), with `video.startMs` taken from the recorder's own start event. No camera stream (replay, still, file) means `video: null`. Downloads use the existing pattern (URL revoked after 10 s); the video follows 600 ms after the JSON so the browser does not block the second one.
- `src/track/seatsource.js` (+ test): `frameReadout()` and `lastFrame()` (the feet as read, the detector's `debug`, taps with their camera x, the seats' poses, `lifted` for every seat), and `model`. Nothing else changed there.
- `src/stage/main.js`: one marked block (`tracktest`), the import line, key G (and Esc while open), `?test=1`, `?testspeed=N`, the lanes the test picks, and the game's `draw()` skipped while the test is up. While the test is up only F and Esc work; the session, tracker and tap detector keep running.
- `qa/seats/analyze-tracktest.mjs <file> [--redetect [--fresh-only]]`: prints the score per seat, every false or extra tap with time, seat and phase, the missed beats. `--redetect` runs the CURRENT `src/track/taps.js` over the recorded frames and prints that score; on a file recorded with the same detector it says the taps are the same (it did, on the sample).
- `public/qa-fixtures/tracktest-sample.json`, the sample for the review builder (1.4 MB, from the scripted run below, video null).

## The scripted run
Address: `stage.html?feet=seats&seats=2&replay=/qa-fixtures/real-two-1.json&test=1&testspeed=4`. **`testspeed=4` squeezes the clock and speeds the beats up four times, so the run takes 20 s instead of 79 s. A file made this way has `"speed": 4` and its scores are a smoke test only.** The replay plays the old recording, nobody taps to the beat, so "caught 2 of 63" is expected. Six steps ran in order, one download, no console errors. The analyze output on that file:
```
started 2026-11-22T00:12:38.678Z, 6 phases, 19.75 s, no video
== score as recorded ==
2358 frames recorded, 2 taps, model lite, facing false, SPEED 4x (scores are a smoke test only)
seat  false(still/move/others-turn)  caught      extra  delay ms (spread)  dropped seat frames
  1     0 (0/0/0)                       0 of 63     0      none               11
  2     0 (0/0/0)                       2 of 63     0      -23 (25)           72
30 fresh frames a second (median), longest gap between them 92 ms, 124 beats missed
False or extra taps (0):
== score with the current src/track/taps.js, fresh frames only ==
2358 frames recorded, 0 taps ...
Recorded taps 2, redetected 0.      (with --redetect alone: redetected 2, "the same taps")
```
2358 frames in 19.75 s is 119 screen frames a second against 30 fresh: the repeat in point 1, seen in a real file.

## How I checked
- `npm.cmd test`: 418 tests, 416 pass, 0 fail, 1 todo (the known one in `taps.test.js`). New: 13 in `tracktest-score.test.js` (a perfect run, one false tap in each kind of phase for the right seat, a missed beat, a steady 120 ms lag, a wobbling lag, an early tap, a double tap that does not catch two beats, a tap in the 3 s before a phase, frame rates, an empty file, `frameRecord`), 1 in `seatsource.test.js`. `npm.cmd run build` passes from PowerShell.
- Puppeteer on the build at :4173, 1280 by 720, with 900 px copies, all opened: `shots/tracktest-run-1-announce`, `-2-beat`, `-3-solo2`, `-4-card` (each `-1280.png` and `-900.png`), `tracktest-four-*` (four seats, solo step 2), `tracktest-facing-1-announce` and `-2-beat` (`&facing=1`: the words read upside down on the laptop and seat 1 sits on the right, as it should for the floor), `tracktest-notseated-1280.png` (the one-line note in mouse mode).
- Keys: G opens, G closes, G then Esc closes, G opens again; mouse mode shows the note for G and for `?test=1`. (One run of that check showed G doing nothing; three reruns passed. I think another builder's build was rewriting `dist` at that moment, but I did not prove it.)

## Calls I made
- Aborting with G or Esc before the end throws the recording away; nothing is saved.
- With one seat there are no "Only Player N" steps (nobody else to catch); the run is 4 steps.
- Beats start at the step's first moment and the last beat is at least one beat before its end: 25, 25 and 13 beats a seat for the 15 s, 10 s and 8 s steps.
- Taps in the 3 seconds before a step are not scored, except that one just before a beat can still be that beat's early tap.
- `slices` is taken at the start. Following can move the lines a little during the test; the per-frame `hipX` shows where the people were.

## Guesses
- The 300 ms match window, the 100 and 150 a minute, the click's pitch and loudness, and the beat disc's size are mine or the brief's. At 150 a minute the beats are 400 ms apart, so a very late tap can match the next beat; closest pairs go first, which limits this but cannot remove it.
- The delay includes the click's speaker delay and the projector's delay: a person taps when they hear or see the beat, and I cannot separate the three.
- A 4-seat card was shown only with a 2-slice recording (it shows two seats), so the 2 by 2 layout of four seats is by arithmetic, not by eye. A 3-seat card was not looked at either.

## Not checked
- The real camera, and the video file from a real camera: `MediaRecorder` was never run (no camera stream in any run). Its webm will have no seek index, so a viewer may not be able to jump in it.
- The click through real speakers (headless Chrome ran the audio code with no error, nothing was heard), and the 3-second lead and loudness in a real room.
- The tab hidden mid-test (frames stop, the clock does not; `frameGapMaxMs` would show it).
- Files at normal speed (`speed` 1): only the plan's numbers are tested, not a 79 s run.

## Needs from others
- Lead or tap owner: the repeated-frame fix in point 1, in `seatsource.js` (call `taps.update` once per new picture). After it, `--redetect` on a real test file shows the gain at once.
- Review builder: the extra fields in point 3. `frames[].fresh` matters for any chart of frame times.
