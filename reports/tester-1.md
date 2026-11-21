# tester-1 report (card E1, Sat 21 Nov, 13:20 to 14:10)

Tested the stage and the phone remote on the real link (puppeteer-core, one stage page plus up to four phone pages, each phone in its own browser context). Scripts are in `qa/e2e/` (`lib.mjs` plus `t1` to `t15`). Screenshots are `shots/tester-1-*.png`.

Bugs: 2 break the demo, 6 look bad, 8 minor. Worst first.

## Breaks the demo

### 1. A seat is held forever after a phone leaves without tapping Leave
- Screen: phone, "Pick your seat"; stage lobby.
- Steps: (1) Phone A joins as "Bob" and takes seat 1. (2) Close A's tab (or lock the phone, or walk out of Wi-Fi range). (3) Open the phone page on a new phone B, enter a name.
- Happened: B sees seat 1 "taken: Bob". Bob stays on the floor and in the State for good. With three phones that have come and gone, all three seats read "taken" and a new player sees "Pick your seat" with every pad taken, no explanation, and no way to play. Only a stage reload clears it, and that wipes everyone (bug 2). Seen in `t3-multi.mjs` section D (`shots/tester-1-e1-13-ghost-seat.png`).
- Should: a phone that has stopped answering for a short time frees its seat, or the stage can free a seat, and a full floor says so in words.
- Why it matters: at a science fair every judge who scans and walks off takes a seat. Code: `session.js` has no timer and the link (`server/link.mjs`) never reports a closed socket.
- Owner: G4 (session.js), phone message in D1.

### 2. Anything that reloads the stage page wipes every seat, and the phones are not told
- Screen: stage; every phone.
- Steps: (1) Two phones join and sit. (2) Reload the stage, in the lobby, mid-song, or during results (scripts `t4-reload.mjs`). Also happens by itself: when the dev server's own socket drops and comes back, Vite reloads the stage page (seen in `t7`, first run).
- Happened: stage is back in the lobby with the players listed but `spotId: null`. Mid-song, the song is gone with no result and the phones jump from the play screen to "Pick your seat" with no sentence about why. Each player has to tap a seat again. The phone knows which seat it had and does not ask for it back.
- Should: the phone claims its old seat again when the stage comes back and the seat is free, and says one plain line if a song was lost.
- Owner: phone main.js (phone-3 / D1), G5 (stage, could keep players in localStorage).

## Looks bad

### 3. One refusal stays on every phone for the whole song, and it says "Stop it first"
- Steps: two phones seated; both pick songs and tap Start at the same moment (`t14-two-starts.mjs`).
- Happened: the second Start is refused. Both phones show the banner "A song is already running. Stop it first." from countdown to the end of the song and through results (22 s sampled, still there). The winner sees it too, and "Stop it first" tells people to end the game that just started. `notice` is global and clears only on the next accepted command. Same cause: in the seat race (`t3` A), the player who got the seat also sees "That seat is taken."
- Should: a refusal is shown only to the phone that sent it, or only for a few seconds, and "A song is already running." needs no instruction.
- Owner: G4 (notice rules in session.js), main.js `showStatus` (D1).

### 4. A double tap on Join takes seat 2
- Steps: type a name, tap Join twice fast (`t10-hammer.mjs` A, `shots/tester-1-e1-31-join-triple-tap.png`).
- Happened: the seat screen appears under the finger and the second tap lands on seat 2's pad. The player is seated in seat 2 without choosing it.
- Should: a tap right after Join cannot claim a seat (the same 400 ms guard, or a short delay on the first claim).
- Owner: D1 (phone main.js).

### 5. Results mark every seat "TOP SCORE" when everyone scored 0
- Steps: start a song and do not step on anything (`shots/tester-1-e1-18-results-names.png`).
- Happened: three pads all say TOP SCORE above a C and 0. Phones rank all of them "1".
- Should: no TOP SCORE label on a zero score, or on a tie of nothing.
- Owner: G3 (render.js).

