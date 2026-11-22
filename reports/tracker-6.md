# tracker-6: only the seats in play, and each player's own calibration

## Result in three lines
- A: built and working. A song on (warm-up, countdown, playing, paused) runs only the taken seats' pose models. 2 of 4 taken: 4 models per picture before, 2 after.
- B: built and measured, but **switched off** (`CALIBRATE_FROM_WARMUP = false` in `src/track/seatsource.js`). On the real recording it made seat 2 worse at rest. The numbers are still learned and shown in `calibration()`.
- `npm.cmd test`: 535 tests, 533 pass, 0 fail, 1 todo (the known one in `taps.test.js`). `npm.cmd run build` passes.

## A. Only the seats in play
- `seats.js`: `setActive(spotIds | null)`, `detections()` (pose models run so far). A seat left out is not detected: no model run, `active: false`, no feet, `hipX` null, its picture counter `n` stands still. A seat put back forgets where its feet were. `perFrame` turns are taken among the active seats only. Every pose now has `active`.
- `seatsource.js`: `setActive(spotIds | null)` passes through to the tracker and also masks the source's own output, so a recording (which plays every seat) behaves the same. Inactive seats give no `read`, no `debug`, no taps, are skipped by `freshSeats`, and `fps()` ignores them. When a seat comes back, `taps.reset(spotId)` clears its tracks and `lastFeet` and heights are cleared. Safe to call every frame (it returns at once when nothing changed). Also kept after `setLayout` builds a new tracker.
- `taps.js`: `det.reset(spotId)`.
- Models per camera picture, 2 of 4 seats taken: **4 before, 2 after** (test with fake pose models: `seats.test.js`, counts `detectForVideo` calls per seat).
- A timing, headless Chrome on the built stage, CPU only, one still picture of three people, four slices (`stage.html?feet=seats&seats=4&src=/qa-fixtures/three.png`), phones taking seats 1 and 2:
  ```
  lobby, 4 seats read:                     51.9 model runs/s = 12.98 pictures/s, 4 models per picture
  lobby, 2 seats taken (still all 4 read): 52.4 model runs/s = 13.09 pictures/s, 4 models per picture
  warm-up, 2 of 4 taken:                   52.9 model runs/s = 26.44 pictures/s, 2 models per picture (seats 3 and 4 active false)
  ```
  **This is a headless CPU number with no GPU. It is not the floor's speed.** It shows the models are the cost (the run rate stays at about 52 a second) so half the models gives twice the pictures. The real camera is capped near 30 pictures a second, and the real GPU speed was not measured.

## B. Each player's own calibration
- `taps.js`: `det.setSeat(spotId, { minLift, liftRatio } | null)` (per-seat lift threshold, the shake part still applies on top: the larger wins). `update()` now also returns `lifts`, `lifts[i] = { peak, liftMs }` for `taps[i]` (the tap objects are unchanged, so no old test changed). `calibrationOf(lifts)` gives `{ taps, medianPeak, medianLiftMs, minLift }`, `minLift = clamp(0.4 * median peak, 0.008, 0.03)`, or null under 3 taps. `CALIBRATION` holds the four numbers.
- `seatsource.js`: `createCalibrator` (exported, tested with a stand-in detector). In `warmup` it records each taken seat's taps; when the warm-up ends it keeps `calibrationOf` for every seat with 3 or more and (only if the constant is on) sets that seat's detector to `{ minLift, liftRatio: 0 }`. Source methods: `calibrate(status, players)`, `calibration()`, `setActive`, `detections()`. `lastFrame()` now has `calibration`, and each tap in it has `peak` and `liftMs`.
- Life of a calibration: through the song and a play again (the lobby between does **not** end it, because play again goes results, lobby, start, so ending it at the lobby would break that), ended for a seat that is let go or taken by another phone (`clientId` changes), thrown away when a new warm-up starts, and thrown away when the seats turn round or the seat count changes. A pause inside the warm-up does not end it.
- Call I made: the calibrated threshold **replaces the shin share too** (`liftRatio: 0`), not only the floor. Reason: on this recording the shin share is about 0.0156 and the floor 0.012, so a calibrated 0.010 for a light tapper does nothing if the shin share stays. I did not choose it for the result.

### Numbers on `qa/seats/real-two-1.json` (each seat's first four taps after 22 s are its warm-up)
```
                                  seat 1 rest 5-22 s / caught 22-39.6 s     seat 2 rest / caught
defaults (today)                   0 / 29 (of 31 lifts)                      0 / 37 (of 40)
calibrated, shin share replaced    0 / 29                                    2 / 39
calibrated, shin share kept        0 / 29 (identical to defaults)            0 / 37 (identical)
```
Learned: seat 1 minLift 0.0133 (median peak 0.033), seat 2 minLift 0.0122 (median peak 0.031).
- **Calibration makes seat 2 worse at rest: 2 false taps where the defaults give 0** (it also catches 2 more real lifts). The rule was "rest must stay 0", so the default is off. Seat 1 is unchanged. The code stays. With the shin share kept it does nothing on this recording (the learned 0.012 to 0.013 sits under the shin share, so it only helps a heavy tapper whose number is above it).
- Nothing was tuned afterwards. These are the first numbers I ran. A test in `taps.test.js` holds all of them and a `t.diagnostic` prints them.
- Made-up tappers (tests): heavy lifts of 0.06 give a threshold of 0.024, and the 0.02 shuffles between real taps drop from 20 to 10 taps. Light lifts of 0.025 give 0.010, and lifts of 0.0115 are missed by default and caught with it.

