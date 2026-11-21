# game-8, card X4 (wave 5): the session for the new flow

## Done
- `src/stage/session.js`
  - `train` replaces `section` in the State: `{ line, directionId, headsign, atStopId, atStopName, car }`. Default is exactly `DEFAULT_TRAIN` (Green-B, 1, Government Center, place-bucen, Boston University Central, car 2). `createSession({ train })` takes a saved one; a broken one falls back to the default. `setTrain(next)` replaces `setSection`: it returns false (and changes nothing) when any part is wrong.
  - `trainFromAddress(search)` reads `line`, `dir`, `at`, `car`. It returns null when the address names none of the four. A part that is missing or wrong falls back to the default's. The headsign comes from a table (line and direction), checked against the live MBTA `direction_destinations` on 2026-11-21. The address has no stop name, so the name is the stop's id until `setTrain` gives the real one (the default stop has its name).
  - `trainQuery(train)` makes `?line=Green-B&dir=1&at=place-bucen&car=2`.
  - Bonus: each player has `bonus` and `bonusFor`. When every seat is done (the moment the status becomes results), 50 goes to the seat with the best `maxCombo` ("Best combo") and 25 to the seat with the most perfects ("Most perfects"). A tie pays every seat tied. Zero combo or zero perfects pays nothing. A seat that won both has `bonus: 75` and `bonusFor: "Best combo, Most perfects"`. Bonuses are zeroed when the next song starts and when the game returns to the lobby. A skipped or stopped song pays nothing. Only seats still playing at the end compete. `team.score` is every seat's `score + bonus`.
  - Removed: `section`, `place`, `cleanSection`, `SECTION_MAX`, `setSection`, `createSession({ section })`.
- `src/stage/main.js` (small edits)
  - The train is read from the address, else from `pp:train`, else the default. It is saved as `pp:train` on every State send. `pp:section` is gone.
  - The QR code now holds `<laptop address>/?line=..&dir=..&at=..&car=..`. The address is also set as `data-join-url` on the stage canvas so a check can read it.
  - `nameStop()`: if the stop name is only an id, it looks the stop up with `listStops()` and calls `setTrain` (the console warns and the id stays if the MBTA cannot be reached).
- `src/stage/session.test.js`: 71 tests. New ones: train default and copy, saved/broken/`setTrain`, address parsing (the card's example, defaults, junk including `constructor` and `__proto__`), the QR query and its round trip for all 8 lines by 2 directions, bonuses (split, both to one seat, tie across 3 seats, nobody scores, none mid-song or on skip, cleared at the next song and in the lobby, a seat that left, a seat with no notes). The shape tests were updated (`train`, `bonus` and `bonusFor` in a player). One older test changed: "team: two seats that play everything" now expects the team score to include the 75 bonus.

## How I checked
- `node --test src/stage/session.test.js`: 71 pass, 0 fail.
- `npm.cmd run build` from PowerShell: passes.
- Live, with `C:\Users\nicol\AppData\Local\Temp\claude\9326cfee85e40a45\819b21c5-7848-4f22-8158-938992bc49cf\scratchpad\check-x4.mjs` (opens the stage, listens to the State on the link, taps pads with the mouse) on `stage.html?demo=1&feet=mouse&autostart=1&line=Red&dir=0&at=place-pktrm&car=3`:
  - QR address: `http://10.192.148.62:5173/?line=Red&dir=0&at=place-pktrm&car=3`
  - `pp:train` and the State's train: `{"line":"Red","directionId":0,"headsign":"Ashmont/Braintree","atStopId":"place-pktrm","atStopName":"Park Street","car":3}` (the name was found live), and there is no `section` in the State.
  - During play every bonus is 0. After the song: seat 1 score 250 bonus 50 (Best combo), seat 2 score 350 bonus 50 (Best combo), seat 3 score 350 bonus 75 (Best combo, Most perfects). Team score 1125 = the three scores plus the bonuses. The next song starts with all bonuses at 0. No console errors.
- Not checked: a screenshot (the card changes no picture), and the no-parameters address in a browser (covered by unit tests only).

## Needs from others
Places outside my files that still read or use `section`:
- **setup (setup-fix, `src/stage/setup.js`):** it still has the "Where is this?" field (`section`, `setSection` options, lines 5 to 12, 131, 607 to 614). That field has no job now. `main.js` passes `section: snap.train.atStopName` and `setSection: () => true` so it does not crash; once setup drops the field, delete those two lines in `main.js` `setup()`. A setup step for the train should call `session.setTrain` (add a `setTrain` option in `main.js` then).
- **phone (`src/phone/main.js` lines 271 to 293 read `state.section.name`; `src/phone/section.js` line 55 and the map step, `src/phone/mock.js` line 15 sends `section`):** the phone must read `state.train` instead; with the new flow the line, car and section pickers go.
- **render (`src/game/render.js`):** it gets `players` from `main.js`, which now carry `bonus` and `bonusFor`; the results card can show them. The seat's total is `score + bonus` (I did not add a field).
- **lead, docs:** PLAN.md ("Data shapes" State `section`, line 197) and `docs/HOW-IT-WORKS.md`, `reports/game-4.md`, `reports/game-6.md` still describe `section` and `createSession({ section })`.
- **phone, for the flow:** `start` is refused while the status is `results` ("A song is already running"). Results last 8 seconds and then return to the lobby. Leaderboard, "Good job" and "Play again" will take longer, so a phone must wait for `status: "lobby"` before `start`, or the lead decides that `start` is allowed from results.

## Calls I made
- `bonusFor` is a string: `"Best combo"`, `"Most perfects"`, or both joined with `", "`. The whiteboard shows one "+50!" per player; the phone can show `+bonus` and the label.
- "A seat's total is score + bonus": I kept `score` as the song's score and `bonus` separate, because `total` already means the note count. The phone adds them.
- The address wins over `pp:train`, which wins over the default. An address that names some of the four parts and gets one wrong uses the default for that part (no error shown).
- A game is one song: I kept the queue (several `songIds`, skip) because the old rules and tests still hold and the demo uses two songs. The phone is expected to send one.
- Car must be 1 to 12; the card gave no bound.
- `transit.endsAt` needed no change: it is already when the train reaches the picked stop.

## Left out
- No `bonus` event for the floor to flash on; the State has it when the song ends.
- "Player 1" to "Player 4" labels: nothing in my files shows a seat to a person, so there was nothing to rename.
- No setup step for the train, and no stop-name table: the name comes from the MBTA on start-up.
