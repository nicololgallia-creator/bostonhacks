# phone-main: the new look is now the real phone app (screens 1 to 5)

## Done
- `index.html` now loads `src/app/main.js` and `src/app/app.css` (the pilot's styles, moved). The old dark app is gone.
- `src/app/`: `main.js` (shell: link, join, `here` every 3 s, banner, history Back, live screen swap), `train.js` (address, State or default), `parts.js` (conductor mount, train car, covers, away/back rules), `opening.js` (the train pulls in, 1.5 s, ignores taps), `lines.js` and `covers.js` (moved), `mock.js` (`?mock=1`: the real session plus a fake player), `fonts/`.
- `src/app/screens/`: one file per screen, registered in `screens/index.js` (`SCREENS`, `FIRST`, `LIVE`). A later screen is its file plus one import and one array entry. `LIVE` maps a game status to the screen that takes over, so the leaderboard card changes `results: "look"` to its own id. Screens: `stops.js`, `song.js`, `seats.js` (+ `seats.css`), `look.js` (+ `look.css`).
- Seats: the State's `layout.spots` drawn by their rects, "Player N" plates in the floor's seat colours (`seatsOf` in `lines.js`, tested equal to `floor-look.js`). Tap takes (`claim`), tap on yours gives back (`release`), another phone's shows "Taken". The two lane rules sit under the floor and the one that applies lights up from the State's `layout.lanes`. Ready! sends `start` with one song and `transit {stop, mode:"train", endsAt: now + ride}`. Refusals show the stage's own words in a banner.
- "Look down!" counts 3, 2, 1, then Playing shows the title, "Your stop in" clock, team score, small Pause (Resume) and Stop (second tap, forgotten after 3 s). Results shows a plain stand-in until the leaderboard card replaces it.
- Removed: `pilot.html`, its line in `vite.config.js`, everything in `src/phone/` except `fonts/`, and `pilot.js`, `pilot.css`, `covers.js` from `src/pilot/`.
- Tests: `src/app/lines.test.js`, `train.test.js`, `mock.test.js` (12, all pass).

## How I checked
- Real round trip on a production build (`vite preview`, stage in one browser, phone in another, a raw listener on the link): arrive, pick Kenmore, take the song on the ticket, take seats 1 and 2, Ready. State sequence read from the link: `lobby` no seats, `lobby` seat 1, `lobby` seats 1,2, `countdown` song seven-nation-army seats 1,2 stop Kenmore, `playing` same. No console errors on either page. Also dropped the phone from the stage (`leave`) and brought the tab back: seats 1,2 came back by themselves.
- Error states on the build: MBTA blocked (real reason "Could not reach the MBTA. Check the internet connection." with Try again); no stage ("No floor is connected. You can still look at stops and songs." and the seats screen says so, Ready off); two phones racing for seat 3 (loser sees "That seat is taken.", gone after 4 s); server stopped (banner "Lost the connection to the floor. Trying again.") then restarted (banner gone, pads back).
- Hidden and shown (12 s, CDP frozen), resized 360/430/390, data refreshed, on stops, song, seats, look: one screen, one map or ticket or floor, one conductor, 3 pads, nothing half-way after return, no sideways scroll. The opening left half-way finishes and is removed.
- Alignment (`centres.mjs` on the app, 711 checks at 390, 360, 1440, scale 1 to 3, after resize): every dot, train and bar centre within 0.000 px at rest. Two over 0.5 px (0.69 and 1.0) are the ticket mid-entrance tilt, the same case look-pilot-2 reported.
- `node tools/phone-check.mjs "http://localhost:5173/?mock=1"` PASS 390 and 360. For the other screens I walked the mock and ran the same measure on stops, song, the song sheet, seats (none and two taken), count and playing at 390 and 360: all PASS, no console errors.
- `npm.cmd run build` from PowerShell passes. `npm.cmd test`: 346 pass; one failure in `src/track/taps.test.js:422` (a file another builder is editing; not mine).
- Screenshots (dpr 1, all opened): Green B 390 `shots/phone-main-green-390-1-stops.png`, `-2-song`, `-3-seats-empty`, `-3-seats-two`, `-4-look-count`; Red 390 `shots/phone-main-red-390-*` (same names, plus `-5-look-play`); Green 1440 `shots/phone-main-green-1440-*`; Blue 360x640 `shots/phone-main-blue-360-*`; Orange 4 seats `shots/phone-main-orange-390-*`; real stage `shots/phone-main-real-390-*`; opening `shots/phone-main-opening-390-1..3.png`; states `shots/phone-main-state-390-e1-mbta-down.png`, `e2-no-floor`, `e3-no-floor-seats`, `e4-seat-refused`, `e5-link-lost`. Not opened: `phone-main-green-390-5-look-play.png` (the dev server reloaded the page mid-run and it shows the first screen; the Red and real-stage playing shots replace it), `phone-main-green-1440-1/2/4/5`, `phone-main-blue-360-1/2/4/5`, `phone-main-orange-390-1/2/4/5`, `phone-main-red-390-1`, `phone-main-state-390-e3` and `e5`.

## Not done
- Leaderboard, share, play again: next card. After a song the phone shows a short stand-in and returns to the seats when the stage goes back to the lobby.
- `src/phone/fonts/` and `src/pilot/` (a one-line `lines.js` re-export and `fonts/`) are still there, because files I may not touch read them (below).
- Not judged: motion as felt, a real iPhone (safe areas, `color-mix`, `dialog`), a locked phone.

## Needs from others
- **src/game (floor-look.js):** change `../pilot/lines.js` to `../app/lines.js` and the two font paths `../pilot/fonts/...` to `../app/fonts/...`. Then delete `src/pilot/` whole. It can also import `seatsOf` from `app/lines.js` instead of rebuilding the same four colours (`app/lines.test.js` fails if the two ever disagree). **src/game/render.js** and **src/tokens.css** still point at `src/phone/fonts/bricolage-*.woff2`: move those two files and fix the two paths, then delete `src/phone/`.
- **src/track taps.test.js line 422** fails now (1 !== 0).
- **A locked phone loses its seats (stage rule, 10 s without `here`).** A phone that dims during a song stops sending `here`, the stage frees its seats, and with none left it returns to the lobby. The app asks for its seats back when the tab returns (tested), but a game already ended by that is not. For the demo: keep the phone awake, or the stage can allow a longer `HERE_MS` while a song plays. Wake Lock needs https, and the QR points at plain http.
- **qa/e2e scripts** still drive the old phone page (name form, `.pad`, `data-act`) and will fail.
- **PLAN.md / docs/HOW-IT-WORKS.md** still describe the old phone files.
- **Dev server:** edits to `src/stage/` or `src/game/` by other builders reload the phone page in `npm run dev` (it imports `stage/session.js` for the countdown length and the mock). Test on `npm run build` then `vite preview` (as look-pilot-2 advised).

## Calls I made
- The train: the address wins; with none, the State's `train`, waiting up to 1.5 s before the first screen; with no stage, the pilot's defaults. A different train arriving later is taken only while the person is still on the first question.
- Seat colours are the floor's (half-way shades minus the line's own, plus cap blue), not the old neon `--seat-*`.
- Seats chosen are remembered and asked for again after a lock, a returned tab or a reconnect, only when the State shows them free and no song is running.
- Browser Back walks the flow (stops, song, seats); the live game screen is not in the history.
- "Look down!" counts from when this phone first sees `countdown` (the State has no sub-second clock): 3, 2, 1.
- The mock is the real `createSession` with a fake player (misses every seventh tile), so it speaks the real State. Address options: `&seats=1..4` (default 3), `&others=2,3` (seats other phones hold, default 2), and the train.
- Skills: no skill loader in this tool, so none loaded. I read `My design taste.md` (one focus a screen) and Lean code, and matched the pilot.
