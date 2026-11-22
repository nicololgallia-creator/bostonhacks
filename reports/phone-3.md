# phone-3: warm-up, Team or Duel, four seats, duel results, welcome QR reader, name T Tiles

## Done
1. **Warm-up in the mock and screens.** `mock.js`: `createFakeFloor({ warmup, mode, tie })`. The warm-up is off by default (`set warmup:false` after `createSession`), so `mock.test.js` passes. `LIVE` now has `warmup: "look"`.
2. **Warm-up screen** (`screens/look.js` + `look.css`): "Tap your foot 4 times", one row per seat this phone holds (seat colour, four station dots that fill from `taps`, a tick when `ready`), a quiet Skip (`skipWarmup`), then the 3, 2, 1 as before. In a duel the play screen's score box says "Top score" (there is no team).
3. **Seats screen** (`screens/seats.js` + `seats.css`): Team / Duel radio pair (sends `mode`; shows the State's `mode`; `start` carries `mode`), one line under it per mode, the State's four seats always, "1v1" / "1v1v1" / "1v1v1v1" chip, "A duel needs two players." with Ready off when one seat is taken. Lane rule follows the taken count (`lanesInPad(state.players.length)`); lanes are patched in place, so pads no longer redraw when a seat is taken.
4. **Duel results** (`after.js`, `board.js`, `stats-image.js`, `share.js`): ranks by the stage's `rank`, "Winner" tag in butter on the `winner` row, header "1v1" (or "Tie"), no team card, no bonus tag. The share image and its alt text and share text follow the same rule. Team mode is unchanged.
5. **Welcome / QR reader** (new: `screens/scan.js`, `scan.css`, `scan.js`, `scanner.js`; `main.js` has the small wiring). Bare address (no `room`, no train, no `mock`/`screen`/`link`) opens "Welcome to T Tiles", "Scan a T Tiles code near you", conductor, live camera with scan frame, and "No camera? Type the code". A good code: the frame turns the line's colour and shows the badge, line name and "Car N" for 0.6 s, then `location.assign` to the app's OWN address with only room, line, dir, at, car. `parseCode` (pure, tested in `scan.test.js`, 7 tests) takes only those values; a link must be http or https; the app never opens the scanned link. Not ours: "That is not a T Tiles code." and it keeps scanning. Camera refused or missing, or plain http: one sentence and the typed way (on http no camera box is drawn). Camera stops on leaving or hiding the tab, restarts on return. BarcodeDetector where it exists, `jsqr` (new dependency, dynamic import) otherwise.
6. **Name.** `APP_NAME = "T Tiles"` in `after.js`, `index.html` (title, apple title), `opening.js`, `app.css` comment, `public/manifest.webmanifest`. `node tools/make-icons.mjs` ran: only the manifest changed, the icon PNGs came out identical. The stage, docs, address and the other HTML pages are untouched.

## Mock addresses (all on http://localhost:4173, `?mock=1&line=Red&dir=0&at=place-knncl&car=3` as the base)
- Warm-up half done: `&seats=4&others=3&warmup=2` then pick a stop, a song, seats, Ready (2 of 4 taps and stays until the 15 s run out). `&warmup=4` fills and goes on to the count.
- Seats in a duel: add `&mode=versus`.
- Duel results with a winner: `&seats=4&others=3&mode=versus&screen=board` (also `screen=share`). Tie: add `&tie=1`. Team results: drop `&mode=versus`.
- Landing without a camera: `/?screen=scan&mock=1&camera=0`. With a camera: `/?screen=scan&mock=1` (needs localhost or https). The real landing is the bare `/`.
- `&seats` now defaults to 4.

## What I saw
- Tests: `npm.cmd test` 508 run, 506 pass, 0 fail. `npm.cmd run build` passes. `phone-check` PASS at 390 and 360, no console errors: landing, duel board, duel share, tie board. For seats, warm-up and count (reached only by walking) I measured `scrollWidth` in the scripts: 390 and 360, no sideways scroll.
- Hidden then shown: the warm-up and count unchanged; the scan screen's camera tracks go to none when hidden and back to live on return. Resized to 360 and 1440: fine.
- **Real stage run** (`stage.html?seats=4&facing=0` in one browser, phone in another, a private relay room so no other builder's stage was heard): phone took seats 2 and 4, picked Duel (chip "1v1"), pressed Ready. Phone showed the warm-up 2:0 4:0, then 1, 2, 3 as mouse clicks landed in the two pads, "Look down!" 3 and 2, "Eyes on the floor", then the board "1v1": Player 2, 4,740, Winner; Player 4, 0. No console errors.
- **QR with Chromium's fake camera** (`--use-fake-device-for-media-stream --use-fake-ui-for-media-stream --use-file-for-fake-video-capture=<clip>.y4m`; clips written by a small script that draws the `qrcode` package's module matrix into a y4m): the bare address showed the welcome; the good code (Green-B, place-bucen, car 2) showed the beat and landed on `/?room=K7M2QX9A&line=Green-B&dir=1&at=place-bucen&car=2`, "Where are you getting off?" for Green Line B. A foreign code (a menu link) gave "That is not a T Tiles code." and stayed. A foreign link with our parameters moved to our own origin with room, line and car only. This Chromium has no BarcodeDetector, so the jsqr path was the one tested.
- Camera denied: the sentence and the field. Typed codes: 7 characters, a letter that is not allowed (O), and a good one "k7m2 qx9a" move to `/?room=K7M2QX9A`.
- Screenshots opened: `shots/phone-3-seats-team-empty-390.png`, `-seats-duel-390.png`, `-warmup-2-390.png`, `-warmup-ready-360.png`, `-board-duel-390.png`, `-stats-duel-share.png`, `-welcome-390.png`, `-welcome-hit-390.png`, `-welcome-then-stops-390.png`, `-welcome-refused-390.png`, `-real-1-seats-390.png`, `-real-5-board-390.png`.
- Taken, not opened: `-seats-team-390`, `-seats-duel-four-390`, `-warmup-2-360`, `-warmup-4-390/360`, `-count-390`, `-board-tie-390`, `-board-team-390`, `-stats-tie-share`, `-welcome-360/1440/paused/typed/good/foreign/foreignours`, `-real-2-warmup-*`, `-real-3-count`, `-real-4-play`.

## Not checked
- A real iPhone camera, Safari, the share sheet, BarcodeDetector (Android Chrome), a real floor camera. The tick on a ready seat was seen only by forcing the class (a real tick needs both seats to be ready for a moment).

## Needs from others
- **Bare address on the laptop's own Wi-Fi now lands on the scanner.** `?link=local` (or any `mock`/`screen`/`link`) skips it. Old scripts that open the phone page with no address parts will see the welcome; give them a train in the address.
- `package.json` / lockfile: `jsqr` added (lead's files).
- The local link has no rooms: other builders' stages made my first real run flap between screens. Private relay rooms (`&link=relay&room=H7K3M9QX` on both pages) are clean.
- Notice seen once on the welcome check after a scan: "The floor did not see your taps." came from another builder's stage in room K7M2QX9A (I used that code in the clips). Use another room in the demo.

## Calls I made
- `matchup` is a one-liner in `after.js`; `src/game/floor-look.js` has one too, but pulling the floor's file into the phone bundle was not worth it.
- The camera code is its own small file; `src/track/tracked.js` has a different `openCamera` for the floor camera.
- Play screen in a duel shows "Top score" (highest score on the floor) in place of "Team score".
- A bad `room` makes a link no code at all; a bad `line`, `dir`, `at` or `car` is dropped and the rest is used.
- No opening animation on the welcome (no train is known yet).
