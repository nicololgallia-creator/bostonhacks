# PLAN

Only the plan owner's lead edits this file.

## Event

- **Name, place, date:** BostonHacks 2026, BU George Sherman Union, Metcalf Ballroom. Hacking 10:30 AM Sat 21 Nov to Devpost deadline 9:00 AM Sun 22 Nov (24 hours).
- **Theme and rules** (word for word, with source): tracks and rules in `notes/hacker-guide.md` (organisers' guide, downloaded 2026-11-21). Summary in `notes/START HERE.md`.
- **Judges:** not announced in the guide. Judges walk to tables by track.
- **Pitch length:** 3 minutes, demo inside it, then 1 minute of questions. Science fair at our table. Plus a 1-minute video on Devpost.
- **Judging criteria** (word for word): Idea Impact & Relevance; Problem Understanding & User Fit; Technical Implementation; Design; Presentation. Full wording in `notes/START HERE.md`.
- **Team:** (people, and which tools each one has)
- **Plan owner:**
- **Lead runs in:** (Claude Code or Antigravity, and on which laptop)
- **Required tools or sponsor prizes:**
- **Scored tools:** (any tool the criteria score by name, and the visible feature built in it from the first hour)

## Look

Asked at kickoff, so taste is not learned one critique at a time.

- **References** (one or two apps or sites the plan owner likes, and what to take from each):
- **Brand rules** (whose logos we may use, which version, what size; required colours):

## Preflight

Done in the first 15 minutes, before any card starts.

- [ ] `node tools/preflight.mjs` passes (paste the command used):
- [ ] Each outside service tested with its exact feature (service, feature, result):
- [ ] Account limits checked (database projects left, AI quota, domain name free):
- [ ] First deploy live at (short URL):
- [ ] Every teammate opened the project and ran `node tools/shot.mjs` once:

## Clock

| Time | What |
|---|---|
| Sat 10:30 AM | Build starts (idea locked by 11:30, before Intro to Claude Code) |
| Sat 12:30 PM | Real MBTA data on screen |
| Sat 2:00 PM | Checkpoint 1: one real screen, Nicolo's yes |
| Sat 6:30 PM | Checkpoint 2: wow moment works end to end (dinner) |
| Sun 12:00 AM | Checkpoint 3: whole demo path works on the deploy. Doors lock 2:00 AM |
| Sun 4:30 AM | Feature freeze (20% of 22.5 h left). Three runs by hand on real devices |
| Sun 7:00 AM | Code freeze, deploy, QR code, 1-minute video recorded |
| Sun 8:15 AM | Devpost shows Submitted, repo public |
| Sun 8:15 AM | Pitch rehearsal (3 min + 1 min questions), timed |
| Sun 9:00 to 9:30 AM | Judging at our table |

## The idea

- **One line:**
- **For:**
- **The problem, with a sourced number** (from research.md):
- **Why it wins** against the judging criteria:
- **Wow moment** (what a judge sees and can touch in the first 20 seconds, something they cannot do today; working by checkpoint 2):

## AI output

Only when the product has an AI feature.

- **Golden sample** (approved by the plan owner, with the time): `qa/golden/`
- **Cases:** `qa/ai-cases.json` (how many, and the last `ai-check` result with the time):

## Demo path

Five steps at most. Each step is something the judge sees.

1.
2.
3.
4.
5.

## Stack

- **App:**
- **Dev server:** command `` on port ``
- **Test student:** `qa/student.json` (the browser storage of a signed-in user, for `--as`)
- **Deploy:** `node tools/deploy.mjs --dir <app folder> --url <short URL>`

## Data shapes

The exact JSON each route returns. Frontend builds against these. Backend returns exactly these.

## Fake on purpose

## Cut

## Cards

| id | owner | runs on (person, tool) | files it may touch | build | done-check | box | status |
|---|---|---|---|---|---|---|---|
