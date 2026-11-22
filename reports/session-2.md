# session-2: modes, four seats, the warm-up

The full contract is in PLAN.md, "Data shapes", block "Wave 9 additions (Sat 21 Nov, session-2 ...)". Copy of the short form:

## Contract

Messages from a phone:
- `{ type: "mode", clientId, mode: "team" | "versus" }`: lobby only. Otherwise refused: "A song is running. Change the mode when it ends." Any other value is ignored.
- `start` may carry `mode`: `"versus"` is versus, any other value is team, none keeps what the lobby shows.
- `{ type: "skipWarmup", clientId }`: from a phone holding a seat, or the stage (key W). No seat: "Take a seat to skip the warm-up." Outside the warm-up or no valid clientId: ignored.
- `{ type: "set", clientId, warmup: true | false }`: default true, read at each start.

State changes:
- `status`: `lobby | warmup | countdown | playing | paused | results`.
- `mode`: lobby shows the last one chosen. In a song it is the mode that song runs as (versus with one seat runs as `"team"`).
- `winner`: `{ spotId, score } | null`. Results only, versus only, two or more seats left, one seat alone at rank 1. Else null.
- `players[].rank`: versus only (else null). 1 is best, ties share a rank, then skip (1, 1, 3). Live during the song.
- Versus pays no bonus (`bonus` 0, `bonusFor` null). Team pays +50 and +25 as before.
- `warmup`: `{ need: 4, beatMs: 600, maxMs: 15000, startedAtMs, players: { "<spotId>": { taps, ready, tapAtMs: [..] } } } | null`. Non-null in `warmup`, and in a pause that began there.
- `settings.warmup`: boolean.
- Which seats are in the game: `players[]` is enough (one entry per taken seat, seat order, lobby too). No `taken` field added.
- Drain events: `{ type: "warmupTap", spotId, taps, atMs }` per tap. `status: "warmup"` on entry.
- Exports from session.js: `WARM_TAPS` 4, `WARM_BEAT_MS` 600, `WARM_MAX_MS` 15000. From layout.js: `DEFAULT_SEATS` 4, `keptLayout`.

What each value holds during warm-up:
- `tick()` returns `status: "warmup"`, `pads` for each taken seat with `tiles: []` and the song's lane count, `songMs: null`, `song` the full song.
- `secondsLeft` is the song length plus the 3 s countdown and 2.5 s slide-in, held still. `snapshot().song` and `queue` are set.
- All scores are zero. `team.total` is the sum of the parts.

Rules I decided where the card was open (all in PLAN.md):
- Warm-up is the first song after the lobby only. The next song of a queue and a skip go straight to the countdown.
- "Play again" (results, lobby, start by the same people in the same seats as the last warm-up) skips it.
- A stopped warm-up does not count as done, so the next start warms up again. A timed-out or skipped one counts.
- A tap is one rise in standing feet per frame. Two feet landing together are one tap. A foot gone under 150 ms has not left, so flicker is not a second tap. A foot already standing at the start is not a tap.
- The timeout notice goes to the one phone with unready seats. With several phones the single notice slot is for everyone (`for: null`). A skip gives no notice.
- `skip` during a warm-up goes to the next queued song's countdown, or the lobby.

## Done

- `src/stage/session.js`: modes, ranks, winner, the `warmup` status, `skipWarmup`, `mode`, `settings.warmup`, four seats by default. `LIVE` includes `warmup`, so a locked phone keeps its seats.
- `src/stage/layout.js`: `DEFAULT_SEATS`, `keptLayout`. Before today the stage saved its own 3 even pads on every run, so a plain "default is four" would never reach the floor. `keptLayout` drops a saved layout that is exactly those untouched 3 pads. Moved pads and other seat counts are kept. `?seats=N` still wins.
- `src/stage/main.js`, small marked blocks ("wave 9"): `keptLayout` in the session's layout; `LIVE` has `warmup`; setup closes on `warmup`; demo Space sends `set warmup:false` first; `draw()` also gets `mode`, `winner`, `warmup`; key W sends `skipWarmup`.
- `PLAN.md`: dated block added before "Fake on purpose".

## Checked

- `node --test src/stage/session.test.js src/stage/layout.test.js`: session 106 pass (87 before, 19 new), layout 12 pass (2 new), 0 fail.
- New tests cover: mode set, refused in each status, start carrying mode, one-seat versus as team, versus split with the mode, winner and ranks (live ranks, 1/2, 2/1/2 with ties skipping, tie at the top, nobody plays), no bonus in versus, no winner in team, seats 2 and 4 of four (two pads, one lane each), four seats and a fifth refused, warm-up shape and values, taps (arrival, stay, flicker, lifted, two feet, already standing, bad feet), end on 4 taps each, timeout and the notice (one phone, several phones, ready phone), skipWarmup (seat holder, no seat, stranger, no id, stage, outside), setting on and off, first song only, play again, stopped warm-up repeats, pause and resume clock, stop, quiet phone, leave, release, skip, lag shift, demo path, malformed messages.
- Old tests changed, with the reason:
  - The old tests use a `quiet()` session with the warm-up off. They start a song and expect the countdown at once.
  - Default layout is 4 seats, so three assertions about 3 seats changed to 4, and "seat 4 does not exist" became seat 5.
  - The State shape test gained `mode`, `winner`, `warmup`, `rank` and `settings.warmup`.
  - Another builder's `game/chart.js` landed while I worked (team split in runs, shared tiles, holds, extra tiles). Tests that hard-coded who plays which note (`tiny` 2 and 1, `scale` 3/2/3, "every note once", 16 and 16) now ask `splitParts`. The `play` helper holds the foot for hold tiles. They stay valid for any split.
