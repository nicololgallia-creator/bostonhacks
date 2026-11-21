# Away run, Sat 21 Nov, from 12:45 PM

Nicolo left for food at about 12:45 PM. His words: "work for as long as possible. get as close to a full fledged app as possible... run our protocol for when i leave. with the boss checking work, making detailed plans, thinking things through."

If this session was cut off, start here: read `PLAN.md`, `docs/HOW-IT-WORKS.md`, `AGENTS.md`, then this file. The queue below says what is next.

## Budget

At most 10 more Sonnet builders in this run, three at once, no Opus. Each card is reviewed by the lead (tests run, screenshots opened) before it counts.

## Standing yes from Nicolo (12:43 PM)

- Push to the private team repo at every checkpoint.
- Post milestones to the Status issue (issue 2) and open cards for Zohayb.

Nothing else leaves the machine. No deploy, no spending, no installs beyond the project's own packages.

## Queue

| # | Card | Needs | State |
|---|---|---|---|
| 1 | G5 stage wired to seats, session, phones | G4 | running |
| 2 | D1 remote pilot screen | | running |
| 3 | T3 setup part one | T2 | running |
| 4 | P2 remote: stop, live trains, songs that fit, start | D1 | next |
| 5 | G3 floor look and effects at full strength | G5 | next |
| 6 | T5 setup part two: place seats, lag test | T3 | next |
| 7 | P3 remote: controls, queue, live score, results | P2 | later |
| 8 | E1 end to end test: phone joins, picks a seat, starts, replayed feet play, results | G5, P2 | later |

## Calls made while he is away

Listed in the report at the end, newest last.

- 12:45 PM. The remote's later screens (P2, P3) are built before he has seen the pilot screen, because he asked for "as close to a full fledged app as possible". His own rule is one screen first. To keep it cheap to change, every phone screen takes its look only from `tokens.css` and `DESIGN.md`, so a different look is a change in one place.

## Milestones

Newest last.

- 12:55 PM. D1 reviewed: the remote pilot (name, pick your seat, seated) is built and the lead opened the seat screens. It mirrors the floor: same order, same seat colours. Nicolo has not judged it yet. P2 (stop, live trains, songs that fit, start) started.
- 12:50 PM. G5 reviewed: the stage runs on seats and the session. The lobby shows a QR code and three seats, a second page joined over the link and its name appeared on its pad, and three pads play the same song. The lead opened the lobby and mid-song shots. Not heard by ear, and the QR code is not scanned by a real phone yet. G3 (the floor's full look) started.
- 12:45 PM. Pushed `b2d6d3f`: seats and session logic, tracker maths, feet recorder, sampled piano. 105 tests pass. Status posted to issue 2. Cards for Zohayb opened as issues 3 (real songs) and 4 (away from the laptop).
- 1:00 PM. T3 reviewed: setup part one works with a fake camera and a replay (camera, straighten, show the camera the field, foot check). The lead opened the marks step and the foot check. 8 keystone tests pass. Never tried with the real DJI or projector: that is the first thing for Nicolo to do when he is back (press C on the stage). T5 (place the seats, lag test) started. Builders used: 4 of 10.
- 1:15 PM. T5 reviewed: setup has all six steps. Seats can be dragged to where feet are, and the lag test measures the delay and saves it. 13 lag tests pass, the lead opened the seats step. Not tried on the real gear. The lead wrote docs/SETUP.md, the step by step guide for the hardware. Builders used: 5 of 10.
