# TTiles

Piano tiles on the floor of a train car, played with your feet.

Built in 24 hours at BostonHacks 2026 (21 to 22 November, Boston University).

- **Play on your phone:** https://ttiles.us
- **Run the floor** on a laptop with a camera and a projector: https://ttiles.us/floor

## What it is

A projector across the aisle draws a lane of tiles at each seat. One camera watches every player's shoes. Lift a foot, land it on the beat, and the note plays. Up to four riders play one song together, sitting down, as a team or in a duel.

Your phone is the remote. Scan the code in the car, pick where you are getting off, and TTiles reads the MBTA's live arrival predictions to offer a song that fits your ride. There is no app to install and no account.

## How it works

- **Feet:** a pose model (MediaPipe Pose Landmarker) runs in the browser on each seat's slice of the camera picture. A tap is a foot that lifts and lands.
- **Floor:** a canvas game on the laptop, straightened onto the floor with a four-corner fit, with a setup screen for the camera, the seats and the lag.
- **Phone:** a small web app. It joins the floor through a room code, over a WebSocket on the same network or an MQTT relay over the internet.
- **Songs:** note data in `songs/`, played through the Web Audio API with sampled piano.
- **Trains:** the MBTA V3 API.

More detail: [docs/HOW-IT-WORKS.md](docs/HOW-IT-WORKS.md). Setting it up in a room: [docs/INSTALL.md](docs/INSTALL.md) and [docs/SETUP.md](docs/SETUP.md).

## Run it yourself

You need Node 20 or newer.

```
npm install
npm run dev
```

Then open http://localhost:5173/stage.html for the floor and http://localhost:5173 for the phone. With no camera, the mouse stands in for feet. On Windows, `start-ttiles.cmd` starts the floor full screen with one double-click.

`npm test` runs the tests. An MBTA API key is optional: put `VITE_MBTA_KEY=...` in a file called `.env.local` for a higher request limit.

## Where it stands

- It runs on a real projector and camera in a room, with phones joining by QR code.
- It has not yet run on a moving train.
- Foot tracking on the real floor is still being tuned: some taps are missed.

## Built with

Vite, plain JavaScript, MediaPipe, the Web Audio API, MQTT, the MBTA V3 API, and zxing for reading QR codes. Written with help from Claude Code.

Sounds, fonts and pictures we did not make are listed in [CREDITS.md](CREDITS.md).
