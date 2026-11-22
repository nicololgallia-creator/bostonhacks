# scanner-2: the phone's QR scanner

Nicolo, after the 11 PM playtest: "the QR code scanner was not scanning at all."

**Not run on a real phone:** nothing here was run on a real phone, a real camera, or a projected code on the real floor. The measurements are drawn pictures and one fake camera on desktop Chrome. Only a real phone shows: whether the 1920x1080 request is granted, the real blur and glare of a projector, how long one look takes on a phone's processor (desktop numbers below are about 3 to 5 times quicker), whether Android's own reader finds the code before ours, and iPhone Safari loading the .wasm file.

## What was wrong

The old reader shrank every frame to 480 pixels wide before jsQR saw it. A code on the floor, seen from a seat, is small, so it ended up about 1.5 pixels per cell. jsQR then read only 61% of the frames a phone's camera app would read. When the screen was waiting, it said nothing at all.

## The bench (qa/scan/bench.mjs)

The real code (`https://ttiles.us/?room=GREENB22&line=Green-B&dir=1&at=place-bucen&car=2`, error correction M, four-cell quiet zone) drawn into camera-like frames over a grey floor. Grid: size 60/35/20/12% of the short side, tilt 0/30/50/65 degrees (true perspective), turn 0/20/180, contrast full/half/quarter, blur 0/1.5/3 px, plus noise and a few pixels of position jitter. 432 frames per picture shape.

"Good" frames, the card's bar: size 20% or more, tilt 50 or less, contrast half or more, blur 1.5 or less (216 frames per shape). Reads out of total, 1280x720 and 720x1280 together (864 frames, full grid):

| Pipeline | all | good | 60% | 35% | 20% | 12% | full | half | quarter | ms/frame |
|---|---|---|---|---|---|---|---|---|---|---|
| A: today's (480 wide, jsQR) | 26% | **61%** | 63% | 34% | 8% | 0% | 27% | 28% | 24% | 13 |
| B: jsQR, whole picture | 30% | 73% | 57% | 38% | 19% | 7% | 34% | 35% | 23% | 33 |
| C: jsQR, framed part | 28% | 67% | 46% | 38% | 19% | 9% | 30% | 32% | 22% | 13 |
| D: B and C with attemptBoth | 30% / 28% | 73% / 67% | same as B, C | | | | | | | 43 / 18 |
| E: zxing, whole picture | 44% | 84% | 85% | 55% | 26% | 12% | 46% | 45% | 42% | 5 |
| S0 (shipped, whole) then S1 (framed x1.5), either reads | 47% | **87%** | 87% | 58% | 30% | 15% | 49% | 48% | 45% | 5 and 6 |
| jsQR added on top of S0, S1 | 47% | 88% | | | | | | | | |

Findings:
- attemptBoth did nothing at all (dark ink on light paper is never inverted). Dropped.
- jsQR in any shape stays at 73% or less. It could not reach the bar, so the card's rule applied: **zxing replaces jsQR.**
- zxing is also faster than jsQR here (5 ms against 33 ms for the same picture). Sharpening, stretching contrast, denoising and other binarizers were tried on the framed part and gained nothing.
- At 1280x720 the good set stops at 87%, short of the 90% bar. Every one of the 28 misses but one is a 20% code with 1.5 px of blur, which is about 3 pixels per cell, blurred by half of that. That is the limit of the picture, not of the reader.
- The same grid drawn at **1920x1080 and 1080x1920**, the size the screen now asks the camera for (same pixel blur, which is kind to it): today's 64%, shipped **95%** (S0 or S1), 8 ms a frame. Bar met when the phone grants the size.

## What changed

- `src/app/scanner.js`: asks for 1920x1080 (falls back to the plain request on OverconstrainedError). Reader is the phone's BarcodeDetector first when it exists; when it finds nothing, our zxing reader looks too. Our looks alternate: the whole picture, then the part the yellow frame covers (frame plus a margin, worked out for object-fit cover, enlarged 1.5 times). `waitingHelp(ms)` and `debugLine()` are the pure message rules. A reader that cannot load says why ("The code reader did not load (...). Type the code instead.").
- `src/app/screens/scan.js` and `scan.css`: "Point the camera at the code." while live; at 6 s "Move closer until the code fills the frame."; at 12 s the same line, one small grey line ("1280x720, our reader, 70 looks"), and the "No camera? Type the code" button becomes a full-width outlined pill. "That is not a TTiles code." is unchanged and the wait starts again after it. No hidden gestures.
- `src/app/scanner.test.js`: 8 tests (crop arithmetic for wide and tall pictures and every box shape, the alternation, the enlargement cap, the message timing, the grey line).
- `package.json` and `package-lock.json`: one package added, **barcode-detector ^3.2.4** (the zxing-wasm ponyfill). `jsqr` stays in package.json because only the bench uses it now. Lead: move it to devDependencies if you like.
- Size in the build: `zxing_reader-*.wasm` 946 kB (411 kB gzipped) plus `ponyfill-*.js` 43 kB (15 kB gzipped). Both load only when the scan screen starts its camera. The wasm is bundled by Vite (`?url`) and passed to `setZXingModuleOverrides({ locateFile })`. The package's own default would fetch it from jsdelivr, and that default is replaced.

## What I checked

- `node --test`: 556 tests, 554 pass, 0 fail, 1 todo (my 8 are in it).
- Built from PowerShell (`npm.cmd run build`, passes). Served with `npx.cmd vite preview --port 4183 --strictPort`, stopped afterwards.
- `node qa/scan/hard-case.mjs make|run <folder>`: a code at 25% of the short side, tilted 50 degrees, half contrast, written as .y4m and played as the fake camera to the **built** scan screen. Bench says today's reader does not read that picture and the new one does (21 ms whole, 8 ms framed). The built screen read it and moved to `/?room=GREENB22&line=Green-B&dir=1&at=place-bucen&car=2`. The .wasm came from `127.0.0.1:4183/assets/`, status 200. Network log: no request to any other host before the read. No console errors.
- Blank wall for 13 s: line "Move closer until the code fills the frame." and "1280x720, our reader, 70 looks". Screenshot `shots/scanner-2-scan-12s-390.png`, opened: nothing overlaps, the lines fit, the typing button is the full-width pill. I took it with my own script, because `tools/shot.mjs` cannot start a fake camera.
- `shots/scanner-2-scan-1440.png` opened (no camera on that run, so it is the typed-code form). `phone-check` on `http://127.0.0.1:4183/`: pass at 390 and 360, no console errors.
- The browser profiles the bench and hard-case scripts make are deleted at the end; none were left in the temp folder.

## Needs from others

- Lead: the live site needs the new build (`package.json`, `package-lock.json` and `src/app/` go together). Every push to main deploys.
- Someone with an iPhone and an Android: scan the floor poster once and read the grey line aloud after 12 seconds. That line is there so a photo of the phone tells us the picture size and which reader ran.

## Calls I made

- Counted a frame as read when either of the two alternating looks reads it, since the person holds the phone still for several looks.
- Kept the bench's pixel blur the same at 1920x1080, so that row is kinder than a real phone.
- Counted the card's "20% and 1.5 px blur" cases in the good set as the card asked, and said above that they are the limit.
- Did not touch `src/app/scan.js` (the parser). I ran `git status` once by mistake early on (read only).

## If anything on the card was wrong

The card said a clean code reads fine on desktop Chrome and the real room does not. That fits the numbers: the old reader reads 63% of large codes and 8% of small ones. The card guessed `inversionAttempts` might matter: it does not.
