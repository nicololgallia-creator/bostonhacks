# game-4, card G4

## Done
- `src/stage/layout.js`: `makeLayout({ posture, seats })` (1 to 4 pads, 0.04 edge and gap, `v` 0.1 to 0.96, so 3 seats give the PLAN example rect `0.04, 0.1, 0.28, 0.86`), `feetBySpot(layout, feet)` (one-tenth margin, nearest pad centre when margins overlap, each foot to one pad, returns `{ [spotId]: [{ u, v }] }` with every spot present), `lanesFor(posture)` (3 or 4, throws on anything else). Also `isLayout`, `postures`, `MAX_SEATS` (see Calls).
- `src/stage/session.js`: `createSession({ songs, layout })` with `apply`, `tick`, `snapshot`, `drain`, holding the State exactly. Every phone message is handled (join, claim, leave, layout, start, pause, resume, skip, stop, set; calibrate only goes out as `{ type: "calibrate" }` from `drain`). One engine per taken seat. Statuses lobby, countdown (3 s), playing, paused, results (8 s), then next queued song or lobby. Pause freezes every engine's clock. Layout change refused during countdown, playing and paused. Leaving frees the seat. Bad messages are ignored, never throw.
- `src/game/engine.js`: `createGame({ song, lanes })` works; `players` still works for the old stage.
- Tests: `layout.test.js` 9, `session.test.js` 28, `engine.test.js` 23 (one new).

## How I checked
- `node --test src/stage/layout.test.js src/stage/session.test.js src/game/engine.test.js`: 60 tests, 60 pass, 0 fail.
- Session tests cover: the exact State shape, join name rules, claim (taken, move, free, no join, no such seat), leave, layout (frees vanished seats, refused mid-song, 0 and 5 refused), every start refusal, countdown to playing with the queue and transit, two seats scoring separately, results then next song then lobby, pause and resume keeping tile positions (also inside the countdown), skip, stop, leave mid-song, calibrate, set clamping, 27 kinds of bad message (no throw, state unchanged).
- Not checked: no browser, no UI (none in this card). `main.js` still calls `createGame({ song, players })`, covered by the unchanged old tests.

## Not done
- `settings.offsetMs` is stored and reported but not applied to any engine clock. The card did not say where the lag shift goes. G5 or the setup card must apply it (shift the feet's time, not the tiles').

## Needs from others
- G5 (`src/stage/main.js`): call `session.tick(nowMs, feetBySpot(layout, fieldFeet))` each frame. `tick` returns `{ status, pads: [{ spotId, lanes, tiles }] }`: the renderer draws each pad from `tiles` (the engine's tile shape). The layout for drawing is in `snapshot().layout`. Play sounds from `drain()`: engine events carry `spotId`, midi, grade, `u` and `v` (pad coordinates). Call `setReady({ camera, calibrated })` when they change. Send `snapshot(now)` as the `state` message twice a second and after every `apply`.
- G5 or T3: save the layout to `pp:layout` and pass it in at `createSession({ songs, layout })`. A dragged layout goes in with `setLayout(layout)` (returns false while a song plays or when the layout is broken).
- The PLAN "Link messages" block lists `clientId` on `start` and the others. The session does not require it on `layout` and `start`, only on `join`, `claim` and `leave`.

## Calls I made
- Song time: a song starts 3000 ms (countdown) plus 2500 ms (tile travel) before its first beat, and status turns to `playing` when the tiles start sliding. `secondsLeft` is time to the song's end, including that lead-in. Zero outside countdown, playing and paused.
- `queue` in State is the songs still to come, each as `{ id, title, seconds }`, the same shape as `song`. The shape in PLAN did not say.
- Scores are per song: each song gets fresh engines. A seat's stats stay readable through the 8 s of results, and read zero in the lobby.
- Seat changes (claim) are refused during countdown, playing and paused ("A song is playing. Pick a seat when it ends."), because a seat with no engine could not play. Allowed in the lobby and in results.
- Feet inside the one-tenth margin are pulled onto the pad's edge (u and v clamped to 0 to 1). The engine ignores feet outside 0 to 1, so without this the margin would do nothing.
- Wrong types are ignored with no notice. Right type, wrong value gets a notice (name too long, 5 seats, unknown song, taken seat). Volume is clamped to 0 to 1 and the delay to plus or minus 1000 ms.
- Names are trimmed and limited to 20 characters (refused, not cut).
- Added beyond the card, because State holds data only the stage knows: `setReady`, `setLayout`, and the `layout` option on `createSession`. Also `isLayout`, which guards a layout read back from localStorage. The layout `lanesFor` shares a name with the engine's `lanesFor(players)` as the card asked; they do different jobs (posture versus player count) so I did not merge them.
- The three other mentions of `createGame` the lean-code hook named (PLAN.md and `reports/game-1.md`) are documents, not callers. The only caller, `main.js`, is unchanged and still works.
- Left out: a cap on how many phones can join, and a cap on the number of song ids in one start. Not asked.
