# look-pilot-2 report, Sat 21 Nov 2026

Open `http://localhost:5173/pilot.html?line=Green-B&dir=1&at=place-bucen&car=2` (also `line=Red&dir=0&at=place-knncl&car=3`, `line=Orange&dir=1&at=place-sull&car=4`, `line=Blue&dir=0&at=place-aport&car=1`). The two screens (stops, recommended song) rebuilt in place on live MBTA data. Not touched: `src/tokens.css`, `DESIGN.md`, anything outside `pilot.html` and `src/pilot/`.

## Files
- `pilot.html`, `src/pilot/pilot.js`, `pilot.css`, `lines.js` (hero colour per line id), `covers.js` (iTunes cover search terms and cache), `fonts/lilita-one-latin.woff2` (new, SIL OFL) plus the Nunito already there.
- Removed: `mascot.js`, `mascot.css`, `icons.js`, `doodles.js` (the jellyfish I drew, the drawn song pictograms, the cloud doodle).
- Uses the lead's `public/mascot/conductor.svg`, fetched and inlined, not redrawn.

## What he sees
1. **Stops.** Hero colour = the line (Green B `#4FAF79`, Red `#E7685E`, Orange `#F3AA45`, Blue `#5B86D3`), ink text. A train car in the line colour (round true-colour badge, name, "to ... · Car n", windows, rails under it). The question with a butter highlighter. The conductor beside it, waving. Then a real piece of a transit map: one thick line, white stations with a dark ring above the line, the train's own marker on it, stops as outline pills with a departure-board chip ("3 stops"). Tap a stop: the marker rides the line to it, the line darkens behind, the stations pass, the mascot stays put.
2. **Song.** A ticket: line-colour header (badge, name, car), real album cover, title, composer, a dashed tear line with two notches, and a stub with the ride as a short track and a train that rides as far as the song goes. Station-sign pill buttons ("Play this song" with a round play badge, "See more songs"). "See more songs" is a sheet of covers, titles and times.
3. Top bar on both: back, and the trip as a tiny map with five stations and a little train.
4. Not Duolingo: no uppercase chunky button, no violet, no confetti, no hard bottom edge.

