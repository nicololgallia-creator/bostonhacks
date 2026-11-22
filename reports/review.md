# review: the page that shows the camera and the detector side by side

Open `review.html`, drop the test's .json and its .webm on it (or pick them), or use `review.html?file=/qa-fixtures/tracktest-made.json` (add `&video=/path.webm` for a video the server has).

## Done
- `review.html`, `src/review/review.css`, `src/review/main.js` (page, files, play head, keys), `strips.js` (the strips canvas), `camera.js` (the overlay), `look.js` (colours), `logic.js` + `logic.test.js` (pure logic, 22 tests).
- `vite.config.js`: one entry, `review.html`. `qa/seats/make-tracktest.mjs` makes `public/qa-fixtures/tracktest-made.json` from the real two-person recording.
- Left: the video (or a dark panel) with seat bands, a dot on each foot, a ring when its seat taps, a Mirror toggle (only when the file says `facing`). Right: one strip a seat on one time axis, phase names on top, ticks coloured by what was expected (ink with a check, crimson diamond and a full-height line for a tap nobody asked for, hollow circle for a missed beat), score table, problems list.
- One play head: Space, Left and Right (one frame), N (next false tap, or next tap in a plain recording), drag to scrub, click a tap mark or a list row to jump to 0.5 s before it and play. Zoom: whole, 10 s, 3 s around the play head.
- A plain seats recording opens too: the current detector runs on it, no phases, no problems list.

## How I checked (all on http://localhost:4173, built copy)
- `npm.cmd run build` passes. `npm.cmd test`: 419 tests, 417 pass, 0 fail, 1 todo (the known one). Mid-run `qa/seats/analyze-test.mjs` was picked up by `node --test` and failed because it is a command line tool; it passed in the final run.
- Opened `tracktest-made.json`, `real-two-1.json` (plain) and `tracktest-sample.json` (the real one from tracktest, 2358 frames): no console errors on any. A missing file and a file that is a web page give a plain message with the reason.
- Video sync: made a webm with ffmpeg that has its own clock burned in (stand-in, not a camera), with `video.startMs` 4000. Scrubbed to about 6, 10 and 14 s: video time x 1000 + 4000 matched the play head to 0 ms each time. A drag scrub: 0 ms. Playing 1.5 s: 4 to 5 ms apart. The screenshot shows the video clock reading 11.960 at the end of the 12 s clip, held while the play head runs on. Also a webm made by the browser's own recorder (no length in its header): the page learns the length, and the three scrubs matched to 0 ms. I did not run that file without the fix, so I did not see it fail.
- Keyboard only: Tab reached all 7 controls and every problem row, each with a 3 px focus outline. Space played and paused (also with a row focused), Right and Left moved one frame (10527 to 10544 and back to 10512), N went to 24.1 s and then to the next one, Enter on a row jumped, Enter pressed the zoom and Mirror buttons.
- Screenshots, all opened: `shots/review-1440.png`, `review-1280.png`, `review-plain-1440.png`, `review-sample-1440.png`, `review-video-zoom10-1440.png`, `review-zoom3-1440.png`, `review-empty-1440.png`, `review-error.png`, `review-focus-1440.png`. 900 px wide copies: `review-1440-900w.png`, `review-video-zoom10-1440-900w.png`.
- What I saw: in the 900 px copy the crimson diamonds and red vertical lines at 39.9, 40.5 and 40.7 s (seat 1, the move phase) stand out from the ink ticks at once. A stranger finds the false taps in about five seconds. The most telling case is the made sample: 3 false taps while moving, 6 extra taps, 3 missed beats.

## Calls I made
- The strips show each foot's height **over its own ground**, so the ground is the zero line and both feet share it. Absolute height drifts too far across a 90 s test to show a 0.02 lift. The threshold is dashed above it.
- A phase that does not name a seat expects no taps from it. A tap outside every phase is an "extra tap".
- Matching: nearest pairs first, one tap to one beat, within 300 ms.
- Space plays and pauses wherever focus is (a clicked zoom button would otherwise eat it). Enter presses a focused button. N on a missed beat is skipped: it goes to false and extra taps only, as asked.
- The file's `score` is read from `score.seats[spot]` (what the real sample has) and from `score[spot]` (what the brief says). A seat with `droppedSeatFrames` gets a column for it. With no score the page computes one: delay spread is a standard deviation.
- Mirror starts off, so the picture is what the camera recorded. The alert colour `#B3261E` is mine; the app has none. Phase names that do not fit a band end in an ellipsis; the full names are listed under the video.
- The made sample's phases, beats and `facing: true` are invented (the file says so). Only its frames and taps are real detector output.

## Not checked
- A real camera's webm, a real 90 s test, a video with the mp4 type. A real test with 4 seats (the strips are laid out for 4 but I saw 2).
- Performance on 2,700 frames: the sample has 2,358 frames and played without any visible lag, but I did not time it.
- That `startMs` means what I assumed (test ms when the video began) in the real tracktest files: the sample has `video: null`.

## Needs from others
- tracktest: a webm from the browser's recorder has no length until the page reads the whole file; the review page handles it, but any other player of that file will not seek.
- Nothing else.

