# Devpost submission

Everything that goes on the Devpost page, in one place. Fill in each `TODO`, then copy the fields across.

**Deadline: 9:00 AM Sunday 22 Nov. No submissions after it.** The page must show **Submitted**, not Draft. Aim to submit by 8:15 AM (PLAN.md clock).

## Checklist

| Done | What | Owner | Notes |
|---|---|---|---|
| [ ] | Devpost account for every member, all registered for Boston Bound | everyone | |
| [ ] | Project created, every member added to it | TODO | Members not on the page cannot win prizes |
| [ ] | Project name and team name | team | See "Name" below |
| [ ] | Tagline (200 characters max) | TODO | Draft below |
| [ ] | "About the project" story | TODO | Draft below |
| [ ] | Built with tags | TODO | List below |
| [ ] | 1-minute video, uploaded and linked | Zohayb | Script: `docs/DEMO-VIDEO-SCRIPT.md` |
| [ ] | Image gallery, at least 4 pictures | TODO | List below |
| [ ] | Repo set to **public** | Nicolo | It is private now |
| [ ] | Links: repo, live phone page | TODO | Below |
| [ ] | Tracks and prizes picked | Nicolo | See "Tracks" below |
| [ ] | Pressed Submit and saw the confirmation | TODO | Check the page says Submitted |
| [ ] | Pitch rehearsed and timed at 3 minutes | everyone | Judging starts 9:30 AM at our table |

## Rules from the organisers' guide

- Teams of 2 to 4, and every member must be listed on the Devpost.
- The Devpost asks for: a 1-minute video demo, a short summary, the team name, the project name, the team members, a public repo link, and any other links that help.
- Judging: 3 minutes of pitch, then 1 minute of questions, science-fair style at our table. The 4 minutes are a hard limit. The whole team must be there to win.
- Criteria: Idea Impact & Relevance, Problem Understanding & User Fit, Technical Implementation, Design, and Presentation.
- All work is made during the event. Open-source libraries, public datasets, and AI tools are allowed.

## Basics

- **Project name:** TTiles
  - Ideas so far: Treble on the Tracks, T-Minus, Hold Music, Seat Music, Sole Train, Bach Bay, Signal Problems, Fare Play.
- **Team name:** TODO
- **Members:**
  - Nicolo Gallia
  - Zohayb Riaz
  - jonfeld (TODO: full name)
  - TODO: PLAN.md says "all four members". Confirm the fourth, or that we are three.

## Tracks

