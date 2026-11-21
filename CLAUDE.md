# BostonHacks 2026 (BU, 21 to 22 November)

Read `notes/START HERE.md` first, then `notes/Hackathon playbook.md`. The `/hackathon` skill runs the build. Both folders are local only and stay out of git.

## Rules that can sink us
- 24 hours. Devpost is due **9:00 AM Sunday**, hard. It must show Submitted, not Draft.
- Everything is built inside the event. The repo is public by submission time.
- Devpost needs a 1-minute demo video, a summary, every team member and the repo link.
- Judging is 3 minutes of pitch plus 1 minute of questions at our table. Both of us must be there.
- Never commit keys or secrets. They live in `.env.local`, which is gitignored.
- Never commit `notes/` or `.claude/skills/`. They hold private notes and copied skills.
- Humans decide what leaves the machine. No spending and no paid sign-ups without a number said out loud.

## How we build
- Lead on Opus plans and checks. Builders are Sonnet, one card each, three at once at most.
- `git pull` first. Commit with named paths, never `git commit -a`.
- Screenshot every screen with `node tools/shot.mjs` and look at it before calling it done.
