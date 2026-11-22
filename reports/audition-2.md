# audition-2 (frontend-audition-2): round two of the song check

## Done
- `tools/make-audition.mjs`: three new options, a plain run is unchanged (and refuses `--bpm` or `--offset` without `--tag`, so round one's files cannot be overwritten).
  - `--bpm <id>=<n>` (repeatable), `--offset <ms>` (default 120), `--tag <name>` (writes `<id>-<tag>.mp3`, perfect version only).
  - A tagged run prints its own table: bpm, tiles, tune notes a second and tiles a second, "own song -> this clip", then file length, peak and mp3 peak.
- `shots/audition/index.html`: a "Round two" section above the songs (groups "Taps on the beat" and "Faster"), then a "Round one, all 17 songs" heading over the old rows. Rows are built from one list for both rounds. Round one's ids, storage key and shape are unchanged.
- 10 new files in `shots/audition/audio/`.

## How the bpm override reaches the chart code
The tool does not import src on the Node side. Everything runs in the browser page, which imports `/src/game/parts.js`, `chart.js`, `synth.js`, `engine.js` and `/src/songs/index.js` from the vite server. For a `--bpm` song the page does `song = { ...own, bpm: n }` and then runs the real `splitParts(song, 2, { mode: "team" })` and `backingLeft(song, parts)` on it. So the tiles, the 350 ms gap rule, the backing, the count-in and the song length all come from the chart code at the new tempo. No old tile is scaled. To render from the clean copy, vite ran with its root at `...\scratchpad\song-src` on port 5181 and the tool was pointed at `http://localhost:5181`. The project's own src was never read. `--offset` replaces the 120 ms constant that was in the page (`synth.backing(backed, songMs + offset)`).

## The table (perfect version, Team mode, 2 players)
Own song -> clip. Tune notes a second is melody notes divided by song seconds; it matches the lead's figures (Saints 0.74, Frere 1.08). Tiles are both seats together. All 10 pass length (within 0.05 s of plan, mp3 within 0.15 s) and peak (under 0.99, mp3 under -0.09 dB).

| file | song | bpm | offset | tiles | tune notes/s | tiles/s | file s | peak (mp3 dB) |
|---|---|---|---|---|---|---|---|---|
| more-than-a-feeling-ontime | More Than a Feeling | 856 | 0 | 30 -> 30 | 0.87 -> 0.87 | 1.04 -> 1.04 | 32.9 | 0.718 (-3.2) |
| sweet-caroline-ontime | Sweet Caroline | 960 | 0 | 53 -> 53 | 0.59 -> 0.59 | 0.87 -> 0.87 | 65.5 | 0.708 (-3.5) |
| dirty-water-ontime | Dirty Water | 435 | 0 | 102 -> 102 | 1.51 -> 1.51 | 1.64 -> 1.64 | 66.4 | 0.701 (-3.5) |
| shipping-up-to-boston-ontime | Shipping Up | 380 | 0 | 68 -> 68 | 1.86 -> 1.86 | 2.01 -> 2.01 | 38.8 | 0.714 (-3.4) |
| shipping-up-to-boston-ontime-fast | Shipping Up | 380 -> 456 | 0 | 68 -> 68 | 1.86 -> 2.24 | 2.01 -> 2.41 | 32.8 | 0.703 (-3.6) |
| saints-fast | Saints | 90 -> 135 | 120 | 40 -> 33 | 0.74 -> 1.11 | 0.95 -> 1.18 | 32.4 | 0.696 (-3.6) |
| jingle-bells-fast | Jingle Bells | 130 -> 195 | 120 | 58 -> 50 | 0.86 -> 1.29 | 0.98 -> 1.27 | 44.5 | 0.708 (-3.5) |
| ship-never-returned-fast | Ship That Never Returned | 100 -> 150 | 120 | 126 -> 120 | 0.96 -> 1.45 | 1.09 -> 1.56 | 82.6 | 0.698 (-3.6) |
| london-bridge-fast | London Bridge | 130 -> 170 | 120 | 26 -> 26 | 0.90 -> 1.17 | 0.97 -> 1.27 | 25.9 | 0.698 (-3.6) |
| frere-jacques-fast | Frere Jacques | 130 -> 165 | 120 | 34 -> 34 | 1.08 -> 1.38 | 1.15 -> 1.46 | 28.8 | 0.683 (-3.7) |

Read from it: the chart code drops tiles at the faster tempo in three songs (Saints 40 -> 33, Jingle Bells 58 -> 50, Ship 126 -> 120), because its millisecond gap rule removes notes that now sit too close. So in those three the "faster" clip has fewer tiles, as well as a quicker tune. Sweet Caroline's tune is slow in notes a second (0.59) even though its bpm number is high.

## New audio files (the lead adds these next to the page, in `audio/`)
`more-than-a-feeling-ontime.mp3`, `sweet-caroline-ontime.mp3`, `dirty-water-ontime.mp3`, `shipping-up-to-boston-ontime.mp3`, `shipping-up-to-boston-ontime-fast.mp3`, `saints-fast.mp3`, `jingle-bells-fast.mp3`, `ship-never-returned-fast.mp3`, `london-bridge-fast.mp3`, `frere-jacques-fast.mp3`. About 7.0 MB together. The "First version" buttons reuse the existing `<id>-perfect.mp3`.

## How I checked
- Page served on port 4185 (a small static server in my scratchpad), driven with puppeteer through `tools/browser.mjs` (script: scratchpad `check-r2.mjs`). All passed:
  - 5 + 5 clip rows and 17 song rows; one audio element.
  - Round one's store was seeded first (Mary Lamb Good, Twinkle Needs work with a note); it painted, and survived two reloads together with a new round-one mark made after round two existed. The store keys: old ids untouched, new marks under `r2:<song>-<tag>`. The "x of 17 checked" count counts round one only.
  - New version of Saints plays, time advances (0.61 -> 1.33 s), the file is 32.4 s; First version of the same row plays the old file (47.3 s); only the tapped button is marked; tapping the playing one pauses; the bar names the version.
  - Better, Same, Worse mark one at a time, tapping again clears, and all survive a reload, with a typed note and an Add the time note (`[new 0:01] `).
  - Copy my notes (clipboard allowed) gave four "Round two, ..." lines first, then the three old lines, for example `Round two, More Than a Feeling, taps on the beat: Better.`.
  - No sideways scroll at 390, 360 and 1280; every button and input at least 44 px; no em dash on the page; no doctype/html/head/body tags; console clean apart from the favicon request.
- Screenshots opened and looked at: `shots/audition2-390-top.png`, `shots/audition2-1280-top.png`. Taken but not opened: `shots/audition2-390-playing.png`.
- Stopped both servers (4185 and 5181, by their own process ids), no .wav left, the tool's temp folder is removed.

## Calls I made
- Clip rows show no length next to the title, because the first and new versions can differ (Saints 47 s against 32 s). Round one's rows keep theirs.
- Frere Jacques' line says "1.27 times faster." and London Bridge's "1.3 times faster.", from the card's own figures. Shipping's both-things line: "Taps land exactly on the beat. 1.2 times faster." The Shipping ontime-fast row sits under "Taps on the beat".
- Added a "Round one, all 17 songs" heading so the old list is not read as part of "Faster".
- Copy lines name what is tested: `taps on the beat`, `taps on the beat and faster`, `faster`.

## Not checked
Not checked: I cannot hear, so nobody has listened to any of the 10 new files; only length, peak and the tile counts above are measured. The page has not run inside claude.ai (the `fetch("audio/...")` path, the clipboard and the font import there are untested), and it was not opened on a real phone. The 390 px test used a desktop-style window. I did not look at the page below the first screen at 390 px (rows further down use the same code).
