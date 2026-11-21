# Setting up Platform Piano

Written Sat 21 Nov 2026 from the code and the reports as they are now. Follow it top to bottom. Read it on a phone if you like: every step is one action.

A step marked **(not yet proven on the real floor)** has run only on recordings, stills, a fake camera, or the mouse. If it fails on the real gear, tell the lead what you saw.

## What you need

| Thing | What it is for |
|---|---|
| Laptop | Runs everything. Needs one USB port, one HDMI port, and power. |
| DJI Osmo Action 4 | The camera. It sees the players' feet. |
| SmallRig VT-07 tripod | Holds the camera low. |
| Panseba HI-04 projector | Throws the game on the floor. It needs a wall socket. |
| HDMI cable and USB-C cable | The USB-C cable from the DJI box. Some cables only charge. |
| One phone for each player | Any phone. It is the remote. |

## 1. Place the gear

Everyone sits on the same side of the aisle. The camera and the projector stand on the other side, **across the aisle, facing the players** (Nicolo, Sat 6:25 PM, after the first run on the real floor).

1. Put the tripod across the aisle from the seats, with its legs at the shortest setting. The camera must sit low.
2. Point the camera at the seats. Every player must show from head to shoes. It needs to see a foot lift and land, so do not aim it down from above.
3. Put the projector across from the players too. Aim it at the floor in front of their feet.
4. Plug the projector into the wall.

## 2. Plug in

1. Connect the projector to the laptop with the HDMI cable.
2. On the laptop press the **Windows key and P**, then choose **Duplicate**. The floor now shows what the laptop shows.
3. Turn the DJI on.
4. Plug the DJI into the laptop's own USB port, not a hub.
5. On the DJI's screen choose **Webcam**. If no choice appears, the cable only charges. Use the one from the DJI box.

The DJI worked as a webcam on 21 Nov in the first real run. Webcam mode and the projector over HDMI were used then.

## 3. Start the server

1. Open PowerShell in the project folder.
2. Run `npm.cmd run build`. Wait for it to finish. (In Git Bash the build fails for a reason that has nothing to do with the project. Use PowerShell.)
3. Run `npx.cmd vite preview`. Leave the window open.
4. It prints a **Local** address, `http://localhost:5173/`, and one or more **Network** addresses.

For a demo use the built copy above. `npm.cmd run dev` also works, but it reloads every page whenever a file is saved, which is bad in the middle of a demo.

## 4. Open the stage

1. In Chrome or Edge on the laptop, open `http://localhost:5173/stage.html?feet=seats`.
2. It must say `localhost`. The browser only allows the camera there.
3. Click **Allow** when it asks for the camera.
4. If the camera does not start, setup opens by itself. Its first step shows the reason.

`?feet=seats` is seated play: one pose reading for each seat, and a tap is a foot that lifts and lands in place. Other options: `?seats=3` sets the number of seats, `?facing=1` turns the picture half way round (see step 5), `?demo=1` fills every seat with a guest and lets Space start a song.

## 5. Line it up (press C)

Press **C** on the stage. Setup shows one step at a time, in a small panel in a corner (press **Move** to change the corner). Each step says what to do. **Next** works when the step has worked. **(not yet proven on the real floor)** for every step below.

| Step | What you do | It worked when |
|---|---|---|
| 1. Camera | Pick the DJI in the list. | You see its picture, and a dot sits on each foot found. |
| 2. Straighten the picture | Drag the four corners until the squares on the floor look square. If the projector faces the players, press **The projector faces the players**. | The squares on the floor look square, and the picture reads the right way round from where the players sit. |
| 3. Seats on the floor | Pick how many seats (1 to 4). Drag each pad until it sits at the feet of its seat. | Each pad is in front of its own seat. |
| 4. Seats in the camera | Press **Fit to the people**. Every player must be sitting in view. | Every seat says "Person found, 2 feet." |
| 5. Tap test | Every player lifts a foot and taps. | Every seat reaches "3 of 3" and its own lane flashes. |
| 6. Lag test | Tap your foot on each of eight clicks. | It says "You tap about ... ms after the click. Saved." |

Notes for the steps:

- **Step 2, facing.** The projector stands across from the players, so the picture is turned half way round and the seats mirror. The switch is saved. Key **T** on the stage does the same and reloads the page. This is a rule from Nicolo, Sat 6:25 PM. After you turn it, check that the seat numbers on the floor read left to right as the players see them.
- **Step 4, fit.** The button finds everyone and cuts the camera picture into one slice for each seat. It takes about 1 to 3 seconds. After that the lines follow the people slowly by themselves. Dragging a line turns following off until you press **Follow people**. Press the fit button in setup, never in the middle of a song.
- **Step 4, a neighbour.** If a row says "Someone from a neighbouring seat shows here. Move the line off them.", drag that line.
- **Step 5, one player alone.** You get two lanes, "Left foot" and "Right foot". If the wrong lane flashes, press **Swap feet**. A camera that faces the player sees the left foot on the picture's right, so you will probably need it.
- **Step 5, two or more players.** Each player has one lane. If another player's lane flashed, press **Another player's lane flashed**, then go back to step 4 and fix the lines.
- **Step 6, lag.** The game starts with 120 ms. The test replaces it with your number.

