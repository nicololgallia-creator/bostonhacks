# phone-end: the three screens after a song (leaderboard, share, play again)

## Done
- `src/app/screens/board.js` (screen 6): players ranked by score plus bonus, each row in the seat's colour with a place number, "You" on this phone's seats, the score counting up and the bonus tag ("+50! Best combo") popping in after. Under the rows, a team strip with score and grade. One player gets their own card (score, grade, best combo, perfects, bonus), not a one-row table. One button: Next.
- `src/app/screens/share.js` (screen 7): "Good job! Share your game?", the stats image as the hero, an X to skip, one button. The button is Share where `navigator.canShare({files})` allows it, else Save image. A failed share shows the browser's reason and turns the button into Save image. Closing the share sheet changes nothing.
- `src/app/stats-image.js`: the 1080 by 1350 canvas. `APP_NAME = "Platform Piano"` is in `src/app/after.js`, the only place.
- `src/app/screens/again.js` (screen 8): "Play again?", two tickets, a quiet Done link.
- `src/app/after.js`: what is kept, `rank`, `twoSongs`, `rideLeft`. `src/app/fit.js`: `fitting(seconds)`, the budget the song screen already used, now shared (`song.js` calls it). `src/app/screens/after.css`.
- Small changes in files phone-main set up: `screens/index.js` (three imports, `results: "board"`), `main.js` (see Calls), `mock.js` (`demoResults`, `mockOptions`), `parts.js` (exports `isCalm`).

## What the phone keeps from results
When the State says `results` and this phone holds a seat, `main.js` copies: `song {id,title,seconds}`, `players[]` (score, bonus, bonusFor, grade, maxCombo, counts, clientId, spotId), `team {score,hits,total,grade}`, `train`, `transit {stop,mode,endsAt}`, and `mine` (this phone's seat numbers). It lives in memory only (`after.js`), replaced by the next game's results. A phone reload loses it; the screens then say so ("No scores to show.", "No game to share.") with a Pick a song button. A phone that was locked through the whole 8 seconds has nothing to show.

## Addresses
- `http://localhost:4173/?mock=1&seats=4&others=2,3&screen=board` (also `screen=share`, `screen=again`). The fake floor plays the shortest song to the end, the phone holds the seats the other phones do not.
- `&seats=1` gives the one-player card. Without `mock=1`, `?screen=share` shows the empty state.

## How I checked
- Built (`npm.cmd run build`), served at 4173. `npm.cmd test`: 380 pass, 0 fail, 1 skipped (the known todo). New: `src/app/after.test.js` (9 tests: ranking, ties, bonus lifting a seat, what is kept, the two songs, ride left).
- `node tools/phone-check.mjs` PASS at 390 and 360, no console errors: board (4 players), board (1 player), board with nothing kept, share, again.
- Round trip on the real stage (`stage.html?feet=mouse&seats=2&demo=0` plus the phone, mouse feet playing): arrive, stop, shortest song (Mary Had a Little Lamb, 21 s), seats 1 and 2, Ready, play. The phone showed the board with the stage's own numbers (stage results 600 +50 and 700 +25, team 1,375 B; phone rows 650 and 725, team 1,375 B). I pressed Next while the stage still said `results`: the share screen stayed up through the switch to `lobby` (the stage going quiet does not move it). X went to Play again with Row, Row, Row Your Boat and Happy Birthday to You. Tapping a ticket made the stage count down again with seats 1 and 2 and the phone showed "Look down!".
- Same run on the fake floor (in-page, no shared link): board, Next within the 8 s, share, 10 s later still share, again, ticket, second game "Look down!". No console errors.
- Hidden 12 s then shown, resized 360, 430, 390, and 3 s of State refreshes, on all three screens: same text, one conductor, no one-shot animation left running, no sideways scroll. A count cut by hiding the tab at 300 ms (656 571 497 330) shows the final 715 675 670 550 after it comes back, with the bonus tags visible.
- Share modes with the browser faked: no share API gives Save image and one download; share works; share cancelled changes nothing; share failing shows "Sharing did not work here (Permission denied). Save the image instead." and the button becomes Save image.
- Screenshots I opened: `shots/phone-end-board-4.png`, `phone-end-share-4.png`, `phone-end-again-4.png` (390, 4 players), `phone-end-board-solo-390.png`, `phone-end-share-empty-390.png`, `phone-end-board-360.png`, `phone-end-again-1440.png`, `phone-end-real-1-board.png` (real stage), `phone-end-stats.png` (the shared image, 1080x1350, final version).
- Taken but not opened: `phone-end-share-360.png`, `phone-end-again-360.png`, `phone-end-board-1440.png`, `phone-end-share-1440.png`, `phone-end-real-2-share.png`, `phone-end-real-3-again.png`, `phone-end-mock-2-share.png`.

## Not checked
- A real iPhone: the share sheet itself, Save image to Photos, long-press save on the image, safe areas.
- Share on the real phone page: it is plain http on the local network, where `navigator.share` does not exist, so people there get Save image. Share shows only on https.
- The stats image on a phone with no network: the cover is then left out and the title takes its room (covered by code, not run offline).
- A clean second-game screenshot on the real link. The 4173 server is shared with other builders' runs and pages; my runs saw foreign stages, a flapping status, and once a "Pick a seat before starting." notice and dropped seats from another page. The text checks passed on the quiet runs, but my one screenshot of the second game caught the interference, so I deleted it.
- A locked phone during results (stage rule from phone-main still applies).

## Needs from others
- None. The stage keeps the seats after a song (30 s grace), so Play again normally starts with the phone's seats.

## Calls I made
- Covers: the iTunes cover host allows canvas drawing (image loaded with `crossOrigin`), so the real cover is on the image. If it fails or takes over 2.5 s, it is left out.
- A total is score plus bonus (as the team score sums), ranking uses it, and the tag shows what the bonus was worth. Nicolo's example reads "1069 +50!"; if he means 1069 is the score before the bonus, it is one line in `rank`.
- `main.js` gained: `lands` (a screen the game puts you on once; the leaderboard), so Next moves on even while the stage still says `results` and the stage's later switch to the lobby leaves the person where they are. Back is hidden on it. `app.restart()` (Done, and the empty states) goes back to the first question. The kept results are saved in `main.js` on every State, and `?screen=` opens a screen directly in mock mode.
- Play again with the stage still in `results`: the tapped ticket waits and sends `start` when the lobby arrives (up to 12 s). It sends the ride's own end time, so "Your stop in" keeps counting. With no seats it sets the trip from the kept ride and goes to the seats screen.
- The two songs are the two longest that fit what is left of the ride, never the one just played; fewer than two fit, or no end known, fills with the shortest.
- The conductor appears on the board and on Play again, not on Share (it is in the picture). No skill loader here, so none loaded; I read `My design taste.md` (one focus a screen) and Lean code.
- The fake player scores the same on every seat, so the demo often gives everyone a bonus on ties. The real floor's results are shown in the round trip above.
