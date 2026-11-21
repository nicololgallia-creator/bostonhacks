# game-1, card G1

## Done
- `src/game/engine.js`: pure rules. `lanesFor`, `laneOf`, `songSeconds`, `createGame().update(nowMs, feet)` returning `{ tiles, hitNow, missedNow, hits, misses, total, done }`. Song time 0 is when the first beat is due at the hit line, so the clock starts at -2500 ms.
- `src/game/engine.test.js`: 7 tests (lane counts, pitch to lane, hit in window, miss outside window, wrong lane and above zone, tile at the hit line, song end).
- `src/game/synth.js`: Web Audio, triangle plus two soft overtones with a 1.1 s decay, and a low thud for a miss. No files.
- `src/game/render.js`: full-window canvas, black field, lane channels, hit zone from v 0.55, hit line, sliding tiles, lit lane under a foot, lane flash on a hit, score at 16% of picture height.
- `src/stage/main.js`, `stage.html`: Space starts or restarts, F fullscreen, `?players=1..4`, `?autostart=1`, `?feet=mouse`. One line (`const feetSource`) picks the feet source.

## How I checked
- `npm.cmd test`: 7 pass. `npm.cmd run build`: passes.
- `node tools/shot.mjs "http://localhost:5173/stage.html?feet=mouse&autostart=1" shots/G1-play-3000.png --w 1280 --h 720 --wait 3000`, then `--wait 4500` (`shots/G1-play-4500.png`): tiles are in different places. Also `shots/G1-idle.png` (3 players, 8 lanes) and `shots/G1-done.png`. I opened all four.
- Scripted a full 33 s run with the mouse sweeping the zone: it ended on "26 / 42" with no page errors.
- Not checked: the sound itself (I cannot hear it; the synth runs without errors in the run above). Nicolo should press Space once and listen.

## Not done
- Only `?feet=mouse` exists. Any other `feet` value also gets the mouse until T2 adds the camera in `main.js`.

## Needs from others
- None. Console shows one 404 for `/favicon.ico` on every page; no page owns a favicon.

## Calls I made
- Lane of a pitch: `round(i * (lanes - 1) / (pitches - 1))`, so the lowest note is the far-left lane and the highest the far-right lane. A song with one pitch uses the middle lane.
- Tiles are one fixed height (12% of the picture) whatever the note length; the head reaching the white line is the beat.
- Hit tiles vanish and the lane flashes; missed tiles turn grey and keep sliding.
- The song is imported in `main.js` (not fetched) so it works in the built app too.
- The lone title and score text uses a thick black outline so it reads over tiles. It is the only text, all at least a tenth of the height.
