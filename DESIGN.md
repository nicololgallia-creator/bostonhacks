# Design: Platform Piano remote

Owner: the designer. Values live in `src/tokens.css`; components in `src/phone/phone.css`, `map.css`, `ride.css`, `play.css` and `settings.css`. Use only what is named here. Written Sat 21 Nov 2026 for the pilot screen; updated at 2:50 PM for the wave 3 remote (where you are, seats, music, results). Every later phone card matches it.

## What the look is for

A stranger on a platform or a train scanned a code. In under a minute, with one thumb, they say where they are, take their seats, and look up at the floor. The phone is the remote and the game is on the floor, so every screen says as little as it can and never holds the eyes.

- **Mode:** a tool, not a page. One thing on screen at a time. Familiar before clever.
- **Dark, one theme.** Used underground and beside a dim projector, where a bright phone glares. There is no light theme, so every token has exactly one value.
- **The colour is the seat.** Cyan, pink, yellow and green are the four seats and mean nothing else. The same four are on the floor. The MBTA's own line colours name a line and nothing else. Everything else is near-black and off-white.
- **No names, no accounts.** A seat is known by its number and colour. It is Open, Taken, or Yours.
- **References taken:** the floor itself (the pads are drawn like the projected ones: seat 1 left, lanes inside, the square you step on at the foot); the way a plane or train seat map works, seen from above; VS Code and claude.ai for the habit of a quiet frame with one active area. No outside brand is copied. No MBTA logo. A cute illustrated train look is parked until Nicolo has said yes to one pilot train.

## Tokens

