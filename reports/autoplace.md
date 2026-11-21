# autoplace: pads that find the people

A person sits down in view, and their pad with its falling tiles moves to their feet. One short calibration (two taps) teaches the floor where the camera's picture lands. After that the pads follow the people in the lobby.

## Done
- `src/stage/autoplace.js` (new, pure plus a small follower) and `src/stage/autoplace.test.js` (21 tests):
  - `fitMap(points)`: least-squares `{ a, b }`, u = a + b * x. Throws a plain sentence for fewer than two points, points under 0.05 apart in x, and two marks in the same place on the floor.
  - `placePads(layout, feetXBySpot, map, { gap, minW, widths })`: each pad centred on map(the seat's feet). A seat with no feet keeps its place. Pads keep their order, never overlap, stay inside 0 to 1. Two close people narrow both pads to meet half way (gap 0.02, minimum width 0.1). `widths` is each pad's normal width so pads grow back when people move apart. v and height never change.
  - `easeLayout(current, target, dtMs)`: each pad edge moves at most 0.05 of the picture a second, and not at all within 0.015. Pads cannot overlap on the way.
  - `createFollower(...)`, `loadMap`, `saveMap`, `usableMap`, `isFollowing`, `setFollowing`. Saved keys: `pp:floor-map` (`{ a, b, facing }`) and `pp:floor-follow`.
  - Facing: nothing is flipped in code. The map's slope carries the mirror. Tests cover b > 0 and b < 0. The saved map records which way the picture was turned, and a map made the other way is not used (it would be backwards). Step 3 says so and offers "Do it again".
- `src/track/seatsource.js`: three small additions. `feetX()` (the middle of each seat's feet, camera x, null for no person or a dropped pose), the latest tap in `taps()` now carries `x` (the foot that tapped; a one-lane pad takes the foot that came down furthest in the last 500 ms, because the tap does not say which foot), and the pure helpers `feetMiddle` and `tappedX` with 2 tests. `taps.js` is untouched.
- `src/stage/setup.js`, step 3 "Seats on the floor", seated mode only:
  - Main button "Place by the camera". It draws two big numbered marks on the foot line at u 0.2 and 0.8 and says: "Put one foot on mark 1 and tap it. Then mark 2. One person can do both, or two people one each."
  - Each tap puts a tick on its mark. After the second the map is saved, following is switched on, and the pads jump to the people at once (not eased).
  - A second tap too near the first says so and keeps waiting on mark 2. No tap for 20 seconds says: "No tap on mark N was read in 20 seconds, so the pads stay where they were. Check the tap test in step 5, then try again." Nothing is moved then.
  - Once a map exists the button becomes "Do it again", and a "Pads follow the people" toggle appears (saved, on by default). While step 3 is open the pads follow live, so you can watch them.
  - Dragging, resizing or arrow-moving a pad turns following off and says so under the buttons.
- `src/stage/setup.css`: `.setup-marks` and `.setup-mark.is-done`.
- `src/stage/main.js`: one marked block plus its import (see below).
- `public/qa-fixtures/`: `three.png`, `uneven.png` (three men at uneven spacing, made from three.png), `real-two-1.json`, `sample-recording.json`. The preview build serves only what `public/` holds at build time, so these ship in `dist/` too (about 2.3 MB). Delete the folder before the final deploy if size matters.

## The stage block (src/stage/main.js)
- Line 23: `import { createFollower } from "./autoplace.js";`
- Lines 186 to 199, between the markers `// ---- autoplace: ...` and `// ---- end autoplace ----`, just above `let padLanes`. A `setInterval` every 200 ms calls the follower. `frame()` is untouched.
- It moves pads only when `snap.status === "lobby"` and setup is not open. It applies the layout with `session.setLayout(next)` then `publish()`, so phones get the same seats. It does not call `feetSource.setLayout`: the ids and their order never change, so the slices need nothing, and that call would reset the unsaved autofit lines.

## What the session does with layout changes
`session.setLayout` returns false in `countdown`, `playing` and `paused`. The `layout` message (seat count) is refused in the same three states with "The seats cannot change while a song is playing." So even a bug here could not move a pad in a song. The follower also stops by itself in those states, and in `results` (the session would accept a change there; the floor shows scores, so it waits for the lobby).

## What I saw
Numbers are pad centres as a share of the floor width.
- Built copy, `stage.html?feet=seats&seats=3&src=/qa-fixtures/uneven.png`, map set by script, no taps. People's feet by the model: about 0.17, 0.37 (only one foot found), 0.87.
  - `facing=0`, map u = x: pads 0.18, 0.50, 0.82 became 0.163, 0.375, 0.85 in about 6 s. Pad 2 and pad 1 narrowed from 0.28 to 0.17 and 0.19 to meet half way.
  - `facing=1`, map u = 1 - x: pads became 0.149, 0.629, 0.835. Seat 1 is under the person at the picture's right, seat 3 under the one at the left, which is the players' view. On the projector (turned half way round) the pads sit under the people in the camera picture.
  - Shots, all opened: `shots/autoplace-compare-f0-before.png`, `-f0-after.png`, `-f1-before.png`, `-f1-after.png` (camera picture above, floor below, 900 px wide), and `shots/autoplace-dots-uneven.png` (the model's feet dots).
- The calibration flow on the recording `real-two-1.json` (its taps drive it): marks 1 and 2 drew, the first tap ticked mark 1, the second tap was too near and showed the refusal sentence, a later tap saved the map and the pads moved. The saved map was a = 5.24, b = -8.53, which is nonsense as geometry, because the recording's people were not tapping on marks. It proves the flow, not the numbers. Shots: `shots/autoplace-cal-1-marks.png`, `-2-done.png`, `-3-following.png` (facing 0; I opened `-1-marks` and `-3-following`), and the same run with facing 1 as `autoplace-cal-real-two-1.json-1-*.png`. Step 3 follow and drag shots: `autoplace-step3-follow.png`, `autoplace-step3-dragged.png`.
- Still picture (`three.png`, cannot tap): after 20 seconds it said the sentence above and the pads stayed as they were.
- Song: with a map and the lobby settled, I changed the map and started a song with Space. The pads stayed exactly put for 6 seconds, and started moving only after Esc returned to the lobby.
- Hand drag in step 3: pad 2 moved 120 px, following turned off, the line appeared, the saved switch read false. Pressing the toggle turned it on and the pad went back to the person.
- No console or page errors in any run.

## Checks
- `node --test src/stage/autoplace.test.js src/track/seatsource.test.js`: all pass. `npm.cmd test`: 382 tests, 380 pass, 0 fail, 1 todo (taps.test.js, known).
- `npm.cmd run build` passes from PowerShell.

## Guesses
- Follow speed 0.05 of the picture a second, dead zone 0.015, gap between pads 0.02, minimum pad width 0.1 (same as setup's smallest pad), 1 second median window for each seat's feet (so one lost foot does not jerk the pad), 20 seconds a tap, 500 ms window for "which foot came down".
- The follower looks every 150 ms and recomputes each time, not once a second. It was cheap and eases smoother.
- The 0.05 spread limit from the brief still allows a very steep map (b up to 12). A real calibration should spread 0.2 or more. I did not add a slope limit because the brief set the rule.

## Known weak spot
A seat that sees only one foot (pad 2 in the uneven picture) is placed under that foot, not under the person. The error is about half the foot gap, which could be 0.04 to 0.08 of the floor. A fix would be to remember each seat's usual foot gap, or to blend in the hip. Not built.

## Not checked
- A real projector, camera and people: whether the straight line is good enough across the real foot zone, whether two taps by one person at marks 0.6 of the floor apart can both be read, whether 0.05 a second feels right to people sitting down, and whether a person leaning gives a stable foot middle.
- A one-lane pad (phones holding two or more seats): which foot "came down furthest" is tested only with fake numbers.
- A map made, then the picture turned with key T: only the unit test for `usableMap`, not clicked on a page.
- Following with phones joined and a song ending to results then lobby on a real stage.
- No `/web-interface-guidelines` run and no design skill loaded: the new controls reuse the existing setup buttons, notes and tokens.
- `docs/SETUP.md` still describes the older steps.

## Needs from others
- Lead: decide whether `public/qa-fixtures/` ships. Update `docs/SETUP.md` with the new step 3 buttons if wanted.

## Calls I made
- Following runs only in the lobby, not in results.
- Following also runs inside setup step 3 (its own follower), and the stage's follower pauses while setup is open, so the two never fight.
- Calibrating again turns following back on.
- The preview-served fixtures live in `public/`, because `qa/` is not served on 4173.
