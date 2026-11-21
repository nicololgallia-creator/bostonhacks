# game-3, card G3 (the floor at full strength)

## Done
- `src/game/fx.js` (new): effect pools made once (160 sparks, 24 rings, 10 words, 96 foot-trail points) and glow sprites made once, drawn with additive light. No `shadowBlur`, nothing allocated per frame in the pools.
- `src/game/render.js` (rewritten, same `createRenderer(canvas)` call). Per card item:
  1. Feet: a glow follows every tracked foot in its pad's Seat colour (white outside a pad), with a 220 ms trail, so it shows between notes and in the lobby.
  2. Tiles: tap is a solid block with a bright leading edge and an arrow cut into it. Hold is a long hollow tube with a bright head. While a foot is on it the tube fills and pulses, glows at the line, throws embers, and shrinks toward the line, so what is left is what is still to hold.
  3. Hits: spark burst and a ring at the foot, the square flashes in the seat's light colour, PERFECT or GOOD rises and fades (one word at a time for each seat). A miss flickers the square dull grey for 220 ms. A missed tile fades where it stands.
  4. Heat: the pad frame is the combo meter. It thickens and brightens through x2, x3 and x4, gets a light chasing round it from x3, and a white core at x4. Reaching a multiplier gives a flash, a ring, sparks and a big "x3". A broken combo turns the frame dull grey and drops the old number away in grey.
  5. Clock: a train runs along the top edge and reaches its station as the song ends. Time left in big digits (yellow and blinking for the last 10 seconds). With `transit` the station carries the stop's name, sized to the name. With no stop it is a finish flag.
  6. Screens: lobby (empty seats light their lanes one after another, seated pads breathe, seat colours chase round the still QR code, "Scan to play" pulses). Countdown (each number lands big with a ring and a flash, in seat colours). Song title (shown from the countdown until the first tiles are well on their way). Paused. Results (grades stamp in one seat after another with a ring and sparks, score counts up, best combo, name, and TOP SCORE with the hot frame for the best seat, ties both marked).
- Also: a dark plate under each pad's score so tiles come up from behind it. The floor uses the phone's own Bricolage Grotesque (loaded from `src/phone/fonts`, read only) with Arial Black as the fallback.
- `src/stage/main.js`: one small edit, three added lines in the `draw({...})` call: `song`, `transit`, `feet` (the field feet).

## How I checked
- Scripted a real player in headless Chrome at 1280x720 (`stage.html?demo=1&feet=mouse`, Space then S for Greensleeves): puppeteer moves the mouse to the tile's lane and presses at the tile's time, holds for holds, and skips one tile so a combo breaks. Script is outside the project: `C:\Users\nicol\AppData\Local\Temp\claude\9326cfee85e40a45\819b21c5-7848-4f22-8158-938992bc49cf\scratchpad\g3-play.mjs`. The mouse is one foot, so only seat 1 is played; seats 2 and 3 stay at 0.
- Shots (full size, all opened at 900 px): `shots/game-3-lobby.png`, `game-3-countdown-3.png`, `game-3-countdown-2.png`, `game-3-hit.png` (burst, ring, PERFECT), `game-3-combo-x2.png`, `game-3-hold.png`, `game-3-mid-a.png`, `game-3-results-a.png`, `game-3-results-b.png`, and from a Twinkle run `game-3-twinkle-x3.png` (real x3 with its flash), `game-3-twinkle-break.png`, `game-3-twinkle-results.png`.
- x4 heat, an empty seat, a held hold, the train arriving at "Government Center", a tied top score, and pause cannot be reached with one mouse in a short run. I drew them from a made-up view fed to the real renderer (a temporary page, since deleted): `shots/game-3-test-heat.png`, `game-3-test-lobby.png`, `game-3-test-lobby-b.png`, `game-3-test-transit.png`, `game-3-test-paused.png`, `game-3-test-results.png`. These are the renderer's output, not a real play.
- Motion, by two shots 300 ms apart: lobby 45,058 pixels changed, mid-song 241,241 pixels changed (threshold: summed colour difference over 60).
- Frame rate, 44 s autoplay run with 14 screenshots taken inside it: 5,305 frames, 120.0 fps, 99th percentile frame 8.6 ms, worst 16.7 ms, main thread busy 12.0 % (includes the screenshots and the mouse driving). Headless Chrome tops out at 120. A Twinkle run: 120.0 fps, worst 9.3 ms.
- `npm.cmd run build` passes. `node --test src/stage/session.test.js src/game/engine.test.js`: 52 pass. Console: no errors or warnings on the stage page in every run.

## Not checked
- Motion by eye. I proved it with paired shots only. How fast the train creeps, whether the chasing light looks smooth, and whether the countdown "lands" are not judged.
- A real projector. All shots are on a bright screen. Dim-projector legibility is unchecked: the darkest fills (empty seat lanes at 20 % of the seat colour, the hold tube's interior) may disappear, and the dull-grey miss flicker may be too faint.
- Frame rate on the real laptop with the pose model running. The 120 fps number is headless Chrome with nothing else running.
- Feet from the camera. The foot glow is drawn from whatever `read()` returns; with the mouse it shows only while the button is held.
- Sound with any of this (not my card).

## Not done / deviations
- Text under a tenth of the picture height: the combo line is 0.065, the best-combo line 0.07, the station name 0.05 and the "TOP SCORE" tag 0.065 of the height. Score, digits, words, grades and names are 0.075 to 0.4. Text is shrunk to fit its pad, never cut, so a long name on four pads goes smaller. If the projector makes these unreadable, raise them in `render.js` (search `H * 0.065`).
- The train's progress uses the song's own clock, not the real arrival time (`transit.endsAt`), because songs are picked to end as the train is due. If the real arrival moves while a song plays, the train will not follow it.
- Time left on the digits is the song's time left, for the same reason.
- Tiles fade in over the top fifth of the pad (under the score plate). Tiles are fully visible for about the last 1.7 of their 2.5 seconds of travel.

## Needs from others
- None for the card. For the setup builder (T3/T5): the floor draws the stage canvas under `applyKeystone`, so everything here (and the foot glow) moves with the straightening. If the glow looks offset on the real floor, the camera map is wrong, not the renderer.

## Calls I made
- Seat colours and the font are shared with the phone: the floor's Bricolage Grotesque is the file under `src/phone/fonts` (read only), so a font rename there would fall the floor back to Arial Black.
- Score, combo and the multiplier badge sit at the top of each pad, not below it, because the top strip is the clock and the lower part is where feet stand.
- Skills: I have no skill-loading tool in this session, so I did not load high-end-visual-design or design-taste-frontend. I held myself to the card's Projection rules, the vault's `My design taste.md` (one focus per screen, judged by eye) and AGENTS.md.
- The spark count per hit (14 perfect, 8 good) and the 160-spark pool are small on purpose; when the pool is full extra sparks are dropped.