| Group | Token | Value | Use |
|---|---|---|---|
| Surface | `--bg` | `#0B0D12` | the page |
| | `--surface-1` | `#12151C` | a pad you cannot use, the car and train bodies |
| | `--surface-2` | `#1A1E27` | the field, quiet buttons, a taken pad, a car |
| | `--surface-3` | `#252A36` | the status line, a seat on the map, a wall |
| Text | `--text` | `#F4F5F8` | everything you read first (15.3:1 on surface-2) |
| | `--text-2` | `#A9AFBE` | second lines, hints (7.6:1) |
| | `--text-3` | `#8A91A3` | placeholders only (5.3:1) |
| | `--ink` | `#0B0D12` | text on any bright fill |
| Action | `--action` | `#F4F5F8` | the one primary button, off-white so colour stays for seats |
| | `--action-hover`, `--action-press` | `#DDE0E8`, `#C9CDD8` | its states |
| | `--warn` | `#FF9F6B` | the dot on the status line, an input error (9.7:1 on bg) |
| Seat 1 | `--seat-1`, `-dim`, `-soft` | `#29D6FF`, `#113541`, `#22A4C4` | cyan |
| Seat 2 | `--seat-2`, `-dim`, `-soft` | `#FF4FA3`, `#3C1A2F`, `#C23F7F` | pink |
| Seat 3 | `--seat-3`, `-dim`, `-soft` | `#FFD43B`, `#3C351A`, `#C2A231` | yellow |
| Seat 4 | `--seat-4`, `-dim`, `-soft` | `#7CFF6B`, `#223D24`, `#60C355` | green |
| Line | `--line-red`, `-orange`, `-blue`, `-green`, `-mattapan`, `-orange-ink` | `#DA291C`, `#ED8B00`, `#003DA5`, `#00843D`, `#DA291C`, `#0B0D12` | a MBTA line: its dot, its tile, the stripe on its cars (values from the MBTA's own API). Never a seat colour, never anything else |
| Type | `--font` | Bricolage Grotesque, self-hosted | the only family |
| | `--text-xs` to `--text-num` | 13, 15, 17, 22, 28, 40, 72 px | fixed scale, no fluid sizes |
| Space | `--space-1` to `--space-9` | 4, 8, 12, 16, 20, 24, 32, 48, 64 px | every gap and padding |
| Radius | `--radius-s`, `-m`, `-l` | 8, 14, 20 px | small parts, controls, pads |
| Shadow | `--shadow-raise` | `0 10px 24px -10px` and `0 2px 4px`, black | the primary button, and the lit section on the car map |
| Motion | `--dur-1`, `-2`, `-3` | 120, 220, 420 ms | press, change, pad lights up |
| | `--ease-out` | `cubic-bezier(0.16, 1, 0.3, 1)` | everything that moves |
| | `--ease-in-out` | `cubic-bezier(0.65, 0, 0.35, 1)` | reserved for a slide that returns |
| | `--ease-pop` | `cubic-bezier(0.34, 1.56, 0.64, 1)` | the pad lighting, nothing else |

**Seat colour on a fill:** bright seat colour carries `--ink` text (6.4:1 for pink, 11:1 or more for the rest). Bright seat colour as text sits on `--bg`, `--seat-N-dim` or `--surface-2`, never on another seat's colour. A seat's numeral on a taken pad uses `--seat-N-soft`. On the car map a free seat is the bright colour on `--ink`, a taken seat is `--seat-N-dim`.

**Line colour on a fill:** white text on red, blue and green (large bold text, 4.4:1 or more), ink text on orange (8:1).

**Surfaces are checked against each other, not only against text.** Steps are small on purpose (bg to surface-1 is 1.06:1). A pad therefore never relies on its fill alone: an open pad has a 2px seat-colour ring and the word Open, a taken pad says Taken, yours is solid and says Yours. A car or train body has a 2px `--surface-3` outline, because its fill alone would vanish.

Font: Bricolage Grotesque, SIL Open Font License 1.1, Mathieu Triay. Files in `src/phone/fonts/`. They are local because the laptop's Wi-Fi may have no internet.

## Layout grid

- One column, `max-width: 30rem`, centred. 20px side gutters, safe-area insets respected. Uses `100svh`, never `100vh`.
- Rows of the page: top bar (logo mark, name of the app, and the settings button once you hold a seat; 56px tall, not glued to the edge), one status line that opens only when something is wrong, then the screen.
- The seats screen is six rows: top row (Back and Change, only before you hold a seat), heading and one line, the bench, the pad row, free space, the action row at the foot. The free space holds "Pick the music". The last two rows keep their place when the top row is hidden.
- The pad row is `clamp(9.5rem, 100svh - 31.5rem, 27rem)` tall (8.5rem minimum under 700px high) and splits into 1 to 4 equal columns with 12px gaps, in the floor's order. The bench above it uses the same columns.
- At 1440px the same column sits in the middle. The remote is a phone page, so it is not stretched.
- Under 700px high (360 by 640) the seats screen, the results and the lists shrink their spacing so the main button stays on screen. The only scrolling the remote has is a list longer than the screen.

## Components

**Buttons.** Two kinds. Primary: off-white fill, ink text, 56px tall, full width, one per screen. Quiet: `--surface-2` fill, 52px tall, sits in the action row, up to two side by side. Radius 14. Label names the action ("Pick the music", "Leave", "Start"). Press scales to 0.98 in 120ms. Hover only where there is a real pointer. Keyboard focus is a 2px white ring with a 3px offset. A **link** ("Change") is text-2, underlined, 44px tall, at the right of the top row.

**Line tiles** (`place.js`, step one). Eight tiles in two columns, each filled with its line's colour, the line's name in 22px bold, 72px tall. Order: Red, Orange, Blue, Mattapan, Green B, C, D, E. The name is on every tile so colour is never the only clue.

**The train and its cars** (`place.js`, step two). The cars of one train in a row, inside a body with a 2px outline. Each car is a `--surface-2` block at least 144px tall, its number in 28px, and a stripe along the top in the line's colour. Green has 2 cars, Red, Orange and Blue 6, Mattapan 1. Cars are a sample: every car leads to the one real section.

**The car map** (`section.js`, step three). A car seen from above, front on the left, in a body with a 2px outline. Sections side by side, each with a bench along both walls and the name between. One section is real: it is off-white like the primary button, shows the stage's `section.name` and how many seats are free, and its top bench holds the real seats in seat colours (bright free, dim taken). The others (Middle, Rear) are quiet `--surface-2` blocks with grey benches; a tap on one shows one plain line under the car: "There is no projector in this section tonight. Tap the lit one." Under the car, small "Front" and "Back".

**Pads.** There are no other cards, and nothing sits inside a pad but its number, its lanes and one word. Three states, each readable without colour: open (dim fill, 2px ring, "Open"), taken (flat, soft numeral, "Taken"), yours (solid seat colour, ink text, "Yours"). A fourth, idle, shows only before the stage has answered. Open and yours are buttons: one tap takes a seat, one tap on yours gives it back. One phone can hold several seats. The lanes inside come from `layout.lanes` (two, one for each foot) with the square for the feet drawn brighter at the foot.

**The bench** (seats screen). One cushion over each pad, same columns, in the same states as the pad (open ring, taken with a dot, yours solid with a dot), under a thin wall. Tapping a cushion is tapping its pad. It is drawn aria-hidden; the pads carry the labels.

**Rows (the ride flow, `src/phone/ride.css`).** The steps after "Pick the music" are one list of rows, one step at a time. A row is a quiet button that is 56px or taller (88px for a two-way choice): a title, an optional line under it in `--text-2`, and at its end a line dot or a time. Hover is `--surface-3`, press scales to 0.98, a chosen row gets a 2px off-white ring and a numbered circle (never a seat colour). A line dot is a 28px circle in the line's colour with its letter in it. "Pick the music" opens on two equal big rows, "Fit my train" and "Pick my own". The line you chose limits the stations and the trains. The set of songs is worked out once and never changes under a finger; only its countdown moves. When it would run past the train the screen says so and the button becomes "Update the set". Back is at the top of every step; the one action sits at the foot, stuck while a list scrolls.

**The live screen and the results** (`play.js`). Everyone plays one song together, so the number is the team's. While a song plays: the song, the clock, one box with "Team score", then Pause, Skip, Stop (Stop needs a second tap). It never says whose turn it is. Results: the team's grade (72px, off-white) and score first, then one row for each of your seats (seat colour in the circle, hits out of its own total, its score). A null grade shows nothing. A viewer with no seat sees the team only.

**Inputs.** The station search is the only text field: 72px tall, 28px text, off-white caret, no border. Focus is a 2px white inset ring. One hint line sits below. Font never under 16px, so iPhones do not zoom.

**Empty states.** Before the stage answers, the seats screen says "Joining the floor" over three quiet pads. Every seat taken: "Every seat is taken. Watch the next song, then ask for a turn." Never a blank screen.

**Loading.** The same screen in its quiet form, never a spinner. A claim has no spinner either: the stage answers in about a tenth of a second and the pad lights.

**Errors.** One line at a time in the status strip under the top bar, with an orange dot, in plain words that say the reason and the fix:
- the link is down: "Lost the connection. Trying again."
- the stage is silent for 3 seconds: "No answer from the floor yet. The game must be open on the laptop."
- the stage refused a command: its own `notice` text, shown only when it is for this phone or for everyone, and gone after about 4 seconds.
- the stage restarted: "The floor restarted. Start the song again." The phone joins again and asks for its seats back by itself.
The strip opens and closes in 220ms and pushes the page down; it never covers anything. "The floor is not lined up yet" is a setup matter and shows only in settings.

**Back.** Every step that has a Back pushes one entry in the browser's history, so the phone's own Back button steps back inside the flow and never leaves the page. Taps in the first 400ms after a step appears are ignored, so a double tap cannot land on the next step.

**Motion.** Motion says what changed. The one authored moment is a pad lighting when you take it: 420ms from dim to solid with a small pop. Screens enter with a 220ms rise. `prefers-reduced-motion` turns all of it to 1ms.

## Copy

Short plain sentences, an Oxford comma, no em dashes, the same phrase never twice. The phone says what to do, then gets out of the way. Seat words are "seat 2", never "slot" or "spot". "Floor" is where the game is. The first screen says what this is: "A piano on the floor. You play it with your feet."

## Never do

1. **Never use a seat colour for anything but its seat,** or a line colour for anything but its line. No colour for success, selection or decoration. State is the off-white button, the ring, the solid pad.
2. **Never put two things to do on one screen.** One heading, one choice (a line, a car, a section, a row of pads), one primary action.
3. **Never ask the eyes to stay on the phone.** No animation that runs without a cause, no scrolling except a long list, no spinner, no glow, no word about whose turn it is. Every screen ends by sending the eyes to the floor.

## Checks that were run on wave 3

- Contrast of every text and fill pair above, computed (numbers in the table).
- 390 and 360 wide, 360 by 640 and 1440: no sideways scroll in any state, no clipped text, targets at least 44px, the seated screen and the set screen fit 360 by 640.
- One phone holding two seats, giving one back, Leave, Change, the stage forgetting everyone, a refusal for another phone, a double tap on a step, the phone's own Back through every step.
- A real stage page and a real phone page on the real link: three steps, two seats, a song, results with the team.
