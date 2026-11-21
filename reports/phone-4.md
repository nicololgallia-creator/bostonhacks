# phone-4, card P4 (where you are, seats, music, team results, its bugs)

Sat 21 Nov 2026. Built in three rounds as Nicolo's words changed it (1:48 map, 2:30 seats and no names, 2:38 line first). I had no skill tool, so I followed `DESIGN.md`, `reports/designer.md` and the short version of `notes/My design taste.md` by hand. No train art: the 2:45 PM rule says it waits for Nicolo's yes on one pilot train.

## Screens that changed
- **New first screen, "A piano on the floor. You play it with your feet." + "Which line are you on?"** (`place.js`): eight tiles in the MBTA line colours (Red, Orange, Blue, Mattapan, Green B, C, D, E), route ids as `src/mbta/api.js`. Replaces the name screen.
- **New, "Which car are you in?"** (`place.js`): the cars of that line's train in a row (Green 2, Red, Orange, Blue 6, Mattapan 1), with the quiet line "Only one section has a projector tonight. Any car leads to it."
- **New, "Which part of the car are you in?"** (`section.js`): car seen from above, one lit real section (`section.name`, seats free, its real seats on the bench), two quiet sample sections that answer with one plain line.
- **Seats** (`main.js`, `map.css`): "Pick your seats", a bench of cushions above the pads, each pad Open, Taken or Yours. One phone takes several seats, tap yours to give it back, "Leave" gives back all, a small "Change" link (line, car or section) and Back before you hold a seat. Title reads "You are in seats 1 and 3". No names anywhere. Every seat taken says "Every seat is taken. Watch the next song, then ask for a turn."
- **Pick the music** (`ride.js`): two equal big rows, "Fit my train" and "Pick my own". "Just pick songs" is gone. The chosen line (kept 3 hours) limits the station search and the train list and takes the riding path's line question away (only the direction is asked). The set list is worked out once and never changes under a finger; when it would run past the train it says so and the button becomes "Update the set".
- **Live screen** (`play.js`): the team's score only, no combo, never says whose turn it is.
- **Results** (`play.js`): "You played it together.", team grade (nothing when null) and score first, then one row for each of your seats with hits out of its own total. A viewer with no seat sees the team only.
- **Settings** (`settings.js`): Sitting or Standing removed, `layout` sends `seats` only; the "floor is not lined up" line lives here only.
- Removed: name screen, "Change name", stored name, 10 character rule, `Join` button.
- Files: new `place.js`, `section.js`, `map.css`, `nav.js`; changed `main.js`, `ride.js`, `play.js`, `play.css`, `settings.js`, `settings.css`, `phone.css`, `mock.js`, `DESIGN.md`. `mock.js` now answers `join` (no name), `claim` (adds), `release`, `leave`, `here`, has `section`, `team`, the object `notice` that clears after 4 s, and hooks `&crowd=1`, `&full=1`, `&seat=1,3`, `&running=...`, plus `window.ppMock.restart()` and `.refuse()` for scripts.

