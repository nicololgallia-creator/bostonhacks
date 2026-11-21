# taps, card T7

## Done
- `src/track/taps.js`: `createTapDetector(options)` with `update(nowMs, feet)` returning `{ feet, taps }`. `feet` is the input with `lifted` added; `taps` is `[{ spotId, foot, atMs }]`, reported at the landing. One track for each `spotId` and `foot`. `TAP_DEFAULTS` is exported.
- `src/track/taps.test.js`: 19 tests. Made-up traces: a clean tap, ten taps at two a second, jitter 0.003, slow slides up and down, a two second hold in the air, two feet and two seats not mixing, a dropout mid-lift, a dropout on the ground, a dropout longer than `lostMs`, one-frame lifts, the cooldown, the shin scaling and floor and no-shin case, a shifted foot, a partial return, options. Plus one test over the real recording.
- `src/game/engine.js`: a foot with `lifted: true` does not count in its square, and when no other foot stands there the square is empty that frame (the sample history is cleared), with no 150 ms wait. A foot missing from `feet` still gets the 150 ms wait. Three lines changed. The mouse path has no `lifted` field and is unchanged.
- `src/game/engine.test.js`: 4 new tests. Rest, lift, land hits a tap tile (and standing still still does not). A landing after one frame in the air is an arrival. A foot staying down holds a hold tile to the end; lifting ends it on the very next frame (1120 ms) while a lost foot takes 150 ms or more; the hold, left after half, is good and keeps the combo. `lifted: false` gives events and results identical to no `lifted` field.

## How I checked
`node --test src/track/taps.test.js src/game/engine.test.js`: 46 pass, 0 fail. No UI, no screenshots, nothing else run.

## The real recording (`qa/feet/real-taps-1.json`)
Run with no `shin`, left foot in the picture as foot 0. Frames without exactly two feet are skipped, because the left and right cannot be told apart (107 of 897 frames). With the defaults below, from 3 to 39.5 s: **29 taps on foot 0, 26 on foot 1** (your count of lifts was about 34 and 27). One tap each for the long lift near 16 s (landing at 16.72 s). None between 30 and 32 s.

## Numbers: which came from the recording and which are guesses
All are options, with these defaults. Only one recording of one person exists, so all of them need more recordings, and above all a different camera height.
| option | default | where it came from |
|---|---|---|
| `minLift` | 0.02 | **From the recording** (jitter 0.005, lifts 0.04 to 0.07). This is the whole threshold when `shin` is missing. |
| `liftRatio` | 0.08 of the shin | Starting guess, from the card. It has no effect until the shin is larger than 0.25 of the picture. Untested on real shins. |
| `returnFraction` | 0.4 (0.008 at 0.02) | From the recording. The card said a third; 0.4 is your landing number and found more taps. |
| `groundEaseMs` | 600 | From the recording. 300 lost about a quarter of the taps, because the ground followed the first part of a slow lift up. |
| `cooldownMs` | 150 | **Changed from the card's 120**: foot 0 bounces 146 ms after landing near 16.7 s and 120 counted that as a second tap. A guess fitted to one event. |
| `minLiftMs` | 50 | Starting guess. A lift shorter than this still counts if it rose past twice the threshold (your one-frame rule); that rule is built and tested. |
| `groundFallMs` | 100 | Starting guess (new, see below). |
| `maxLiftMs` | 3000 | Starting guess (new, see below). |
| `lostMs` | 500 | Starting guess (new, see below). |

## Changes to the card, and why
- **Ground is not the single lowest point.** The card said the largest `y`. On the real recording one noisy low frame set the ground 0.02 too far down and the foot stayed "lifted" for seconds. The ground now follows the lowest points but eases down at `groundFallMs` and up at `groundEaseMs`, and it does not move up while the foot is lifted (so a held-up foot does not drag it).
- **`maxLiftMs`.** A foot lifted for more than 3 s has a wrong ground (or shifted and stayed): its height becomes the new ground, `lifted` goes false, and no tap is reported. Without it a bad ground froze a foot as lifted for the rest of the song. This does mean `lifted` goes false with no tap at 3 s, and the engine will see that as an arrival on that square.
- **`lostMs`.** A foot missing longer than 500 ms starts a new track, so a stale lift cannot tap when the foot comes back. A shorter gap keeps its state (the card's "frame or two").
- A foot is `lifted` from crossing the threshold until it is back within `returnFraction` of it (so lifted stays true a little longer than "higher than the threshold").

## Not done, and things to know
- Nothing in `src/stage/` calls `createTapDetector` or passes `lifted` to the engine yet. That is the wiring card.
- `seats.js` was not read or touched; I built to the shape in the card. The detector needs `spotId`, `foot` and `y`; `x` and `shin` only pass through (`shin` scales the threshold).
- The recording has dropouts on 12% of frames and its feet carry no id. A real `seats.js` will give each foot its index, so the one-foot frames I skipped will be usable.
- Your "no taps between 30 and 33 s" is not quite so: both feet lift 0.02 to 0.04 at 32.1 to 32.3 s (and at 29.3 to 29.7 s), and the detector reports taps there. They look real in the data. The test checks 30 to 32 s.
- My test floor is a count of 25 to 40 taps; foot 1 has 26, so a small change to a default can drop it below 25. That is the recording being near the edge, not a loose test.
- Only one speed was checked on real data (20 frames a second). The made-up traces use 20 ms frames.
- Sound and hits on the real floor are not checked; no UI was in scope.
