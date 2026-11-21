# Report: designer, card D1 (remote pilot, screen 1: join and pick your seat)

Sat 21 Nov 2026. Skills used: `impeccable` (Operate mode, its craft floor and operate notes, read by hand because its launcher downloads a program on first run, which I did not allow) and `design-taste-frontend`. `high-end-visual-design` is for marketing pages and Nicolo's design note says never for a tool, so I did not apply it. Nicolo's `notes/My design taste.md` read: the short version, "Tools and apps", "How I work on your designs", and the verdict rows for tools.

**Look, in one line:** a dark tool where the only colour is the seat. Near-black, off-white, Bricolage Grotesque, and the four seat colours drawn as pads in the floor's order.

## Done

- `src/tokens.css`: colours (one dark theme), one self-hosted font, type, space, radius, shadow and motion scales.
- `src/phone/phone.css`: frame, buttons, field, status line, pads. Only tokens, no loose values.
- `src/phone/main.js`: three states. Name (one field, one button, kept in localStorage). Pick your seat (pads in floor order and seat colours, taken pads show who). Seated ("You are in seat 2" in that seat's colour, Change seat, Leave). Sends `join`, `claim`, `leave` with its own `clientId`, draws only the stage's State, shows `notice` when a command is refused. A lost link and a silent stage each show one plain line and recover by themselves. Joins again by itself after a reconnect or when the stage forgot it.
- `src/phone/mock.js`: the fake stage for `?mock=1` (three seats, "Zo" in seat 2, answers join, claim, leave with real-shaped State and the refusal sentences).
- `index.html`: top bar with a mark made of the four seat colours, a status line, one screen. Inline favicon so there is no 404.
- `src/phone/fonts/`: Bricolage Grotesque, latin and latin-ext, from Google Fonts. SIL OFL 1.1.
- `DESIGN.md`: tokens table, layout grid, rules for buttons, pads (the only card), inputs, empty, loading, errors, motion, copy, three "never do" lines.

## How I checked

- Mock walk at 390x844 and 360x640: name, empty submit (error hint), join, pick seat 3, change seat, keep seat, leave (name comes back prefilled). Page width equals the screen in every state. Console: no errors.
- A page-side fake of the browser's WebSocket, driven by script, through the real `src/link.js`: 4 standing seats with a 10-letter name, a refused claim showing "That seat is taken.", the notice clearing on the next accepted command, a silent stage (3 s), a dropped link ("Lost the connection. Trying again."), a rejoin when the stage forgot the player. This did not touch the shared link, because the stage page another builder runs is on it (my first try did reach it, and a "demo" stage answered; I stopped using the shared link for tests).
- `node tools/phone-check.mjs "http://localhost:5173/?mock=1"`: PASS at 390 and 360, no console errors.
- `npm.cmd run build`: passes.
- Contrast computed for every text and fill pair (table in `DESIGN.md`). Text on surfaces 5.3:1 to 15.3:1. Ink on seat colours 6.4:1 to 15:1.
- Screenshots (opened and looked at):
  - `shots/D1-390-1-name.png` state 1, name
  - `shots/D1-390-2-seats.png` state 2, pick your seat (Zo in seat 2)
  - `shots/D1-390-3-seated.png` state 3, you are in seat 3
  - `shots/D1-390-4-choosing.png` changing seat
  - `shots/D1-390-5-left.png` after Leave, name prefilled
  - `shots/D1-390-lost.png` link down line
  - `shots/D1-notice-4.png` four standing seats and a refused claim
  - `shots/D1-1440-2-seats.png` desktop, 1440x900 viewport saved at 0.625 scale (900 px wide file, per the size limit)

## Not done

- No `--as` runs (no `qa/student.json`). The mock needs none.
- `impeccable` audit not run: its launcher downloads a program, so I held to its written craft floor instead and checked each line by hand.
- Not heard or felt on a real phone. The pad lighting, the vibration on a tap and the on-screen keyboard are unseen on a phone. Nicolo should tap through `http://<laptop IP>:5173/?mock=1` on his own phone before the next screen.
- The real stage does not answer yet (card G5), so the real round trip is untested.

## Needs from others

- Stage owner (G4, G5): cap player names at 10 characters when it receives `join` (the phone stops typing at 10, but a longer name from elsewhere wraps inside a narrow pad). Draw the floor's pads in the four seat colours from `src/tokens.css` (`--seat-1` to `--seat-4`).
- Lead: `CREDITS.md` (audio-1's file) should list Bricolage Grotesque, SIL OFL 1.1, Mathieu Triay, from Google Fonts.
- Lead: `vite.config.js` and other files untouched. Nothing else needed.

## Calls I made

- **The picker is the floor, flattened.** One row of pads in the floor's order and colours, with the lanes inside, instead of a list. Picking a seat and then looking up at the same shape is the point of the screen.
- **Seated reuses the same row.** Your pad lights, the others stay. "Change seat" reopens the row. No separate screen.
- **Seat number appears twice when seated** ("You are in seat 3" and the 3 on the pad). The card asks for that sentence and the pad needs its number to be a seat. One exception to "never the same number twice".
- **Self-hosted font, not a Google link,** because the laptop's Wi-Fi may have no internet.
- **Names are 10 characters at most,** so four pads still show a whole name on one line.
- **The primary button is off-white,** so colour never means "go". Colour is the seat only.
- **Desktop:** the remote is a phone column, centred at 1440. It is not stretched.
- **Name screen is top-anchored,** with the button right under the field, because a pinned bottom button hides behind the keyboard.
- **The empty space under the pads is on purpose.** Later cards put the stop, songs and Start there.