## How I checked
- Mock walks at 390x844, 360x640 and 1440x900 (puppeteer, scripts in my scratch folder): every step above, two seats then one given back, full floor, results with two of my seats and watching, settings. The seated screen, the stop list, the set screen and the three "where" steps fit 360x640 (the train list and the set list scroll because they are longer than the screen).
- Bugs by test: join sent, `here` every 3 s (4 in 9 s); a tap 120 ms after a step does nothing (bug 4); the phone's own Back through line, car, section, seats and the music flow never leaves the page (bug 10); the stage forgetting everyone brings both seats back by itself and shows "The floor restarted. Start the song again." (bug 2); a refusal for another phone is hidden, mine shows and clears in about 4 s (bug 3); the set list is identical 34 s later and then says "This set no longer fits. The train is closer now." with "Update the set" (bug 6); "not lined up" only in settings (bug 7); null grade shows nothing (bug 16, by reading the code, no stage sends one yet except the mock before results).
- Line limiting: Green B with "kenmore" finds it, "alewife" says no match; Kenmore trains listed are Green Line B only; Red riding path asks only the direction.
- Real stage (`stage.html?feet=mouse` and `/` in two browser contexts on the real link, after game-7): first screen, three steps, `section.name` "Car 2, front", seats 1 and 2 on one phone, a song picked by "Pick my own", Start gave the live screen with "Song ends in 20 s", results "You played it together." with Seat 1 and Seat 2 rows, Stop twice, release one seat, Leave. All passed.
- `node tools/phone-check.mjs` PASS at 390 and 360, console errors none, on `/?mock=1` (line step), `&seat=3&crowd=1`, `&seat=1,3&running=results`, `&seat=3&running=playing&transit=platform`, `&full=1`. `npm.cmd run build` from PowerShell passes.
- Shots opened (all in `shots/`, 390 unless noted): `phone-4-390-1-line.png`, `-2-car.png`, `-3-section.png`, `phone-4-390s-3-section-sample.png`, `-4-seats.png`, `-5-two-seats.png`, `phone-4-390g-2-car-green.png`, `phone-4-390m-2-car-mattapan.png`, `phone-4-390-6-choice.png`, `-7-stops.png`, `-8-trains.png`, `-9-set.png`, `phone-4-b6-17-set-stale.png`, `phone-4-390x-12-live.png`, `-13-results.png`, `-14-results-watching.png`, `-15-seats-full.png`, `-16-settings.png` (all `phone-4-390-`). 360x640: `phone-4-360-1-line.png`, `-2-car.png`, `-3-section.png`, `-4-seats.png`, `-5-two-seats.png`, `-13-results.png`, `phone-4-360x-1-line.png`. 1440: `phone-4-1440-1-line.png`, `-3-section.png`, `-4-seats.png`, `-5-seated.png`. Real stage: `phone-4-real-1-seats.png`, `-real-2-live.png`, `-real-3-results.png`, `-real-stage.png`. Not opened: the 360 stop, trains and own-songs shots, `phone-4-390-11-own.png`, `-10-ride-way.png`.

## Not done
- Nobody has held it on a real phone: tap targets under a thumb, the keyboard over the station list, vibration, the phone's Back button on iOS Safari.
- No train art, no chugging animation (waits for Nicolo's yes on one pilot train, 2:45 PM rule).
- Bug 11 for the stop list at 360x640 holds only with the first four matches (I cut the list from five to four, and dropped the sub line).
- `/web-interface-guidelines` and the design skills were not available to me.

## Needs from others
- Lead: PLAN.md "Messages from a phone" still show `join` with a name, `posture`, and a string `notice`; `docs/HOW-IT-WORKS.md` says seats are picked by name. Both are stale.
- Tester (`qa/e2e/*.mjs`): they click the old name form and read `p.name`; they need rewriting for the three steps and the seat words.
- Stage (X2/game-7): `section.name` should read as a car and a place ("Car 2, front"). The phone shows it next to the line, so a person who picks car 5 still sees "Car 2, front". The car pick is a sample and is not sent.
- Stage: `release` is accepted mid-song on the stage, but the phone has no way to send it during a song (the live screen has no seats).

## Calls I made
- "Puts in their car" is the car step (tap one of the cars). I did not add a car number field, because the car is a sample.
- The line step always shows first for a new visit, and a remembered line is only used by "Fit my train". A phone that already holds seats skips all three steps.
- "Change" goes back to the line step and keeps your seats until you pick a section again; it only shows before you hold a seat. To change after sitting, tap Leave.
- A `join` is also sent with every seat tap and again when the link comes up, because the stage forgets seatless phones on restart (game-7's note).
- The team grade is off-white, not a seat colour; seat colour appears only in each seat's circle and the seat numbers.
- Results rows are in seat order, not ranked, because the team plays one song together.
- Settings keep the seat count buttons 1 to 4 and the line "Fewer seats move players out of the seats that go away".
