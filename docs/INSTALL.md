# Installing TTiles in your space

For BU Spark staff. You do not need anyone from the team in the room. TTiles is a rhythm game projected on the floor. Players sit in a row and tap their feet. A camera watches the feet. Each player's phone is the remote.

A step marked **(not yet proven on the real floor)** has run only on recordings, a fake camera, or a mouse. If it fails, the troubleshooting table at the end has the fix. Written Sat 21 Nov 2026.

## The short way: one link

On any laptop with the camera and projector plugged in and internet, open **https://ttiles.us/floor** in Edge or Chrome and allow the camera when it asks. That is the whole floor: nothing to install, nothing to start. The first time, give it up to a minute to load the foot tracker; after that it is quick. Two small buttons sit in the lobby's corner: **Calibrate** (check the camera, straighten the picture, place the pads) and **Full screen**. Press either once and the sound is on. Players scan the code on the floor. (not yet proven on the real floor)

The rest of this guide is the same floor started from the laptop itself, for a room with no internet.

## What is in the box

| Thing | What it is for |
|---|---|
| Windows laptop with TTiles on it | Runs the game. It needs one USB port, one HDMI port, and power. |
| DJI Osmo Action 4 camera and its USB-C cable | The camera. It sees the players' feet. Use the cable from the DJI box, because some cables only charge. |
| Tripod | Holds the camera low. |
| Panseba HI-04 projector, HDMI cable, power cable | Throws the game on the floor. It needs a wall socket. |

## Set up the gear

1. Put the tripod across the aisle from the seats. Set its legs to the shortest length, so the camera sits low.
2. Point the camera at the players' seats. Every player must show from head to shoes.
3. Put the projector across the aisle too, facing the players. Aim it at the floor in front of their feet. The game turns its picture half way round by itself, so it reads from the players' side. **(not yet proven on the real floor)**
4. Plug the projector into the wall.
5. Plug the HDMI cable from the projector into the laptop.
6. On the laptop press the **Windows key and P**, then choose **Duplicate**. The floor now shows what the laptop shows.
7. Turn the DJI on.
8. Plug the DJI into the laptop's own USB port, not into a hub.
9. On the DJI's screen choose **Webcam**. If no choice appears, the cable only charges. Use the one from the DJI box.

The DJI worked as a webcam and the projector worked over HDMI in the first real run on 21 Nov.

## Start it

1. Open the TTiles folder.
2. Double-click **start-ttiles** (the file is called `start-ttiles.cmd`).
3. A black window prints one or two lines. The first time, it may build the game and take about a minute. Leave the window open.
4. Windows may ask whether to let the program "node" use the network. Choose **Allow** on private networks. Phones on the same network need this. **(not yet proven on the real floor)**

The same thing from a terminal: `npm.cmd run floor`.

## What you should see in ten seconds

1. A full-screen green picture with a code to scan, the words "Scan to play", and four empty pads in a row. No address bar, no question, no click needed.
2. A small strip in one corner of the picture for about 6 seconds. It names the camera, for example "Camera: DJI Osmo Action 4". The picture is turned for the projector, so on the laptop screen the corner is the bottom right.
3. If the strip stays up in orange and says "Camera: the laptop's own. Press C to change.", the game is using the laptop's camera. The DJI is not found. Check steps 7 to 9 above. The game looks again every few seconds, so plugging the DJI in is enough. **(not yet proven on the real floor)**
4. The game sounds start with no key press.

## Place the pads once (only if the pads are not at the players' feet)

The pads start in four default places. The game can move them to each player's feet by itself, but it first needs to learn where the camera's picture lands on the floor. This takes two foot taps and is done once for this setup. Do it again if someone moves the camera or the projector. **(not yet proven on the real floor)**

1. Sit the players down, or stand at the seats yourself.
2. Press **M** on the laptop keyboard. A panel opens and two numbered marks appear on the floor.
3. Put one foot on mark 1 and tap it. Lift the foot and put it down again.
4. Put one foot on mark 2 and tap it.
5. The pads jump to the players' feet. The game saves this and keeps the pads at the feet while no song plays.
6. Press **Close setup** in the panel.

