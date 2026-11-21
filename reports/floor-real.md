# floor-real: Zohayb's falling-tiles floor, made ours and made right

## Done
- `src/game/tiles.js`: the renderer (lanes, tiles, hits, words, pops). Lanes are drawn at each seat's pad from the State's layout (`rect.u`, `rect.w`), lane count from `pad.lanes`. Lone player: 2 lanes. Two to four: 1 lane each. No `render.js` import any more: every status is drawn here (lobby, countdown, title, playing, paused, results).
- `src/game/floor-look.js` (new): line colour theme (flat field = the line's half-way shade), seat colours, ink/white/gold, Lilita One + Nunito loaded with `FontFace` before the first draw, shared canvas helpers.
- `src/game/floor-screens.js` (new): clock as a train on a map line with the stop name, big team score and combo, countdown, title ticket, pause, lobby (QR, mascot beside it, seat zones), results as a departure board (grade disc, ranked rows, split-flap digits, bonus tags). The foot zone is one piece of code (`drawLaneZone`, `drawBadge`) used by the lobby and by play.
- `src/stage/main.js`: one line, `train: snap.train` passed to the renderer.
- Nicolo's 7:00 PM fixes: (1) QR panel: the picture is clipped to a rounded rectangle concentric with the white plate, so no corners poke out; every other panel is filled and outlined from the same rounded path, and the board rows are clipped to the board. Checked at 1280 and 1920. (2) Foot zone: footprints in ink (one per lane for a 2-lane pad, a pair for a 1-lane pad), the player's number in a seat-colour disc among them. A foot down fills the footprints and floods the zone with the seat colour; lifted, they are outlines. Lobby: open seat dim footprints and dim number, taken seat full strength. The zone is the pad's own length, with the footprints filling it, no pill and no blank band.

## How I checked
- Real stage `stage.html?demo=1&feet=mouse&autostart=1&seats=N`, N 1 to 4, Green-B: `shots/floor-real/g-seats1-10000.png` ... `g-seats4-10000.png` (and `-2000` countdown). Red: `red-seats2-10000.png`, `cd-red-*.png`. Blue at 1920x1080: `blue-seats4-1920-10000.png`. Orange lobby at 1920: `orange-lobby-1920-1500.png`. Lobby 1280: `lobby-3-1500.png`, `lobby-1-1500.png`.
- Hit, Perfect word, combo pill, lit footprints, hold in seat colour, Miss: a bot that reads the canvas and clicks the lane (frames grabbed inside the page). Seen in the scratchpad frames `h2/*`, `h4/*`, `h3/*` (not kept in the project).
- Pause: key P, seen (`res-p4-41000.png`, taken before the footprint change, not re-shot after).
- Results with scores, `+75 Best combo, Most perfects` tag, winner row: scratchpad `r2/a-t37000.png`. Zero-score board: `r/p4-37000.png`.
- Motion pair 300 ms apart: `motion-s3-9000.png` and `motion-s3-9300.png`: 19.8% of pixels changed.
- 30 s scripted run, 4 seats, headless Edge: 71.5 frames a second, 24 frames over 25 ms, worst 58 ms, no console errors. This is headless on a busy laptop, not a projector.
- `stage.html?demo=1&feet=seats&src=/qa/seats/bob.mp4&autostart=1`: plays, seat 2 lit and scored 100 (`bob-24000.png`). It ran at 13 frames a second in headless because the pose model runs on the CPU there; that is the tracker's cost, not the floor's.
- `npm.cmd run build` passes from PowerShell. `npm.cmd test`: 315 pass, 1 fails, in `src/app/mock.test.js` (the lead's phone app work, not a file of mine). My files have no tests; they are drawing code.
- Screenshots larger than 900 px (1280 and 1920 wide) were read at full size.

## Not done
- Not watched: any motion, and no real projector. The squash, pop, countdown bounce, score count-up and the board count-up are written as functions of time and each seen only at one moment.
- Not re-shot after the footprint change: the paused screen, the results screen, 2 and 3 seat play on Red (those frames came before it). The code path is the same `drawLaneZone`.
- Not run: tab hidden and shown again, a window resize while playing, a data refresh. Colour-blind check of the four seat colours. `?look=pads` not re-run.
- Held-note shot (`h4`) shows the start of a short hold; I did not catch a long hold mid-way.
- The design skills (`high-end-visual-design` and the others) are not in this tool, so the craft was held to the pilot by hand.

## Needs from others
- Lead: `src/pilot/lines.js` now re-exports `src/app/lines.js` and I import `LINES`, `lineOf`, `BUTTER` from `src/pilot/lines.js`. If `src/pilot/` is deleted, change the import at the top of `floor-look.js` to `../app/lines.js`, and the font path in `floor-look.js` (`../pilot/fonts/`) if the fonts move.
- Lead: `src/app/lines.js` has its own copy of the seat palette (`seatsOf`); `floor-look.js` builds the same four from the same shades. One of the two should import the other.
- Lead: `src/app/mock.test.js` fails (line 42).
- Peer on `src/track/seatsource.js`: a regex lost its backslashes for about 25 minutes (`/.(jpe?g|png|webp)(?|$)/i`), which blocked the whole stage. It is fixed now.

## Calls I made
- Seat colours: the four half-way shades minus the line's own, topped up with cap blue (white text on it). Shown as a disc with the number, not a "Player N" pill, in the zone. The results board still says "Player N".
- Top of the screen is a fixed band (20% of the height) for the clock and score, so the lane's tiles come out from under it. Lanes still take their x and width from the pad; their y positions follow the pad's rect with the hit line at `HIT_V`.
- No stop picked (demo): the train's station is the line's headsign.
- Hit tile squashes only when its lane just scored; a missed tile and a played tile are flat colours, not alphas.
- A temporary copy of the stage (`qa/floor-real/`) stood in while a peer's file was broken. It is deleted.
