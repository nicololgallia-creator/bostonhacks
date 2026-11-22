# floor-fx: the floor reacts when you play well

## Done
- `src/game/floor-fx.js` (new): the six reactions, one pool, one clock. Pure rules (`heatOf`, `breaksStreak`, `shakeOffset`, `sameMoment`, `everyoneHas`, `everyoneLanded`, `flightAt`, `padGeom`) are tested in `src/game/floor-fx.test.js` (new, 8 tests). Fixed pool of 24 floaters, typed arrays, no shadows, nothing built per frame.
- `src/game/tiles.js`: calls the effects. A game clock that stands still while paused now drives the pads (words, flashes, effects). A frame after a gap over 250 ms (hidden tab) only catches up: no stamp, no shake, no floaters from it. Hold trail drawn here. `drawPad` reads its measures from `padGeom`.
- `src/game/floor-duel.js`: plates take points when they land; the leader is read from landed scores; the lead-change pulse. `src/game/floor-screens.js`: `score()` takes `pending`, so the team score waits for the points in the air.

## What each one is
| Moment | What it is | Lasts |
|---|---|---|
| Every hit | "+N" (the real points, multiplier included) leaves the foot, goes up its own lane behind the tiles, then across the top and under the team score (the player's own plate in a duel). Gold and big for a perfect, white for a good. The score and the plate bump when it lands, not before. | 450 ms |
| Streak 10, 25, 50 | The lane turns gold in three steps (40, 60, 80% toward butter yellow), the rails thicken to ink, a gold band sweeps up the lane once, and x2, x3 or x4 is slammed on the pad's foot zone. The heat stays while the streak does (a state, not a loop). | stamp 700 ms, sweep 450 ms |
| Streak breaks | The heat is gone at once. The pad shakes once, two swings of at most 0.6% of the width, only when a streak of 10 or more breaks. | 220 ms |
| Hold | White dashes run up both edges of the slab while the foot stays down. Held to the end: the foot zone floods gold, a gold bar swells at the line, and the bigger "+N" flies. Left early: nothing extra. | finish 400 ms |
| Everyone at once | When every player has landed a tile all of them were given: a white flash behind everything, the foot zones go gold, a gold bar crosses the whole floor at the hit line, and a "Together" plate sits on it. | 450 ms |
| Duel lead | The new leader's plate swells once and a gold ring spreads from it. Only when the old leader no longer leads (catching up to a tie or breaking one is not a handover). | 450 ms |

## How a tile is known to be everyone's (no help needed from others)
Tiles given to everyone have the same `v` on every pad in the same frame. `floor-fx.js` flags a tile of the first pad as everyone's when it first appears and every other pad has a tile at that `v` (within 5e-4, under 2 ms). The flash fires when all of them are `hit` or `holding`. One player missing it means no flash. Not used in a duel or with one seat.

## How I checked
- Real stage, built copy, 4 seats and 2 seats (`stage.html?seats=N&demo=1&autostart=1`), with a bot that reads the canvas and clicks a lane when a tile's head is at the line, and the link relay cut off so other builders' messages cannot reach it. Green line facing 0, Red line facing 1. No console errors. Shots `shots/floor-fx/stage-*.png` (opened `stage-Green-up-2.png`: x2 heat on pads 1 and 2, combo 10).
- A page that runs the real engine and the real renderer on a clock I control (not kept in the project, in the session scratchpad), so a moment can be hit exactly. Every pair below is at 1280x720 with a `-900.png` copy in `shots/floor-fx/`:
  - hit: `hit-before`, `hit-mid`
  - streak: `streak-before`, `streak-mid` (x2), `streak-x3`, `streak-x4`, `streak-heat-steady`; Red: `streak-x3-red`, `streak-before-red`, `streak-mid-red`; Orange: `streak-*-orange`
  - break: `break-before`, `break-mid-a` (first swing), `break-mid-b`
  - hold: `hold-before`, `hold-held`, `hold-finish`
  - together: `together-before`, `together-mid`; Red: `together-*-red`; facing 1: `together-before-facing`, `together-mid-facing`, `hit-*-facing`
  - duel: `duel-flight` (points flying into the plate), `duel-before`, `duel-pulse`
  - edge: `pause-mid-flight`, `hidden-after`, `hidden-after-1s`
- **900 px copies I opened:** `hit-before`, `hit-mid`, `streak-mid`, `streak-x4`, `streak-x3-red`, `break-before`, `break-mid-a`, `hold-held`, `hold-finish`, `together-before`, `together-mid`, `together-mid-facing`, `duel-flight`, `duel-pulse`, `hidden-after`. `streak-mid`, `streak-x4`, `break-mid-a` and `hit-mid` were opened before I made the heat tint stronger (30/50/70% became 40/60/80%) and the files were re-made after, so the files in the folder are not exactly what I looked at for those. **Not opened:** `streak-before`, `streak-x3`, `hold-before`, `break-mid-b`, `duel-before`, the Orange shots, the other Red shots, `pause-mid-flight`, `hidden-after-1s`, the `stage-*` shots other than `stage-Green-up-2`.
- Motion, share of pixels that changed in the effect's own region (the other things on screen keep moving, so it is the region that matters):

| Effect | 100 ms apart during it | 1 s apart, 1.5 s after it ended |
|---|---|---|
| hit (score area) | 12.6% | 0.00% |
| streak stamp (foot zone) | 79% | 0.00% |
| break shake (pad's foot zone) | 89% | 0.00% |
| hold trail (held lane) | 24% | n/a, it ends with the hold |
| hold finish (foot zones) | 44% | 0.00% |
| together (foot zones) | 49% | 0.00% |
| duel pulse (leader's plate) | 4.0% | 0.00% |

- A streak of 5 breaking: the pad's edge moved 0.9% of pixels over 20 ms (nothing); a streak of 12 breaking: 89%.
- Paused with a point in the air: pad 1 identical 1.5 s apart (0.00%). Resumed: it moves again.
- Tab hidden 3 s in a 13-streak: the combo went to 0 (the missed notes), no stamp, no shake (the pad edge moves at most the small existing miss pop: 7 to 23% of a 14x8 pixel strip, against 43 to 50% in a real break), heat gone, nothing queued. `hidden-after.png`.
- Speed (1280x720, headless, this laptop): 4 seats, every seat a perfect hit every beat for 30 s (240 hits, a together flash every beat, stamps at 10, 25, 50), cost of a drawn frame with the picture forced to paint: **before 1.65 to 2.15 ms, after 3.4 to 3.8 ms** (about 470 to 600 frames a second of capacity, about 270 to 290 after). Two runs each. "Before" is the same file with the effect calls stubbed out in a copy (the hold dashes stay in it). That is the worst case, a together flash on every beat; a real song has one in about 12. The real built stage, 4 seats, a bot clicking for 32 s: 114 frames a second, 2 seats 116 (headless runs free, it is not 60 Hz). I have no real-stage "before" number: the stage imports the renderer directly.
- `npm.cmd test`: 535 tests, 533 pass, 0 fail, 1 skipped, 1 todo. `npm.cmd run build` passes.

## Not checked
- A real projector, a seat across the floor, a dim room. Whether the x2 stamp, the heat steps and the "+N" read from there. The pastel field on Orange: the gold heat is the least different from the lane there (`streak-*-orange`, not opened).
- Real feet. The together flash fires when the last player lands, so with real feet landing up to 300 ms apart it fires up to 300 ms after the first.
- The "+N" is split equally when one frame holds two scoring events for the same seat (a lone player landing both feet in one frame): the two numbers may be off by up to 50. Rare.
- "Held to the end" is read from the score: a hold paid more than 50 times the multiplier. Left-early holds pay exactly 50 times it, so they do not trigger it.
- Sound: nothing added.
- **What I would cut first:** the "+N" on every hit in a fast 4-seat team game. It is the busiest thing, six or eight numbers climbing at once, and the lane heat and the score bump already say "you are scoring". If it is too much, keep it for perfects only (`gold[f]` in `spawn`) or only in a duel.

## Needs from others
- Nothing needed. Optional, `src/stage/main.js`: pass `offsetMs: session.offsetMs()` in the draw view if the hold finish should be judged from the tile's tail instead of the score (it is not needed now).

## Calls I made
- Floaters are drawn twice: above the lanes before the score (so they fly in under the digits) and in each lane behind the tiles. A number is never over a tile that is still coming.
- The team score and a duel plate wait for the points in the air (`pending`), so "points land in the score" is true on screen. If the pool of 24 is full the points are added at once.
- `tiles.js` now has its own game clock for everything on the pads (it stops in a pause), so the existing "Perfect" words and flashes also freeze in a pause now. Before they kept running.
- The lead-change pulse ignores ties, on purpose: with equal players it would pulse every other note.
- The hold dashes run along both edges, not the middle: the ring and the bar take the middle, and a first try there showed no dashes on a short hold.
