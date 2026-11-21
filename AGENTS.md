# Team rules

Every agent on this team reads this file first and obeys all of it. Only the plan owner's lead edits it. The event, the schedule, the theme, the judges, and who owns the plan are in PLAN.md.

## The job

People run this team. The plan owner's main chat is the lead, on the strongest Claude model available (Opus). It plans and checks. Builders run on Sonnet and build one card each: as agents in Claude Code, or as their own conversations in Antigravity. There is only ever one lead, and PLAN.md says where it runs. Every other main chat, on a second laptop or in the other tool, is a lane lead that runs only the cards whose "runs on" column names it.

Winning means one thing: a judge watches the demo path work perfectly, it looks better than every other team's, and they understand why it matters in the first 20 seconds. Work that does not serve that does not get done.

## How our workflow goes

1. **Look first.** Before you write a line, read AGENTS.md, PLAN.md, your card, and every file you will touch. Never ask a question the files already answer.
2. **One card.** Your card in PLAN.md names your files, what to build, your done-check, and your time box. Do exactly that card. Nothing more.
3. **Pilot first.** The designer builds screen 1 for real and the plan owner looks at it before anyone builds screen 2. One screen a person has seen beats four nobody has.
4. **AI output gets a pilot too.** Before anyone tunes a prompt, the plan owner approves one real output of the AI feature, seen on the screen where it appears. That is the golden sample in `qa/golden/`. Its test cases live in `qa/ai-cases.json`, and every later prompt or matching change must pass `node tools/ai-check.mjs qa/ai-cases.json`.
5. **Real stack early.** Render the real app with fake data first. Connect real data after the screen works.
6. **Check your own work.** Open it in a browser, click every step, take screenshots, and look at them. Then report.
7. **Report, then stop.** Write `reports/<your-id>.md`, end your turn, and return a three-line summary.
8. **Critiques become rules.** When a person on the team corrects anything, the lead adds it to Critique rules at the bottom of this file. From then on every agent obeys it. A critique changes the one thing it names: show one real example of the change and get a yes before applying it everywhere.

## Ownership

- Edit only the files your card names. If you need a change in a file you do not own, write it under "Needs from others" in your report. Never make it yourself.
- The lead owns the shared files: `package.json`, the app entry and router, `PLAN.md`, `AGENTS.md`. The designer owns `tokens.css` and `DESIGN.md`.
- Builders never run git. On each laptop, only the main chat commits, and only its own cards' files, after a `git pull`.
- One dev server per laptop, with the command and port in PLAN.md. If it is down, start it with that exact command in the background. Never start a second one on another port.
- Install a package only when your card says so.
- Never leave the shared app broken. Build a big feature (a map, an editor, a new flow) in new files and wire it in at the end with one small change. If your half-done work stops the app compiling, or crashes a page you do not own, fix that before anything else.

## Build rules

- Before any UI work, use the high-end-visual-design and design-taste-frontend skills if your tool has them. If not, follow DESIGN.md.
- Use DESIGN.md and `tokens.css` only. No new colours, fonts, spacing values, radii, shadows or easing curves.
- Build exactly what the card asks. No bonus features, no placeholder sections, no "coming soon", no dead buttons.
- When told to remove something, remove it and put nothing in its place. Every link, button, and route that led to it goes too.
- Every screen on the demo path works at 390px wide and at 1440px wide. Tap targets at least 44px. Inputs at least 16px font, so iPhones do not zoom.
- No page ever scrolls sideways on a phone. Check every page you touched with `node tools/phone-check.mjs <url> --as qa/student.json`, which tests 390px and 360px as a signed-in user. Adding one link to a nav row is enough to break it, so check again after any change to a shared bar.
- Never cut text a person reads to a word or character count. A sentence cut in half is harder to read than a long one. When AI output is too long, ask for shorter and retry, or reject it and use the saved answer.
- Instructions a person follows are one action per step, in the order they must happen, each step complete on its own. Follow the source's own process and words for names of forms, buttons, and deadlines. Never merge two actions to make a list look shorter.
- Every error a user can see gives the real reason in plain words ("That calendar link did not work. Copy it again."). One vague line for every failure hides the fix. The server logs which step failed and the status code, never a secret, a private link, or a user's data.
- Anything that picks a topic from what a user typed (keywords, a matcher, a router) is tested with at least three phrasings per topic, plus one phrasing that must not match it. Put them in `qa/ai-cases.json`.
- A free tier, rate limit, or account limit is something you check before building on it. When a service fails or is full, say so in your report at once, with the exact error, and suggest the fallback.
- Real-looking content only. No lorem ipsum. Fake data uses believable names, prices, dates and numbers.
- Every number shown on screen or said in the pitch is true and sourced, or clearly labelled as demo data. Never invent a statistic, a user count, a quote, a review or a partner.
- Fix causes. When you find why a bug happens, search the project for the same cause and fix every instance in your files. List the rest under "Needs from others".
- Animation must be visible. Take two screenshots a moment apart. If nothing changed, the animation is not there.
- After you change anything a server runs, restart that server and reload before you check.
- Keep terminal output short. Pipe long installs and logs through `tail` or `Select-Object -Last 20`.
- On Windows, use `npm.cmd` and `npx.cmd`, because PowerShell often blocks plain `npm` and `npx`. Use `curl.exe`, not `curl`.
- Secrets go in `.env` only. Never print a key, never commit `.env`, never paste a key into code.
- Never connect anyone's personal or company accounts or databases. Use new keys made for this hackathon only.
- One file per job. Edit in place. No `-v2`, `-new`, `-old` or `.bak` copies.

