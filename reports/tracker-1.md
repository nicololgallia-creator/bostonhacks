# tracker-1 report, card T1

## Done
- `src/track/camera.js`: `createCameraFeet({ video, model, maxPeople })` returns `{ start(), read(), fps(), poses(), stop() }`. `start()` resolves to "GPU" or "CPU". `video` can be a video or an img element.
- `src/track/debug.js` and `track.html`: live picture, yellow dot on every foot, faint cyan dot on every other landmark, fps, delegate, foot count, camera picker (remembered in localStorage key `track:camera`), lite/full switch, `?src=` for an image or a video file.
- `qa/person.jpg`: 280x590 crop of a Library of Congress carte de visite, "Full-length portrait of a man, standing, facing front" (LCCN2005692477), public domain, from Wikimedia Commons. It is a 19th century photo, because freely licensed modern full-body photos were hard to get (Wikimedia rate-limited me).

## How I checked
- `node tools/shot.mjs "http://localhost:5173/track.html?src=/qa/person.jpg" shots/T1-photo.png --wait 6000`: two foot dots on the two shoes, "8 fps, GPU, 2 feet", console errors none. Opened and looked at it.
- Chrome with `--disable-gpu`: page still works (software WebGL, 4 fps, 2 feet). CPU delegate run by hand in that browser: 1 pose found. The CPU fallback branch itself never triggers here, because the GPU delegate works on software WebGL.
- No WebGL at all: the page says "This browser has no WebGL, which the pose model needs. Use Chrome or Edge with hardware acceleration turned on."
- Fake camera (`--use-fake-device-for-media-stream`): 68 fps, GPU, camera listed in the picker, no errors.
- Camera permission denied: page shows "The browser blocked the camera. Click the camera icon in the address bar, choose Allow, and reload."
- Missing model: `start()` throws "The pose model /mediapipe/pose_landmarker_nope.task is missing. Run npm.cmd install to download it, then reload."
- `npm.cmd run build` passes.

## Not done
- Not tried with the real DJI (Nicolo, by hand). The "no camera" and "camera in use" messages are written but not triggered.
- Phone and 390px checks skipped as the brief said.

## Needs from others
- Dev server was down when I came back to it (connection refused, not my change). I restarted it with `npm.cmd run dev` in the background, port 5173. The earlier one is gone.
- Lead: `track.html` has no tokens.css yet (does not exist), so it has its own small plain style.

## Calls I made
- Added `poses()` to the camera object, because the faint landmark dots need every landmark and `read()` only returns feet.
- For a still image the loop runs every 100 ms, not every frame. At full speed it starved the headless browser and `shot.mjs` timed out waiting for the page to settle.
- Cropped the photo tighter so the lite model rates both feet above 0.5 (uncropped it saw one foot with lite, two with full).
- Left out: calibration, any use of the feet, a mirror toggle, tests (the card asked for none).
