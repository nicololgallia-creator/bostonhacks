# songs-1 report (card S1)

**Done:**
- 10 new songs in `songs/` (mary-lamb, row-boat, happy-birthday, london-bridge, frere-jacques, saints, fur-elise, jingle-bells, ode-to-joy, ship-never-returned). With twinkle that is 11, from 21 s to 115 s.
- `src/songs/index.js`: exports `songs` (shortest first, uses `songSeconds` from `src/game/engine.js`) and `songById(id)`. Static JSON imports with `with { type: "json" }`, so it loads in Node and in Vite (checked at `localhost:5173/src/songs/index.js`).
- `src/songs/pick.js`: `pickSongs({ seconds, buffer = 20 })`, tries every combination, deterministic. `totalSeconds` includes the 4 s per song. A non-number wait throws "The wait must be a number of seconds."
- `src/songs/songs.test.js` (every file, plus a check that `index.js` lists every file) and `src/songs/pick.test.js` (6 tests, all five from the card plus bad input).

**How I checked:** `node --test src/songs/songs.test.js src/songs/pick.test.js`: 18 tests, 18 pass. Lengths printed: Mary 21.3 s, Row Boat 22.2, Happy Birthday 22.2, London Bridge 26.8, Twinkle 28.8, Frere Jacques 29.5, Fur Elise 42.0, Saints 42.0, Jingle Bells 59.1, Ode to Joy 59.1, Ship That Never Returned 115.2. Closest notes start 0.43 s apart (Fur Elise), 0.46 s in most others. No UI, so no screenshots. `ai-check` does not apply (no AI, no matcher).

**Not done:**
- Skipped Yankee Doodle, Oh! Susanna, The Entertainer. I was not sure of them note for note and found no source I trusted. A wrong tune is worse than none.
- Fur Elise is only the opening, with the repeat. Jingle Bells is the chorus twice (I am not sure of the verse).

**Needs from others:** nothing. Adding a song later means one file in `songs/` and one import line in `src/songs/index.js`; the test fails if the line is missing.

**Calls I made:**
- Sources. Ship That Never Returned, When the Saints, and the Fur Elise right hand were checked against ABC transcriptions found on abcnotation.com (the Ship one is John Chambers's transcription of the 1865 original; Saints matched two independent files; Mary matched a third). The rest are from memory and sit in a five-finger range that confirms the pitches. Please have someone who knows the tunes listen to Jingle Bells, Ode to Joy, London Bridge and Happy Birthday once.
- The Ship's second G in the chorus pickup and in "E G# G# B d" follows the ABC rule that a sharp holds to the bar line, which also makes an E7 chord.
- Happy Birthday: public domain (Hill sisters, 1893, as Good Morning to All; copyright claim on the song was thrown out in 2016). I simplified its dotted first two notes to even eighths. Drop it if you want zero doubt.
- Tempo: `beat` is the smallest note (an eighth, or a sixteenth in Fur Elise), so `bpm` is 130 or 140 and the real beat is slow. Ship is 100 so it lasts about 2 minutes.
- `totalSeconds` counts the 4 s extra per song, because that is what the wait pays for. Not rounded, so the phone should round it.
- Titles keep their accents (Frère Jacques, Für Elise); the Für Elise title says "(opening)", Jingle Bells says "(chorus)".
- The converter I used to make the JSON from ABC stayed in my scratch folder, not in the repo.