### 6. Set list changes under the finger on the "Your set" screen
- Steps: Kenmore, platform, pick a train about 3 minutes away, read the five songs, wait 14 s (`t13`).
- Happened: the five songs on screen are replaced by a different five as the clock ticks, while the heading still says "These five songs end as it arrives." The songs actually end about 20 s early (buffer), so "as it arrives" is not quite true.
- Should: the list stays still once shown (or changes only when it must), and the sentence says what is true.
- Owner: P2 (ride.js).

### 7. Phone with no hardware shows "The floor is not lined up yet. Run setup on the laptop." to every stranger
- Steps: any seated phone with the mouse source (`ready.camera` false).
- Happened: a technician's line sits under "Pick the music" for every player. It is true on the demo laptop until setup is done, and at 390px it pushes Change seat and Leave below the fold.
- Should: show it only on a phone that opened settings, or not at all once the demo is set up.
- Owner: D1 / P3.

### 8. Stranger test: the first screen does not say what this is
- Steps: scan the QR with no help (`shots/tester-1-s-01-name-390.png`).
- Happened: "What should the floor call you?" with a small "Platform Piano" wordmark. A stranger on a platform has not been told it is a game played with their feet, and "seat" arrives one screen later with no reason. Judges will be standing at the floor, so this hurts a passer-by more than a judge.
- Should: one line saying what it is ("Play a piano with your feet. Pick a name.").
- Owner: D1.

## Minor

9. **Stale error in setup.** Setup, step "Place the seats", choose Standing while a song plays: "A song is playing, so the seats cannot change now. Stop the song, then try again." is correct. It is still shown after the song ends, until another button is pressed. Owner T5 (setup.js).
10. **Browser Back leaves the app.** On the phone, open "Pick the music" and a stop, then use the phone's own Back: the page goes to `about:blank` (history length 2). The in-page Back button is fine. Owner P2 / main.js.
11. **Seated screen runs off a small phone.** At 360x640 "Change seat" and "Leave" are below the fold and the page scrolls (also the stop list at 360x640 and the set screen). 390x844 and larger are fine. Owner D1.
12. **Setup Next is off with no reason.** Step 1 "Straighten the picture" keeps Next disabled until a corner is dragged, even when the picture is already square, and says nothing about why. Owner T3.
13. **Anyone can end the game.** Unseated viewers and any device on the Wi-Fi get Pause, Skip, Stop (Stop needs two taps). Raw messages with no `clientId` are also accepted by the stage. The link has no rooms: a second stage page, or a stray phone from another session, shares every message (see "Environment" below). Owner G4 / link.
14. **Setup stays open over a running game.** If setup is opened (phone "Line up the camera" or key C) and a phone starts a song, the setup panel and grid stay on the projector over the floor until someone closes it. Esc, P and S correctly do nothing inside setup. Owner T3.
15. **Lag set mid-song jumps the clock.** A `set` with a new `offsetMs` while a song plays is accepted (120 to 400 ms accepted in test) and moves the tile clock at once. Not observed to break, but not looked at on screen. Owner G4 / G5.
16. **Grade placeholder is an en dash** (`play.js` 115) when a grade is null. Not a sentence, low risk. Owner P3.

