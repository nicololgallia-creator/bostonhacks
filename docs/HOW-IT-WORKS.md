# How TTiles works

Written Sat 21 Nov 2026 from the code and the reports as they are now. `PLAN.md` holds the cards that built it, and `docs/SETUP.md` says how to set it up.

## What it is

A rhythm game projected on the floor of a train car. Tiles slide toward your feet. You sit in your seat and tap a foot in place when a tile reaches the line. Each player picks a seat on their phone, and a pad of tiles appears on the floor at that seat. The phone is only the remote. The song is picked to end about when your ride ends.

## The pieces

| Piece | Files | What it does |
|---|---|---|
| Stage page | `stage.html`, `src/stage/main.js` | Runs on the laptop, full screen on the projector. It is the one source of truth: seats, scores, the song, the clock. It draws the floor and plays the sound. |
| Phone page | `index.html`, `src/app/main.js`, `src/app/screens/` | The remote. One screen for each step: stops, song, seats, look down, leaderboard, share, play again. It draws only what the stage's State says. |
| The link | `server/link.mjs`, `src/link.js`, `src/link-relay.js` | Carries JSON messages between the pages. The local link is a WebSocket on the laptop's server and has no rooms: every page hears every other. The relay is a public MQTT broker with a private 8-letter room code, for the hosted phone page. |
| Session | `src/stage/session.js`, `src/stage/layout.js` | Who holds which seat, the lobby, countdown, playing, paused and results states, scores, bonuses. No browser calls, so it is tested in Node. |
| Tracker | `src/track/` (`seats.js`, `slices.js`, `seatsource.js`) | Camera video in, each seat's two feet out. |
| Tap detector | `src/track/taps.js` | Turns a foot's height over time into taps. |
| Game engine | `src/game/engine.js`, `src/game/parts.js` | The rules, one engine for each taken seat. `parts.js` splits one song across the seats. |
| Floor drawing and sound | `src/game/tiles.js`, `floor-look.js`, `floor-screens.js`, `src/game/synth.js` | The projected picture and the piano. |
| Setup | `src/stage/setup.js`, `keystone.js`, `lag.js` | Six steps on the stage that line the camera, the seats, and the projector up. |
| Songs | `songs/*.json`, `src/songs/index.js`, `src/songs/pick.js` | 17 songs and the picker that fits one to a ride. |
| MBTA data | `src/mbta/api.js` | Live stops, predictions and schedules from `api-v3.mbta.com`. |

Hardware: the DJI Osmo Action 4 (webcam mode, USB) and the Panseba HI-04 projector (HDMI) stand across the aisle, facing the players. The laptop runs everything. Phones join by QR code.

```
 DJI --USB--> LAPTOP --HDMI--> projector --> floor in front of the seats
                ^
     phones --link (Wi-Fi, or the relay over the internet)
```

## How a tap becomes a hit

**One pose model for each seat.** The camera picture is cut into upright slices, one for each seat (`src/track/slices.js`). A pose model (MediaPipe Pose Landmarker, saved in `public/mediapipe/`, no internet needed) runs on each slice by itself, so it has one person to find. The whole picture with several people missed some of them, which is why it is cut. Each model sees 15 percent more picture on each side of its slice (`PAD_SHARE` in `src/track/seats.js`). A person belongs to the seat whose slice holds their hips, so a neighbour who leans in is dropped for that frame. The slice lines come from the **Fit to the people** button, which puts each line half way between two people's hips, and they follow the people slowly after that (`fitBounds` in `slices.js`, at most 0.02 of the picture a second).

**Each foot is tracked on its own.** `src/track/taps.js` keeps one track for each foot. A foot's ground is its lowest recent height in the picture. It is lifted when it rises above the ground by 6 percent of the shin's length, and at least 0.012 of the picture's height, and at least four times the shake the foot shows while down (`TAP_DEFAULTS`). A tap is a lift of at least 50 ms followed by a return to the ground, reported at the landing. The same seat cannot tap twice inside 150 ms.

**Lift, then land.** The detector gives each foot `lifted: true` while it is in the air. In the engine (`src/game/engine.js`) a lifted foot is off its square at once, and a landing is an arrival. A tap tile is hit when a foot arrives within 300 ms of the tile's time, and within 120 ms counts as perfect. A foot that stays down holds a hold tile (a note of 0.8 seconds or longer). Tiles take 2.5 seconds to travel to the hit line.

**The lane rule.** One player alone has two lanes, one for each foot. Two, three, or four players have one lane each, and either foot plays it (`lanesInPad` in `src/game/parts.js`). So the song is spread over 2, 2, 3, or 4 lanes in all, and nobody gets a thinned-out part (Nicolo, Sat 5:25 PM). `splitParts` deals the notes by pitch, low to high, so each lane gets about the same number of notes.

**Facing.** The gear stands across from the players, so the picture is turned half way round and the seats mirror. One saved switch holds it (`src/facing.js`, key T). Everything that maps camera to pad or draws for the floor asks it.

