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

- **Sat 8:00 PM, Nicolo**, a change log after playing on the real floor. His words, each one a rule:
  1. "add a 1v1 mode which you can select where people don't get the exact same tiles but get the exact same NUMBER OF tiles and the same max score if they get perfect and their scores above their head." And at 8:10 PM: "make the 1v1 feature via having people pick team or dual mode. then when you enter your amoutn of players, it will be 1v1, 1v1v1, or 1v1v1v1." So: the player picks **Team** or **Duel** (in code `mode: "team" | "versus"`). Duel with 2, 3 or 4 players reads "1v1", "1v1v1", "1v1v1v1". In a duel every player has their own tiles, the same count, the same kinds in the same order, the same top score, and their own score drawn at their own pad.
  2. "the hold notes must reset your foot because right now you can just hold your foot the whole time." A hold starts only when a foot lands. A foot that never left does not start it.
  3. "tiles should have more variety, be longer, and split between the people more because sometimes you got 10 seconds without tiles, it should be tiles back and forth in team mode." No player waits more than about 4 s while the song has music. In team mode the tune passes from player to player in short runs.
  4. "background track should be playing while the game is being played, just the main notes must get tapped on." The backing plays from the first beat to the last whether or not anyone hits. Tiles are only the main tune.
  5. "on the app there should be an option for which of the 4 available seats are playing and any one you click gets added to the game as a player." The phone always shows four seats. Tapping one adds that seat as a player.
  6. "before the 3,2,1 there should be a calibration that shows up for each player to make sure that each one is specifically calibrated for the game." A warm-up before every first countdown: each player taps, the floor shows it saw them, and the tracker sets itself to that player.
  7. (8:25 PM and 9:00 PM) "please add a QR code reader to the main landing page of T Tiles phone app." And: "when you log into the game, you get a QR scanner welcoming you and asking you to scan any T Tiles qrs near by. for the demo, we scan that one QR code which takes you to our selected line. we are pretending that QR is in one in a train." The app opened with no code is a welcome with a live scanner. A T Tiles code carries the room, the line and the car. The demo path: open the bare address, scan one printed poster, land on that line's stop picker. Only our own values are ever taken from a scanned code.
  8. (9:05 PM) "also please add a web app icon." The conductor is the icon (done 7 PM, `public/icons/`, `public/manifest.webmanifest`): keep it, and the app's name under it is T Tiles.
  9. (8:45 PM, his answer to the builder's limit) "why can a tile only go to one player?" and "is it possible to add more animations to the floor? like streaks, scores on the floor, etc?" In a duel a quiet stretch may give two players a tile at the same moment, so nobody waits over 4 s. The floor gets hit points that fly to the score, streak heat at 10, 25 and 50, a streak-break beat, a hold trail, a whole-floor flash on everyone-at-once tiles, and a pulse when a duel's lead changes: each one short, each meaning one thing.
  The name is **TTiles**, one word (9:15 PM, relayed by Nicolo's other Claude session: "please change the name everywhere to TTiles"; at 8:25 PM he had written it "T Tiles"). Write it TTiles in everything a person sees, including anything drawn on the floor or the poster. The live phone page is https://platform-piano.vercel.app until a domain truly resolves: `ttiles.com` belongs to someone else, and `ttiles.us` is attached to the Vercel project but was still unregistered at GoDaddy at 8:50 PM, so it does not answer. Do not point any QR code at a domain that has not been checked with a real request.
- **Sat 6:25 PM, Nicolo**, after the first run on the real floor: "the feet are like backwards. The one that lights up on the ground is not the same as the one that lights up on the screen... our projection needs to be flipped 180 degrees because it's being held up on the other end of the person, not from their back. It's aiming at them from the front. Keep that in mind when you move forward." And: "the tracking system... moves pretty slowly." Rules: (1) **The projector and the camera stand across the aisle, facing the players.** The floor picture is turned half way round so it reads from the players' side, and the seats mirror: the camera's left is the players' right. One saved switch holds this, `src/facing.js` (`isFacing()`, key T on the stage, `?facing=1`). Any code that maps camera to pad, or draws for the floor, asks it. (2) Everything drawn on the floor is designed for a person sitting at the foot-zone edge looking across it. The laptop screen is the operator's view and may be upside down. (3) Tracking speed is a feature: any change to the tracker reports frames a second and tap-to-flash delay on the real camera, not headless.
- **Sat 6:00 PM, Nicolo:** "use pastels for the colors please... they look too harsh so pastels will be better." Colours are pastels with near-black ink (`#141413`) for text and outlines: Red and Mattapan `#E7685E`, Orange `#F3AA45`, Blue `#5B86D3`, Green `#4FAF79`, gold `#FFDB62`, cap blue `#57679B` (changed at 6:10 PM: "maybe a little too pastelly, just a nice mix betwen the too", so these sit half way between the full MBTA colour and a pastel). The full-strength MBTA colour appears only in the small round line badge. The mascot is `public/mascot/conductor.svg`, picked by Nicolo: never redraw or recolour it.
- **Sat 5:40 PM, Nicolo**, on the second look pilot: the drawn jellyfish "looks very ai sloppy, please make him in claude design"; a "weird black banner"; "that black dot gets covered by the green line"; "there are lots of visual bugs with things glitching around, weird elements, etc. a lot when you leave the tab and come back. also the songs should have their real album covers, not AI generated elements". Rules: (1) builders do not draw the mascot or any character: it comes from the lead's Claude Design canvas, as a file. (2) Songs show their real cover art, fetched when the page runs, never a drawn icon. (3) Every screen is checked after the tab was hidden and shown again, after a resize, and after a data refresh, before it is called done: nothing may move, double or stop half-way. (4) No element whose purpose a stranger cannot name. (5) Station dots draw above the line.
- **Sat 5:25 PM, Nicolo:** "1 player gets two note lanes (one per foot), 2 players get 2 note lanes (one note per person), 3 players get 3 lanes (one note per person), 4 players get 4 lanes (one per person) that way we dont have to cut the song up amongst 8 notes and have it get boring for people." This replaces "2 lanes a pad always". **A lone player has 2 lanes, one for each foot. With two, three or four players, each player has ONE lane, and either foot plays it.** The song is spread over 2, 2, 3 or 4 lanes in all.
- **Sat 5:05 PM, Nicolo**, on the first screen of the new look (white, one violet, chunky buttons): "it needs the mascot, more dynamic views, icons for songs, train themes, the color should be the color of the line youre on, but this is a great start. you did really take exactly themes from duolingo so maybe dont copy exactly but this is a great direction. its just not giving train vibes. you can take INSPIRATION from here: https://bostonhacks.org/". For every phone screen from now on: the hero colour is the colour of the line the player is on; the graphic language is a transit map (thick lines, station dots), tickets and departure boards; the jellyfish conductor is on it and alive; every song has its own icon; each screen is its own composition; and nothing is lifted from Duolingo (no uppercase button with a darker bottom edge, no violet, no confetti).
- **Sat 4:15 PM, Nicolo:** "the whole app needs to come way more alive... we need brighter colors and more minimalist sleek designs like we usually go for. it looks right now like a roblox game. it should look like duolingo made a train piano tiles." The dark neon look is rejected for the phone and the floor. His whiteboard gives the new flow: see "Wave 5" in PLAN.md.
- **Sat 3:45 PM, Nicolo:** "please remove the eyes from the train cars, i took back my opinion on them", then, on the lead's attempt to paint the faces out in code: "painted out is not the move, it looks really bad and you can see the old outlines please re do the front ends." The trains have **no faces**: a plain front with a windshield and headlights. Art that is wrong gets made again properly. Never patch, paint over or redraw part of a generated picture in code.
- **Sat 2:45 PM, Nicolo**, with a picture of a cute cartoon train game as "an art style reference": "there should be a train chugging animation zooming off when loading in... cute generated trains where you pick your track, when you pick... it chuggs along on the track and you move forward to picking your car etc... they should be modeled off of the actual trains." The phone gets a cute illustrated look for where-you-are: a train chugs off as the app opens, each line is a cute train modeled on that line's real MBTA train, and picking one sends it chugging down its track into the car step. The reference is a feel, never art to copy: our trains are our own drawings. No train art is built until Nicolo has said yes to one pilot train. A mascot and a name are parked.
- **Sat 2:38 PM, Nicolo:** "youll have to pick the line, rail, etc. not just the car you know?" On the phone, where you are is picked in order: your line, your car, your section, then your seats. The line is real (the MBTA's subway lines) and is reused by "Fit my train". The car and section are the sample picker.
- **Sat 2:30 PM, Nicolo:** "what is this youre up stuff? thats not how it works. each foot gets its own tile and you guys play a song all together. its not like one at a time... you can click the seat that youre sitting in and it will project it on the floor. you can pick your own seat and song. if you pick 2 or 3 seats, you are controlling for everyone, no need for team codes and everything." This replaces every earlier line about turns, phrases, names and joining. (1) **Everyone plays at the same time, the whole song.** No turns, no resting, no "you're up". The song's notes are spread across all the feet in play like one long keyboard. (2) **Each seat's pad has 2 lanes, one for each foot.** (3) **One phone can take several seats** and controls the game for all of them. (4) **No names, no join screen, no codes.** Seats are known by number and colour, and are Open, Taken or Yours.
- **Sat 1:48 PM, Nicolo:** "we won't be able to do all sections tonight. That's pretty much just for the sample... even if it's like kind of a fake section picker and in reality, only a few of the seats are available that's fine." This replaces rule (1) of the 1:40 PM line where they disagree: the phone shows a map of a car with several sections, **one of them is the real one** (ours, with its real seats) and the others are sample sections that cannot be entered and say so plainly. No routing between sections is built. This is the one allowed exception to "no dead buttons".
- **Sat 1:40 PM, Nicolo:** "it's pretty much going to be a map by the section that you're sitting in where you pick your seats... other people could pick their seat on the same app and their section of their car and then it would project right where they are as well... you're only picking the seats that you want to play and then it'll split the parts based on who's playing." Three rules from it. (1) A stage is one **section** of a car, and the phone shows a map of sections and the seats in yours. (2) Players in a section **share one song, split into parts**: nobody gets the same tiles as their partner. (3) Picking music offers two equal choices: pick your own song from the library, or the songs that fit your stop and your train.
- **Sat 12:12 PM, Nicolo:** "i feel like youre underestimating this whole software... this is a REAL LARGE application." Each player picks a seat on their phone, that seat is tracked, and the projector draws their pad exactly at their feet. Read `docs/HOW-IT-WORKS.md` before any card. Build every card as one part of a large system: follow the shapes in PLAN.md to the letter so the parts fit, and where "Seats and session" disagrees with an older section, "Seats and session" wins.
- **Sat 12:04 PM, Nicolo:** "we need this application to be stellar." The game is played on the ground with feet and must feel like a real rhythm game: you tap the square when the tile arrives (standing on it does not count), some tiles are held down, hits build combos, the songs are real songs, and every hit gives feedback you can see and hear. The phone is only the remote that commands the floor. Build each card to that bar. "It works" is not the bar.

