# How Platform Piano works

Written Sat 21 Nov, 12:12 PM. This is the map of the whole system: every part, what it does, and how the parts talk. `PLAN.md` holds the cards that build it.

## What it is

A rhythm game projected on the floor. Tiles slide toward your feet and you tap them with your shoes. Each player picks a seat on their phone, and their own pad of tiles appears on the floor right at that seat. The phone is only the remote. The songs are picked to last as long as your wait for the train, or your ride to your stop.

## The four machines

| Machine | Its job |
|---|---|
| **Camera** (DJI Osmo Action 4, on the SmallRig tripod) | Watches the floor and the players' legs. Sends video to the laptop over USB. |
| **Laptop** | The brain. Finds feet in the video, runs the game, draws the picture, plays the sound, and hosts the page the phones open. |
| **Projector** (Panseba HI-04) | Throws the laptop's picture onto the floor. It is the laptop's second screen, over HDMI. |
| **Phones** | The remotes. One for each player. They pick seats, songs, and start the game. Nothing is played on the phone. |

```
 camera --USB--> LAPTOP --HDMI--> projector --light--> floor
                   ^                                     |
                   |  Wi-Fi or hotspot                   | feet
                 phones                                  v
                                              (the camera sees them)
```

## The software, part by part

Everything is one web app served by the laptop. Three kinds of page:

| Page | Who opens it | What it does |
|---|---|---|
| **Stage** (`stage.html`) | The laptop, full screen on the projector | Tracks feet, runs the game, draws the floor, plays sound. It is the one source of truth: seats, scores, and the song all live here. |
| **Setup** (inside the stage page) | The person setting up, on the laptop | Six steps that line the camera up with the projector. Done once each time the gear moves. |
| **Remote** (`index.html`) | Every phone | Join, pick a seat, pick a stop and songs, start, pause, see your score. |

Behind them:

| Part | File area | What it does |
|---|---|---|
| Tracker | `src/track/` | Video in, feet on the floor out. Described in full below. |
| Game engine | `src/game/engine.js` | The rules: taps, holds, combos, score, grade. Pure logic, fully tested. One engine runs for each seat. |
| Renderer and effects | `src/game/render.js`, `fx.js` | Draws every pad, tile, glow, burst, the train clock, and the results. |
| Sound | `src/game/synth.js` | A piano for the players' notes and a backing beat under them. |
| Songs | `songs/`, `src/songs/`, `tools/midi-to-song.mjs` | The library, the tool that turns a MIDI file into a song, and the picker that fits songs to a wait. |
| Transit | `src/mbta/` | Live MBTA data: stops, next trains, and ride time between two stops. |
| Session | `src/stage/session.js` | Who is in which seat, the song queue, and the game's state (lobby, countdown, playing, paused, results). |
| Link | `server/link.mjs`, `src/link.js` | Carries messages between the phones and the stage. |

## The tracker, step by step

This is the hard part of the project, so here is every step from light hitting the camera to a tile being hit.

### 1. Capture
The browser opens the DJI as a webcam and gets about 30 pictures a second. The setup page lets you pick the DJI, because the laptop has its own camera too.

### 2. Find the people
Each picture goes through a pose model (MediaPipe Pose Landmarker, running on the laptop, no internet). For up to four people it returns 33 body points each. We keep four: the heel and the toe of each foot. A foot's position is the middle of its heel and toe.

The model needs to see most of a body to find it. So the camera must see the players from about the knees down at least, and ideally the whole person.

### 3. Clean it up
Raw points shake and sometimes vanish for a frame. Three fixes:
- **Smoothing:** each foot's position is blended with where it was a moment ago, so it stops shaking but still follows a fast step.
- **Dropouts:** a foot that disappears is kept where it was for 150 ms before we believe it is gone.
- **Confidence:** points the model is unsure of are thrown away.

### 4. From camera picture to floor
The camera sees the floor at an angle, so a foot's position in the picture is not its position on the floor. Calibration (below) gives us a formula, called a homography, that turns any point in the camera picture into a point on the projected field. It is built from four matching points. After this step every foot is a spot on the field: 0 to 1 across, 0 to 1 deep.

This only holds for things touching the floor. A lifted foot looks further away than it is. That is fine, because we only care about feet when they land.

### 5. Whose foot is it
Each seat owns a rectangle of the field, its pad. A foot inside a pad (or just outside its edge) belongs to that seat's player. We do not need to recognise people. Where you sit is who you are.

### 6. Taps and holds
Inside a pad the foot's position says which lane it is in. The engine watches each lane's square:
- A foot **arriving** on a square is a tap. Standing still on it is not.
- A foot **staying** on a square holds a long tile.
- The timing of the arrival against the tile's time gives perfect, good, or miss.

### 7. Lag
The camera, the model, and the projector each add delay, about 100 to 200 ms together. If we ignored it, every tap would look late. The setup's last step measures it: you tap along to eight clicks, and the game shifts its clock by your average lateness.

## Setup: lining up the camera and the projector

Six steps on the laptop. Each one shows what to do and will not move on until it works.

1. **Camera.** Pick the DJI. You see its picture with dots on any feet it finds.
2. **Straighten the picture.** The projector sits at an angle, so its picture lands on the floor as a stretched shape. Drag four corners until the field looks like a true rectangle on the floor.
3. **Show the camera the field.** The projector lights up four corner marks. The camera takes a still, and you click the four marks in it. Now the laptop knows where the field is in the camera's view.
4. **Place the seats.** Choose seated or standing and how many seats. Drag each pad so it sits at the feet of its seat.
5. **The foot check.** The projector draws a glowing dot wherever it thinks a foot is. Walk around. If the dot stays on your shoe, the lineup is right. If not, redo step 3.
6. **The lag test.** Tap a square in time with eight clicks.

Everything is saved on the laptop, so a restart does not lose it. If the camera or projector gets bumped, redo steps 2 and 3.

## A game, start to finish

1. The stage shows the lobby on the floor: empty pads, each with a seat number, and a QR code.
2. A player scans the code. Their phone opens the remote, asks a name, and shows the seats. They tap one. Their pad on the floor lights up with their name.
3. Someone picks the stop. The remote shows the next trains, live, and the songs that fit the wait. On a train, they pick where they get off, and the songs fill the ride.
4. Start. The floor counts down, then tiles slide toward every player's feet. Every seat gets the same song on its own pad.
5. Hits play the notes, with a backing beat under them. Combos build. A small train creeps along the top of the field toward its station as the real train gets closer.
6. The song ends as the train is due. The floor and every phone show scores, best combo, and a grade.

## What can go wrong, and the plan for each

| Risk | Plan |
|---|---|
| The projector is dim (about 100 to 450 lumens) and stations are lit | Black field, bright tiles, small pads. Test in a lit room early. |
| The projector has no battery | Test at an outlet. A power station is needed for the T and waits for Nicolo's number. |
| The camera's wide lens bends the picture at the edges | Keep the field in the middle of its view. |
| The gear gets bumped | Steps 2 and 3 of setup take under a minute. |
| No signal underground | The laptop needs no internet to track or play. Only the live train times need the phone's signal, and the last answer is kept. |
| People walk through the field | Feet outside every pad are ignored. |
| Phones cannot reach the laptop on venue Wi-Fi | Use a phone hotspot. The laptop and the phones join it. |

## Limits we say out loud

- It needs a camera, a projector, and a laptop. Today it is a demo you carry, not something built into a station.
- Up to four players, because the pose model tracks four people and the picture is about 1.2 m wide.
- The laptop's own clock runs the game. The train clock comes from MBTA predictions, which can change while you play.
