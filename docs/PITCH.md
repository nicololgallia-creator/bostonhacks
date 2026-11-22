# T Tiles: 3-minute pitch

BostonHacks · Transit Gamification. Nicolo and Zohayb Riaz.

Slides: https://claude.ai/artifact/JBUiUtYEJ7MfD6TKDcrEW9 (private until shared from the deck's Share menu)

Speaker times add up to 3:00.

| # | Slide | Time |
|---|---|---|
| 1 | Cover | 0:10 |
| 2 | The problem | 0:20 |
| 3 | The challenge | 0:08 |
| 4 | Our solution | 0:25 |
| 5 | How it works | 0:25 |
| 6 | The twist | 0:15 |
| 7 | Why it works | 0:20 |
| 8 | Live demo | 0:30 |
| 9 | Under the hood | 0:20 |
| 10 | Close | 0:07 |

## 1. Cover (0:10)

**On screen:** T Tiles. Piano tiles on the floor of your train car. Your feet are the fingers.

**Say:** Hi, we're Nicolo and Zohayb, and this is T Tiles: piano tiles projected on the floor of a train car, where your feet are the fingers.

## 2. The problem (0:20)

**On screen:** 1M+ trips on the MBTA every weekday. Most of them are just time to get through.
- Locals: same platform, same wait, same car. Heads down, earbuds in.
- Tourists: the ride is a passive gap between the places they came to see.
- The car: strangers share one of Boston's biggest spaces and never connect.

Source: Boston Globe, 19 Nov 2026 (all modes, October average weekday).

**Say:** The MBTA just passed a million trips a weekday. And most of those trips are dead time. Locals put their heads down and wait. Tourists sit through a gap between the places they came to see. And a car full of strangers, one of the biggest shared spaces in Boston, never connects.

## 3. The challenge (0:08)

**On screen:** What if your ride was the best part of the trip?

**Say:** The challenge asked how to turn a dreaded T ride into something people look forward to. We asked: what if the ride itself was the best part of the trip?

## 4. Our solution (0:25)

**On screen:** T Tiles turns the train floor into a rhythm game. A projector puts a lane of tiles at each rider's feet. When a tile hits the line, lift a foot and land it on the beat, and the piano plays the note. Up to four riders play one song together, right from their seats. Your phone is the remote. No app, no controller.

**Say:** Think piano tiles, but the screen is the train floor and your feet are the fingers. A projector across the aisle puts a lane of tiles in front of each seat. One camera watches your shoes. Lift a foot, land it on the beat, and the note plays. Up to four riders play one song together, sitting down. The phone is just the remote.

## 5. How it works (0:25)

**On screen:** One ride, start to finish.
1. Scan: scan the poster in your car. The QR code already knows your line, direction and stop.
2. Pick your stop: "Where are you getting off?" One tap, and a song that fits your ride is ready.
3. Play: take a seat, tap Ready, and tiles slide to your feet after a 3, 2, 1 countdown.
4. Compare: the floor shows the team score and grades. Your phone shows the leaderboard.

**Say:** Here's one ride. You scan the poster in your car; the code already knows the line, direction and stop. The phone asks where you're getting off, and offers a song that fits. You take a seat, hit Ready, and after a 3-2-1 the tiles roll in. When the song ends, the floor shows your team score and each seat's grade, and your phone shows the leaderboard.

## 6. The twist (0:15)

**On screen:** The song ends when your ride does. Your ride, from live MBTA arrival predictions; the song we pick fills it, with a 20-second buffer. Sweet Caroline, Dirty Water, Shipping Up to Boston, More Than a Feeling, Take Me Out to the Ball Game, and 12 more.

**Say:** The song isn't random. We read the T's live arrival predictions for the time between your stop and your destination, and pick the song that fills the ride, with a 20-second buffer, so it ends as you pull in. And the set list is Boston: Sweet Caroline, Dirty Water, Shipping Up to Boston, plus 12 more.

## 7. Why it works (0:20)

**On screen:** Answering the challenge.

| The question | Our answer |
|---|---|
| More exciting? | The ride becomes a game with combos, Perfects, and a grade from S to C. |
| Memorable for tourists? | A Boston set list, timed to their stop, in a car full of strangers. |
| Community? | Up to four riders play one song together for one team score. |
| Accessible? | You play seated, with any phone and no app to install. |
| Why use it? | It is already in your car, and it fills your ride exactly. |

**Say:** Mapping to the guiding questions, fast: it's exciting because it's a real rhythm game with combos and grades. It's memorable for tourists: Boston songs, timed to their stop. It builds community: up to four strangers play one song for one team score. It's accessible: you play sitting down, on any phone, nothing to install. And people will use it because it's already in the car and it fits their ride exactly.

## 8. Live demo (0:30)

**On screen:** Take a seat. (Photo or recording of the lit floor with feet playing.)

**Do:** Switch to the live setup, or play the recording if the room is too bright or the Wi-Fi is shaky. Show one loop only: scan, pick a stop, take two seats, play a few bars, show the score. Leave a few seconds with no talking so the judges hear the piano.

## 9. Under the hood (0:20)

**On screen:** How we built it, and what we measured.

The setup:
- One camera across the aisle watches every seat's feet
- A pose model (CNN) runs on each seat's slice of the picture, offline
- A small projector draws the floor; a laptop runs the game
- Phones join by QR
- Live stops and arrival times from the MBTA V3 API

Measured:
- 66 / 71 real foot lifts read as taps, two seated players
- 0 false taps while the seats were resting
- 71.5 fps floor drawing with all four seats in play
- Under 10 s for a closed phone to free its seat for the next rider

Taps measured on recordings from our camera, not yet on a live train. Sources: `reports/taps-feet.md`, `reports/floor-real.md`, `qa/e2e/demo-path.mjs`.

**Say:** Under the hood: one camera across the aisle, a pose model per seat running offline, a pocket projector and a laptop. Phones join by QR, and the train data is the MBTA's live API. On recordings from our real camera, we read 66 of 71 foot lifts as taps, with zero false taps at rest, and the floor draws at over 70 frames a second.

## 10. Close (0:07)

**On screen:** Where your stop comes too soon. Next stop: a pilot on a real Green Line car.

**Say:** Next, we want to try it on a real Green Line car. This is T Tiles, where your stop comes too soon. Thank you!