Everything is saved on the laptop. If the camera or the projector gets bumped, press **C** and redo steps 2 to 4.

## 6. Full screen and keys

1. Click once on the stage page. The click also turns the sound on.
2. Press **F** for full screen, then drag the page to the projector's screen first if it is on the laptop's.

| Key | What it does |
|---|---|
| F | Full screen on and off. |
| C | Setup. |
| T | Turns the picture half way round and mirrors the seats. Saved. The page reloads. |
| P | Pause or resume. |
| S | Skip the song. |
| Esc | Stop the song. |
| Space | Only with `?demo=1`: starts two songs. |

## 7. Phones join

1. The floor shows a QR code and "Scan to play".
2. Each player scans it with their phone camera. The phone opens the app with the train already known.
3. The phone asks "Where are you getting off?". The player taps a stop.
4. The phone shows a recommended song that fits the ride. "See more songs" shows the rest.
5. The player taps **Play this song**, then taps a seat. One phone can take several seats. Tap a seat again to give it back.
6. When the seats are right, tap **Ready!**. The floor counts down 3, 2, 1.

Which address is in the QR code: if the laptop has internet and the relay connects, the code holds the hosted page `https://platform-piano.vercel.app/` (set in `.env.local`). Phones then need only their own internet. If not, it holds the laptop's Wi-Fi address, and the phones must be on the same Wi-Fi or hotspot. **(not yet proven on the real floor)** Whether the hosted page is up to date was not checked.

Venue Wi-Fi often blocks phones from reaching a laptop. If a QR code will not open, turn on one phone's hotspot and put the laptop and the other phones on it.

The live train times need internet. Without it the stop list and song step show "Could not reach the MBTA. Check the internet connection." with a **Try again** button.

## 8. Before the demo

1. Close every other stage page on this laptop. The local link has no rooms, so two stage pages mix up their seats.
2. Run `node qa/e2e/demo-path.mjs --base http://localhost:5173`. It plays the whole path with a mouse in about one minute. It does not prove the camera.
3. Then do one real round by hand: scan, pick a stop, take two seats, play, and watch the score move.

## No hardware? Try it with the mouse

Open `http://localhost:5173/stage.html?demo=1&feet=mouse` and press **Space**. Guests sit in every seat. A mouse click is a foot landing. Hold the button for a long tile. The phone alone, with a pretend floor: `http://localhost:5173/?mock=1`.

## When something is wrong

| What you see | Why, and what to do |
|---|---|
| The floor is black and empty. | 1. The projector may be showing a different screen. Press Windows key and P, choose **Duplicate**. 2. The stage page may show a line of big white text: that is the reason, read it. 3. If the server window closed, run `npx.cmd vite preview` again and reload. The field is black on purpose, because black is no light. A lit pad should show. |
| The camera picture is stale or frozen. | Reload the stage page. If it stays frozen, another app has the camera: close Zoom, the DJI app, and other browser tabs, then reload. The code keeps the camera video on the page for good, because a browser freezes a video that is hidden or taken off the page. |
| The page looks old after a fix. | The browser kept the old copy. Reload. For a built copy, run `npm.cmd run build` again first. |
| "No camera found." | The DJI is not in Webcam mode. Unplug it, turn it on, plug it in, choose **Webcam**, reload. |
| "The browser blocked the camera." | Click the camera icon in the address bar, choose Allow, reload. |
| "No person found." for a seat (setup step 4). | Everyone must sit in view with their legs showing. Press **Fit to the people**. If it still fails, drag that seat's lines to cover the person. |
| "Person found, 0 feet. The shoes are not in view." | The camera cannot see the shoes. Lower it or move it back. |
| Taps do not count. | The foot must lift and come back down in place. A foot that stays down holds a long tile only. Lift higher. Check step 5. The tap detector needs the knee and ankle in view to size a lift. |
| The wrong foot or lane lights up. | Press **Swap feet** in step 5 (one player). With more players, a line cuts through someone: fix it in step 4. |
| The picture on the floor reads upside down, or the feet look backwards. | Press **T**, or use **The projector faces the players** in step 2. This was the first problem found on the real floor. |
| A phone shows no seats, or lost its seats. | The stage frees the seats of a phone it has not heard from in 10 seconds in the lobby. A locked phone says nothing. During a song it keeps them, and for 30 seconds after. When the phone wakes it asks for its seats back by itself if they are still free. Keep phones awake in the lobby. |
| A phone says "That seat is taken." | Another phone holds that seat. Wait for it to give the seat back, or pick another. |
| A phone says "No floor is connected." | The stage page is not open, or the phone is on another network. Check the QR code and the network. |
| Seats are already taken by guests. | Another stage page is open with `?demo=1`. Close it. |
| Hits feel late or early. | Press **C** and redo the lag test. |
| No sound. | The browser keeps sound off until a click. Click the stage page once, or press any key. Then check the laptop's volume and output. |
| The QR code will not open on a phone. | The phone is on another network. Use a hotspot. |
| The floor picture is too dim. | The projector gives about 100 to 450 lumens. Move it closer to make the picture smaller, and find a darker spot. |
| The stop list says "That did not load." | Read the reason on the screen. Without an MBTA key the service allows 20 requests a minute. The key is built into the app, so "The MBTA refused the API key." means it is wrong. |