## Scripted run (built copy, `stage.html?feet=seats&seats=4&replay=/qa-fixtures/real-two-1.json&facing=0`)
Two raw `ws` clients (the phones, with a `here` every second so they are not dropped) took seats 1 and 2, the song started 20 s into the replay so the taps (22 s on) fall in the warm-up. Read from `window.feetSource.lastFrame()` (I added `window.feetSource` in my main.js block):
```
+0.0s warmup    poses [seat1 active, seat2 active]   calibration {}
+4.8s countdown ...
+7.9s playing   calibration {"1":{"taps":6,"medianPeak":0.0295,"medianLiftMs":291,"minLift":0.0118},
                             "2":{"taps":5,"medianPeak":0.0264,"medianLiftMs":207,"minLift":0.0105}}
during the song: activeSeats [1,2], readSeats [1,2], debugSeats [1,2], tapSeats [1,2]; console errors none
```
Then the same with only a phone on seat 1: from the warm-up to the results (0.8 s after each status change, because the state reaches the phone every 0.5 s) `activeSeats [1]`, `readSeats [1]`, `debugSeats [1]`, `tapSeats [1]`, seat 2 `active: false`, 0 feet, and seat 2 is active again in the lobby. Calibration held seat 1 only.
- **The recording has two slices, so seats 3 and 4 do not exist in the replay.** With seats 1 and 2 both taken, "only seats 1 and 2 are read" is true but is also all the replay has. The one-phone run shows the masking working. The 2-of-4 model count comes from the fake-model test and the headless timing above, not from the replay.
- `seatreplay.js` is not mine and has no `setActive`, so the source masks the replay's seats itself (feet, taps, debug, `fps`, `n`). The replay's own clock still runs every seat's `n`; the source reports the frozen value.
- The two earlier runs of the script, with the shared link at :4173, also sent my phones' messages to any other stage page open at that moment (the link relays to every page). I used the ids `tracker6-*` and left at the end.

## Tests added
- `seats.test.js` (2): 2 of 4 seats in use run 2 models a picture (counted per seat), the idle seats' `n` and feet stand still, `perFrame` rotates only the active ones, null puts all back, an empty list runs nothing.
- `taps.test.js` (6): `lifts` peak and duration, `setSeat` changes that seat only and null restores it, the shake still raises it, `reset` starts clean and keeps options, the calibration rule (heavy 0.024, light 0.010, clamps, 2 taps gives null, 3 gives a number), heavy and light tappers, the real-recording numbers above.
- `seatsource.test.js` (6): calibrator per seat with 3 taps or more, fewer than 3 keeps defaults, apply off sets nothing, lasts through play again, ends on release and on a new owner, a new warm-up resets, a pause does not end the warm-up, `clear()`, and the source on the replay (feet, taps, debug, counter, fps, and a seat put back after a gap shorter than 500 ms starts clean; it fails with `taps.reset` removed).

## My main.js lines (src/stage/main.js)
Lines 233 to 236, one marked block `tracker-6` (`window.feetSource = feetSource;` and `trackSeats`), and line 244, `if (seated) trackSeats(); // tracker-6`, in `frame()` right after `const read = ...`. Nothing of the "music" or "wave 9" blocks was touched.

## Guesses
0.4, the clamps 0.008 and 0.03, 3 taps, and "the first four taps are the warm-up" (the real warm-up gives 4 taps and the detector keeps recording until the status leaves `warmup`, so a seat can have 5 or 6, as in the run). The shin-share replacement is a call, not a measurement.

## Not checked
The real camera, real GPU speed and frames a second on the floor (so rule 3 of the 6:25 PM critique is only half met: models per picture is counted and a headless relative rate is given, the tap-to-flash delay is not measured). Real people's warm-up taps (the numbers come from one recording of two people). Three or four people on a live camera with `setActive`. A real phone's `clientId` changing hands. The lobby keeping a calibration for people who walk off without releasing the seat: they keep it until the seat frees, and any new warm-up replaces it anyway.

## Needs from others
- Lead: decide whether to turn `CALIBRATE_FROM_WARMUP` on after one real warm-up on the floor. It is a single constant. With it on, a seat's `calibration()` entry is also set on the detector.
- The tracking-test builder: `lastFrame().calibration` and tap `peak`/`liftMs` are new additive fields; the pose `active` flag is new.
