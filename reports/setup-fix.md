# setup-fix

**Done**
- `src/track/tracked.js`: the tracker's video stays on the page for good (the lead's fix, kept). New: `closeStream` also sets `video.srcObject = null`, so the camera is released and the preview lets go. Searched all of `src/` for any other place that moves, removes or hides a camera video: none. `debug.js` makes its own video for its own page and never moves it. `main.js` only builds the source.
- `src/stage/setup.js`: (a) a small live camera picture in the panel for "Place the seats" and the foot check. It uses its own preview video on the tracker's stream, a dot on every foot the camera finds, and the field's outline on top, from the four field corners sent through `invert` and `apply` of the saved `cameraToField`. The players' edge (bottom) is drawn thicker and named. (b) A foot the map puts off the field is a hollow pink ring on the nearest edge with an arrow pointing the way it is off, on the floor and in the small picture; a foot on the field stays a yellow dot. (c) Feet seen but none on the field for 3 s shows one line (clicked in the wrong order, or the camera or projector moved) plus a "Back to the four marks" button. (d) After the 4th click the field outline is drawn on the still. Clicks are numbered, and the panel says each corner in the floor's words: 1 top left, 2 top right, 3 bottom right, 4 bottom left, seen from the players' edge. The floor marks also name their corner. (e) The panel docks small in a corner in every step but Straighten (and the floor-marks view, so the marks stay clear). A Move button cycles the four corners. The big camera picture and the still shift over to leave the panel room (before, the panel covered marks 1 and 2 on the still, so they could not be clicked). Also: a camera made by setup now has its hidden video removed on close.
- `src/stage/setup.css`: dock, Move, mini picture, floor mark labels.

**How I checked**
- Replay, 1280x720: `stage.html?feet=camera&replay=/qa/feet/still.json` with a saved map for four cases (right map, wrong click order, feet off the field, no feet on the field), walking all six steps by script. No console errors. Opened: `shots/setup-fix-foot-inside.png`, `-foot-off.png`, `-foot-lost.png`, `-still-outline.png`, `-still-wrong-order.png`, `-floor-marks.png`, `-seats.png`, `-lag.png`, plus the straighten step (not copied).
- Chrome fake camera: the still changed between two takes 3 s apart (not frozen), both videos kept playing through steps 1 to 5, outline sat on the live picture: `shots/setup-fix-fake-still.png`, `-fake-foot.png`. No console errors. Move cycled tl, tr, br, bl. `npm.cmd run build` passes.

**Not done / only a real camera can prove**
- Real DJI: that the still is fresh on it (fake camera and replay only), that the pose model puts dots on real shoes, that the outline lines up with the real marks, and that a bad lineup really looks wrong. The camera's lens bend is not corrected, so an outline near the picture's edge may sit a little off.
- Seats step: pad 1 sits under the panel in the top-left corner. Press Move.
- Not tried: a phone-sized window.

**Needs from others**
- The stage threw errors for about three minutes while `session.js` was mid-edit by someone else (`state.section` undefined); it cleared on its own. My dev-server check found it down once, so I started `vite --port 5173` again; it is running now.

**Calls I made**
- Pink for off-field, because the warn orange is too close to the yellow dot.
- Floor-marks view keeps the centred panel so no mark is covered; the still view docks.
- My test scripts and screenshots are in the session scratchpad `sf` folder. I overwrote a `run.mjs` in the scratchpad root by mistake before moving to that folder.
