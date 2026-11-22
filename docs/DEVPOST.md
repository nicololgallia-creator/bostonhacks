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

TODO, for the Spark entry only. Say what the $1,000 adds, and check every price before writing it. Starting ideas:
- A brighter short-throw projector mounted overhead, so the picture is bigger and players do not shadow their own tiles.
- A depth camera, so tracking does not depend on light.
- A permanent install in the Spark! lab with no setup, starting in the lobby screen.

## Image gallery

Devpost shows these on the project page. TODO: take each one and add it.
- [ ] The floor mid-song, with real feet on the tiles
- [ ] The phone: picking your line and seats
- [ ] The phone: "Fit my train" with live arrivals
- [ ] Results on the floor and on the phone
- [ ] The gear set up: camera, projector, and laptop

## Credits to include

From `CREDITS.md`: Salamander Grand Piano V3 by Alexander Holm (CC BY 3.0), and the Bricolage Grotesque font by Mathieu Triay (SIL Open Font License 1.1).
