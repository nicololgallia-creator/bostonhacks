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
`beat` is when the note starts, counted from 0. `midi` is the pitch (60 is middle C). `beats` is how long it lasts. Song length in seconds is `(last beat + its beats) * 60 / bpm`. Public domain melodies only.

**Feet source** (every tracker has this shape, see `src/track/mouse.js`):
`{ start(): Promise, read(): [{ u, v }] }`. Field coordinates: `u` runs 0 (left) to 1 (right) across the lanes, `v` runs 0 (far edge, where tiles appear) to 1 (the players' edge).

**Camera feet** (`src/track/camera.js`, before calibration): `[{ x, y, person }]`, `x` and `y` from 0 to 1 in the camera picture, one entry per visible foot.

**Lanes:** 1 player 4 lanes, 2 players 6, 3 or 4 players 8. Everyone shares one keyboard and one score. A note's lane comes from its pitch: the song's distinct pitches, sorted low to high, spread evenly over the lanes, low on the left.

**Hit rule:** a tile takes 2.5 seconds to travel from `v = 0` to the hit line at `v = 0.75`. It is hit if any foot is inside its lane with `v >= 0.55` at any moment within 250 ms either side of its time. Otherwise it is a miss.

**Link messages** (JSON text, relayed to every other page):
```json
{ "type": "start", "songIds": ["twinkle"], "players": 2, "endsAt": 1795300000000, "stop": "Kenmore", "mode": "platform" }
{ "type": "stop" }
{ "type": "state", "status": "idle", "songId": null, "title": null, "hits": 0, "total": 0, "secondsLeft": 0 }
```
`mode` is `"platform"` or `"train"`. `endsAt` is the time the train is due, in epoch milliseconds, or null. `status` is `idle`, `playing` or `done`. The stage sends `state` once a second and on every change.

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

## Projection rules (physical, from the hardware table)

The stage page is a picture thrown on a floor by a dim 720p projector. So: the background is pure black (black is no light), tiles and lanes are bright saturated fills, no thin lines, no text smaller than a tenth of the picture height, nothing that needs fine detail to read.

## Cards

| id | owner | runs on (person, tool) | files it may touch | build | done-check | box | status |
|---|---|---|---|---|---|---|---|
| T1 | tracker-1 (hack-backend) | Nicolo, Claude Code | `src/track/camera.js`, `src/track/debug.js`, `track.html`, `qa/person.jpg` | **Camera check page.** `camera.js` exports `createCameraFeet({ video, model = "lite", maxPeople = 4 })` returning `{ start(), read(), fps(), stop() }`; `read()` returns Camera feet (see Data shapes). It runs MediaPipe Pose Landmarker in VIDEO mode with `numPoses = maxPeople`, loading `/mediapipe/wasm` and `/mediapipe/pose_landmarker_<model>.task` (never a CDN). Try the GPU delegate and fall back to CPU. A foot's point is the midpoint of its heel and foot-index landmarks, kept only when both have visibility above 0.5. `track.html` shows the live camera with a dot on every foot and a faint dot on every other landmark, the frames per second, a camera picker (`enumerateDevices`, choice remembered in localStorage, so the DJI can be picked over the laptop's own camera), and a lite/full model switch. With `?src=/qa/person.jpg` (an image) or a video file URL it runs on that file instead of the camera, so it can be checked with no camera. Save one freely licensed photo of a standing person with visible feet as `qa/person.jpg` and note its source in the report. Every error a person can hit (no camera, permission denied, model missing) shows its real reason and the fix in plain words on the page. | `node tools/shot.mjs "http://localhost:5173/track.html?src=/qa/person.jpg" shots/T1-photo.png --wait 6000` shows two foot dots on the person's feet and no console errors. | 30 min | ready |
| G1 | game-1 (hack-frontend) | Nicolo, Claude Code | `src/game/engine.js`, `src/game/engine.test.js`, `src/game/synth.js`, `src/game/render.js`, `src/stage/main.js`, `stage.html` | **The game, played with the mouse.** `engine.js` is pure logic with no browser calls: `lanesFor(players)`, `laneOf(song, midi, lanes)`, `songSeconds(song)`, and `createGame({ song, players })` with `update(nowMs, feet)` returning the tiles to draw (lane, position `v`, state waiting/hit/missed), the notes hit this frame, and `hits`, `misses`, `total`, `done`. Follow Lanes and Hit rule in Data shapes exactly. `engine.test.js` covers: lane counts, pitch to lane, a foot in the lane inside the window is a hit, outside the window is a miss, the wrong lane is a miss, the song ends. `synth.js` plays a note by midi number with the Web Audio API (a soft piano-like tone, short attack, about one second decay; no audio files) and a dull low thud for a miss. `render.js` draws on a full-window canvas following Projection rules in this file: black field, lanes, the hit zone from `v = 0.55` to `1`, tiles sliding from the far edge to the players' edge, a lit lane where a foot is, a flash on a hit, and a large score. `main.js` wires it: `?feet=mouse` uses `src/track/mouse.js`; Space starts `songs/twinkle.json` (browsers need a key press before sound); F toggles fullscreen; `?players=1..4` sets lanes; `?autostart=1` starts without the key press (no sound) so screenshots can catch it playing; when the song ends it shows hits out of total. Keep the feet source swappable: one place in `main.js` picks it. Do not build the phone link, calibration or camera here. | `npm.cmd test` passes. Open `http://localhost:5173/stage.html?feet=mouse`, press Space, hit tiles with the mouse and hear the tune. Two shots of `stage.html?feet=mouse&autostart=1` with `--wait 3000` and `--wait 4500` show tiles in different places. | 30 min | ready |
| M1 | mbta-1 (hack-backend) | Nicolo, Claude Code | `src/mbta/api.js`, `src/mbta/api.test.js` | **Live T data.** The three functions under MBTA in Data shapes, against `https://api-v3.mbta.com` with plain `fetch`, working in both the browser and Node (no key needed; if `VITE_MBTA_KEY` is set, send it as the `x-api-key` header). `listStops()` covers the subway only (Red, Orange, Blue, Mattapan, Green B, C, D, E; route types 0 and 1), parent stations, one entry per station with every line that serves it, sorted by name. `nextTrains(stopId)` returns upcoming arrivals sorted soonest first, with past ones dropped, using `arrival_time` or `departure_time` when arrival is null. `rideSeconds` follows one trip from the first stop to the second: predictions first, the schedule when a prediction is missing, and a thrown error with a plain reason when neither exists. Every failed request throws an error that says what failed in plain words (rate limit, no service, offline). Read the API's rate limit for keyless use and put it in the report. | `npm.cmd test` passes against the live API and prints the next trains at Kenmore and the ride time from Kenmore to Park Street. | 30 min | ready |
| S1 | songs-1 (hack-backend) | Nicolo, Claude Code | `songs/*.json` except `twinkle.json`, `src/songs/index.js`, `src/songs/pick.js`, `src/songs/pick.test.js` | Song library and the picker that fits songs to a wait. Written when wave 1 reports. | | 30 min | waiting |
| T2 | tracker-2 (hack-frontend) | Nicolo, Claude Code | `src/track/homography.js`, `src/track/homography.test.js`, `src/track/calibrate.js`, then one small change in `src/stage/main.js` | Straighten the projected picture (drag four corners) and map camera feet onto the field (click four corners). Written when T1 and G1 report. | | 30 min | waiting |
| D1 | designer (hack-designer) | Nicolo, Claude Code | `src/tokens.css`, `DESIGN.md`, `src/phone/*`, `index.html` | Phone page pilot: pick a stop, see live trains and the song that fits. Written when M1 reports. | | 30 min | waiting |
| R1 | researcher (hack-researcher) | Nicolo, Claude Code | `research.md` | Sourced facts for the pitch: how long riders wait, what waiting feels like, three existing floor games and what each misses. | | 30 min | waiting |