## Inspiration taken from bostonhacks.org (feel only)
Subway map as the graphic language (thick lines, round-ended, white station dots with a black ring), pale blueprint grid ground (in the line's own colour), yellow highlighter under the key words, pill buttons with a plain outline. Our own shapes: the train car, the ticket with notches, the departure chips, the station-sign button. No copied layout, lettering or logo.

## The five fixes you sent
1. **Mascot out, then the lead's in.** The jellyfish I drew is gone. `mascotMount(where)` in `pilot.js` is the named mount point (`stops`, `song`); it now fetches `public/mascot/conductor.svg` once and inlines it. Motion: whole body bobs, `#arm-wave` swings about (70,172), `#tentacles` sway a little. About 133 px tall at 390.
2. **Black banner (printer slot):** removed. The ticket now simply arrives (slides in with a small tilt).
3. **Dots under the line:** fixed. Stations are drawn above the line (z-index layers written at the top of `pilot.css`), always white with a dark ring.
4. **Glitches on leaving and returning** (see "Glitch causes" below).
5. **Covers:** drawn icons removed. Covers come from the iTunes Search API at run time, one search term per song in `src/pilot/covers.js` (17 terms), cached in localStorage, loaded lazily (only tiles in view), never saved in the repo. No network or no result: a tile in the line's colour with the song's first letter.

## Colours (your 6:10 PM numbers)
| Line | Hero fill | Ink on it | White on it |
| --- | --- | --- | --- |
| Red, Mattapan | `#E7685E` | 5.7:1 | 3.2:1 |
| Orange | `#F3AA45` | 9.3:1 | 2.0:1 |
| Blue | `#5B86D3` | 5.1:1 | 3.6:1 |
| Green (B C D E) | `#4FAF79` | 6.8:1 | 2.7:1 |
| Gold highlight `#FFDB62` | | 13.7:1 | |

Ink `#141413` is used on every hero fill. No white text is left on a hero: the only white text is on ink chips (18:1). The true MBTA colour appears only in the small round badge (white letter: Red 4.9, Blue 9.5, Green 4.8; Orange uses ink, 7.7). All values live in `src/pilot/lines.js`. The grid, tints and the darker "line already travelled" are mixed from the hero colour in `pilot.css`.

## Alignment (6:20 PM note): cause and proof
- **Cause.** `* { box-sizing: border-box }` does not match `::before` and `::after`. The line pieces and the two tracks were pseudo-elements with a thick ink border, so their boxes were 5 to 6 px bigger than the numbers placed them with. The line sat 3 px off the dots' centre, the progress track 2 px low. Same bug in every pseudo-element.
- **Fix.** `*, *::before, *::after { box-sizing: border-box }`, and the line pieces and tracks are now real elements (`.seg`, `.t-base`, `.r-base`, `.r-fill`), so they can be measured. The ticket's notch is cut at the middle of the dashed line (it was 1.5 px high). The two headlights on each train marker were 1 px lopsided; they are now centred at the quarter points. The line is drawn in pieces by each stop, so a wrapped name or a late font cannot change its length. Only the train marker is placed from a measurement, and it is re-measured by a `ResizeObserver`.
- **Proof.** `centres.mjs` (scratchpad) reads `getBoundingClientRect()` for every line piece, dot, train, bar dot and ticket notch on both screens: 766 checks in 4 states each (device scale 1, 2, 3, and after a resize) at 390, 360 and 1440 wide. Every dot and train centre is within 0.5 px of its line's centre on the cross axis: **0 failures, 0.000 px at rest**, worst 0.365 px (the ticket mid-entrance, tilted by its arrival animation, so it is not a layout error). With the old content-box rule restored on the line pieces the same script reported every piece 3.00 px off, which is what his screenshot showed.
- Round badges and rings: all square (width = height). Mount for the mascot is a flex item centred on the question's row.

## Glitch causes (leaving the tab and coming back)
Found and fixed, each everywhere it occurred:
1. **Vite's dev socket.** In the dev server (`npm run dev`), when a tab sleeps or a phone locks, Vite's websocket drops and on return Vite reloads the whole page, which replays every entrance and loses where you were. Not our code, and not present in a build. **For Nicolo's phone use a build (`npm.cmd run build`, then `vite preview`), not the dev server.** This is the most likely cause of what he saw.
2. **Line and marker positions from measured pixels** (wrong after a resize or a font load): line is now pure CSS; the marker is re-measured on every size change.
3. **Pseudo-element boxes** (above).
4. **A timer-driven animation** (`requestAnimationFrame` for the song bar, never fires while hidden, then plays on return): replaced by CSS animations.
5. **A slow reply for a screen already left** could replace the screen (back during loading): each screen now has a number and a late answer is dropped.
6. **Entrances replaying:** swapping the song on the same screen re-ran the whole entrance (ticket, bar, mascot); it is now a quiet fade. A screen or the mascot arriving while the tab is hidden, or within 2.5 s after returning, is shown at rest.
7. **Away behaviour:** endless animations pause while hidden (`.away` class); on return every animation with an end is finished at once.
8. **Stacking:** every layer has an explicit z-index inside its own stacking context (lines 0, stations 1, train 2).

Tested against a production build with the tab frozen for 30 s (CDP `Page.setWebLifecycleState` plus a hidden `document`), mid-ride and on the song screen: no doubled maps, tickets or mascots (counts 1, 1, 1), no animation left half-way (0 running after return, one 320 ms mascot fade before the last fix, now at rest), no sideways scroll, marker on its dot (0 px). Screenshots: `shots/L2-away-*.png`. Resized 390, 360, 430, 390: marker and dots stay centred (see proof above).
The pilot has no live data refresh of its own (stops and ride are asked once per page load); I tested the same re-render paths another way: swapping the song twice and going Back and forward, with the same counts and nothing replayed.

## Covers: what came back (searched 21 Nov 2026, top result)
Confirmed right song and recording: Dirty Water (The Standells), Sweet Caroline (Neil Diamond), Seven Nation Army (White Stripes), More Than a Feeling (Boston), I'm Shipping Up to Boston (Dropkick Murphys), The Ship That Never Returned (Carter Family), Jingle Bells (Frank Sinatra), Greensleeves (Celtic Woman), When the Saints Go Marching In (Louis Armstrong), Für Elise (Alfred Brendel), Twinkle (CoComelon), Row Row Row Your Boat (Super Simple Songs), Mary Had a Little Lamb (Countdown Kids), London Bridge (Little Sunshine Kids), Frère Jacques (CoComelon Lullabies).
Not fully confirmed:
- **Ode to Joy:** the cover is the right symphony (Beethoven Ninth, Koussevitzky, Boston Symphony), but the track Apple returns is the Adagio movement, not the Ode to Joy finale.
- **Happy Birthday:** my first term returned Stevie Wonder's different song. I changed it to "Happy Birthday to You Sing-Along Super Simple Songs", which returns the right tune; I checked the title and artist of that result but did not look at its cover in the page (the other 16 are in `shots/L2-covers-contact.png`; the Stevie cover shows there for happy-birthday).
- Several old tunes (Twinkle, Mary, London Bridge, Frère Jacques, Row boat) are children's-album covers because those are the recordings Apple has; they are right songs, but not "famous" covers.
Offline: letter tiles in the line colour (`shots/L2-covers-offline-sheet.png`). Cache: second load asked Apple 0 times. Apple's search results are public; the terms are a one-line edit each.

## Proof shots (390 wide unless named)
- Stops: `shots/L2-green-390-1-stops.png`, `L2-red-390-1-stops.png`, `L2-orange-390-1-stops.png`, `L2-blue-390-1-stops.png`; 360: `L2-red-360-1-stops.png`; 1440: `L2-green-1440-1-stops.png`.
- Song: `L2-green-390-3-song-rest.png`, `L2-red-390-3-song-rest.png`, `L2-orange-390-3-song-rest.png`, `L2-blue-390-3-song-rest.png`; 360: `L2-red-360-3-song-rest.png`; 1440: `L2-green-1440-3-song-rest.png`, `L2-blue-1440-3-song-rest.png`.
- Sheet: `L2-green-390-4-more.png`, `L2-covers-net-sheet.png` (covers), `L2-covers-offline-sheet.png` (letters).
- Motion pairs: pick `L2-green-390-2-pick-a.png` / `-b.png` (350 ms apart, 5,391 px changed: the marker and line), ticket arriving `L2-green-390-3-song-a.png` / `-b.png` (500 ms apart, 29,150 px changed), mascot `L2-mascot-a/b/c.png` (700 ms apart: 3,225 and 4,081 px changed; `#arm-wave` rotation read 0.12 then 0.06 rad).

## Checks run
- `node tools/phone-check.mjs "http://localhost:5173/pilot.html"`: PASS at 390 and 360, no console errors. I also read `scrollWidth` on both screens at 390, 360 and 1440: no sideways scroll.
- Console: no errors in any run.
- Contrast: numbers above. Text on tints (ink-2 `#444B5C` on 30% line tint) is 6:1 or better.

## Could not judge
- Motion as felt (timing, the marker's ride, the ticket's tilt, the wave). Paired stills prove it moves, not that it feels right.
- iPhone: safe areas, the sheet's scroll, `color-mix` and `:has` support on older iOS (needs Safari 16.2 or newer), and a real phone locked and unlocked.
- Apple's cover search from the venue's Wi-Fi.

## Open items for the lead
- **`npm.cmd run build` currently fails, not from my files:** `src/track/seatsource.js` line 58 has `/.(jpe?g|png|webp)(?|$)/i` (a missing backslash: `\.` and `\?`), Vite stops on "Invalid group". It built fine at 6.6 s earlier today with my last big change in. The dev server's pilot works.
- For Nicolo's phone, serve a build, not the dev server (glitch cause 1).
- "Play this song" still only says seat picking is the next screen.
- The conductor's raised ticket arm is the art's; I did not add anything that covers it. The mount is beside the question, not over any control.

## Tools
No skill loader here, so none of impeccable, high-end-visual-design or design-taste-frontend were loaded. I read `My design taste.md` (one focus per screen, a reference is a feel, show one screen) and the Lean code house rules. `/web-interface-guidelines` was not run. New dependencies: none.
