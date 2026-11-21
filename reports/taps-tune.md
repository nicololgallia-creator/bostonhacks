# taps-tune: resting feet were reading as taps

Changed `src/track/taps.js` and `src/track/taps.test.js` only. No UI, no screenshots.
`node --test src/track/taps.test.js src/track/seatsource.test.js src/game/engine.test.js`: 82 pass, 0 fail. The other track tests (`seats`, `slices`, `seatreplay`) still pass, 22 of 22.

## What is built
1. **Threshold that follows the noise.** Each track measures its own shake: the median frame to frame change in y over the last 3 s, counting only frames where the foot rests. A lift must rise above the ground by more than the largest of: `minLift` (0.02), `liftRatio` times the shin, and `shakeMultiple` times the shake. Options: `shakeMultiple` (default **4**), `shakeMs` (3000), `shakeMinSamples` (10), `restShare` (0.6). With `shakeMultiple: 0` the old behaviour comes back.
2. **A lift must last.** The foot has to be over the threshold on two frames in a row before it is `lifted`. One frame counts only if it is past twice the threshold. A tap still needs the lift to last `minLiftMs` (50) or to peak past twice the threshold, as before.
3. **A foot that comes or goes is not a lift.** When the number of feet in a seat changes: that frame decides nothing, and a lift in the making starts over.
   - A foot that is down takes the new height as its ground, unless the count has just returned to the one it left within 500 ms. Then it gets back the ground it had, so a foot that comes back already in the air is still a lift.
   - A lifted foot keeps its ground and its lift, and is not compared to it at all while the count differs from the one the lift began with. The last builder's "move the ground by the jump" let the noise of both feet pile up in the ground (a test showed 10 lifts giving 2 taps); this removes that.
   - Flicker in and out every other frame, higher or lower foot, 30 s: zero taps (test).
4. **Tap or shift.** A lift that has not come back within `maxLiftMs` is a shift: no tap, the ground follows. It was 3000, now **1500**. The recording's longest real lift is about 1 s, so one tap each at about 16.7 s still holds. The tests that held a foot up for 2 s now hold it for 1.2 s, and the shift test now ends at 1500 ms.
5. **`debug` list** in the object `update()` returns: `[{ spotId, foot, ground, threshold, shake }]`, one entry per track (a one-lane seat is one entry, foot 0). `feet` and `taps` are unchanged. The test that compared the whole returned object now compares `feet` and `taps`.

## Tests added (made-up traces, a repeatable pseudo-random shake)
Each runs in seat mode and in two-foot mode:
- two feet resting with a shake of 0.008 and the higher foot missing on 2 frames of every 7, for 30 s: **0 taps**, never `lifted`.
- a shake of 0.012 (past the old floor) with the same dropouts: 0 taps.
- the same 0.008 shake, ten lifts of 0.035: **10 taps**, with and without the dropouts.
- a slow drift of 0.1 over 10 s with the shake: 0 taps.
- a foot that shifts 0.03 up or down and stays: 0 taps, and it settles (not `lifted`) after the shift.
- a one-frame spike of 0.03: 0 taps.

Also: flicker every other frame (three cases); the higher foot dropping out inside its own lift keeps the lift and taps once at the landing; a shake of 0.02 gets a threshold above 0.04 (floor alone gave 5 taps in 12 s, the following threshold 0); a big lift still taps; the `debug` shape.
Run against the old `taps.js` the new file fails 10 tests, including both seat-mode dropout tests. One caveat: in two-foot mode the old code also passes the 0.008 and 0.012 zero-tap tests, so those two do not prove the fix there. The shake-follows test does.

Two changes to old tests, both from the new rules: the flipping-names test now uses feet 0.1 apart for the two-foot half (at 0.04 apart the new two-frame rule alone stops the flips reading as lifts, which is good, but the test wanted to show seat mode matters), and the 2 s holds became 1.2 s.

## The real recording (`qa/feet/real-taps-1.json`)
- **25 taps on foot 0, 26 on foot 1** (3 to 39.5 s), one tap each at 16 to 17.5 s, none at 30 to 32 s. Before: 29 and 26.
- Printed by the test, from 3 s: **shake median 0.0042, highest 0.0080; threshold median 0.0200, highest 0.0320.** So on one person the threshold is the 0.02 floor almost all the time.

## Numbers: guesses and what the recording fixed
Only one recording of one person exists. Every number below needs a two-person recording.
- **From the recording:** `minLift` 0.02, `returnFraction` 0.4, `groundEaseMs` 600 (unchanged).
- **Fitted to it, so fragile:** `shakeMultiple` 4 and `restShare` 0.6. The count on foot 0 sits at exactly 25, the bottom of the allowed range. Multiple 5 gave 24 and 25, 4 gives 25 and 26. `restShare` 0.75 or more let a busy tapper's small lifts raise the shake and lose taps (21 to 22); 0.5 under-reads a big shake. The recording count jumps by 3 or 4 with small changes to either number, so do not read 25 as a margin.
- **Guesses, no data behind them:** `shakeMs` 3000 (1000 made the estimate jump about in a big shake), `shakeMinSamples` 10, `maxLiftMs` 1500, the 5 versus 4 question on a distant camera.
- **Made-up shake is uniform noise of plus or minus the stated size.** Real model shake may be shaped differently. At plus or minus 0.02 or more the detector still reads about one false tap per 10 s per foot (3 taps in 90 foot-seconds at 0.02, 6 at 0.025): the threshold follows the noise but under-reads it a little.
- The foot's own drift in the real recording is not in any test except the drift trace I made up.

## Things to know
- A tap lost to a gap: the **two-frame rule costs real taps at the real frame rate**. The recording's frames are about 50 ms, not 20, so a lift that shows in one frame at under twice the threshold no longer counts. That is 4 of the 29 taps the old detector had on foot 0. By the rule you gave.
- With the count changing on every frame (flicker each frame) no lift can be read at all, since each changed frame decides nothing. Flicker every few frames is fine.
- A lifted foot whose count never returns to the count it began with stays `lifted` until `maxLiftMs`, then is dropped with no tap. A landing that happens while the other foot is missing is read when the count comes back, one or two frames late.
- Busy tappers raise their own shake (no gate fully stops it); the threshold then rises with it and small taps go. That is the intended trade on a noisy camera and the wrong one on a clean one. `shakeMultiple: 0` turns it off.
- `lifted` now turns on one frame later for lifts under twice the threshold.
- Nothing outside `taps.js` and its test was touched; `seatsource.js`, `stage/`, `game/tiles.js` and `pilot/` are other builders'. Nobody has yet read `debug`; showing it on the page is for whoever owns the UI (`det.update(...).debug`).

## Next, needs a person
Record two people on the real camera (the Record button on `seats.html` writes the file) and run the same count: resting feet should give 0 taps, real taps close to the number made. If taps go missing, lower `shakeMultiple` before anything else; if resting feet still tap, raise it.