- Scripted run on the built copy (`npm.cmd run build`, then http://localhost:4173/stage.html?seats=4&facing=0, a raw `ws` link client and puppeteer; script in the session scratchpad, shots in `shots/session-2-*.png`):
  ```
  lobby: seats=4 mode=team warmup setting=true
  taken: 2:phone-a,4:phone-b layout.lanes=1
  mode set to versus by phone-b
  state: warmup mode=versus players=2,4 warmup={"2":0,"4":0}
  after 2 rounds: {"2":2,"4":2}
  state: countdown mode=versus ... warmup=null     (notice null: both ready)
  state: playing > results
  results: mode=versus winner={"spotId":2,"score":650} players=[{spotId:2,score:650,rank:1,bonus:0,total:14,hits:8},{spotId:4,score:0,rank:2,bonus:0,total:14,hits:0}]
  statuses seen: lobby > warmup > countdown > playing > results
  console errors: none
  ```
  Four mouse clicks in each pad ended the warm-up, and both seats had 14 tiles (the same number). Seat 2 only spam-tapped and won. No bonus was paid.
- What the floor drew: during `warmup` a plain green screen with nothing on it (the floor does not know the status yet, `floor-screens.js` only has lobby and countdown). The countdown, the playing floor and the results board drew normally (seats 1 and 3 shown as empty "Seat 1", "Seat 3"; pads 2 and 4 with their numbers).
- `npm.cmd test`: the failures not in my files are listed below. My files pass.

## Not checked

- A real phone, the real camera and the real floor. Warm-up taps were from the mouse only. Real tracker taps (flicker, `lifted`) are tested with made-up feet.
- Versus "same max score" in the sense of identical hold lengths per player: that is `chart.js` (rules). I only checked equal tile counts (14 and 14, 16 and 16) and that a tie is a tie.
- `?demo=1` Space start was tested in the session test (stage start with the warm-up off), not clicked in a browser.
- Whether Nicolo's floor browser still holds an old saved layout of moved pads: `keptLayout` keeps those on purpose, so he may need `?seats=4` once.

## Needs from others

- **`src/app/mock.js` line 16 (phone builder).** The fake floor uses the real session, so a start now goes to `warmup`. `src/app/mock.test.js:20` fails ("a phone joins, takes two seats..." expects `countdown`). Fix: after `createSession`, add `session.apply({ type: "set", warmup: false }, 0, { stage: true })`, or have the test expect `warmup`. Without it the phone preview shows a warm-up that nobody taps.
- **Phone screens (`src/app/screens/look.js:51`, and anything that tests `status === "countdown"`).** Treat `warmup` like `countdown` ("starting"), or it falls into the "done" look. The phone should also show: mode choice (`mode` message), `players[].rank`, `winner`, the warm-up progress (`warmup.players[<own seat>]`), a skip button (`skipWarmup`), and the `notice` text.
- **Floor (`src/game/tiles.js`, `floor-screens.js`, `render.js`).** `status: "warmup"` draws nothing. `draw()` now receives `mode`, `winner`, `warmup` and `players[].rank`. Draw each taken pad with its taps (`warmup.players[id].taps` of `need`), a target pulsing every `beatMs` from `startedAtMs`, and a click on each `warmupTap` event. Show scores above each head in versus.
- **Tracker (`src/track/`).** Per seat: `warmup.players[spotId].tapAtMs` and `warmup.startedAtMs`, `beatMs` (the stage's clock). Pads exist in the warm-up, so `padLanes` is set.
- **Rules (`game/`).** `splitParts(song, seats, { mode })` is called with the mode, and the game ran with it (14 and 14 tiles in the run). Three failures outside my files at the last run, all in files others own: `src/track/seatsource.test.js` (two or three tests), `src/game/*backing*` tests. They moved while I ran; none touch the session.

## Calls I made

- `mode` message with a bad value is ignored (no notice), while a bad `mode` in `start` means team, as the card said.
- `winner` is null when fewer than two seats are left at the end, even though one seat has rank 1.
- Added `maxMs` to the `warmup` block (the card had none), so the floor need not import `WARM_MAX_MS`.
- Added the stage key W (`skipWarmup`) and the `warmupTap` drain event. The card asked for the message from the stage, and the event saves the floor from diffing counts.
- `warmup` stays non-null while paused after a warm-up began, so the floor can keep drawing it.
