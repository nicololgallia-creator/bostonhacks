# floor-1, card F1 (wave 3, as changed by Nicolo at 2:30 PM)

## Done
- **Item 1 dropped** (Nicolo, 2:30 PM): no resting pad, no "YOU'RE UP", no "EVERYONE", no count-in, and `waitMs` is not read anywhere. I had started it and removed all of it (checked with a search of `render.js`).
- `src/game/render.js`:
  - **(2) Train clock to the real arrival.** With a `transit` that has `endsAt`, the train and the digits run from the moment the first song of the set begins to `endsAt`, across every song, and the station carries the stop's name. With no `transit`, or no `endsAt`, they follow the song as before. The train is drawn smaller when the track is short, so it always has room to move.
  - **(3) Team.** While playing, `TEAM <score>` sits along the top between the digits and the track (the score counts up). It is shown only when two or more seats are playing, since with one seat it would repeat the pad's score. Results now lead with a band: the team's grade stamped in first and large, the team score counting up, and "51 of 60 hit"; the seats stamp in after it, below. Pads show "Seat N" on results (no names).
  - **(4) Bug 5.** TOP SCORE needs a score above zero, so an all-zero round marks nobody.
  - **(7) Sound line.** In the lobby, "Click once to turn the sound on" in the left column beside the QR code until the page has had a click or key (`navigator.userActivation.hasBeenActive`). It goes away by itself after the first click. No state kept.
  - Lanes: nothing hard-coded to 3; pads use the data's `lanes`. The lobby no longer draws `undefined` if a player has no name.
- `src/stage/main.js` (two lines): `team: snap.team` passed to the renderer, and `isPlaying` passed to setup.
- `src/stage/setup.js`: **(5) Bug 9**, a "song is playing" refusal is dropped as soon as the choice changes (it already was) or the song ends (new optional `isPlaying()` callback, checked each frame in the seats step). **(6) Bug 12**, Straighten lets Next through from the start, with the lines "Look at the squares on the floor. If every one looks square, press Next." and "If they look stretched, drag a corner until they look square. ...".

## How I checked
Browser: headless Edge at 1280x720. Scripts are in the scratchpad (`...\scratchpad\f1-scenes.mjs`, `f1-real.mjs`, `f1-setup.mjs`, `f1-fps.mjs`), outside the project. Real runs use two scripted phones on the real link and a real `stage.html?feet=mouse` (no demo). All shots are in `shots/`, opened at 900 px.
- **Two seats playing at once, different tiles, 2 lanes each, team on the top, train to Kenmore:** `shots/floor-1-play-two-a.png`, `floor-1-play-two-b.png` (300 ms later: 68,647 pixels changed). Real State: team `{score 0, hits 0, total 42}`, transit with `endsAt`. Seat 3 is empty and stays as an empty pad.
- **Train clock across a two-song set** (Twinkle then Greensleeves, `endsAt` 15 s after the set should end): `floor-1-train-set-song-two.png` reads 0:52 with 51 s truly left in the set, while song two itself had 37 s left. Digits were 1:31 in song one (`play-two-a`).
- **Train position at start, halfway and late, and urgent colour:** `floor-1-transit-start.png` (0:59), `transit-half.png` (0:27), `transit-late.png` (0:07, yellow). These come from a made-up view fed to the real renderer with the clock moved (a temporary page, now deleted).
- **Four seats with a long stop name:** `floor-1-four-clock.png` (train shrinks and still fits).
- **Team results:** `floor-1-results-team.png` (made-up scores, A team grade, TOP SCORE on seat 1). **All-zero results, real run:** `floor-1-results-real-zero.png` (no TOP SCORE; the made-up version is `floor-1-results-zero.png`).
- **Sound line:** `floor-1-lobby-click-for-sound.png` (line present), `floor-1-lobby-after-click.png` (gone after one click).
- **Setup:** script `f1-setup.mjs`: Straighten step 1 has Next on and both lines (`floor-1-setup-straighten.png`). Start a song, open setup, Place the seats, click seat count 2: refusal shown (`floor-1-setup-refused.png`), still shown while the song plays, gone within 700 ms of Stop (`floor-1-setup-cleared.png`).
- Frame rate (headless, 8 s each, made-up views): 2 pads 116.6 fps, 4 pads 120.0, transit 118.7; 99th percentile frame 16.7 / 8.5 / 9.0 ms. Console: no errors in any run. `npm.cmd run build` from PowerShell passes.

## Not done / not checked
- **Not checked:** motion by eye, a real projector, the real camera, and the new Twinkle run with real hits. The made-up results and clock scenes are the renderer's output, not a real play, and say so above. Real play only had a mouse that hit nothing, so every real score is 0.
- Text under a tenth of the picture height: "TEAM" and the "of hit" line (0.06), the station name (0.045), and the team score on the clock (0.07). Same call as G3: nothing is cut, text shrinks to fit.
- Not built, because it was not asked: any change to the pause screen, the countdown, or the pads' look.

## Needs from others
- PLAN.md, `reports/tracker-3.md` and `reports/tracker-5.md` list `openSetup`'s options; `isPlaying` is a new optional one (the lead).
- The team score is hidden with one seat on purpose; say if it should show then too.
- The train starts when the first song of the set begins and keeps running while paused (the real train does not wait). If a set is stopped and restarted with the same stop and arrival, the train starts again from the restart.

## Calls I made
- The sound line uses the browser's own `navigator.userActivation.hasBeenActive`, not a flag in `main.js`, so `main.js` needed no change for it. A browser without it shows no line.
- `playing` for setup is a callback, not a status copy, so the refusal clears the moment the song ends, not only on the next click.
- The results rectangles are moved down below the team band (`RESULTS_TOP = 0.32`) for every pad, including empty seats, so nothing collides with it.
- The other builder's layout changes landed while I worked (`isLayout` was briefly missing); I waited for them to finish and did not touch `layout.js`, `session.js`, `parts.js`, or `engine.js`.
