# look-pilot report (card R1b), Sat 21 Nov 2026

Open `http://localhost:5173/pilot.html` (or `?line=Green-B&dir=1&at=place-bucen&car=2`, the same values as the fallback). Screens 2 and 3 of the new flow, built for real on live MBTA data. The working phone is untouched.

## Files
- `pilot.html`, `src/pilot/pilot.js`, `src/pilot/pilot.css`, `src/pilot/fonts/nunito-latin.woff2` (Nunito, SIL OFL, saved locally).
- `vite.config.js`: one entry added (`pilot.html`).
- Not touched: `src/tokens.css`, `DESIGN.md`. The pilot's tokens sit at the top of `pilot.css`. If Nicolo says yes, they move to `tokens.css` and `DESIGN.md`.

## What he sees
1. **Where are you getting off?** A white page. A small chip: green "B" dot, "Green Line B", "to Government Center · Car 2". The question, with "getting off?" in violet. Under it a rail: a violet dot for "You are here, Boston University Central", then the stops ahead from `stopsOnRoute` (9 on Green B), each a big white row with a hard bottom edge and a small "3 stops" pill.
2. **Tap a stop.** The row squashes and turns violet, the rail fills violet down to it, and the dots light one after another like a train passing. About 0.9 s, then the next screen slides in.
3. **Recommended song.** One big violet-tint card: a violet cover with four white bars that bounce three times, the title at 36 px, composer and year, a bar showing the song's length against the ride, "1:55 song, Your ride 8 min". A burst of confetti once. Under it, "Play this song" (chunky violet) and "See more songs" (white, violet label). More songs opens a sheet of the songs that fit, tap one to swap.
4. Loading is breathing skeleton rows. Errors say what failed, in plain words from the API layer, with "Try again".

## Where it comes from
- The train: page address, with the card's fallbacks. The ride: `rideSeconds` from "you are here" to the tapped stop. The song: `pickSongs({ seconds })`, first id. More songs: every song that fits the same ride.
- MBTA key: read by `api.js` from `.env.local`; never printed or copied.

## Look decisions (ours, not a copy)
- Light ground `#FFFFFF`, mist `#F4F5FA`, ink `#1F2430`, one hero violet `#6B4EFF` (white on it 5:1), tint `#ECE8FF`. Nothing else competes. The MBTA line colour appears only in the small dot.
- From LOOK-BRIEF: the chunky press-down button, flat colour, sentence case, uppercase on buttons only. From GAME-FEEL: celebrate once then rest, sound-free feedback is a squash and a fill. Taken as a feel only. No Duolingo colour, font, name or mascot. The rail with lighting stops, the song-versus-ride bar and the bouncing bars cover are ours.
- Radii 8, 16, 24 and full. 2px borders. Hard edges, no blur shadow, no gradient.
- No train or mascot art.

## Proof
Shots in `shots/` (390 wide unless named, 1440 for two):
- Stops: `R1b-390-1-stops.png`, full length `R1b-390-1-stops-full.png`, `R1b-1440-1-stops.png`.
- Rows popping in, 450 ms apart: `R1b-390-1-stops-in-a.png` and `-in-b.png` (50,524 px changed).
- Tap sequence, 330 ms apart: `R1b-390-2-pick-a.png` and `-pick-b.png` (5,627 px changed).
- Song found, 500 ms apart: `R1b-390-3-song-a.png` and `-song-b.png` (9,070 px changed: bars, meter fill, confetti). At rest: `-song-rest.png`.
- Sheet: `R1b-390-4-more.png`. After Play: `R1b-390-5-play.png`. 1440 song: `R1b-1440-3-song.png`. 360 wide: `R1b-360-red-sheet.png`. Rejected look to compare: `phone-4-390-1-line.png`.
- `node tools/phone-check.mjs "http://localhost:5173/pilot.html"` passes at 390 and 360. I also measured `scrollWidth` on the song screen and the open sheet at both widths: 390 and 360, no sideways scroll. This caught a real bug: the slide-in made the page wider for 300 ms; fixed with `overflow-x: clip`.
- Console: no errors in any run. `npm.cmd run build` (PowerShell) passes.

## Could not judge
- Motion as felt. I only have still pairs. The pairs prove things move, not that the timing feels right. Durations are starting values: press 100 ms, rows pop 420 ms with 55 ms stagger, rail fill 650 ms, song card pop 520 ms, confetti about 1 s.
- The "You are here" pulse is slow (2.4 s) and faint; a still pair at 1 s apart showed 0 px changed, but a direct read of its opacity showed it cycling (0.03, 0.002, 0, 0, 0, 0.07). It is visible only for the first third of each cycle, so it may be too subtle. Nicolo's eye decides.
- Touch feel on a real phone, safe-area padding on a real iPhone, and the sheet's scroll on iOS.

## What he should check
- Does the screen feel bright enough? I kept it mostly white with violet and one tint, on the brief's rule. If he wants more colour, the first move is a colour wash behind the song card or a coloured cover per song, not more panels.
- 1440 shows a 480 px phone column on mist. It is a phone remote, so I did not stretch it.

## Honest gaps and calls
- "Play this song" does nothing yet but say, in a line, that seat picking is the next screen and not built. This is the one dead end, by the card ("nothing else is rebuilt").
- The song card shows only the first sentence of `by` (composer and year). The long credit on "The Ship That Never Returned" (the Charlie on the M.T.A. link) stays in the song file, so it is not shown on this screen.
- "Recommended" is the first id from `pickSongs`, the longest song in the best-fitting set. On a 5 minute ride that was Ode to Joy (0:59) while longer songs exist. That is how `pickSongs` orders its answer; whether the recommendation should be the longest song that fits alone is a call for the lead.
- Stops ahead on Red: `stopsOnRoute` lists the Alewife to Braintree stops and then the Ashmont branch, so for a train at a stop before the split the "ahead" list may include stops of the other branch. Not handled.
- The progress bar fills 35 percent and 55 percent, a guess at where these screens sit in the flow.
- Not done: reading a stop's own time to arrive for each row (it would be one API call per row, past the 20 per minute keyless limit).

## Tools
My tool has no skill loader, so I did not load impeccable, high-end-visual-design or design-taste-frontend. I held myself to "The bar" in the brief, read `notes/My design taste.md` (short list and the table), and ran the contrast numbers by hand: ink on white 15:1, ink-2 on white 6:1, white on hero 5:1, hero-edge on tint about 7:1. `/web-interface-guidelines` was not run for the same reason. Lean code: no new dependency, about 200 lines of JS, shared pieces reused (`stopsOnRoute`, `rideSeconds`, `pickSongs`, `songSeconds`).
