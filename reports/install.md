# install: install mode, one double-click, the handoff guide

Sat 21 Nov 2026. Install mode is built. `start-ttiles.cmd` ran once for real on this laptop and worked.

## Steps from a cold laptop to a playable floor
- Before: about 12 actions. Build, start the server, open the page with `?feet=seats`, click Allow, pick the camera in setup, straighten, fit the seat lines, press F, press T, click once for sound, plus the two-tap floor placing.
- After: 1 action for a floor with the pads at the default places (double-click `start-ttiles`). 4 more (press M, two taps, close) once per setup, only if the pads are not at the feet. Plugging in the camera and projector is the same as before.

## Done
- `src/stage/install.js` (new, with `install.test.js`, 12 tests): `installOn` (?install=1 remembered, ?install=0 off), `defaultFacing`, `chooseCamera` (pure: labels in, choice and reason out), `pickInstallCamera`, `cameraOf`, `stripFor`, `createStrip`. `src/stage/install.css`: the strip.
- Camera rule: saved camera if still there; else a name with osmo, dji or action; else the first camera that is not the laptop's; else the laptop's, with the reason. The laptop's own camera picked by default is not saved, so the DJI is found the day it is plugged in (a call I made, see below). Saved but gone: chosen again by the same rule.
- `src/stage/main.js`, marked "install" blocks: install mode picks `?feet=seats` when no `?feet=` is given; turns facing on unless someone set it; opens the synth with no key; never opens setup by itself; `keepCamera` starts the camera and tries again every 3 s, also after an unplug; `keepFit` runs the "Fit to the people" logic in the lobby until it finds people (when no lines are saved and following is on). Key M opens setup on the seats step with "Place by the camera" already started. A phone's "calibrate" no longer opens setup in install mode. The strip exists in every mode that has a camera.
- `src/track/seatsource.js`: an `install` option. It picks the camera by name before `getUserMedia`, and its errors say what to do with the gear ("Plug the camera in and turn on webcam mode on it.") instead of "reload".
- `src/stage/setup.js`: one option, `first: "seats"`.
- `start-ttiles.cmd`, `npm.cmd run floor` (`.\start-ttiles.cmd`), `docs/INSTALL.md`, a link line at the top of `docs/SETUP.md`.
- Strip: top corner of the picture (the lobby headline is centred, the pads are at the players' edge). It goes through `applyKeystone`. Camera name for 6 s after the lobby opens or the camera is known. The laptop's own camera in seated play stays up in the warn colour, "Camera: the laptop's own. Press C to change." A failure shows one sentence.

## How I checked
- `npm.cmd test`: 545 pass, 0 fail, 1 todo (taps.test.js, the known one). `npm.cmd run build` passes. `node qa/e2e/demo-path.mjs --base http://localhost:4173`: 8 of 8.
- Scripted puppeteer runs, clean profile, Chrome fake camera playing a clip of four people (made from `qa/seats/four.png`), `?install=1`, no click, no key (`install-run.mjs`, `install-keys.mjs` in the session scratchpad):
  - Plain: reaches the lobby, `synth.locked()` false, tracker running at 9 to 11 frames a second, `pp:facing` 1, setup not open, no dialogs, no console errors. The seat lines saved themselves in about 4 s (`seats:slices:4` has 5 dividers).
  - Osmo name (two cameras listed, the laptop's first): picks the Osmo, strip "Camera: DJI Osmo Action 4". Laptop name only: strip stays up in orange.
  - No camera: strip "No camera found. Plug the camera in and turn on webcam mode on it.", the lobby still drawn. Then the camera appeared with no reload: tracking at the second check (+3 s), strip gone and lines fitted by +6 s.
  - Key M: "Step 3 of 6: Seats on the floor", two marks out, "Put one foot on mark 1 and tap it." C while setup is open opens no second panel. `?install=0` turns install mode off and remembers it; the bare address is mouse play again.
- Shots (1280x720, with `-900` copies, all opened): `shots/install-plain-900.png`, `install-plain-late-900.png`, `install-osmo.png`, `install-laptop-900.png`, `install-nocam-900.png`, `install-nocam-recovered-900.png`, `install-key-m.png`, `install-kiosk-real.png` (2880x1800, the real Edge run). The osmo 900 copy was taken after the 6 s ran out, so it shows no strip; the 1280 one shows it.
- **`start-ttiles.cmd` for real**, port 4180, with an extra debug port so I could read the page: it printed "Starting the built copy in dist on port 4180", started the server, opened Edge in kiosk mode on `stage.html?install=1` in its own profile. The window was 1440x900, the whole screen (the page's `document.fullscreenElement` is null in kiosk mode, it is full screen by the browser). `synth.locked()` was false with no key press, so the autoplay flag alone is enough and the synth needed no change; only main.js calls `synth.unlock()` at start. The camera permission read "granted" with no prompt and the laptop camera ran at 19 frames a second, the strip said "Camera: the laptop's own. Press C to change." (only the laptop camera exists here). Closing the browser (the same as Alt+F4) printed "TTiles stopped", the server on 4180 was gone, nothing was left running. I deleted `.deploy/kiosk-profile` after.

## Not checked
- The real Osmo's name as the browser reports it. The rule matches osmo, dji or action; if it reports "USB Video Device" it is still chosen when it is the only non-laptop camera.
- The real projector and the half turn with real players. Autofit and M placing with real people (the placing was only run to the point of the marks being out). A laptop that is not this one, including the Windows firewall question for phones.
- `npm.cmd run floor`, `start-ttiles.cmd rebuild`, and the "already running" branch (the script's text is written for them, not run). A key press for Alt+F4 itself (I closed the browser through its debug port).
- A real unplug while running: the code waits for the camera track's "ended" event and starts again, but the fake camera cannot be unplugged, so that branch never ran. The retry was run only for "no camera at start".
- Phone join with no internet on a venue network. `/web-interface-guidelines` and the design skills were not loaded in this tool; the strip reuses the tokens and the setup panel's look.

## Needs from others
- `src/facing.js`: its key `pp:facing` is copied in install.js (`FACING_KEY`); a test fails if they drift. If facing.js gets a `hasChoice()` export, use it instead.
- The lead should rebuild the `.deploy` copy and the live site if the install flag is wanted there (the code only matters on the laptop).

## Calls I made
- Port 5173 by default (the one `vite.config.js` pins), with `TTILES_PORT` to change it.
- `--kiosk --edge-kiosk-type=fullscreen`: no address bar, nobody presses F, Alt+F4 leaves. The script waits for Edge and then stops the server it started, so one Alt+F4 stops everything. A server that was already running is left alone.
- The script uses `.\start-ttiles.cmd` in package.json, because this machine sets `NoDefaultCurrentDirectoryInExePath=1`, which hides files in the current folder from cmd.
- The laptop's own camera picked by default is not saved, which differs from "save the choice". Otherwise plugging in the DJI later would be ignored.
- In install mode a phone's "calibrate" button does nothing, so a stranger cannot cover the floor with setup. Key C and key M still work.
- No automatic "place the pads" prompt: with no floor map, the pads stay at the default places and the guide names M as the one thing to do once.
- Seatsource has no test of its own for the new option; `pickInstallCamera` and `chooseCamera` are tested in install.test.js.
