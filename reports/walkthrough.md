# Walkthrough video (horizontal only)

Output: `C:\Users\nicol\Downloads\ttiles-walkthrough\ttiles-walkthrough.mp4` and `shot-list.md`. Nothing else is in that folder now.

## What changed in `tools/walkthrough.mjs`

- Makes only the horizontal file and the shot list. I deleted the portrait, phone, floor and team-footage code (and the unused `probe`) instead of putting it behind a flag, since that was the smaller change. The phone and floor sources it cuts from are now temp files.
- Sound banner: the floor presses a key and waits for `synth.locked()` to be false before recording (already in the file), and both browsers launch with `--autoplay-policy=no-user-gesture-required`. New: a guard throws if the floor's sound is locked at the warm-up, the countdown or the game, so a banner can never be recorded silently.
- Cursor: floor 64 px, phone 46 css px (shown 1.4 times larger in the video, so about 64 px). Both are a solid #FFD84D disc with an ink (#141414) outline, about 5 px at 1920. The click pulse is now a yellow ring with ink on both edges, so it shows over white, green and black. Same overlay code in both pages.
- Shot list: the talk-track line is now stored with each cut, so it cannot go out of step with the table (no more "undefined"). The old per-file tables are gone. The walkthrough table also says what is on screen, with the recommended song and the game song filled in from the run.

## What I checked

- `ffprobe`: h264, 1920x1080, yuv420p, 30 fps, no audio stream, 69.0 s (the plan was about 70).
- `blackdetect` over the whole file: no black frames.
- One frame per second for all 69 seconds, in one contact sheet: no yellow banner anywhere. Then one frame per shot, each scaled to 900 px wide, each opened (notes below).
- Ripple: 15 fps frames around the stop click show the yellow ring with ink edges.

## Per-shot notes

- 0:00 to 0:03 floor lobby: frames at 0.0 and 1.0 s. No banner. QR, jellyfish and four seats show. Cursor is a yellow disc low in the frame, easy to see.
- 0:03 to 0:20 phone, welcome and stops: frames at 12 s and 17.6 s. Phone is centred on green, nothing cut off. At 12 s the "Green Line B, Car 2" card is up. At 17.6 s the cursor sits on the Kenmore row, clearly visible on white and green.
- 0:20 to 0:39.6 floor warm-up and countdown: frames at 21, 25, 30 and 38 s. "Tap your foot 4 times" with the dots filling, then the 3, 2, 1, then the first tiles with a Perfect pill and a click ring on the left pad at 38 s. No banner at 20 to 25 s (the span that had it). Cursor sits on the pads.
- 0:39.6 to 0:45.6 phone, recommended song: frame at 42 s. "When the Saints Go Marching In", 0:42 song, ride 4 min. Cursor on white, easy to see.
- 0:45.6 to 0:57.6 floor game: frame at 52 s (cursor over the right pad). Scores 1650 and 632, Perfect pills, no banner. Cursor is visible over green; it is small next to the black tiles but the ink outline holds.
- 0:57.6 to 1:01.8 floor duel board: frame at 59.5 s. Winner shown, cursor parked low, nothing cut off.
- 1:01.8 to 1:06 phone leaderboard: frame at 64 s. Cursor over the white grid page, easy to see.
- 1:06 to 1:09 floor lobby again: frame at 67.5 s. Seats 2 and 4 filled, QR visible.

## Calls I made

- A leftover `node tools\walkthrough.mjs` from the earlier builder (started 11:17 PM, still alive) and its browsers were running on the same room, and my first run failed at "seat 2 to be yours" while it was there. I stopped it and its browsers. The second run was clean.
- Cleaned up: the four unwanted .mp4 files in Downloads, the raw recordings and 280 MB camera clip in `%TEMP%\ttiles-walkthrough-raw`, the `ww-*` browser profiles. `--assemble` therefore has nothing to cut from until the tool records again.
- Left alone: the `vite preview` on port 4180 (started 10:13 PM before my run, not by me) and `%TEMP%\ww-preview.log` and `.err`, which it holds open.

## Not checked

Not checked: the video in a player with sound or a YouTube upload; the 0:19 to 0:25 banner span in the old file was not re-opened, only the new file; the ripple on the floor pads (the 38 s frame shows a ring, but I did not step through it); the game's "Greensleeves" title card covers the left score in the 3, 2, 1 frame (an app layout matter, not changed); the app was served from the existing `dist/` built at 10:13 PM, so later source changes are not in this video.
