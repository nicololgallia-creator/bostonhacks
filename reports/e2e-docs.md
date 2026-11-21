# e2e-docs: the demo-path check, and the two docs

## Done
- `qa/e2e/demo-path.mjs`: one script, 8 steps, two real browser pages (stage 1280x720, phone 390x844), a listener on the link for the stage's State. Replaces the stale `lib.mjs` and `t1` to `t15` scripts, which are deleted. Run: `node qa/e2e/demo-path.mjs [--base http://localhost:4173]`. Screenshots go to `shots/e2e-<n>-<name>.png`. Takes about one minute.
- `qa/e2e/README.md`: three lines.
- `docs/SETUP.md` and `docs/HOW-IT-WORKS.md`: rewritten from the code and the six reports. No em dashes. Every step nobody has run on the real floor is marked.

## What the check covers, and its result today
Last two full runs, against my own `vite preview` on port 4180 (the built copy, nothing else on the link): **8 of 8 PASS, exit 0**, both times.
1. Stage opens with `?feet=mouse&seats=2`, State is `lobby`, `canvas.dataset.joinUrl` holds `?room=...&line=Green-B&dir=1&at=place-bucen&car=2`. PASS.
2. Phone opens the address's path and query on the base, shows "Where are you getting off?" with 9 real stops ahead (first: Boston University East). PASS.
3. Takes the first stop, sees a recommended song, takes the shortest in "See more songs" (to keep the run near one minute, so the stage plays "Mary Had a Little Lamb", 21 s), claims seats 1 and 2, presses Ready. State went lobby, countdown, playing with that song. PASS.
4. Mouse presses on the pads hit 3 to 4 tiles. Stage team score and phone score both rose (0 to 150, 200, 300, 350 in different runs, stage and phone equal). PASS.
5. Results show (grade B, phone shows the Leaderboard), the lobby returns, the stage still lists both seats for the phone. PASS. The phone stays on the Leaderboard until its player taps Next, so the check reads the seats from the State, not from the seats screen.
6. Phone page closed with no goodbye: seats freed 7.8 to 9.1 s later (five runs). PASS.
7. Another phone holds seat 1 (a Node client on the link), a second phone page asks for it and its banner says "That seat is taken." PASS. The app switches taken pads off, so the check turns the button back on and clicks it, the way a phone with a stale picture would.
8. No console errors on any page. PASS.
Against `http://localhost:4173` right now: step 1 FAILS and the run stops, because another stage page (guests `guest-1` and `guest-2`, so a `?demo=1` page from another builder) is open on that server. The check detects this on purpose, see bug 1.

## Bugs and risks found
1. **The local link has no rooms, so a second stage page on the same server wrecks a run.** Steps: open `http://localhost:4173/stage.html?demo=1` in one tab and `stage.html?feet=mouse&seats=2` in another. Both stages' States reach every phone and every listener. In my first runs this showed as "seat 2 to be yours" never happening, because the other page's guests held the seats. At the demo, close every other stage tab. Not fixed (not mine). The check refuses to start and also fails step 8 if it sees a phone id it did not make.
2. **The QR address can start with a link-local address.** Steps: `curl.exe localhost:4180/lan` returned `["http://169.254.32.31:4180/","http://10.192.148.62:4180/"]` while the 5173 server had answered with only the 10.x address a few minutes earlier. `main.js` uses `urls[0]`. A phone cannot open 169.254.x on a normal Wi-Fi. It only matters when the relay is down (the QR then holds the hosted address, `VITE_PUBLIC_URL` is set in `.env.local`). Not confirmed on the real network.
3. **The built copy changed while I tested** (a leaderboard, share and play-again flow landed between runs, and the server on 4173 was restarted once). My first step 5 expected the old seats screen after the lobby and failed. That is the check being updated, not an app bug.

## Docs: what I could not verify
- Which address the QR holds on the real day (hosted page or Wi-Fi) and whether `https://platform-piano.vercel.app/` is current. I did not open it.
- Every setup step on the real gear. The six steps are described from `setup.js` and the reports. All are marked "(not yet proven on the real floor)". Only the DJI as a webcam and the projector over HDMI are described as used on the real floor, from Nicolo's Sat 6:25 PM critique and Wave 6 in `PLAN.md`.
- The sound check, the tunes by ear, and the tracking speed on the real camera.
- The `Move` button's corners and the exact wording of every setup line: taken from the code, not seen.

## Where sources disagree (the code wins)
- `reports/phone-main.md` says a locked phone loses its seats during a song. `src/stage/session.js` now keeps all phones during a song and for 30 s after (`AFTER_SONG_MS`), then 10 s of quiet drops them. The docs follow the code.
- `PLAN.md` still lists names, `posture`, a Sitting or Standing choice, and the old step names ("Show the camera the field", "Foot check") for the stage. The seated setup has 6 other steps (`STEPS` in `setup.js`). The docs follow the code. `?feet=camera` and `?feet=mouse` still use the older step lists.
- The old `HOW-IT-WORKS.md` said a camera-to-field map and a high camera. Today seated play uses slices and tap-in-place, and `PLAN.md` Wave 6 says so too.
- `PLAN.md` says the phone flow starts with a platform or train choice. The phone no longer uses `nextTrains`; it asks only where you get off.
- `reports/seat-stage.md` says seats come from `seats:edges`. `slices.js` now keeps one list for each seat count (`seats:slices:<n>`) and uses `seats:edges` as the old fallback.
