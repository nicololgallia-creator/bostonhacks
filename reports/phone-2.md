# phone-2, card P2 (the remote: tell it your stop, get songs that fit, start)

Sat 21 Nov 2026. Matched the pilot (`shots/D1-390-2-seats.png`, `-3-seated.png`) with tokens and `DESIGN.md` only. I had no skill tool, so I followed `DESIGN.md`, `reports/designer.md` and the numbered short version of `notes/My design taste.md` by hand.

## Done
- `src/phone/ride.js` (new): the whole flow, one step at a time, Back on every step. Where are you (search over `listStops()`, last stop offered first, up to five matches with a count when there are more), Waiting or riding, Which train (live, refreshes every 20 s, says how old the answer is, keeps the last answer when the network drops), train mode (line and direction, then where you get off in route order, then `rideSeconds`), Your set (`pickSongs`, buffer 20 platform and 30 train, Start), "Just pick songs" (library, tap to add in order, tap again to remove). Too-close and ride-failed states offer the next train or picking by hand.
- `src/phone/ride.css` (new): rows, line dots, Back, sticky foot, order circles. Only tokens.
- `src/phone/main.js`: three small edits. "Pick the music" button in the free space under the pads when seated and `status` is `lobby`; the flow owns the screen while open; it closes when the stage leaves the lobby.
- `src/phone/mock.js`: the fake stage answers `start` with a real-shaped State (countdown, song, queue, transit) and the same refusal sentences as the real session, then returns to the lobby after 6 s.
- `src/mbta/api.js` + `api.test.js`: `stopsOnRoute(routeId, directionId = 0)`, stations in trip order (Red's branches listed one after the other), with a stubbed test and one live assertion.
- `src/tokens.css` + `DESIGN.md`: six line tokens (red, orange, blue, green, mattapan, orange-ink) and a "Rows" paragraph. Line colours come from the MBTA API's own `color` field.

## How I checked
- `node --test src/mbta/api.test.js src/songs`: 5 of 6 pass, 1 skipped (live). With `MBTA_LIVE=1` and the key in the environment: all 5 pass (125 stations, Kenmore trains, Kenmore to Park Street 642 s, Green B order).
- Puppeteer walks against `/?mock=1` with live MBTA data: Kenmore platform path, Kenmore to Park Street train path, by-hand path, a train forced to 25 s away (too close, then "Use the next train" gives "1 min 35 s until your train. These two songs end as it arrives."), offline stations (error and Try again), no match, trains offline (kept 6 rows, "Showing the answer from 23 s ago"), ride failing offline (own words, Back returns to the stop list), Start from every path.
- Real stage: `stage.html?feet=mouse` open in one page, the phone on `/` in another, a `ws` client watching: by-hand Start gave `countdown` with `mary-lamb` and the queue; the platform Start at Park Street gave `countdown` with `transit {stop "Park Street", mode "platform", endsAt}`. Stop returned the lobby and the button came back. No console errors (the only errors in the offline runs are the browser's own "internet disconnected" lines).
- `node tools/phone-check.mjs "http://localhost:5173/?mock=1"`: PASS at 390 and 360. Own overflow check on every step at 360: no sideways scroll on any. `npm.cmd run build`: passes.
- Shots (390x844 at scale 1, so 900 px or less): `shots/phone-2-0-seated-music.png`, `-1-stop-empty.png`, `-1-stop-typed.png`, `-1-stop-last.png`, `-2-mode.png`, `-3a-trains.png`, `-3b-lines.png`, `-3c-dest.png`, `-4-set-platform.png`, `-4b-too-close.png`, `-4-set-train.png`, `-6-songs-empty.png`, `-6-songs-picked.png`, `-5-after-start.png`. 360 wide: `phone-2-360-stop-offline.png`, `-stop-nomatch.png`, `-stop-park.png`, `-trains-offline.png`, `-ride-failed.png`, `-set-train.png`, `-songs.png`. 1440: `phone-2-1440-trains.png`. Opened: every 390 shot except -1-stop-empty, -6-songs-empty, and the 360 -stop-nomatch, -mode, -trains, -songs, which I did not open (their text and widths were read from the page). -5-after-start and -0-seated-music were opened after a fix: an empty free-space row had collapsed and stretched Change seat and Leave.

## Not done
- A refused Start on the real stage was not seen on screen. The mock refuses only without a seat or songs, and the real stage always has the seat. Code path: the button comes back after 3 s and `main.js` shows the stage's `notice` in the status line, which the pilot already tests.
- A real phone and real mobile network: not tried. Keyboard covering the search results on a phone is unseen.
- 360x640 and 375x667: the seated page scrolls about 60 px because the new button takes the free space. "Pick the music" is on screen; Change seat and Leave are just below. At 390x844 nothing scrolls.

## Needs from others
- Lead: the MBTA key is a `VITE_` variable, so Vite puts it in every built bundle and phones send it from the browser. `dist/` and `.env.local` are git-ignored. Fine for a hackathon key; do not reuse it.
- Stage owner: `endsAt` on a train ride is now plus the ride's length at the moment Start is tapped (see Calls). If the floor wants the MBTA's own arrival time instead, say so.
- Songs owner: a Green-line station lists B, C, D and E dots from `listStops()`, but live Kenmore data sometimes returns an E train (Heath Street) the station list does not name. Nothing to fix here.

## Calls I made
- On the train, `endsAt` is the moment Start is tapped plus `rideSeconds`, and `stop` is where you get off. The songs fit the ride length, so the train clock and the songs end together. Using the arrival time of the next trip would end the songs minutes early if that train has not yet left.
- `stopsOnRoute` takes an optional direction (default 0), because route order flips by direction. It returns station ids (parent stations), so they work with `rideSeconds`. Only stops after your own stop are offered as where to get off.
- The stop search shows five matches, says "Showing 5 of N", and shows only the last stop when empty: listing 125 stations would scroll forever.
- Line dots carry the branch letter (B, C, D, E; R, O, B, M) so blue on near-black is not the only clue.
- Platform set recomputes every second and redraws only when the songs that fit change, so the list never changes under a finger without cause.
- `summary` in `mock.js` repeats a one-line helper in `session.js`, which is not mine to export from.
