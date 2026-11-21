# Design: Platform Piano remote

Owner: the designer. Values live in `src/tokens.css`; components in `src/phone/phone.css`. Use only what is named here. Written Sat 21 Nov 2026 for the pilot screen (join and pick your seat); every later phone card matches it.

## What the look is for

A stranger on a platform or a train scanned a code. In ten seconds, with one thumb, they have a name and a seat, then they look up at the floor. The phone is the remote and the game is on the floor, so this screen says as little as it can and never holds the eyes.

- **Mode:** a tool, not a page. One thing on screen at a time. Familiar before clever.
- **Dark, one theme.** Used underground and beside a dim projector, where a bright phone glares. There is no light theme, so every token has exactly one value.
- **The colour is the seat.** Cyan, pink, yellow and green are the four seats and mean nothing else. The same four are on the floor. Everything else is near-black and off-white.
- **References taken:** the floor itself (the pads are drawn like the projected ones: seat 1 left, lanes inside, the square you step on at the foot); VS Code and claude.ai for the habit of a quiet frame with one active area. No outside brand is copied. No MBTA logo.

## Tokens

| Group | Token | Value | Use |
|---|---|---|---|
| Surface | `--bg` | `#0B0D12` | the page |
| | `--surface-1` | `#12151C` | a pad you cannot use |
| | `--surface-2` | `#1A1E27` | the field, quiet buttons, a taken pad |
| | `--surface-3` | `#252A36` | the status line |
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
| Type | `--font` | Bricolage Grotesque, self-hosted | the only family |
| | `--text-xs` to `--text-num` | 13, 15, 17, 22, 28, 40, 72 px | fixed scale, no fluid sizes |
| Space | `--space-1` to `--space-9` | 4, 8, 12, 16, 20, 24, 32, 48, 64 px | every gap and padding |
| Radius | `--radius-s`, `-m`, `-l` | 8, 14, 20 px | small parts, controls, pads |
| Shadow | `--shadow-raise` | `0 10px 24px -10px` and `0 2px 4px`, black | the primary button only |
| Motion | `--dur-1`, `-2`, `-3` | 120, 220, 420 ms | press, change, pad lights up |
| | `--ease-out` | `cubic-bezier(0.16, 1, 0.3, 1)` | everything that moves |
| | `--ease-in-out` | `cubic-bezier(0.65, 0, 0.35, 1)` | reserved for a slide that returns |
| | `--ease-pop` | `cubic-bezier(0.34, 1.56, 0.64, 1)` | the pad lighting, nothing else |

**Seat colour on a fill:** bright seat colour carries `--ink` text (6.4:1 for pink, 11:1 or more for the rest). Bright seat colour as text sits on `--bg`, `--seat-N-dim` or `--surface-2`, never on another seat's colour. A seat's numeral on a taken pad uses `--seat-N-soft`.

**Surfaces are checked against each other, not only against text.** Steps are small on purpose (bg to surface-1 is 1.06:1). A pad therefore never relies on its fill alone: a free pad has a 2px seat-colour ring, a taken pad has a name, your pad is solid.

Font: Bricolage Grotesque, SIL Open Font License 1.1, Mathieu Triay. Files in `src/phone/fonts/`. They are local because the laptop's Wi-Fi may have no internet.

## Layout grid

- One column, `max-width: 30rem`, centred. 20px side gutters, safe-area insets respected. Uses `100svh`, never `100vh`.
- Rows of the page: top bar (logo mark and name, 56px tall, not glued to the edge), one status line that opens only when something is wrong, then the screen.
- The seats screen is four rows: heading and one line, the pad row, free space, the action row at the foot. **The free space is for the controls later cards add** (stop and songs, start, pause, score). Put them between the pads and the action row. Do not add a second column.
- The pad row is `clamp(15rem, 50svh, 27rem)` tall and splits into 1 to 4 equal columns with 12px gaps, in the floor's order.
- At 1440px the same column sits in the middle. The remote is a phone page, so it is not stretched.

## Components

**Buttons.** Two kinds. Primary: off-white fill, ink text, 56px tall, full width, the only shadow in the app, one per screen. Quiet: `--surface-2` fill, 52px tall, sits in the action row, up to two side by side. Radius 14. Label names the action ("Join", "Change seat", "Leave"). Press scales to 0.98 in 120ms. Hover only where there is a real pointer. Keyboard focus is a 2px white ring with a 3px offset.

**Pads (the one card).** There are no other cards, and nothing sits inside a pad but its number, its lanes and a name. Four states, each readable without colour: open (dim fill, 2px ring, "Sit here"), taken (flat, soft numeral, their name), yours (solid seat colour, ink text, your name), idle (flat, nobody there, used after you sit). A pad is a button only in the open state, and in yours while changing seats. The lanes inside are the real lane count (3 seated, 4 standing) with the square for the feet drawn brighter at the foot.

**Inputs.** 72px tall, 28px text so it reads at arm's length, off-white caret, no border. Focus is a 2px white inset ring. The label is the heading above it. One hint line sits below. Font never under 16px, so iPhones do not zoom. Names are 10 characters at most and the field stops there.

**Empty states.** A pad with nobody in it says "Sit here". Before the stage answers, the seats screen shows three quiet pads under "Joining the floor". Never a blank screen.

**Loading.** The same screen in its quiet form, never a spinner. A claim has no spinner either: the stage answers in about a tenth of a second and the pad lights.

**Errors.** One line at a time in the status strip under the top bar, with an orange dot, in plain words that say the reason and the fix:
- the link is down: "Lost the connection. Trying again."
- the stage is silent for 3 seconds: "No answer from the floor yet. The game must be open on the laptop."
- the stage refused a command: its own `notice` sentence, shown as sent.
- an empty name: the hint under the field becomes "Type a name first." in orange.
The strip opens and closes in 220ms and pushes the page down; it never covers anything.

**Motion.** Motion says what changed. The one authored moment is a pad lighting when you take it: 420ms from dim to solid with a small pop. Screens enter with a 220ms rise. `prefers-reduced-motion` turns all of it to 1ms.

## Copy

Short plain sentences, an Oxford comma, no em dashes, the same phrase never twice. The phone says what to do, then gets out of the way. Seat words are "seat 2", never "slot" or "spot". "Floor" is where the game is.

## Never do

1. **Never use a seat colour for anything but its seat.** No colour for success, selection or decoration. State is the off-white button, the ring, the solid pad.
2. **Never put two things to do on one screen.** One heading, one field or one row of pads, one primary action. New controls go in the free space under the pads and replace nothing.
3. **Never ask the eyes to stay on the phone.** No animation that runs without a cause, no scrolling, no long text, no spinner, no glow. Every screen ends by sending the eyes to the floor.

## Checks that were run on the pilot

- Contrast of every text and fill pair above, computed (numbers in the table).
- 390 and 360px, every state: no sideways scroll, no clipped text, targets at least 44px.
- A name of 10 letters in four pads, a refused claim, a silent stage, a dropped link, a stage that forgot everyone.