## Screenshots

Use the project's tool, then open the PNG and look at it:

```
node tools/shot.mjs http://localhost:<port>/<page> shots/<your-id>-<page>-1440.png
node tools/shot.mjs http://localhost:<port>/<page> shots/<your-id>-<page>-390.png --mobile
```

Add `--full` for the whole page, `--theme dark` for dark mode, and `--as qa/student.json` to see a page as a signed-in user (the file holds the browser storage the app reads; the lead writes it at scaffold). It also lists console errors. In Antigravity, the built-in browser can click through and screenshot too. Save only into `shots/`. A screenshot you did not open does not count.

Two more checks, both quick:

```
node tools/phone-check.mjs http://localhost:<port>/<page> --as qa/student.json
node tools/ai-check.mjs qa/ai-cases.json
```

## Definition of done

A card is done only when all of these are true:

1. You ran the done-check in your card and it passed.
2. You took screenshots at 390px and 1440px, as a signed-in user where the page needs it, and looked at them.
3. `phone-check` passes on every page you touched.
4. If you touched an AI prompt, a matcher, or anything that shapes AI output, `ai-check` passes.
5. The console shows no errors on the demo path.
6. The build command passes.
7. Your report is written.

"Should work" is not done. Untested is not done. If one item fails, say which in your report.

## Report format

File: `reports/<your-id>.md`. Five lines per section at most.

- **Done:** what you built, file by file.
- **How I checked:** the exact commands and clicks, and the screenshot paths.
- **Not done:** what is missing and why.
- **Needs from others:** changes needed in files you do not own, with the owner.
- **Calls I made:** any choice PLAN.md did not cover, and why.

## Writing rules

These apply to every word a user, judge or teammate will read: UI text, the pitch, slides, the README.

- Short, plain sentences. Say what it does for the person using it.
- No em dashes. Use a comma, a full stop, or a colon.
- No "not X, but Y" lines. No "imagine a world". No "revolutionize", "seamless", "unlock", "leverage", "empower", "game-changer" or "cutting-edge".
- Always use the Oxford comma.
- Never repeat the same phrase across screens, slides or files.
- Say what the product is before listing what it does. A stranger must know what it is from one line.

## When you are stuck

- Two options and no rule covers it: pick the one closest to PLAN.md and easiest to undo. Write it under "Calls I made" and keep going.
- Blocked for more than 5 minutes: stop, write the blocker in your report, and end your turn. Do not thrash.

## Clock

The times are in PLAN.md under Clock. At every checkpoint the lead runs the whole demo path and commits. After feature freeze, only bugs that break the demo path get fixed. After code freeze, nothing changes but the deploy. If your card will overrun its time box, report at the end of the box with exactly what is left.

## Critique rules

The lead adds one line per correction, newest first, with the time. Every agent obeys every line.

- **Sat 1:48 PM, Nicolo:** "we won't be able to do all sections tonight. That's pretty much just for the sample... even if it's like kind of a fake section picker and in reality, only a few of the seats are available that's fine." This replaces rule (1) of the 1:40 PM line where they disagree: the phone shows a map of a car with several sections, **one of them is the real one** (ours, with its real seats) and the others are sample sections that cannot be entered and say so plainly. No routing between sections is built. This is the one allowed exception to "no dead buttons".
- **Sat 1:40 PM, Nicolo:** "it's pretty much going to be a map by the section that you're sitting in where you pick your seats... other people could pick their seat on the same app and their section of their car and then it would project right where they are as well... you're only picking the seats that you want to play and then it'll split the parts based on who's playing." Three rules from it. (1) A stage is one **section** of a car, and the phone shows a map of sections and the seats in yours. (2) Players in a section **share one song, split into parts**: nobody gets the same tiles as their partner. (3) Picking music offers two equal choices: pick your own song from the library, or the songs that fit your stop and your train.
- **Sat 12:12 PM, Nicolo:** "i feel like youre underestimating this whole software... this is a REAL LARGE application." Each player picks a seat on their phone, that seat is tracked, and the projector draws their pad exactly at their feet. Read `docs/HOW-IT-WORKS.md` before any card. Build every card as one part of a large system: follow the shapes in PLAN.md to the letter so the parts fit, and where "Seats and session" disagrees with an older section, "Seats and session" wins.
- **Sat 12:04 PM, Nicolo:** "we need this application to be stellar." The game is played on the ground with feet and must feel like a real rhythm game: you tap the square when the tile arrives (standing on it does not count), some tiles are held down, hits build combos, the songs are real songs, and every hit gives feedback you can see and hear. The phone is only the remote that commands the floor. Build each card to that bar. "It works" is not the bar.

