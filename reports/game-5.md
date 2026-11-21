# game-5, card G5

## Done
- `src/stage/session.js`: `tick` now also returns `songMs` (song clock in ms, negative in the lead-in, frozen while paused, null when no song is live) and `song` (the full current song object, null in the lobby). Test added in `session.test.js`.
- `src/stage/main.js`: rebuilt around `createSession` and `feetBySpot`. Link messages go to `session.apply`; the State goes out twice a second and after every apply and status change. One feet-source picker (`?feet=mouse`, default; an unknown name shows a plain-words error). Sound from `drain()`: `note` on a hit, `noteOn` until that seat and lane's `holdEnd`, the thud on a miss, `stopAll` on any status change away from `playing`. Calls `synth.load/setVolume/backing/stopAll` with `?.`. Keys F, P, S, Esc. `?demo=1` (Ana, Ben, Cy, Dee in the seats, Space starts Twinkle then Greensleeves) and `?autostart=1` (with demo). The QR code uses the first address from `/lan`.
- `src/game/render.js`: rewritten. One pad per spot at its `rect` in its Seat colour, with lanes, square zone, hit line, tap and hold tiles, hit flashes, lit lane under a foot, and that seat's score and combo. Empty pads are dim with the seat number. Lobby (QR and "Scan to play", seat numbers, names), countdown (3, 2, 1), paused, results (grade, score, best combo, name for each seat).
- `stage.html`: `<link rel="icon" href="data:,">`.

## How I checked
- `node --test src/stage/session.test.js`: 29 pass, 0 fail. `npm.cmd run build`: passes.
- Shots at 1280x720, all opened: `shots/game-5-lobby.png` (QR, three named pads), `shots/game-5-play.png` (three pads, tiles), `shots/game-5-hit.png` and `shots/game-5-paused.png`, `shots/game-5-countdown.png`, `shots/game-5-results.png`, `shots/game-5-link-lobby.png`, `shots/game-5-empty-lobby.png`, `shots/game-5-badfeet.png`.
- A second page joined and claimed over the link: "Zo" appeared on pad 2 and in the State (560 bytes, under the relay's 4096 limit). Claiming seat 9 gave "That seat does not exist." Start, pause, resume, stop and leave all changed the State as expected. A mouse click on the first tile scored 50 (good) on that seat only. Console: no errors or warnings, also with the sound unlocked and keys P, S, Esc pressed.
- Not checked: sound by ear. The lag shift (offsetMs 120) and the QR scan with a real phone.

## Not done
- Nothing on the card is left out. The `calibrate` event from `drain()` is ignored: the setup card wires it.

## Needs from others
- Setup card (T3): when the stage is opened by a person, they must press a key or click once so the browser lets the sound start (F for fullscreen does it). If a game starts from a phone before that, the floor is silent. T3 could show a line for it.
- Setup or camera card: call `session.setReady(...)` when the camera and calibration state change (not called yet, so `ready` stays false).

## Calls I made
- `pp:layout` is read by passing it to `createSession`, which already checks it with `isLayout`. I also save the layout back to `pp:layout` after every message, so a phone's layout change survives a reload.
- The session runs on `now - offsetMs` for `tick`, `apply` and `snapshot` alike, so pause, resume and results timing share one clock. The backing gets `songMs + offsetMs`, so it lines up with when the tile looks like it is on the line.
- A change of `offsetMs` while a song plays shifts the clock by the difference at once.
- Text is made smaller to fit a pad's width, never cut, so long names and "Combo 24 x2" on a four-pad layout fall under a tenth of the picture height.
- In the lobby only each pad's square zone is drawn, so the QR code above belongs to no seat.
- Score sits in the strip above the pad and combo just inside its far edge, because the lower part is where feet stand.
- Left out: song title, train clock, effects and glow (card G3); any text for a refused command on the floor (phones show `notice`).
