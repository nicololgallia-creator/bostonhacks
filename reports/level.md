# level: each song shows how hard it is (Sun 22 Nov, about 2:30 AM)

Nicolo meant a label, not a selector. Every song now shows Easy, Medium or Hard, worked out from the song. Nothing to choose, nothing changes in the game.

## The measure and the thresholds

- **Measure ("trouble"):** the most tiles one player gets in any 10 seconds (per second), plus twice the share of that player's tiles that come under 0.6 s after the one before. It uses the real chart (`splitParts` with one player), so it never depends on how many people play.
- **Thresholds:** under 1.65 is Easy, 1.65 up to 2.45 is Medium, 2.45 and over is Hard.
- A quarter note at 100 bpm is exactly 0.600 s, so tile times are rounded to the millisecond first. Without that, Twinkle's steady quarter notes could count as "quick" by a float error.

## Table (computed from the song files as they were at 2:20 AM)

| Song | Trouble | Level |
|---|---|---|
| The Ship That Never Returned | 1.30 | Easy |
| Mary Had a Little Lamb | 1.40 | Easy |
| London Bridge Is Falling Down | 1.47 | Easy |
| Twinkle, Twinkle, Little Star | 1.50 | Easy |
| Jingle Bells (chorus) | 1.52 | Easy |
| Ode to Joy | 1.53 | Easy |
| Sweet Caroline | 1.80 | Medium |
| Happy Birthday to You | 1.97 | Medium |
| More Than a Feeling | 2.18 | Medium |
| Frere Jacques | 2.22 | Medium |
| When the Saints Go Marching In | 2.30 | Medium |
| Greensleeves | 2.61 | Hard |
| Dirty Water | 2.69 | Hard |
| Row, Row, Row Your Boat | 3.01 | Hard |
| Take Me Out to the Ball Game | 3.22 | Hard |
| I'm Shipping Up to Boston | 3.39 | Hard |
| Fur Elise (opening) | 3.48 | Hard |

Groups are 6, 5 and 6. All three anchors hold: Mary and Twinkle Easy; Fur Elise, Shipping Up to Boston and Dirty Water Hard. No anchor failed.

Sweet Caroline and More Than a Feeling are being re-imported by someone else. Their rows are as of now; the level is computed when the page runs, so they will follow the files. Their gaps to the thresholds are 0.15 and 0.27 on the lower side, so a small re-import should not move them much, but it can.

## How the measure was picked

Plain tiles per second could not hold the anchors: Twinkle (1.46 tiles a second) sits next to Dirty Water (1.53), so any single cut put 9 or more songs in Easy. I searched windows of 4 to 30 s, quick-step cutoffs of 400 to 700 ms and weights, kept only settings where the anchors hold and every group has at least 5, and took the one with the widest gaps at both thresholds.

## What changed

- `src/songs/level.js` (new): `songTrouble(song)` and `songLevel(song)`.
- `src/songs/level.test.js` (new, 5 tests): every song gets a level; the anchors; three groups of 4 or more; a made-up slow tune is Easy and a fast one Hard; a faster tempo never lowers the number.
- `src/app/screens/song.js`: `levelBadge(song)` draws the label. It sits on the ticket and on each row of "More songs".
- `src/app/app.css`: styles for `.tk-cover`, `.level`, `.pips` and a visually hidden `.sr` (the file already styles this screen).

## How it looks

- **Ticket:** the cover now sits in a row (`.tk-cover`) with the label at the right, in the empty space beside the cover. It is an outlined pill like the "Car 2" pill (same border weight, radius and display font), the word plus three pips (one, two or three filled). No hover, no pressed state, no radio dot, no pointer cursor. I did not put it by the length: that line already holds "0:21 song" and "Your ride 25 min", and at 360 px a third item would not fit. Beside the cover adds no height.
- **Row in "More songs":** a small line under the song name, the word and three pips, plain text, no pill, so it cannot read as a second button inside a button. A two-line title plus this line makes a row a little taller only when the title wraps.
- **Screen readers:** the pips are hidden from them; a hidden "Difficulty: " comes before the word, so they read "Difficulty: Medium".
- No em dashes in the words.

## What I checked

- `node --test`: 561 pass, 0 fail, 1 todo (was 556 pass; 5 new).
- Built from PowerShell (`npm.cmd run build`), served with `npx.cmd vite preview --port 4187 --strictPort`, then stopped.
- Screenshots at 390 and 360 px, all opened and looked at: Easy (Mary), Medium (Saints), Hard (Fur Elise), the opened "More songs" list and its end. Files in `shots/`: `level-after-390-1-easy.png`, `-2-medium.png`, `-3-hard.png`, `-4-list.png`, `-5-list-end.png`, and the same at `level-after-360-...`. The label fits, nothing overlaps, it does not look like a button.
- **Play button did not move:** measured its top edge with the label hidden and shown (390 px, same songs): 758, 758, 779, 720 in both runs, identical.
- No sideways scroll: page and sheet widths equal the viewport at 390 and 360 on the ticket and the sheet; `tools/phone-check.mjs` passes at 390 and 360 on the first screen.
- No console errors.
- Browser profiles in the temp folder cleaned.

Note on method: `tools/shot.mjs` only loads a page, and the song screen needs a tapped stop and a ride time. I used my own small puppeteer script with the same browser launcher, and it answered the MBTA calls with a made-up 25 minute ride (real MBTA calls were not used). The script is a scratch file, not in the repo.

## Not checked:

- A real phone, real MBTA data, and the 1440 px desktop view (the app is a phone page).
- The play-again screen (`src/app/screens/again.js`) also shows song tickets with a cover and has no level label; the card did not ask for it, so I left it out.
- Dark mode or high-contrast modes; none exist in this app's design.
- Nicolo's ear on whether Ode to Joy and Jingle Bells (Easy) and Greensleeves (Hard) feel right; the measure is about how often feet move, not tricky rhythm or music.

## Anything wrong in the card

- The card suggested the level could use "one player and two players in team mode". I used one player only, as the card also says the level must not depend on how many play.
- The card said Part 2 might need the length line; it did not fit, see above.