If no tap is read in 20 seconds, the panel says so and nothing changes. Press **M** and try again. Tap with the foot clearly in the camera's view.

The lines that cut the camera picture into one slice for each seat fit themselves the first time the game sees the players. Sit in view, with legs showing. **(not yet proven on the real floor)**

## How people join

1. The floor shows a code. Each player scans it with their phone camera. The phone opens the TTiles page.
2. With internet on the laptop, the code opens https://ttiles.us and the phone needs only its own data or Wi-Fi.
3. With no internet, the code holds the laptop's own network address, and the phone must be on the same network as the laptop, one that lets devices talk to each other. Many venue networks block that. Turn on one phone's hotspot and put the laptop and the other phones on it. **(not yet proven on the real floor)**
4. The phone asks where the player is getting off, offers a song, and lets the player tap a seat. Then the player taps **Ready!** and the floor counts down.

Live train times need internet. Without it the phone says "Could not reach the MBTA" and has a **Try again** button.

## Keys, if you need them

| Key | What it does |
|---|---|
| M | Places the pads by the camera (see above). Works in the lobby. |
| C | Setup: pick the camera, straighten the picture, place seats, test taps. |
| T | Turns the picture half way round or back. The page reloads. |
| P | Pause or resume. |
| S | Skip the song. |
| Esc | Stop the song. |

## Stop it

1. Press **Alt and F4** together.
2. The window closes, and the black window prints "TTiles stopped" and goes away.

## If something is wrong

| What you see | What to do |
|---|---|
| The floor is black. | The projector may show another screen. Press Windows key and P, choose **Duplicate**. Check the projector's input is HDMI. |
| Orange strip: "No camera found. Plug the camera in and turn on webcam mode on it." | The DJI is not in Webcam mode, or the cable only charges. Unplug it, turn it on, plug it in, choose **Webcam**. The game finds it within a few seconds. |
| Orange strip: "The browser blocked the camera." | Close the window with Alt+F4 and double-click **start-ttiles** again. Do not open the page in another browser. |
| Orange strip: "Another app is using this camera." | Close Zoom, the DJI app, and other browser windows. The game finds the camera again by itself. |
| Orange strip: "The camera was unplugged." | Plug it back in. The game recovers by itself. |
| Strip says the laptop's own camera is in use. | The DJI is not found. Plug it in and choose Webcam. Or press **C** and pick it in step 1. |
| The pads are not at the players' feet. | Do "Place the pads once" above. |
| The picture reads upside down from the players' seats, or the feet look backwards. | Press **T**. |
| A seat says "No person found." | Everyone must sit in view with legs showing. Press **C**, go to step 4, press **Fit to the people**. |
| Taps do not count, or the wrong lane lights. | Lift the foot and put it down in place. Press **C** and use steps 4 and 5. |
| Hits feel late or early. | Press **C**, go to step 6, and run the lag test. |
| No sound. | Check the laptop's volume and output. If the start file was not used, click the page once. |
| A phone shows no seats, or "No floor is connected." | The floor page is closed, or the phone is on another network. Check the code and the network. |
| The code will not open on a phone. | The phone is on another network. Use a hotspot. |
| The floor picture is dim. | The projector gives about 100 to 450 lumens. Move it closer, and find a darker spot. |
| The black window says the build failed. | Run `npm.cmd install` once in the TTiles folder with internet, then double-click **start-ttiles** again. |
| The game looks old after someone changed the code. | Open a terminal in the folder and run `.\start-ttiles.cmd rebuild`. |

## What the start file does

It starts a small web server on this laptop (port 5173, or the number in TTILES_PORT), then opens Microsoft Edge in full screen on the stage in "install mode". Edge runs in its own profile folder (`.deploy\kiosk-profile`), so nothing changes in anyone's own browser. Two Edge settings are used for this window only: one lets sound play with no click, and one lets the camera start with no question. The second one does not fake the camera. Closing the window stops the server the file started.