**Score.** Perfect is 100, good is 50, a finished hold adds 20 for each beat. The multiplier is x2 from a combo of 10, x3 from 25, x4 from 50. A grade comes from hits over total: S from 95 percent, A from 85, B from 70, else C. When a song ends, 50 bonus points go to the seat with the best combo and 25 to the seat with the most perfects. The team score adds every seat.

## How a song is chosen

1. The poster's QR code holds the train: line, direction, the stop the train is at, and the car (`?line=Green-B&dir=1&at=place-bucen&car=2`).
2. The phone asks "Where are you getting off?" and lists the stops ahead (`stopsOnRoute`).
3. `rideSeconds` reads the live time between the two stops from MBTA predictions, and from the schedule when there is no prediction.
4. `pickSongs({ seconds })` in `src/songs/pick.js` finds the set of songs whose play time, plus 4 seconds each, comes closest to the ride minus 20 seconds without going over. The phone shows the first, the longest, as the recommended song. "See more songs" lists every song that fits. If none fits, it lists the three shortest.
5. On Ready, the phone sends `start` with one song and `transit` (the stop's name and `endsAt`, now plus the ride). The stage draws a small train running to that stop, with the time left.

## A game, start to finish

1. The stage shows the lobby: seat pads, "Scan to play", and a QR code.
2. A player scans, picks a stop and a song, and taps one or more seats. The pads light up in the seat colours.
3. Ready sends `start`. The floor counts down 3, 2, 1, then tiles slide in.
4. Hits play the notes of a sampled piano, with a backing beat under them when the song has one.
5. When the song ends, the floor shows results for 8 seconds, then the lobby. The phone shows the leaderboard, then share and play again.
6. A phone that goes quiet loses its seats: 10 seconds in the lobby, and 30 seconds after a song. Nobody is dropped during a song.

## Measured numbers

| What | Number | Source |
|---|---|---|
| Taps read, seat 1, two people, one lane each | 29 taps for 31 real lifts | `reports/taps-feet.md`, `qa/seats/real-two-1.json`, 22 to 39.6 s |
| Taps read, seat 2 | 37 taps for 40 real lifts | same |
| Taps while the seat was resting | 0 in both seats, 5 to 22 s | same |
| Taps read, one seated person, each foot | 26 and 26 (range expected 25 to 40) | `reports/taps-feet.md`, `qa/feet/real-taps-1.json` |
| A missed target | 1 tap when seat 1 sat alone (40.7 to 42.2 s). Kept as a `todo` test, not hidden | `reports/taps-feet.md` |
| Finding all people at once, whole frame | 0 of 4 on `four.png`, 2 of 3 on `close3` | `reports/autofit.md` |
| Finding people with the scan added | all of them | same |
| Fit to the people, in the stage | 0.6 s (2 people), 0.8 to 0.9 s (3), 2.9 s (4) | same |
| Floor drawing speed, 4 seats, 30 s | 71.5 frames a second, worst frame 58 ms | `reports/floor-real.md` (headless, on a busy laptop, not the projector) |
| Tracking speed on a video, headless | 13 frames a second | same (pose model on the CPU there) |
| Relay, three public brokers | 717 of 717 messages in 4 minutes on two of them. A third failed in 3 of 6 attempts | `reports/relay.md` |
| Time for a closed phone's seats to free | 7.8 to 9.1 s | `qa/e2e/demo-path.mjs`, five passing runs on 21 Nov |
| MBTA without a key | 20 requests a minute | `src/mbta/api.js` |

## What is not proven yet

- Any live tap on the real floor. The tap numbers come from recordings made with the real DJI, not from a live game.
- Whether the slice dots land on real shoes at the real distance, and whether "person found" holds with a person behind a table (`reports/seat-setup.md`).
- Whether a neighbour leaning into a slice is flagged in live video (`reports/autofit.md`).
- Three or four people on one camera, a different camera height, and feet that cross (`reports/taps-feet.md`).
- Whether the lines follow people at a good speed (0.02 a second is a guess), and the edge sizes in the fit (`reports/autofit.md`).
- Facing on the real floor: only the geometry is checked on stills. The default lane for a lone player with facing is reasoned, not tested with a person.
- The real lag number, and how fast the tracker runs on the laptop with the GPU while the game draws (`reports/seat-stage.md`).
- The tracking speed on the real camera. Nicolo said on Sat 6:25 PM that it "moves pretty slowly". No number from the real camera has been recorded since.
- Anything on a real train or platform: power for the projector, the lit station, and the phone signal underground.
- The hosted phone page at `platform-piano.vercel.app`: it was not checked that it matches the current code.
- Sound by ear, and the tunes from memory (`PLAN.md`: Jingle Bells, Ode to Joy, London Bridge, Happy Birthday need a listen).

## Limits we say out loud

- It needs a camera, a projector, and a laptop. It is a demo you carry.
- Up to four players. The pose model sees one person in each slice, and the picture is about 1.2 m wide.
- The laptop's clock runs the game. The train clock comes from MBTA predictions, which can change while you play.
- The relay uses free public brokers with no promise of service. The room code is the only secret. Messages carry seat numbers, scores, and the train, with no names.
