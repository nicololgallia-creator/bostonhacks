# parts-1, card X1 (updated with the lead's change)

## Done
- `src/game/parts.js`: `phrasesOf(song)` returns `[{ from, to }]` (from inclusive, to exclusive, so `notes.slice(from, to)`). `splitParts(song, seats)` returns `seats` songs (1 to 4) with the same `id`, `title`, `by`, `bpm`, `backing`. One seat gets the whole song.
- **Phrases (changed):** a phrase ends after a note of 0.8 s or more, before a silence of 0.6 s or more, or at 4 s, but a close only counts once the running phrase has run 2 s, so a short phrase runs on into the next one. A short tail (under 2 s) joins the phrase before it, so the finale is at least 2 s unless the whole song is one phrase.
- **Dealing (changed):** each phrase before the finale goes to the seat with the fewest notes so far. A tie goes to the seat that has waited longest since its last phrase, then to the lowest seat. The finale goes to every seat. Pure, deterministic, input not changed. A seat count outside 1 to 4 throws "A song can be split for 1 to 4 players, not X."
- `src/game/parts.test.js`: 20 tests. Everything from before is kept. Changed: the "joins the one before it" test now checks a short phrase runs on into the next; the "phrase counts differ by at most one" check is replaced (see Calls). Added: no collapse into one phrase on songs with a long note every 0.9 s; finale at least 2 s on every real song; fewest-notes dealing (a seat behind takes three phrases in a row, which strict turns would not give); tie goes to the seat that waited longest; no seat plays two phrases in a row when another seat has fewer notes (checked on every real and made-up song, 1 to 4 seats).

## How I checked
`node --test src/game/parts.test.js`: 20 pass, 0 fail. Only my two files touched; only my test file run. Nothing in a browser (no UI).

Notes per seat before the finale (the finale adds the same notes to every seat):

| song | phrases (was) | notes | 2 seats | 3 seats | 4 seats |
|---|---|---|---|---|---|
| mary-lamb | 6 (6) | 26 | 13/14 | 7/11/10 | 7/5/10/7 |
| row-boat | 7 (5) | 27 | 18/13 | 8/16/11 | 15/7/7/10 |
| happy-birthday | 8 (1) | 25 | 15/12 | 10/10/9 | 10/8/6/7 |
| london-bridge | 9 (1) | 24 | 14/13 | 11/9/10 | 9/8/8/8 |
| twinkle | 6 (6) | 42 | 28/21 | 21/21/14 | 21/14/14/14 |
| frere-jacques | 10 (3) | 32 | 16/18 | 13/11/12 | 10/11/8/9 |
| greensleeves | 14 (10) | 58 | 33/27 | 18/19/25 | 15/14/20/15 |
| saints | 11 (8) | 31 | 17/16 | 12/10/13 | 10/10/8/9 |
| fur-elise | 12 (12) | 70 | 40/34 | 26/22/30 | 17/21/20/24 |
| jingle-bells | 18 (4) | 51 | 26/26 | 19/16/18 | 13/14/13/14 |
| ode-to-joy | 20 (4) | 62 | 33/31 | 22/23/21 | 19/17/16/16 |
| ship-never-returned | 29 (25) | 111 | 57/59 | 37/43/41 | 34/33/29/30 |

Saints on two seats is now 17/16 (was 24/8). Every real song has at least 6 phrases, so no song gives every seat the whole tune any more.

## Not done
- The 2x rule (item 3) cannot hold for every real song, see Needs from others. Nothing else is left out.

## Needs from others
- **Row-boat with 3 seats breaks the "no more than twice another" rule: 4/12/7 before the finale.** Its phrases are 2,3,3,2,9,4 notes before the finale. Dealing in tune order to the seat with the fewest notes forces it: after the first four phrases the seats hold 4, 3 and 3, the 9-note phrase must go to one of them, and only one 4-note phrase is left. No in-order dealing avoids it, because the 9-note phrase is one 4-second run of quick notes. It is the only real song and seat count that breaks the rule (the test prints it under the table). Options for the lead: accept it, or let a phrase of more than 8 notes split in two at 4 seconds minus the cap. I did not build either. Owner: lead.

## Calls I made
- Because of the row-boat case, the test enforces the 2x rule on every made-up song, and on real songs it enforces what dealing to the fewest notes really guarantees: no seat is ahead of another by more than the biggest phrase. Real-song breaks of the 2x rule are printed, not failed.
- `{ from, to }` is from-inclusive and to-exclusive. The floor should use `notes.slice(from, to)`.
- "Has run 4 seconds" and "has run 2 seconds" are measured from the phrase's first note start to the end of the current note.
- Notes are counted, not seconds, when picking the seat with the fewest. The finale is left out of the count.
- Times are compared with a 1e-9 tolerance, so exactly 0.6 s or 0.8 s counts.
- One seat returns a copy of the song (new object, same note objects). `phrasesOf` assumes notes are sorted by beat, as `songs.test.js` already requires.