## Held (tested and fine)
- Demo path end to end with the mouse as the foot: Kenmore (live data), platform, pick a train, Start, countdown, play, Stop (two taps), and a hand-picked song through to results and back to the lobby. Phone and stage agreed at every step.
- Too-close train (live times shifted so the first train is 12 s away): "Your train is too close for a song. The next one is Riverside in 3 min." and "Use the next train" works. Offline during train search: "Could not reach the MBTA. Check the internet connection." with Try again, and recovery works.
- Two and three phones: the same seat tapped at once gives one winner and the loser sees the seat as taken; change seat and Keep my seat work; a late phone joining mid-song sees the song and no score; the session never throws on a bad message.
- Queue: two songs back to back; skip in countdown, play, and results; Skip on the last song goes to the lobby; Stop in the lobby is refused politely; Pause in countdown and resume keeps the countdown; pause then resume keeps the tiles where they were (shots `e1-21`, `e1-23`); five fast Start taps and five raw starts produce one song.
- Names: empty and spaces are refused on the phone; names stop at 10 characters; 5 emoji fits; two "Nico"s are both allowed; HTML such as `<b>Hi</b>` and a raw 20 character `<svg onload=top.x=1>` shows as plain text on the floor and on phones and does nothing; a 21 character name is refused by the stage in plain words.
- Link drop (only the `/link` socket cut for 5 s, through a TCP proxy): the phone shows "Lost the connection. Trying again." after 1.5 s, recovers by itself, keeps its seat, and a song in progress carries on and reaches results.
- Setup with the mouse source: 4 steps, Back, Close, `calibrate` from the phone opens it, the seats step with Standing/Sitting and 1 to 4 seats, the lag test (a result of 240 ms was saved into the State), setup opened mid-song, and its seat change refused with a plain sentence.
- Idle lobby for 2 minutes with a phone seated: heap flat at 1.9 MB, 30 DOM nodes, 13 listeners, about 120 frames a second, 241 State messages in 120 s (expected about 240), no errors.
- `npm.cmd test`: 160 tests, 159 pass, 1 skipped (the live MBTA test), 0 fail. `npm.cmd run build` passes (PowerShell).
- Console: no errors on any demo path (the only errors were from my own proxy and offline tests).
- `node tools/phone-check.mjs` passes at 390 and 360 for `/`, `/?mock=1`, `/stage.html?feet=mouse`, `/stage.html?demo=1&feet=mouse` and `/track.html`. A second script measured every phone screen (name, seats, stop search, mode, trains, set, songs, playing, stop armed, paused, results, settings) at 360, 390, 768 and 1440: no sideways scroll anywhere, every tap target 44 px or more, input text 16 px or more. Screenshots `shots/tester-1-s-*-390.png` and `-1440.png`.
- The projected lobby at 1280x720 with three and four seats: QR code clear of the pads (`e1-37`, `e1-38`).

## Not tested
- No AI feature in the app, so `tools/ai-check.mjs` does not apply. There is no `qa/student.json`, so `--as` was not used.
- Real camera, projector, sound by ear, and the real platform. Dark mode does not exist in the app (it is dark only).
- A phone closing its tab was tested in the lobby and mid-song, but a phone leaving at the exact moment of results was not.
- Leaving mid-song is not possible from the phone: there is no Leave button on the play screen (by the card's design).

## Environment notes
- Another session was on the same link while I tested (no rooms). Around 13:27 to 13:35 my stage received a "Nico" phone that was not mine (a stray join with no seat), and at about 13:34 a Pause on my stage was followed within a few seconds by a stop I did not send (the first `t6` run, then clean on a re-run at 13:36). At about 13:31 a stage with guests "Ana, Ben, Cy" was also on the link and my phones saw its State. I reran those sections when it was quiet. The `foreign()` helper in `lib.mjs` lists messages that did not come from my phones.
- The app sends an `x-api-key` header to the MBTA from the browser (the key comes from `.env.local`). That works today. Anything that blocks that header, or a rate limit on the key, would show as "Could not reach the MBTA".
- I started no server and edited no app code. Browsers: all closed; my temp profile folders (`pp-e2e-*`) are deleted. The 39 `puppeteer_dev_chrome_profile-*` folders in Temp all date from before 13:24 and are not mine.
- The link proxy in `t7-linkdrop.mjs` uses port 5199 and closes itself.

## Scripts (in `qa/e2e/`)
`t3-multi.mjs` ghost seats and seat race, `t4-reload.mjs` reload wipes seats, `t14-two-starts.mjs` sticky notice, `t10-hammer.mjs` Join double tap and Back, `t7-linkdrop.mjs` link drop, `t8-setup.mjs` and `t8b-setup-seats.mjs` setup, `t9-idle.mjs` two minutes idle, `t11-sizes.mjs` every phone screen at four sizes, `t13-transit.mjs` too-close train. Run any of them with `node qa/e2e/<name>.mjs` while the dev server is up.
