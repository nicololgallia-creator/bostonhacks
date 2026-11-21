# Research for the Platform Piano pitch

Written 2026-11-21. Card R1. Every fact has a link and the date of its source. Numbers are copied as the source states them. Anything I could not confirm is marked UNCONFIRMED.

## The one number the pitch should say, and its baseline

**On 2026-01-28 the Red Line had 9 trains in service. A typical rush hour has 20.**

- Source: Streetsblog Mass, Christian MilNeil, 6:22 PM EST, 2026-01-28, "The Red Line's old trains can't cope with the cold": https://mass.streetsblog.org/2026/01/28/the-red-lines-old-trains-cant-cope-with-the-cold
- Source's words: "the T only had 9 trains in service on the entire Red Line" and "In a typical rush hour, there are 20 trains running." The page credits real-time train location data from TransitMatters (my search summary said so; the page text I read did not quote the credit, so check before saying "TransitMatters data" out loud).
- Baseline to put beside it: 20 trains in a typical rush hour. Say "9, not 20".
- Same article: the MBTA warned of "delays of up to 30 minutes" and said it would "maintain a service delivery schedule of 15 minutes between trains". The article does not give measured rider waits.

Honest warning for the pitch: on a normal weekday the scheduled gaps are short (see Fact 1). Do not claim riders wait a long time every day. The story is the bad days, the Green Line, evenings, and not knowing.

## Three facts that prove the problem is real

### Fact 1. The T's own schedule: 8 to 10 minutes between Green Line trains at Kenmore in the morning peak, and bad days break it
- Scheduled departures at Kenmore, Green Line D, toward the west, 7:00 to 9:00 AM on Monday 2026-11-23. Gaps of 8 to 10 minutes (13 gaps, mean 8.85 by my count from the list). Source: MBTA V3 API, retrieved 2026-11-21: https://api-v3.mbta.com/schedules?filter[route]=Green-D&filter[stop]=place-kencl&filter[direction_id]=0&filter[date]=2026-11-23&filter[min_time]=07:00&filter[max_time]=09:00&sort=departure_time
- For contrast, Red Line toward Alewife at Park Street, same morning window: gaps of 4 to 5 minutes (26 gaps). Same API, route Red, stop place-pktrm. Red Line late evening (9 PM to midnight): gaps of 4 to 7 minutes.
- These are scheduled departures, not measured waits. The mean figures are my arithmetic on the API list, not a number the MBTA publishes.
- Why it matters: the pitch can say the wait is real on the Green Line (the line past BU and Kenmore), and that the app reads exactly this feed.

