# songs-2 report (card S2)

**Done:**
- `tools/midi-to-song.mjs`: `node tools/midi-to-song.mjs <file.mid> --id <id> --title "<title>" --by "<artist, year>" [--track <n>] [--from <sec>] [--to <sec>]`. Writes `songs/<id>.json` in the Song shape and adds the import line and the name in the `songs` list of `src/songs/index.js` (once, even if run twice). Uses `@tonejs/midi`.
- With no `--track` it prints every track (number, notes, lowest-highest pitch, name and instrument) and the likeliest melody with the reason (highest average pitch among pitched tracks with at least a quarter of the busiest track's notes). With only the file (no `--id`, `--title`, `--by`) it prints that and writes nothing.
- Melody: highest note when several share a beat, moved by one common whole-octave shift into midi 48 to 84 (outliers folded), then the weaker of two notes under 0.4 s apart is dropped (the one off the beat; on a tie the longer note stays). The grid is the coarsest of quarter, eighth, triplet, sixteenth, sixth, thirty-second that every note start sits on, from the file's tempo, so `bpm` is the file's tempo times the grid.
- Backing: every other track, pitched notes as they are, drums as `kick` (kick, toms), `snare`, `hat` (hats, cymbals, everything else). Same beat and same sound is written once.
- `qa/midi/greensleeves.mid` (Mutopia, public domain, source in `qa/midi/SOURCE.txt`) and `songs/greensleeves.json`, listed in `src/songs/index.js`. 58 melody notes (14 dropped), 218 backing notes, bpm 300, 38.8 s.
- `tools/midi-to-song.test.mjs`: 13 tests (real file, melody pick, highest note, octave shift, 0.4 s drop both ways, `--from/--to`, drums, no backing key, grid, bad input, the command twice, list-only mode, Windows line endings).

**How I checked:**
- `node --test tools/midi-to-song.test.mjs src/songs/songs.test.js`: 26 tests, 26 pass. `Greensleeves: 38.8 s` printed by songs.test.js.
- Good input: `node tools/midi-to-song.mjs qa/midi/greensleeves.mid --id greensleeves --title "Greensleeves" --by "Traditional English melody, 16th century"` printed the track table, `Melody: track 0 has the highest average pitch (midi 71) ...` and `Wrote songs/greensleeves.json: 58 melody notes (14 dropped ...), 218 backing notes, bpm 300, 38.8 s. Listed in src/songs/index.js.` The first notes are A, C, D, E (69, 72, 74, 76), the tune's opening.
- Bad input, each exit 1 with a plain line: `Error: There is no file at qa/midi/nope.mid. Check the path.` / `Error: That file is not a MIDI file. Pick a .mid file.` / `Error: The id "greensleeves" is already used by songs/greensleeves.json. Pick another --id, or delete that file first.` / `Error: Track 2 has no notes. Pick another --track or widen --from and --to.` The tests also cover a bad id (`../evil`), missing `--title`/`--by`, a bad `--track`, `--from` after `--to`, and an unknown option.
- Browser: with a puppeteer page on `stage.html?feet=mouse`, `import("/src/songs/index.js")` gives 12 songs and Greensleeves with 58 notes and 218 backing. The only console error is the `/favicon.ico` 404, which the page had before. No UI, so no screenshots or phone check. `ai-check` does not apply (no AI, no matcher).

**Not done:**
- Greensleeves loses its passing notes. At the file's tempo an eighth is 0.2 s, so the 0.4 s rule removes 14 notes (the F in "E F E", for example). The tune is still right. If a song needs all its notes, a slow-down option (`--slow 2`) would do it; I did not add it because the card did not ask.
- Only the first tempo of the file is used. A piece that speeds up or slows down is placed correctly in time (times come from seconds) but its `bpm` is the first tempo.
- Stage and phone do not play `backing` yet: `src/stage/main.js` only imports twinkle. That is the audio card (A1).

**Needs from others:**
- Lead: the card named only the import line, but the song also has to be in the `songs` array in `src/songs/index.js` or `songById` cannot find it, so the tool edits both. Nothing else in index.js changes.
- Whoever picks songs for the stage (stage/phone cards): `songs` now has 12 entries and Greensleeves carries `backing`.

**Calls I made:**
- Picked Greensleeves (Mutopia piece 1265, "Public Domain" on its page, checked today). It has a melody hand and an accompaniment hand, so both parts of the tool are tested on a real file. Mutopia has no drum files, so drum mapping is tested on a MIDI built in memory.
- `--id` must be lowercase letters, numbers and dashes and start with a letter, because it becomes a file name and a JavaScript name. A clashing name in index.js is refused.
- A file over 5 MB is refused ("too large to read as a song").
- Beat 0 is the first note of the section (melody or backing), so `--from` songs start at once.
- Re-running with an id whose file exists is refused, as the card says; to redo a song delete its JSON file first (the index line stays and is not added twice).
- Files written without a byte-order mark, so tools in the repo read them cleanly.
