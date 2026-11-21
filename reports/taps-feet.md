# taps-feet: each foot of a one-lane seat has its own track

Changed `src/track/taps.js` and `src/track/taps.test.js`. Added in `qa/seats/`: `sweep-taps.mjs`, `replay-real1.mjs`, `two-lanes-count.mjs`. No git, nothing else touched.

`node --test src/track/taps.test.js src/track/seatsource.test.js src/game/engine.test.js`: 88 tests, **87 pass, 0 fail, 1 todo** (the missed target below).

## What is built
- One-lane seat: two feet seen, the smaller x is the left track, the other the right. One foot seen: the track whose last x is nearest (the only track, or left, if none yet). The other track is not updated that frame, and the `lostMs` rule applies per track. Tracks are keyed `spot:L` and `spot:R`; each has its own ground, shake and threshold. A tap on either is a tap for the seat.
- Two feet closer than half the seat's usual gap (median of the last 10 s of two-foot x gaps, trusted after 10 frames): that frame decides nothing for the seat. Options `gapMs`, `gapMinSamples`, `closeShare` (0.5).
- Output shape unchanged: one foot, foot 0, taps `{ spotId, foot: 0, atMs }`. **x and y rule: the highest foot seen that frame (smallest y), as before.** `lifted` is true while any track of the seat is in the air (and was seen within `lostMs`), false on the frame a foot of that seat lands (tap or not).
- A seat taps at most once per 150 ms (the cooldown is held by the seat, not the foot). Two-lane mode keeps the per-foot cooldown.
- `debug`: one entry per track updated that frame. In a one-lane seat, foot 0 is its left track and foot 1 its right.
- The two-lane mode (tracks by the model's foot name) shares the same per-track code. Only the numbers changed for it.
- Removed: all the count-change rules (`changed`, `held`, `liftCount`, the "back within 500 ms" ground restore). With one signal per track, a foot that comes or goes just is not updated, so none of them has a job. Tests show nothing needs them: flicker every other frame, a dropout mid-lift, a foot gone 2 s, all pass. One kept idea: the frame-to-frame shake only counts if the foot was also seen on the frame before.
- New number: `restFloor` 0.02. The shake gate (`restShare`) is now 0.6 times the larger of the threshold and 0.02. With the lower floor a made-up shake of 0.008 never counted as resting, so the threshold never rose to meet it (both made-up drift tests failed). On the recordings this changes nothing.

## Tuning (recordings, `qa/seats/sweep-taps.mjs`)
Result: `liftRatio` 0.08 to **0.06**, `minLift` 0.02 to **0.012**. The shin term was the real floor: shin 0.24 to 0.28 gave 0.019 to 0.022 at 0.08, so `minLift` alone did nothing. Sweep (one lane, rest 5 to 22 s seat 1/seat 2, tapping seat 1, seat 2):
- liftRatio 0.04 to 0.055: 0 and 1 to 6 taps at rest in seat 2 (fails).
- 0.06: rest 0/0, tapping 29 and 37. 0.065: 28 and 37. 0.07: 24 and 35 (seat 1 below 27).
- `minLift` 0.010 to 0.014 changes nothing at 0.06, because the shin term decides. 0.012 is the card's guess range and matches the one-person recording's plain floor.

## Numbers on qa/seats/real-two-1.json, one lane a seat
- 5 to 22 s: **0 taps** in both seats, no foot ever `lifted`. Met.
- 22 to 39.6 s: seat 1 **29** taps (31 real lifts, target 27 to 35), seat 2 **37** (40 real lifts, target 36 to 44). Met, but seat 2 is one above the bottom of its range.
- No two taps of one seat closer than 150 ms. Met.
- **40.7 to 42.2 s, seat 1 alone: 1 tap, at 40.76 s. MISSED by 1.** Not loosened. Trace (`trace.mjs`, seat 1, 40.3 to 40.8 s): as seat 2 leaves, seat 1's feet go up together by 0.04 to 0.05 at 40.64 to 40.70 s and come down at 40.76, after which the resting height is 0.012 lower. The old detector tapped there too (40.5 and 40.8 s). It is a real body movement landing 60 ms inside the window, not shake. The only rules that would remove it (drop a lift where both feet rise together, or a lift that starts on the frame a lost foot returns) would also hide real jumps and are not in the card. It is a `todo` test, so the suite stays green and the miss stays visible.
- `qa/feet/real-taps-1.json`: foot 0 **26** taps, foot 1 **26** (3 to 39.5 s, range 25 to 40), 0 at 30 to 32 s, one each at 16 s. Passes.
- Printed, not a test: TWO lanes a seat (tracks by the model's name), 22 to 39.6 s: seat 1 foot 0 **14**, foot 1 **17**; seat 2 foot 0 **19**, foot 1 **19**. 0 taps at rest 5 to 22 s in all four. Seat 1 also had 2 taps per foot before 5 s (in the sit-down, not scored). Real lifts: seat 1 15 and 16, seat 2 20 and 20.

## Tests
Added: the real two-person recording (targets above), the 40.7 s todo, a tap shows as lifted then not lifted while the other foot is up, one foot seen goes to the nearest track, both feet on one spot decides nothing (and reads taps with `closeShare: 0`). Replaced: "a lower foot lifted by less than the gap is not seen" is now "the lower foot's own lift counts" (the old test described the bug).

Changed made-up tests, each because the floor fell from 0.02 to 0.012:
- Slide test: 0.1 in 4 s became 0.1 in 8 s. The ground lags a moving foot by speed times 600 ms, 0.015 at the old speed. Drift faster than about 0.02 a second now reads as a lift.
- One-frame and short lifts: 0.03 became 0.02 (0.03 is past twice 0.012). Spike test: 0.03 became 0.02 for the same reason (2 x 0.012 plus shake).
- Shin test: values scaled to 0.012 (0.025/0.05 for shin 0.5, 0.01/0.02 for the rest).
- Name-flip test and the `seat` helper: foot x now stays with the feet's places and only the names flip. Before, x followed the name, which is no longer what the model's flipping looks like to a tracker that goes by place.
- `debug` test: two entries for one one-lane seat.

## Guesses and not checked
- From recordings: `liftRatio` 0.06, `minLift` 0.012, `closeShare` 0.5 (bad frames 0.001 to 0.013 against a gap of 0.055).
- Guesses: `gapMs`, `gapMinSamples`, `restFloor`, and that one lane never has more than two real feet.
- Seat 2's 37 against a floor of 36, and 0.055 giving a rest tap, show the margin is thin. The two-person recording is one recording of two people, one session.
- Not checked: the live app (`seatsource.js`, `engine.js` on the page, nobody pressed a pad); only their unit tests. Not checked either: three or four people on one camera, a different camera height, and people whose feet stand close or cross. A foot seen alone for over 0.5 s then restarts its track, so a lift in progress then is lost.
- Not checked: that frames where the model swaps left and right in x exist. If they do, a tap can be read from the wrong track, but the result is still one tap for the seat.

## Needs from others
Nothing. `seatsource.js` and `engine.js` need no change: the returned shape is the same. If `debug` is shown on screen, one-lane seats now have two entries, foot 0 left and foot 1 right.