### Fact 2. Wait pain in riders' own words, and it is about the wait and not knowing
- r/mbta thread "List the biggest problems you have with the MBTA", 113 comments, 2026-03-09. Waiting too long between trains was the most common complaint in my hand count of about 70 comments (about 12). One thread, not a survey: https://reddit.com/r/mbta/comments/1rpeqjm/list_the_biggest_problems_you_have_with_the_mbta/
- Quote, 38 upvotes: "Commuter rail frequencies are a joke. 30 minutes or better is “commuter” rail." Quote on the Green Line: "The wait, stops, and slow speeds are killing me."
- Source for both: `notes/research-riders.md`, written 2026-11-21 (the hand count is the earlier researcher's, not mine).
- UNCONFIRMED: no MBTA rider survey with wait numbers found. Do not cite New York MTA surveys as Boston.

### Fact 3. Weekday ridership is back above 1 million, so millions of waits a week
- Boston Globe, "MBTA ridership one million October", published about 2026-11-19 (the page shows no date; the URL path says 2026/11/19, and the text says officials "announced Thursday"): average weekday ridership "surpassed 1 million passenger trips in October." It was the highest since February 2020, when the MBTA "averaged more than 1.2 million weekday riders." https://www.bostonglobe.com/2026/11/19/metro/mbta-ridership-one-million-october/
- This is the whole MBTA (all modes), not subway only. UNCONFIRMED: an exact subway-only weekday figure. The MBTA's ridership dashboard (https://www.mbta.com/ridership) holds it but is interactive and I could not read it. Someone with a browser can read it in a minute.
- Earlier datapoint, WGBH, 2025-12-18: "weekday ridership is at 73% of 2019 levels" (MBTA COO Ryan Coholan). https://www.wgbh.org/news/local/2025-12-18/t-says-weekend-ridership-is-nearly-back-to-2019-levels
- Do not combine the two numbers. They are from different dates and measures.

## What waiting feels like (the science behind the idea)

- **Perceived wait is longer than real wait, and information shortens it.** Watkins, Ferris, Borning, Rutherford, Layton, "Where Is My Bus? Impact of mobile real-time information on the perceived and actual wait time of transit riders", Transportation Research Part A, vol. 45(8), pages 839-848, 2011. Riders without real-time information judged their waits longer than they were. Riders with it did not. Per the IDEAS abstract summary, real-time users' perceived wait was about 2.4 minutes shorter, and they waited nearly 2 minutes less. https://ideas.repec.org/a/eee/transa/v45y2011i8p839-848.html . Solidity: peer-reviewed, Seattle buses, 2011. Other web summaries quote different sizes (13% and 30%), so say "shorter", not a percent, unless someone reads the paper. This supports the phone half of our idea: showing the live arrival time.
- **Occupied time feels shorter than unoccupied time.** David Maister, "The Psychology of Waiting Lines", 1985, in The Service Encounter (Czepiel, Solomon, Surprenant, eds.), pages 113 to 123. First proposition: "Occupied Time Feels Shorter Than Unoccupied Time." A wait that ends under the quoted estimate feels good, and one that runs past it feels worse. Index: https://davidmaister.com/?p=747 . Solidity: a widely taught essay of service-business observations, not a controlled experiment. I read it through secondary summaries (university textbook chapter https://uen.pressbooks.pub/servicesmgt/chapter/chapter-12-the-psychology-of-waiting/ and search results), not the original text. UNCONFIRMED: the exact wording.
- **Use in the pitch:** "A wait with something to do feels shorter, and a wait with a known end feels shorter. We give you both." Do not give a minutes-saved number for our own game. Nobody has measured it.

## The Stockholm piano stairs, 2009

- Volkswagen Sweden and DDB Stockholm turned the stairs at Odenplan metro station, next to an escalator, into a piano in October 2009 (part of the "Fun Theory" campaign). Awarded Gold at Cannes Lions, entry listed "PIANO STAIRCASE", DDB Stockholm, Volkswagen Sweden, 2010: https://www.lovethework.com/work-awards/entries/93366
- The result usually quoted is 66% more people took the stairs than usual. I could not find it on a Volkswagen or DDB primary page or in the Cannes entry text I read. It appears in press coverage, for example Laughing Squid and Good: https://laughingsquid.com/the-fun-theory-volkswagen-turns-stairs-into-giant-piano-creates-worlds-deepest-trash-can/ and https://good.is/articles/the-fun-theory-musical-stairs-inspire-healthy-behavior
- How solid: weak. It is an advertiser's own number from a one-day test with a typical-day baseline, no published sample size, and a novelty effect is not ruled out (an educational write-up calls it "far from definitive"). UNCONFIRMED against a primary source.
- How to use it: say "Stockholm showed people will play a piano with their feet in a transit station, and the campaign reported 66% more people took the stairs." Always add "the campaign reported". Never present it as a study.

## Three existing floor games and what each lacks

| Product | What it is | What it lacks beside ours |
|---|---|---|
| **EyeClick BEAM** | A commercial projector that turns a floor into a motion game. Library has Blitz (smash falling bombs), Potato Rebellion, Drums. Some games take up to 12 players. Vendor says systems start at $5,796. https://eyeclick.com/projectors/beam-interactive-projector and https://eyeclick.com/games/floor-games (retrieved 2026-11-21; all numbers are vendor claims) | Sold for family entertainment centers, schools, clinics, senior care. No train clock, not made for a platform, fixed install, and games are short loops with no end tied to anything real. UNCONFIRMED: vendor's "more than 15,000 locations". |
| **MIT 6.111 "Piano Dance Revolution" (Spring 2006)** | Student project (Liang, Li, Meyer, Tian). Piano projected on the floor, played by stepping. Play, record and a DDR-style game mode. Two cameras at ground level. https://web.mit.edu/6.111/www/s2006/PROJECT/14/main.html | A lab demo on custom hardware. No live data, no song that fits a wait, nothing built to move to a public platform. |
| **MIT 6.111 "Projected Floor Piano" (2017, Team 09)** | Student proposal (Cohen, Flanagan, Klawans). Fixed-size 1.5 octave piano on the floor, played by foot, with distance sensors. https://fpga.mit.edu/videos/2017/team09/abstract.pdf | Same gaps: a classroom build, one fixed size, no live data, no extra players adding keys. |

- Also relevant: the Stockholm piano stairs (above) is a fixed hardware install on one staircase, not a game, with no song and no clock.
- I found no documented projected floor game on a subway platform that is tied to a live arrival time. A 2016 Singapore student concept proposed platform games for waiting time and noted frequent trains leave little time, which is the same risk as our Red Line numbers: https://oss.adm.ntu.edu.sg/n1602337a/2016/10/ (search summary; page not opened). This is "none found", not "none exist". Say "we found none".
- What is new in ours, all three at once: song length tied to the live train clock, built to carry onto a platform with a projector and a camera, and strangers share one keyboard so a newcomer makes it fuller.

## Who has the problem

- People waiting on an MBTA subway platform, alone or next to strangers, with the longest and least certain waits on the Green Line, in evenings, and on disruption days. Students at BU and nearby colleges ride the Green Line B, C and D. The r/mbta evidence is thin on students (see `notes/research-riders.md`).
- Only 5 of 246 riders in a 2016 Vancouver reader poll chat with strangers (https://buzzer.translink.ca/2016/10/fun-poll-wrap-up-most-riders-spend-their-time-on-transit-listening-to-music , self-selected poll, 2016-10-21). Shared play has to be optional and easy to walk away from.

## Existing apps that try to solve the dead wait, and what each misses

These are from `notes/research-riders.md` (2026-11-21) and the facts above, not new searches.

1. **Transit and Google Maps (live arrival apps).** They cut the not-knowing. Watkins 2011 supports that. They give the number and nothing to do while it counts down.
2. **Ekimemo / Station Memories! (Japan).** Collect-a-station game, 4th highest grossing location game in Japan in 2023 (https://automaton-media.com/en/wp-json/wp/v2/posts/26953). Runs on the phone and GPS, which users report fails in tunnels. Solo, on a screen, not tied to a train arrival.
3. **MTA Away "Subway Bingo" (NYC, 2022-11-01 to 2022-11-30).** Top-down card game from the agency. Rider reaction was mixed, no participation numbers (https://mta.info/press-release/mta-away-unveils-subway-bingo-game). Phone or paper, solo, and it reads as a distraction from service problems.

The biggest gap: none of them puts the game in the physical space where strangers stand together, and none ends exactly when the train arrives.

## Opening line for the pitch

"On January 28 the Red Line ran 9 trains where a rush hour needs 20, and everyone on those platforms had nothing to do but stare at a tunnel."

Backup line if the judge wants it short: "The T makes you wait. We make the wait a song, and it ends when your train pulls in."

## What I could not confirm

- Measured rider waits (not scheduled gaps) for any line. TransitMatters' dashboard (https://dashboard.transitmatters.org) is the place; my searches did not surface a median wait.
- A subway-only weekday ridership number.
- A Volkswagen or DDB primary source for the 66% figure.
- The original text of Maister (1985).
- That the 9-trains figure is TransitMatters data, from the page text I read.
