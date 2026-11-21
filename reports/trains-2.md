# trains-2 report (card A2, Sat 21 Nov 2026)

Built the opening, the track rows and the chug-off. New files `src/phone/trains.js` and `src/phone/trains.css`. Small edits to `src/phone/place.js` (line step, car step, one import and one call) and `src/phone/map.css` (the old colour-tile rules removed). One paragraph in `DESIGN.md` (it replaces the "Line tiles" paragraph with "Track rows"). Nothing else touched.

## What it does
1. **Opening.** `playOpening()` runs when `place.js` loads. If `public/trains/green.png` loads, a fixed overlay (`pointer-events: none`) shows the Green Line train chugging in from the left with small hops, a big bounce on its wheels, then zooming off right with three puffs, 1.4 s. A cover in `--bg` hides the first screen until about 0.6 s and clears by about 0.95 s, before the train is gone. Skipped under `prefers-reduced-motion`. It removes itself at 1.5 s.
2. **Pick your track.** Each line is a 88px row: name left, track right (6px rail in the line colour on sleepers, to the row edge), its train on the rail with a 3px idle bounce, each out of step. A train is added only when its picture loads (an image load per line, cached). Right now only `green.png` exists, so Green B, C, D, E show trains and Red, Orange, Blue and Mattapan show track and name only. No stand-in art. The row has `--surface-1` and a 2px `--surface-3` outline (a surface check against the page).
3. **Pick.** The tapped row's train chugs right along its track and off the screen (620 ms, slow start and fast end, little hops), the page is clipped sideways while it goes so nothing scrolls, then the car step slides in from the left over 420 ms. A line with no train, or reduced motion, goes straight on. A second tap while the train leaves does nothing. The car step works as before.

## Proof (motion cannot be watched, so frames were frozen with the Web Animations API at set times)
- Opening, nine moments from 0 to 1350 ms: `shots/trains-2-opening-frames.png` (top to bottom: 0, 250, 450, 600, 750, 900, 1050, 1200, 1350 ms; train enters, bounces, puffs appear at 700 ms, cover clears, train leaves the screen).
- Chug-off on Green B at 0, 150, 300, 450, 600 ms: `shots/trains-2-chug-frames.png` (train moves right along the rail, reaches the edge at 600 ms).
- Car step arriving at 0, 150 ms and finished: `shots/trains-2-car-arrive-frames.png` (empty, then shifted left and fading in, then in place).
- Line step at rest: `shots/trains-2-line-390.png` (390 by 844), `shots/trains-2-line-1440.png`. Earlier real-time shots `shots/trains-2-open-*.png` were taken before the puff and rail fixes; ignore them.
- A finger on a row during the opening hits the row, not the overlay.
- Mattapan (no train) goes straight to "Which car are you in?"; Green D under reduced motion goes straight on, with no opening and no idle animation.
- `node tools/phone-check.mjs "http://localhost:5173/?mock=1"`: PASS at 390 and 360, no console errors. `npm.cmd run build` from PowerShell: built. `scrollWidth` stays 390 during the chug.

## What I could not judge
- How the motion feels at real speed: the chug rhythm, whether 1.4 s feels long, whether the bounce looks right. Frames only show positions. Nicolo should watch it once on a phone.
- A real iPhone. The sideways clip during the chug (`overflow-x: clip` on `.app`) is proven on Chromium only.
- The line step now scrolls on a 390 by 844 phone: Green C, D and E are below the first screen. That is by the card ("scrolling is fine"), but the lead may want the title block tighter.

## Notes for the lead
- **Any shot of the phone taken within about 1.5 s of load will show the opening.** Use `--wait 1600` or more in other cards' shots and test scripts. Taps are never blocked.
- `public/trains/red.png`, `orange.png` and `blue.png` were present for a few minutes while I worked (I saw them in shots), then were gone. Whatever drops files into `public/trains/` gets them picked up with no code change.
- The 17px name, 88px rows and the idle bounce are exceptions to "no animation without a cause" in DESIGN.md's last rule, written into the new paragraph.
- Local easing `--ease-go` is defined in `trains.css` (not in tokens.css, which I did not touch).
- Not committed. Files to commit with named paths: `src/phone/trains.js`, `src/phone/trains.css`, `src/phone/place.js`, `src/phone/map.css`, `DESIGN.md`, `reports/trains-2.md`, the `shots/trains-2-*` files.
