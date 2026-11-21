# Setting up Platform Piano

Written Sat 21 Nov, 1:15 PM. Follow it top to bottom. It takes about ten minutes the first time and two minutes after that.

Steps marked **(not tried on the real gear yet)** have only run against a fake camera. Tell the lead what happens.

## What you need

| Thing | Notes |
|---|---|
| Laptop | The one with the project on it. It needs an HDMI port and a USB port. |
| Panseba HI-04 projector | With its power cable and an HDMI cable. It needs a wall socket. |
| DJI Osmo Action 4 | With the USB-C cable from its box. Some other cables only charge. |
| SmallRig VT-07 tripod | Holds the camera. |
| A phone for each player | Any phone with a camera. |

## 1. Place the gear

1. Pick a patch of floor about 1.2 m wide, as dark as you can find. The projector is dim.
2. Rest the projector as high as you can, tilted down at that floor. Higher is better: the picture is less stretched.
3. Put the camera on the tripod, or hook it on a rail, where it sees the players from the knees down at least. Seeing the whole person is best.
4. The players must not stand between the projector and their own pad, or their shadow covers the tiles.

## 2. Connect

1. Plug the projector into the wall and turn it on.
2. Connect the projector to the laptop with HDMI.
3. On the laptop press **Windows key + P** and choose **Duplicate**. The floor now shows the laptop screen.
4. Turn the DJI on. Plug it into the laptop itself, not a hub.
5. On the DJI's screen choose **Webcam**. If no choice appears, the cable is a charging cable. Use the one from the DJI box.

## 3. Start the app

1. Open the project folder in a terminal.
2. Run `npm.cmd run dev`. Leave that window open. It prints two addresses: Local and Network.
3. In Chrome or Edge on the laptop, open `http://localhost:5173/stage.html?feet=camera`.
   It must be `localhost`. The browser only allows the camera there.
4. Click **Allow** when it asks for the camera.
5. Click once anywhere on the page, then press **F** for full screen. The click also turns the sound on.

## 4. Line it up (press C)

Press **C** on the stage page to open setup. It shows one step at a time. **(not tried on the real gear yet)**

| Step | What you do | It worked when |
|---|---|---|
| 1. Camera | Pick the DJI in the list. | You see its picture with dots on feet. |
| 2. Straighten | Drag the four corners. Watch the floor, not the laptop. | The grid on the floor looks square. |
| 3. Show the camera the field | Press "Take a still". Then click marks 1, 2, 3, 4 in the still, in that order. | It moves on. If it says three marks are in a line, click again more carefully. |
| 4. Place the seats | Choose sitting or standing and how many seats. Sit where you will play. Drag each pad until your feet are inside it. | Each player's feet are inside their own pad. |
| 5. Foot check | Walk around. | A glowing dot sits on each shoe. If not, go back to step 3. |
| 6. Lag test | Step on the square on each of eight clicks. | It says "You step about ... ms after the click. Saved." |

Everything is saved on the laptop. If the camera or the projector gets bumped, press C and redo steps 2 and 3.

## 5. Connect the phones

The phones must be on the same network as the laptop.

- **Easiest:** turn on one phone's hotspot. Connect the laptop to it. Other phones join the same hotspot.
- **Venue Wi-Fi:** often blocks phones from reaching laptops. If the QR code will not open, use the hotspot.

Then each player scans the QR code on the floor, types a name, and taps a seat. Their pad on the floor shows their name.

## 6. Play

1. On a phone tap **Pick the music**.
2. Choose your stop, then platform or train. The phone shows live trains and the songs that fit.
3. Tap **Start**. Tiles slide toward your feet. Step on a tile's square as it reaches the line. Keep your foot down on a long tile.

Keys on the laptop: **P** pause, **S** skip, **Esc** stop, **F** full screen, **C** setup.

## No hardware? Try it with the mouse

Open `http://localhost:5173/stage.html?demo=1&feet=mouse` and press **Space**. Four guests are seated. A mouse click is a foot landing. Hold the button for a long tile.

The phone alone, with a pretend floor: `http://localhost:5173/?mock=1`.

## When something is wrong

| What you see | Do this |
|---|---|
| The DJI is not in the camera list | It is not in Webcam mode. Unplug it, turn it on, plug it in, choose Webcam. |
| "The browser blocked the camera" | Click the camera icon in the address bar, choose Allow, reload. |
| No dots on feet | The camera must see more of the body. Move it back or up. Add light on the players, not on the floor. |
| The dots are beside the shoes, not on them | Press C and redo step 3. |
| Hits feel late or early | Press C and redo the lag test. |
| No sound | Click once on the stage page. Check the laptop's volume and that sound goes to the speaker you want. |
| The QR code will not open on a phone | The phone is on a different network. Use the hotspot. |
| The floor picture is too dim | Make the picture smaller: move the projector closer. Find a darker spot. |
| The page is blank or frozen | Look at the terminal running `npm.cmd run dev`. If it stopped, run it again and reload the page. |