- **Transit Gamification** (our main track, in PLAN.md): "How can we transform the common T ride from something that is dreaded to something people look forward to?"
- **Spark! Hack Our Space** ($500, BU Spark!): TODO, Nicolo to confirm we enter. The guide does not say whether a subtrack entry also needs a main track. Ask on Discord. Spark judges score out of 100 on three things:
  - Creativity, the "Spark" factor: people who try it want to bring someone over to see it.
  - Technical execution: usable right away, with no setup, instructions, or extra development.
  - Build-out vision: a clear, realistic idea of what the $1,000 equipment budget adds. Draft below.
  - Facts from the organisers' own doc, "Hack Our Space! Prize 2026-2027" (read in full by the lead's Claude on Sat 21 Nov, about 9:25 PM: https://docs.google.com/document/d/1-kdotQLWTW1eAzaz2IL3RyrYiG09FCKZ8zkaTYMAANA):
    - The prize: "$500 (a Visa gift card, awarded after the event)", plus "automatic entry into the Spark! Innovation Program, track of their choice, and an equipment budget of up to $1,000 to fully build out the project."
    - The bar: "It doesn't need to be polished, but it does need to be a working prototype that we could install in our space right away."
    - **Who may enter: "this challenge is now open to non-BU students with the requirement that projects are a full handoff so we can install them immediately in our space."** Nicolo is at Bentley, so this applies to us: the entry needs a handoff a stranger can install (see docs/SETUP.md), and the floor must start with no setup.
    - What they want: hacks that "turn everyday features of our lab into moments of surprise, delight and playful interaction", for example "seats that react when someone sits down, walkways that come alive with sound or light".
    - Their own idea list is close to ours in two places, so say how TTiles differs: "Chair Symphony" (pressure sensors under 6 to 10 chairs that play a note when someone sits) and "Approach Detector" (a ceiling projector draws glowing footsteps). They add: "We have projectors if someone wants to try this out!" and their table "should have" a projector and a camera.
    - Their note on networks: "Many hobby boards can't connect to campus Wi-Fi, so design your hack to work offline where you can." TTiles plays with no internet when the phone and the laptop share a network (the laptop's own address is the QR fallback); the public phone page needs internet.
- **Other prizes:** TODO, check the Devpost prize list (PLAN.md mentions a GoDaddy domain prize).

## Links

| Link | Address |
|---|---|
| Code | https://github.com/nicololgallia-creator/bostonhacks (must be public before submitting) |
| Live phone page | https://platform-piano.vercel.app |
| Video | TODO |

## Tagline (200 characters max)

Draft: A piano projected on the floor of the T that you play with your feet. Your songs last exactly as long as your wait for the train.

## About the project (draft)

Devpost gives these headings. Every number here comes from `research.md` or a report in `reports/`. Keep it that way.

### Inspiration
Waiting for the T is the part of the ride people dread. On 28 January 2026 the Red Line had 9 trains in service, against 20 in a typical rush hour (Streetsblog Mass). Research on waiting says a wait with something to do, and a wait with a known end, both feel shorter. We wanted to give riders both.

### What it does
TTiles projects a rhythm game onto the floor of a train car or platform. Tiles slide toward your feet and you tap them with your shoes to play the notes. Scan the QR code, pick your line and your seats on your phone, and pick music. "Fit my train" reads live MBTA arrival times and picks songs that end as your train pulls in. Everyone nearby plays one song together, so a stranger who joins makes the song fuller.

### How we built it
- A web app built with Vite and plain JavaScript. The laptop runs the projected stage, and each phone is a remote.
- A DJI Osmo Action 4 used as a webcam. MediaPipe Pose Landmarker finds each seated player's feet in the browser, with no internet needed.
- A homography maps the camera picture onto the projected floor, and a six-step setup lines up the camera and the projector.
- A rhythm engine with tap and hold tiles, combos, and grades. A sampled piano (Salamander Grand, CC BY 3.0) plus backing tracks made from MIDI files.
- Live arrivals and ride times from the MBTA V3 API.
- Phones reach the stage over a local link or an internet relay (MQTT), so they work on mobile data.

### Challenges we ran into
- Telling a resting foot from a tap. On our first real two-person recording, the tuned detector read 0 taps at rest and caught 29 of 31 and 37 of 40 taps.
- On the first real floor test, the projector and camera faced the players, so the picture had to turn half way round and the seats had to mirror.
- A dim 720p projector, so the floor uses bright tiles on black.
- TODO: add the ones the team remembers best.

### Accomplishments that we're proud of
TODO

### What we learned
TODO

### What's next
- Riding it on a real train, which needs portable power for the projector.
- TODO

## Built with

JavaScript, HTML, CSS, Vite, Node.js, MediaPipe, WebSocket, MQTT, Web Audio API, MBTA V3 API, Tone.js MIDI, Vercel, DJI Osmo Action 4, projector

## Spark build-out vision ($1,000)

For the Spark entry only. The hackathon version borrows four things: our laptop, our DJI camera, a projector resting on a table, and a person to line it up. The $1,000 replaces each one, so the floor lives in the lab and starts by itself. One row for each borrowed thing:

| Item | What it replaces, and why | Price |
|---|---|---|
| BenQ MW560C projector (4,000 ANSI lumens, throw ratio 1.55 to 1.7) | The dim projector on a table. Bright enough for a lit room, and from a 2.7 m ceiling it lights about 1.7 m of floor: one row of chairs. | $499.00 at Staples |
| Beelink SER5 mini PC (Ryzen 5 5500U, 16 GB, 480 GB) | Our laptop, so the floor runs with nobody's computer left behind. **Not yet tested with the game.** | $379.00 on Amazon (sold by WU Tech-Beelink) |
| Logitech C920s webcam | Our DJI camera | $74.99 at Best Buy |
| Mount-It MI-606L ceiling mount | The person who lines it up: mounted once, aligned once | $46.19 at Staples |
| **Total** | | **$999.18 before tax** |

Where these numbers come from: Nicolo's other Claude session opened each product page in Chrome on the evening of Sat 21 Nov 2026 and sent the prices to the lead's Claude, which did NOT open the pages itself. The pages: staples.com/benq-dlp-business-projector-white-mw560c/product_IM1230C52, amazon.com/dp/B0CRKXMKDT, bestbuy.com/site/-/6321794.p, staples.com/mount-it-projector-ceiling-mount-height-adjustable-universal-stand-mi-606l/product_2632715. Prices move: open each once more on Sunday morning before submitting. (An earlier draft of this table, $530, $340 and $130, came from search summaries nobody had opened. It is gone. The depth camera is dropped: the ordinary camera already catches 66 of 71 real taps on our recording, so it cannot be justified.)

Two things to say honestly on the page: the mini PC has not run the game yet, and the game has not been tried with the C920s (it works with any camera a browser can open, and it has only been run with the DJI).

## Image gallery

Devpost shows these on the project page. TODO: take each one and add it.
- [ ] The floor mid-song, with real feet on the tiles
- [ ] The phone: picking your line and seats
- [ ] The phone: "Fit my train" with live arrivals
- [ ] Results on the floor and on the phone
- [ ] The gear set up: camera, projector, and laptop

## Credits to include

From `CREDITS.md`: Salamander Grand Piano V3 by Alexander Holm (CC BY 3.0), and the Bricolage Grotesque font by Mathieu Triay (SIL Open Font License 1.1).
