# Floor pilot: the floor in a new look, for Nicolo's yes

Page: `http://localhost:5173/floor-pilot.html` (files: `floor-pilot.html`, `src/floor-pilot/floor-pilot.js`, `chart.js`, `chart.test.js`, `floor-pilot.css`, `fonts/nunito-latin.woff2`; one line added to `vite.config.js`, the other builder's lines kept). The working game is untouched. `npm run build` passes (PowerShell). 12 tests pass (`node --test src/floor-pilot/chart.test.js`).

## How to look at it

- `?line=Green-B` (default), `Green-C/D/E`, `Red`, `Orange`, `Blue`, `Mattapan`. The colour is read from the `--line-*` tokens in `src/tokens.css`.
- `?v=1` deep ground, `?v=2` lighter and bolder ground. Keys `1` and `2` switch live.
- `?players=4` (default), `3`, `2`, or `1`. Two or more players: one lane each, either foot taps it, lanes get wider as players drop out. One player: one pad, two lanes, L and R.
- Keys: `F` fullscreen (do this on the projector), Space pause. `?t=12.6&pause=1` freezes any moment. The loop is 38.4 s: pads rise, 3-2-1-GO, 24 s song, departure board.

## What changed after his notes (phone pilot, 5:25 PM lane rule)

1. **Line colour.** The whole floor is the line the train is on. The ground is the line colour made dark (v1) or at its own strength (v2). The map line, the hit line, the rails and the board header use the line colour lifted to a brightness a projector can show (the blue line is only 6% of white light, so lifted; red and green about 16%). The four pad colours are chosen to keep clear of each line's hue: Green line cyan, pink, yellow, violet; Red cyan, yellow, lime, violet; Orange cyan, pink, lime, violet; Blue cyan, pink, yellow, lime. Pink is now `#FF8AC4` (lighter, it was the dimmest) and violet `#B59BFF` is new. **These pad colours differ from `tokens.css` seat colours on purpose; if the phone keeps the old four, they will not match on green and red. Your call.**
2. **Train structure, not a skin.** Each lane is a track: two rails and sleepers that run past with the song, so the tiles ride on it. Tiles are train cars with a front window. A hold is a train of coupled cars. The hit line is a thick line-coloured platform edge. The foot zone holds a station dot (white dot, seat-colour ring) with the seat number on it. The clock is a train on a map line with round-capped thick stroke, a bend, stop dots and a bigger station dot, with the line's bullet (B, R, O, BL) at the start. A pale map grid sits under everything. Results are a departure board: a line-coloured header (Kenmore, Arrived), rows, split-flap digit tiles that count up, a white "+50" bonus tag, a crown for first.
3. **Nothing from Duolingo.** No chunky-edge buttons, no pastel-on-white, no rounded-pill chrome beyond the combo tag, no green `#58CC02`. The ref site's feel (thick lines, station dots with a dark ring, pale grid) is the language. No mascot.
4. **Lanes by player count.** Built exactly to his 5:25 rule.

## The physics, and the answer

A dim projector (100 to 450 lm) on a lit train floor can only add light to a floor that is already lit. Black is the floor as it is. If the car's light and the projected white are about equal, white on black is only about 2x brighter than the floor. Every bit of ground lit costs contrast twice: it raises the floor under the tiles and it lowers tile over ground.

My answer: a ground that costs little light but still carries colour (a deep or mid tone of the line colour, not black, not white), flat solid shapes with no glow and no outlines, very bright flat tiles, white kept for the hit moment and for text, large shapes, almost no words.

Measured from the screenshots (share of full white light):

| | ground | mean frame, playing | mean frame, results | white text on ground |
|---|---|---|---|---|
| v1 deep | 4.9% | 16 to 17% (Green-B 16.3, Red 17.4, Blue 17.4) | 13 to 14% | 10.6:1 |
| v2 bold | 15.8 to 16.1% | 25 to 26% (Blue 26.2) | 22 to 24% | 5.0 to 5.1:1 |

For comparison the rejected black floor frame is 6.5% mean. **Ours uses about 2.5x that light in v1 and about 4x in v2**, because tiles are now big. The knob is the lane slot (7% lighter than the ground now); lowering it saves about 3 points.

How a tile reads on the floor, assuming the projector's white is as bright as the car's own light (a hard case) and then half as bright: the dimmest pad colour (violet or pink, about 40% of white) over its ground is 1.34x (v1) and 1.21x (v2) at equal light; 1.17x and 1.11x at half light. Cyan, yellow, lime are better (cyan 1.4x to 1.5x in v1). So v1 gives tiles more separation, and v2 gives the stronger colour. The route line over the ground is 3.8:1 in v1 and about 2.1:1 in v2 (a quieter line). I cannot tell which one wins in the room.

## Motion proof (I cannot watch motion)

- Two real-time screenshots 0.36 s apart (`shots/floor-pilot/motion-a.png`, `motion-b.png`, page time 13.86 to 14.22): 146,389 pixels changed, 15.9% of the frame. Sleepers and cars moving.
- A landing, in three crops of one pad at 70 ms before, 50 ms after and 200 ms after a Perfect (`hit-strip.png`): the car approaches, then a near-white card flattened (104 px tall squashed to about 85) with the zone flashing white and the ring popping, then the word and the next car. The squash is also wider by 12%, but the lane clips it, so only the flattening shows. That is a bug I left: widening needs a clip that is a little wider than the lane.
- What I did not see: the pop spring on the zone (1.13x then settle in 0.4 s), the countdown bounce (overshoot then squash), the score bump, the count-up on the board, the crown bob. They are written as functions of time and each sits in a screenshot at one moment, but I have not seen any of them move.

## Screenshots (1280x720, all in `shots/floor-pilot/`; I read them at full 1280 wide, over your 900 limit)

Four players, Green-B, deep ground:
- `Green-B-p4-v1-t1.png` countdown "3"; `Green-B-p4-v1-t3.9.png` "GO" (the first note only enters the lane half a second after GO)
- `Green-B-p4-v1-t12.6.png` play: a hold (Player 1's train of cars, zone held), Perfects, a Miss (Player 4, the dull car rolling through the zone), combos x3, x5
- `Green-B-p4-v1-t19.png` late play, combos building
- `Green-B-p4-v1-t33.png` the departure board with the whiteboard numbers: Player 2 1069 +50, Player 4 942, Player 1 872 +25, Player 3 401

The two grounds, Green-B: `Green-B-p4-v1-t12.6.png` and `Green-B-p4-v2-t12.6.png`, board `Green-B-p4-v2-t33.png`.
Red: `Red-p4-v1-t12.6.png`, `Red-p4-v2-t12.6.png`, `Red-p4-v1-t33.png`. Blue `Blue-p4-v1-t12.6.png`, Orange `Orange-p4-v2-t12.6.png`.
Other player counts: `Green-B-p1-v1-t12.6.png` (solo, two lanes L and R), `-p1-v1-t33.png`, `Green-B-p2-v1-t12.6.png`, `-p2-v1-t33.png`, `Green-B-p3-v1-t12.6.png`, `-p3-v1-t33.png`.

## Calls I made

- Score sits above the lane, not under the feet. Combo tag beside the score. The number on the foot zone (or L/R for a solo pad) tells you which lane is yours.
- The countdown is plain white numerals, no disc: a big white shape is lit floor, so it stays thin.
- Words: Perfect, Great, Miss, on a small dark plate above the hit line, gone in half a second. Miss is quiet, not red.
- Final scores are scaled so each player ends on his whiteboard number exactly. A fewer-player scene uses the first players' numbers.
- The song and the tiles are made up (`chart.js`, one seed). The same chart in the browser and in the tests (I found the two disagreed at first, because the shuffle used random numbers inside a sort; fixed).
- Holds are one second long: longer, and the train of cars fills the whole lane.

## Not checked, and not built

- **How it looks through a real projector on a real floor.** Everything above is a model. Ground, line colour lift, slot lightness and the pad colours need a test in the car.
- Colour-blind check of the four pad colours: not run. Each lane also carries its seat number.
- Sound: none.
- The `tokens.css` file is not changed. The page loads it only to read the `--line-*` colours.
- The design skills (`high-end-visual-design`, `design-taste-frontend`, `impeccable`) are not available in this tool, so I held the work to the bar by hand; no automated audit was run. `phone-check` is not meant for a 1280x720 canvas; the canvas scales to the window and the page does not scroll sideways.
- Not tested on the other builder's pages. 404 in the console is the missing favicon.
