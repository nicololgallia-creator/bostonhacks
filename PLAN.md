# PLAN

Only the plan owner's lead edits this file.

## Event

- **Name, place, date:** BostonHacks 2026, BU George Sherman Union, Metcalf Ballroom. Hacking 10:30 AM Sat 21 Nov to Devpost deadline 9:00 AM Sun 22 Nov (24 hours).
- **Theme and rules** (word for word, with source): tracks and rules in `notes/hacker-guide.md` (organisers' guide, downloaded 2026-11-21). Summary in `notes/START HERE.md`.
- **Judges:** not announced in the guide. Judges walk to tables by track.
- **Pitch length:** 3 minutes, demo inside it, then 1 minute of questions. Science fair at our table. Plus a 1-minute video on Devpost.
- **Judging criteria** (word for word): Idea Impact & Relevance; Problem Understanding & User Fit; Technical Implementation; Design; Presentation. Full wording in `notes/START HERE.md`.
- **Team:** Nicolo Gallia (Claude Code, this laptop). Zohayb Riaz. jonfeld on GitHub (invited to the repo 11:00 AM Sat; role not written down yet).
- **Plan owner:** Nicolo
- **Lead runs in:** Claude Code, Nicolo's laptop
- **Required tools or sponsor prizes:** Track: Transit Gamification ("transform dreaded T rides into something people look forward to"). No sponsor tool is required.
- **Scored tools:** none named in the criteria.

## Look

- **References:** not asked yet. Asked before card D1 starts.
- **Brand rules:** MBTA line colours may be used to name lines. No MBTA logo.

## Preflight

- [x] Each outside service tested with its exact feature: MBTA V3 API, live predictions at Kenmore from a browser origin, HTTP 200 with CORS open, no key (11:53 AM Sat).
- [x] Pose model and runtime saved locally by `npm.cmd install` (`public/mediapipe/`, 11:55 AM Sat).
- [ ] The DJI shows up as a camera in `track.html` on this laptop (Nicolo, by hand).
- [ ] The projector shows the laptop screen over HDMI (Nicolo, by hand).

## Clock

| Time | What |
|---|---|
| Sat 11:50 AM | Idea locked: Platform Piano |
| Sat 2:00 PM | Checkpoint 1: the camera page shows dots on real feet through the DJI, and the game plays with the mouse. Nicolo's yes on the projected picture |
| Sat 6:30 PM | Checkpoint 2: wow moment end to end. Real feet play a real song on the floor through the projector (dinner) |
| Sun 12:00 AM | Checkpoint 3: whole demo path. Phone picks the stop, live T data picks the song, the floor plays it. Doors lock 2:00 AM |
| Sun 4:30 AM | Feature freeze. Three runs by hand on the real hardware |
| Sun 7:00 AM | Code freeze, 1-minute video recorded |
| Sun 8:15 AM | Devpost shows Submitted, repo public, pitch rehearsal timed |
| Sun 9:00 to 9:30 AM | Judging at our table |

The trip to a real platform happens after checkpoint 2 and needs power for the projector (see Hardware).

## The idea

- **One line:** A piano projected on the platform floor that you play with your feet, and the song lasts exactly as long as your wait for the train.
- **For:** people waiting on an MBTA platform, alone or next to strangers.
- **The problem, with a sourced number** (from research.md): to come from card R1.
- **Why it wins** against the judging criteria: the judge plays it with their own feet in the first 20 seconds (Presentation, Design); it runs on live MBTA data (Technical); it turns the wait, the part riders dread, into the game clock (Idea, User Fit).
- **Wow moment:** tiles slide across the floor toward your feet, you step on one and it plays the note. More people means more keys, so a stranger stepping in makes the song fuller.
- **The second layer:** the phone asks your stop, reads the live arrival time, and picks a song that ends as your train pulls in. On the train, it lines up songs until you reach your stop. (Nicolo, 11:50 AM Sat.)
- **Known prior work, said out loud:** projected floor pianos exist (MIT 6.111 projects 2006 and 2017, EyeClick sells floor games). None is tied to a train clock or built to carry onto a platform.

## Hardware (specs looked up 11:45 AM Sat, sources in the lead's chat)

| Part | What we know | What it means |
|---|---|---|
| DJI Osmo Action 4 | Webcam mode over USB-C. A third-party test lists 1080p at 30 fps (not confirmed by DJI). Draws a lot of USB power. No HDMI out. | Plug into the laptop's own USB port. The browser reads it like any webcam. Very wide lens bends lines at the edges, so keep the play area in the middle of the view. |
| Panseba HI-04 projector | Native 1280x720. Real brightness is about 100 to 450 ANSI lumens (the 5000+ on listings is marketing). 60 W, wall power only, no battery. HDMI in. About 1.5 kg. | Dim, so the picture is black with bright tiles and the play area stays small (about 1.2 m wide). Needs an outlet or a power station. Rests on something high, tilted down; software straightens the stretched shape. |
| SmallRig VT-07 tripod | 16.3 to 36.6 cm tall, holds 1.2 kg, has a hook for rails. | Holds the camera only. Hook it as high as it will go, looking down at the play area. |
| Laptop | Runs everything. Needs an HDMI port (or adapter) for the projector and a USB port for the camera. | Projector is set to Duplicate (Windows key + P). |

Power on the T: nothing yet. Build and test at an outlet. A power station costs money, so it waits for Nicolo's number.

## Demo path

1. On the phone, pick your stop. The page shows the next trains, live, and the song that fits the wait.
2. Pick how many people are playing and tap Start.
3. Tiles slide across the floor toward the players' feet.
4. Players step on the tiles. Each hit plays its note, so the song is only heard if they play it.
5. The song ends as the train is due. The floor and the phone show the score.

## Stack

- **App:** Vite, plain JavaScript modules, no framework. Three pages: `index.html` (phone), `stage.html` (the projected game), `track.html` (camera check).
- **Tracking:** MediaPipe Pose Landmarker in the browser (`@mediapipe/tasks-vision`), model and runtime served from `public/mediapipe/` so it works with no internet.
- **Link:** phone and stage talk through a WebSocket relay inside the dev server (`server/link.mjs`, client `src/link.js`). The phone joins the laptop over the same Wi-Fi or a phone hotspot at `http://<laptop IP>:5173`.
- **Dev server:** command `npm.cmd run dev` on port `5173`
- **Tests:** `npm.cmd test` (Node's own test runner, files named `*.test.js`)
- **Deploy:** not decided. The game needs the laptop anyway.

## Data shapes

**Song** (`songs/<id>.json`):
```json
{ "id": "twinkle", "title": "Twinkle, Twinkle, Little Star", "by": "Traditional French melody, 1761", "bpm": 100,
  "notes": [ { "beat": 0, "midi": 60, "beats": 1 } ] }
```
`beat` is when the note starts, counted from 0. `midi` is the pitch (60 is middle C). `beats` is how long it lasts. Song length in seconds is `(last beat + its beats) * 60 / bpm`.

A song may also carry `"backing": [{ "beat": 0, "midi": 36, "beats": 2 }, { "beat": 0, "drum": "kick" }]`: notes the game plays by itself under the players' melody. `drum` is `"kick"`, `"snare"` or `"hat"` and has no pitch. Songs with no `backing` play the melody only.

**Feet source** (every tracker has this shape, see `src/track/mouse.js`):
`{ start(): Promise, read(): [{ u, v }] }`. Field coordinates: `u` runs 0 (left) to 1 (right) across the lanes, `v` runs 0 (far edge, where tiles appear) to 1 (the players' edge).

**Camera feet** (`src/track/camera.js`, before calibration): `[{ x, y, person }]`, `x` and `y` from 0 to 1 in the camera picture, one entry per visible foot.

**Lanes:** 1 player 4 lanes, 2 players 6, 3 or 4 players 8. Everyone shares one keyboard and one score. A note's lane comes from its pitch: the song's distinct pitches, sorted low to high, spread evenly over the lanes, low on the left.

**Play rules** (replaces the first hit rule, Sat 12:06 PM, after Nicolo's critique):
- **Square:** each lane's square is the lane's width from `v = 0.55` to `v = 1`. A tile takes 2.5 seconds to travel from `v = 0` to the hit line at `v = 0.75`.
- **Feet flicker.** The tracker drops feet for a frame or two. A foot counts as gone from a square only after no foot has been in it for 150 ms.
- **Tap tile** (a note shorter than 0.8 seconds): hit when a foot **arrives** on its square, meaning the number of feet in the square goes up, within 300 ms either side of the tile's time. Within 120 ms is `perfect`, otherwise `good`. A foot that was already standing there does not count. One arrival hits one tile, the nearest unjudged one in that lane. An arrival with no tile in reach costs nothing.
- **Hold tile** (0.8 seconds or longer): it starts when a foot arrives within the window, or is already standing on the square at the tile's time (then it is `good`). The note sounds for as long as a foot stays. Staying until 150 ms before the tail completes it. Leaving after at least half counts as `good` and keeps the combo. Leaving sooner is a miss.
- **Combo:** every hit adds one, a miss resets it to zero. Multiplier: x1 below 10, x2 from 10, x3 from 25, x4 from 50.
- **Score:** perfect 100, good 50, a completed hold adds 20 per beat held, all times the multiplier.
- **Grade at the end**, by hits over total: S from 95%, A from 85%, B from 70%, else C.
- **Engine output:** `update(nowMs, feet)` returns `{ tiles: [{ id, lane, kind: "tap" | "hold", v, vTail, state: "waiting" | "holding" | "hit" | "missed" }], events: [{ type: "hit" | "miss" | "holdStart" | "holdEnd", lane, midi, grade, u, v }], score, combo, maxCombo, multiplier, counts: { perfect, good, miss }, total, done, grade }`. `vTail` is where a hold's far end is. `events` holds only what happened this frame; `u` and `v` are where the foot was.

**Link messages** (JSON text, relayed to every other page):
```json
{ "type": "start", "songIds": ["twinkle"], "players": 2, "endsAt": 1795300000000, "stop": "Kenmore", "mode": "platform" }
{ "type": "stop" }
{ "type": "pause" }   { "type": "resume" }   { "type": "skip" }
{ "type": "calibrate" }
{ "type": "set", "volume": 0.8, "offsetMs": 120 }
{ "type": "state", "status": "idle", "songId": null, "title": null, "queue": [], "score": 0, "combo": 0, "maxCombo": 0, "multiplier": 1, "counts": { "perfect": 0, "good": 0, "miss": 0 }, "total": 0, "grade": null, "secondsLeft": 0, "camera": false, "calibrated": false }
```
`mode` is `"platform"` or `"train"`. `endsAt` is the time the train is due, in epoch milliseconds, or null. `status` is `idle`, `countdown`, `playing`, `paused`, `calibrating` or `done`. The stage sends `state` twice a second and on every change. The phone is only the remote: every command the game has is one of these messages.

**MBTA** (`src/mbta/api.js`):
```js
listStops()   // [{ id: "place-kencl", name: "Kenmore", lines: ["Green-B", "Green-C", "Green-D"] }]
nextTrains(stopId)  // [{ routeId: "Green-B", line: "Green Line B", directionId: 0, headsign: "Boston College", arrivesAt: "2026-11-21T12:31:00-05:00", seconds: 240 }]
rideSeconds({ fromStopId, toStopId, routeId, directionId })  // { seconds: 540, arrivesAt: "...", source: "prediction" | "schedule" }
```

## Fake on purpose

- The mouse stands in for feet (`stage.html?feet=mouse`) so the game can be built and tested with no hardware.

## Cut

- Leaderboards, accounts, saved scores.
- A native phone app. The phone page is a web page that opens from a link or QR code.
- Telling players apart. Everyone shares one keyboard.
- Automatic aiming with projected markers. Calibration is four clicks by hand first.

Not cut (Nicolo, Sat 12:04 PM: "we need this application to be stellar"): taps that need a real step, hold tiles, combos, real songs, sound and light on every hit, and the phone as a full remote.

## Projection rules (physical, from the hardware table)

The stage page is a picture thrown on a floor by a dim 720p projector. So: the background is pure black (black is no light), tiles and lanes are bright saturated fills, no thin lines, no text smaller than a tenth of the picture height, nothing that needs fine detail to read.

## Seats and session (added Sat 12:15 PM)

Nicolo, 12:12 PM: "a web app which you can pick your seats which will be tracked and then linked to the projector to perfectly display at your feet." The whole system is described in `docs/HOW-IT-WORKS.md`. Read it before any wave 2 card.

This section **replaces** "Lanes" and the "Link messages" block above. Each player picks a seat on their phone and gets their own pad of tiles at that seat. Nobody shares a keyboard any more.

**Layout** (saved on the stage in localStorage as `pp:layout`):
```json
{ "posture": "seated", "lanes": 3, "spots": [ { "id": 1, "rect": { "u": 0.04, "v": 0.1, "w": 0.28, "h": 0.86 } } ] }
```
A spot is one seat. `rect` is its pad on the field, in field coordinates. `posture` is `"seated"` (3 lanes a pad) or `"standing"` (4 lanes a pad). One to four spots, side by side. Inside a pad, pad coordinates work like field coordinates: `u` 0 to 1 across its lanes, `v` 0 (far edge) to 1 (the player's edge), and the Play rules apply inside each pad. A foot belongs to a spot when it is inside the pad or within a tenth of the pad's size outside it. A note's lane comes from its pitch as before, spread over the pad's lanes. Every seat gets the same song on its own pad. One engine runs for each taken seat: `createGame({ song, lanes })`.

**Messages from a phone** (JSON text over the link; every one carries the phone's own `clientId`, a random id it keeps in localStorage):
```json
{ "type": "join", "clientId": "a1b2c3", "name": "Nico" }
{ "type": "claim", "clientId": "a1b2c3", "spotId": 2 }
{ "type": "leave", "clientId": "a1b2c3" }
{ "type": "layout", "clientId": "a1b2c3", "posture": "seated", "seats": 3 }
{ "type": "start", "clientId": "a1b2c3", "songIds": ["twinkle", "ode-to-joy"], "transit": { "stop": "Kenmore", "mode": "platform", "endsAt": 1795300000000 } }
{ "type": "pause" }  { "type": "resume" }  { "type": "skip" }  { "type": "stop" }  { "type": "calibrate" }
{ "type": "set", "volume": 0.8, "offsetMs": 120 }
```
`transit` may be null. `mode` is `"platform"` or `"train"`. `endsAt` is when the train is due or the ride ends, in epoch milliseconds.

**State from the stage** (sent to every phone twice a second and on every change; the stage is the only source of truth):
```json
{ "type": "state", "status": "lobby", "notice": null,
  "layout": { "posture": "seated", "lanes": 3, "spots": [ { "id": 1, "rect": { "u": 0.04, "v": 0.1, "w": 0.28, "h": 0.86 } } ] },
  "players": [ { "clientId": "a1b2c3", "name": "Nico", "spotId": 1, "score": 0, "combo": 0, "maxCombo": 0, "multiplier": 1, "counts": { "perfect": 0, "good": 0, "miss": 0 }, "total": 0, "grade": null } ],
  "song": null, "queue": [], "secondsLeft": 0, "transit": null,
  "ready": { "camera": false, "calibrated": false },
  "settings": { "volume": 0.8, "offsetMs": 120 } }
```
`status` is `lobby`, `countdown` (3 seconds), `playing`, `paused` or `results` (8 seconds, then the next song in `queue`, or back to `lobby`). `song` is `{ "id", "title", "seconds" }` while one is loaded. `spotId` is null until the player picks a seat. `notice` is one plain sentence when a command was refused ("That seat is taken.", "Pick a seat before starting."), cleared by the next accepted command. A seat already taken cannot be claimed. Claiming a second seat moves the player. Start needs at least one seated player.

## Build map (Sat 12:15 PM to feature freeze Sun 4:30 AM)

| Phase | When | What must be true at the end |
|---|---|---|
| A. Foundations | to 1:00 PM | Camera page finds feet. Game rules done. MIDI tool works. |
| B. Seats and tracking | 1:00 to 4:00 PM | Seats and session work with the mouse. Setup lines the camera up with the projector. Real feet hit real tiles. |
| C. The floor | 2:00 to 6:30 PM | The floor's look, effects, sound with backing. Checkpoint 2: a real song played by real feet, at dinner. |
| D. The remote | 3:00 to 9:00 PM | Phone: join, pick a seat, pick a stop, songs that fit, start, pause, live score. |
| E. Real songs | 2:00 to 8:00 PM | The Boston songs from MIDI, each one listened to by a person. |
| F. The T | after 6:30 PM | Power for the projector, a platform test, then a train test. |
| G. Harden | midnight to 4:30 AM | Whole demo path three times by hand. Fixes only. |

## Cards, from wave 2

| id | owner | runs on (person, tool) | files it may touch | build | done-check | box | status |
|---|---|---|---|---|---|---|---|
| G4 | game-4 (hack-backend) | Nicolo, Claude Code | `src/stage/layout.js`, `src/stage/layout.test.js`, `src/stage/session.js`, `src/stage/session.test.js`, and one change in `src/game/engine.js` with its test | **Seats and the session, as pure logic.** No browser calls in these files, so every rule is tested in Node. In `engine.js`, let `createGame` take `{ song, lanes }` (keep `players` working until the stage is rewired) and add a test. `layout.js`: `makeLayout({ posture, seats })` returns a Layout as in "Seats and session" with 1 to 4 pads side by side, even gaps, filling the field's width, `v` from 0.1 to 0.96; `feetBySpot(layout, feet)` takes field feet and returns, for each spot id, that spot's feet in pad coordinates, using the one-tenth margin rule, each foot going to one spot only (the nearest pad centre when margins overlap); `lanesFor(posture)`. `session.js`: `createSession({ songs })` holding the State in "Seats and session" exactly, with `apply(message, nowMs)` for every phone message (join, claim, leave, layout, start, pause, resume, skip, stop, set; calibrate changes nothing and is passed on as an event), `tick(nowMs, feetBySpotMap)` that runs one engine for each taken seat and moves through lobby, countdown, playing, paused, results and the queue, `snapshot(nowMs)` returning the State message, and `drain()` returning what happened since the last call for the renderer and the sound (each engine event with its `spotId`, plus `{ type: "status", status }` on every status change). Pausing freezes every engine's clock. A layout change is refused while a song is playing. A player who leaves frees the seat. Unknown or malformed messages are ignored and never throw. Write the refusal sentences in plain words. Tests cover every rule in "Seats and session", each status change, the queue, pause and resume keeping tile positions, two seats scoring separately on the same song, and bad messages. | `node --test src/stage/layout.test.js src/stage/session.test.js src/game/engine.test.js` passes. | 30 min | ready |
| T2 | tracker-2 (hack-backend) | Nicolo, Claude Code | `src/track/homography.js`, `src/track/homography.test.js`, `src/track/pipeline.js`, `src/track/pipeline.test.js` | **The tracker's maths, as pure logic.** Steps 3 and 4 of "The tracker, step by step" in `docs/HOW-IT-WORKS.md`. No browser calls, so all of it is tested in Node. `homography.js`: `solve(from, to)` takes four points and their four matches (`[{ x, y }]`) and returns a 3x3 matrix, throwing a plain-words error when three of the points are in a line; `apply(matrix, point)`; `invert(matrix)`. `pipeline.js`: `createPipeline({ cameraToField, smoothing = 0.5, holdMs = 150, minConfidence = 0.5 })` with `update(nowMs, cameraFeet)` returning field feet `[{ u, v }]`. Camera feet come from `src/track/camera.js` as `[{ x, y, person }]` (read that file; add nothing to it). Match each new foot to the nearest tracked foot from the frame before, within a fifth of the picture, so each foot keeps its own smoothing. Smooth each foot's position (blend with its last position by `smoothing`). A foot with no match this frame is kept where it was until `holdMs` has passed, then dropped. Feet whose mapped point is far outside the field (more than half a field beyond any edge) are dropped. `setMatrix(matrix)` swaps the map without losing tracked feet. Tests: the map sends the four corners exactly to their matches and a middle point to the right place on a known tilted view; points in a line throw; smoothing moves a foot part of the way; a foot missing for 100 ms is still returned and after 200 ms is gone; two feet that cross do not swap their histories wrongly when they stay more than the match distance apart; far-outside feet are dropped. | `node --test src/track/homography.test.js src/track/pipeline.test.js` passes. | 30 min | ready |
| T4 | tracker-4 (hack-backend) | Nicolo, Claude Code | `src/track/record.js`, `src/track/record.test.js`, `qa/feet/*`, and one small addition to `src/track/debug.js` | **Record real feet, replay them later.** So tracking and the game can be tuned with no camera, and a bad demo moment can be replayed. `record.js`: `createRecorder()` with `add(nowMs, cameraFeet)` and `toJSON()` giving `{ "version": 1, "frames": [{ "t": 0, "feet": [{ "x": 0.41, "y": 0.83, "person": 0 }] }] }` with `t` in milliseconds from the first frame; `createReplay(recording)` returning a source with the same `start()`, `read()`, `fps()`, `stop()` as `createCameraFeet` in `src/track/camera.js`, playing the frames back in real time and looping. On `track.html` add a Record button that records until pressed again and downloads the file, and `?replay=/qa/feet/<name>.json` to run the page from a recording. Bad or empty files show a plain-words message. Make one short recording from `qa/person.jpg` held still (so a file exists to test with) and save it as `qa/feet/still.json`. Tests cover: times start at zero, replay returns the right frame for a given time, replay loops, a bad file is refused. | `node --test src/track/record.test.js` passes, and `node tools/shot.mjs "http://localhost:5173/track.html?replay=/qa/feet/still.json" shots/T4-replay.png --wait 3000` shows foot dots with no console errors. | 30 min | ready |
| G5 | game-5 (hack-frontend) | Nicolo, Claude Code | `src/stage/main.js`, `src/game/render.js`, `stage.html` | Wire the stage to the session and the link, draw one pad for each seat with the player's name, the lobby with a QR code to the remote, and `?demo=1` to seat guests for testing with the mouse. Written when G4 reports. | | 30 min | waiting |
| T3 | tracker-3 (hack-frontend) | Nicolo, Claude Code | `src/stage/setup.js`, `src/stage/setup.css` | The six setup steps in `docs/HOW-IT-WORKS.md`, on the stage page. Written when T2 and G5 report. | | 45 min | waiting |
| G3 | game-3 (hack-designer) | Nicolo, Claude Code | `src/game/render.js`, `src/game/fx.js` | (replaces the G3 row below) The floor at full strength, per pad. After G5. | | 45 min | waiting |
| D1 | designer (hack-designer) | Nicolo, Claude Code | `src/tokens.css`, `DESIGN.md`, `src/phone/*`, `index.html` | (replaces the D1 row below) Remote pilot, screen 1: join and pick your seat. Needs Nicolo's look references. | | 30 min | waiting |
| P2 to P4 | phone builders | Nicolo, Claude Code | `src/phone/*` | Stop and songs that fit; the host's controls and queue; live score and results. After D1 has Nicolo's yes. | | 30 min each | waiting |
| S3 | songs-3 | Nicolo, Claude Code | `songs/*.json` | The Boston songs from MIDI files Nicolo or Zohayb download, each cut to its best part. After S2. | | 30 min | waiting |

## Cards, wave 1

| id | owner | runs on (person, tool) | files it may touch | build | done-check | box | status |
|---|---|---|---|---|---|---|---|
| T1 | tracker-1 (hack-backend) | Nicolo, Claude Code | `src/track/camera.js`, `src/track/debug.js`, `track.html`, `qa/person.jpg` | **Camera check page.** `camera.js` exports `createCameraFeet({ video, model = "lite", maxPeople = 4 })` returning `{ start(), read(), fps(), stop() }`; `read()` returns Camera feet (see Data shapes). It runs MediaPipe Pose Landmarker in VIDEO mode with `numPoses = maxPeople`, loading `/mediapipe/wasm` and `/mediapipe/pose_landmarker_<model>.task` (never a CDN). Try the GPU delegate and fall back to CPU. A foot's point is the midpoint of its heel and foot-index landmarks, kept only when both have visibility above 0.5. `track.html` shows the live camera with a dot on every foot and a faint dot on every other landmark, the frames per second, a camera picker (`enumerateDevices`, choice remembered in localStorage, so the DJI can be picked over the laptop's own camera), and a lite/full model switch. With `?src=/qa/person.jpg` (an image) or a video file URL it runs on that file instead of the camera, so it can be checked with no camera. Save one freely licensed photo of a standing person with visible feet as `qa/person.jpg` and note its source in the report. Every error a person can hit (no camera, permission denied, model missing) shows its real reason and the fix in plain words on the page. | `node tools/shot.mjs "http://localhost:5173/track.html?src=/qa/person.jpg" shots/T1-photo.png --wait 6000` shows two foot dots on the person's feet and no console errors. | 30 min | ready |
| G1 | game-1 (hack-frontend) | Nicolo, Claude Code | `src/game/engine.js`, `src/game/engine.test.js`, `src/game/synth.js`, `src/game/render.js`, `src/stage/main.js`, `stage.html` | **The game, played with the mouse.** `engine.js` is pure logic with no browser calls: `lanesFor(players)`, `laneOf(song, midi, lanes)`, `songSeconds(song)`, and `createGame({ song, players })` with `update(nowMs, feet)` returning the tiles to draw (lane, position `v`, state waiting/hit/missed), the notes hit this frame, and `hits`, `misses`, `total`, `done`. Follow Lanes and Hit rule in Data shapes exactly. `engine.test.js` covers: lane counts, pitch to lane, a foot in the lane inside the window is a hit, outside the window is a miss, the wrong lane is a miss, the song ends. `synth.js` plays a note by midi number with the Web Audio API (a soft piano-like tone, short attack, about one second decay; no audio files) and a dull low thud for a miss. `render.js` draws on a full-window canvas following Projection rules in this file: black field, lanes, the hit zone from `v = 0.55` to `1`, tiles sliding from the far edge to the players' edge, a lit lane where a foot is, a flash on a hit, and a large score. `main.js` wires it: `?feet=mouse` uses `src/track/mouse.js`; Space starts `songs/twinkle.json` (browsers need a key press before sound); F toggles fullscreen; `?players=1..4` sets lanes; `?autostart=1` starts without the key press (no sound) so screenshots can catch it playing; when the song ends it shows hits out of total. Keep the feet source swappable: one place in `main.js` picks it. Do not build the phone link, calibration or camera here. | `npm.cmd test` passes. Open `http://localhost:5173/stage.html?feet=mouse`, press Space, hit tiles with the mouse and hear the tune. Two shots of `stage.html?feet=mouse&autostart=1` with `--wait 3000` and `--wait 4500` show tiles in different places. | 30 min | done 12:02 PM, lead ran tests and looked at its own shot. Sound not heard by anyone yet: Nicolo listens |
| M1 | mbta-1 (hack-backend) | Nicolo, Claude Code | `src/mbta/api.js`, `src/mbta/api.test.js` | **Live T data.** The three functions under MBTA in Data shapes, against `https://api-v3.mbta.com` with plain `fetch`, working in both the browser and Node (no key needed; if `VITE_MBTA_KEY` is set, send it as the `x-api-key` header). `listStops()` covers the subway only (Red, Orange, Blue, Mattapan, Green B, C, D, E; route types 0 and 1), parent stations, one entry per station with every line that serves it, sorted by name. `nextTrains(stopId)` returns upcoming arrivals sorted soonest first, with past ones dropped, using `arrival_time` or `departure_time` when arrival is null. `rideSeconds` follows one trip from the first stop to the second: predictions first, the schedule when a prediction is missing, and a thrown error with a plain reason when neither exists. Every failed request throws an error that says what failed in plain words (rate limit, no service, offline). Read the API's rate limit for keyless use and put it in the report. | `npm.cmd test` passes against the live API and prints the next trains at Kenmore and the ride time from Kenmore to Park Street. | 30 min | done 12:01 PM, lead ran stubbed and live tests. Live test now needs `MBTA_LIVE=1` |
| S1 | songs-1 (hack-backend) | Nicolo, Claude Code | `songs/*.json` except `twinkle.json`, `src/songs/index.js`, `src/songs/songs.test.js`, `src/songs/pick.js`, `src/songs/pick.test.js` | **Song library and the picker that fits songs to a wait.** Add at least eight more songs in the Song shape, melody only, one note at a time, with lengths spread from about 20 seconds to about 2 minutes. Public domain melodies only, with the composer and year in `by` (for example Ode to Joy, Jingle Bells, Frere Jacques, Mary Had a Little Lamb, Row Row Row Your Boat, When the Saints Go Marching In, Oh! Susanna, Yankee Doodle, the opening of Fur Elise, the opening of The Entertainer). Also "The Ship That Never Returned" (Henry Clay Work, 1865), whose tune the Boston song about Charlie on the M.T.A. borrowed: title it by its own name and put the Charlie link in `by`. **Write a melody only if you are sure of it note for note. A wrong tune is worse than a missing one; list any you skipped.** Feet are slow: set each `bpm` so no two notes start less than 0.4 seconds apart, and simplify fast runs to their main notes. `index.js` exports `songs` (every song, sorted shortest first) and `songById(id)`, and must load in both Vite and plain Node. For a song's length use `songSeconds` from `src/game/engine.js` (card G1, being written now; if it is not there yet, write against it and run your tests when it appears; do not write a second copy). `songs.test.js` checks every file: id matches the file name, title and `by` present, notes sorted by beat with no overlap, midi from 48 to 84, the 0.4 second rule. `pick.js` exports `pickSongs({ seconds, buffer = 20 })` returning `{ songIds, totalSeconds, fits }`: the set of different songs whose total play time is closest to `seconds - buffer` without going over, counting 4 extra seconds per song for the lead-in and the score; longest song first; the same input always gives the same answer; `fits` is false with an empty list when even the shortest song is too long. With this few songs, trying every combination is fine. `pick.test.js` covers: never over the budget, no repeats, too short a wait gives `fits: false`, a 3 minute wait lands within 20 seconds of the budget, a 30 minute wait returns every song once. | `node --test src/songs/songs.test.js src/songs/pick.test.js` passes and prints each song's title and length in seconds. | 30 min | done 12:09 PM, lead ran the 18 tests. 11 songs, 21 to 115 seconds. Tunes from memory need a listen: Jingle Bells, Ode to Joy, London Bridge, Happy Birthday |
| T2 | tracker-2 (hack-frontend) | Nicolo, Claude Code | `src/track/homography.js`, `src/track/homography.test.js`, `src/track/calibrate.js`, then one small change in `src/stage/main.js` | Straighten the projected picture (drag four corners) and map camera feet onto the field (click four corners). Written when T1 and G1 report. | | 30 min | waiting |
| D1 | designer (hack-designer) | Nicolo, Claude Code | `src/tokens.css`, `DESIGN.md`, `src/phone/*`, `index.html` | Phone page pilot: pick a stop, see live trains and the song that fits. Written when M1 reports. | | 30 min | waiting |
| R1 | researcher (hack-researcher) | Nicolo, Claude Code | `research.md` | **Sourced facts for a 3-minute pitch.** Read `notes/research-riders.md` first (rider research from this morning; reuse what is sourced, do not redo it). Then find, each with a link and the date of the source: (1) how long MBTA subway riders wait: scheduled headways by line and any measured wait times (MBTA, TransitMatters); (2) how many people ride the subway on a weekday; (3) what research says waiting feels like (perceived wait against real wait, and whether having something to do shortens it); (4) the Stockholm piano stairs of 2009 and its measured result, with the original source if it can be found, and how solid that number is; (5) three existing projected floor games or floor pianos (for example EyeClick BEAM, the MIT 6.111 floor pianos, museum floor pianos) and what each one lacks beside ours: tied to a live train clock, carried onto a platform, played by strangers together. End with the one number the pitch should say and the baseline to put beside it. Mark anything you could not confirm as unconfirmed. | `research.md` exists, every fact has a working link, and the last section names one number and its baseline. | 30 min | done 12:05 PM. Lead has not checked the links yet |
| G2 | game-2 (hack-frontend) | Nicolo, Claude Code | `src/game/engine.js`, `src/game/engine.test.js`, `src/track/mouse.js`, and the smallest changes in `src/game/render.js`, `src/game/synth.js` and `src/stage/main.js` that keep the page running | **Real rhythm game rules.** Rebuild the engine to "Play rules" in Data shapes, exactly: tap tiles that need a foot to arrive, hold tiles, the 150 ms flicker rule, perfect and good, combo and multiplier, score, grade, and the Engine output shape. Keep it pure logic with no browser calls. Replace the old tests with ones for every rule: an arriving foot inside 120 ms is perfect and inside 300 ms is good; a foot standing still on the square does not hit a tap; one arrival hits only one tile; a second foot arriving on the same square hits the next tile; a foot that flickers out for under 150 ms does not count as a new arrival; a hold completes, a hold left after half is good, a hold left early is a miss; combo, multiplier steps at 10, 25 and 50, and reset on a miss; score sums; grade bands; the song ends. Change `mouse.js` so the foot is down only while the mouse button is held: a click is a tap and a press-and-hold is a hold. In `synth.js` add `noteOn(midi)` returning a function that stops the note, for holds. In `render.js` and `main.js` do only what keeps the game playable with the new output: draw a hold as a long tile from `v` to `vTail`, lit while holding, show score and combo, play sounds from `events`. The look and the effects are the next card, so do not polish them. | `node --test src/game/engine.test.js` passes. On `stage.html?feet=mouse`, clicking a tap tile at the line hits it, holding the button on a hold tile sustains the note and completes it, and resting the mouse on a lane with no click hits nothing. One shot at 1280x720 mid-song shows a hold tile and the combo. | 30 min | ready |
| G3 | game-3 (hack-designer) | Nicolo, Claude Code | `src/game/render.js`, `src/game/fx.js` | The floor's look and feedback at full strength: a glow that follows every tracked foot, bursts on hits, combo heat, countdown, song title card, the train clock creeping to its station, the results card. Written when G2 reports. | | 30 min | waiting |
| A1 | audio-1 (hack-frontend) | Nicolo, Claude Code | `src/game/synth.js`, `public/sounds/*` | Sound worth hearing through a speaker: a sampled piano saved locally and a backing beat under the players' notes. Written when G2 reports. | | 30 min | waiting |
| S2 | songs-2 (hack-backend) | Nicolo, Claude Code | `tools/midi-to-song.mjs`, `tools/midi-to-song.test.mjs`, `qa/midi/*`, one new `songs/<id>.json` and its import line in `src/songs/index.js` | **Real songs from MIDI files.** `node tools/midi-to-song.mjs <file.mid> --id <id> --title "<title>" --by "<artist, year>" [--track <n>] [--from <sec>] [--to <sec>]` writes `songs/<id>.json` in the Song shape and adds its import line to `src/songs/index.js` (never twice). Use `@tonejs/midi`, already installed. With no `--track` it prints every track (number, name, instrument, note count, lowest and highest pitch) and picks the likeliest melody, saying which and why, so a person can re-run with `--track`. The melody becomes `notes`: one note at a time (the highest when several start together), moved by whole octaves into midi 48 to 84, on a beat grid taken from the file's tempo, with `bpm` and the grid chosen so the song passes `src/songs/songs.test.js`, including the rule that no two notes start less than 0.4 seconds apart (drop the weaker of two notes that are too close, keeping the ones on the beat). Every other track becomes `backing` in the shape under Song in Data shapes: pitched notes as they are, and drum-channel notes mapped to `kick`, `snare` or `hat`. `--from` and `--to` cut a section, so a song can be just its chorus. Bad input gets a plain message and the fix (file not found, not a MIDI file, no notes in the chosen track, id already used). Test it on one public domain MIDI file you download and keep in `qa/midi/` with its source noted (a Mutopia Project file is a safe choice), and leave that one converted song in the library. | `node --test tools/midi-to-song.test.mjs src/songs/songs.test.js` passes, and the converted song loads in `http://localhost:5173/stage.html` without console errors. | 30 min | ready |
| P2 | phone-2 (hack-frontend) | Nicolo, Claude Code | `src/phone/*` | The rest of the remote after the pilot: song library, queue, pause, skip, calibrate, volume, live score. Written when D1 has Nicolo's yes. | | 30 min | waiting |
