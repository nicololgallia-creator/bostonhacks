# music: the backing under every song

## What I found (before any change)

1. **12 of 17 songs had no backing at all.** Only Greensleeves, Sweet Caroline, Dirty Water, More Than a Feeling and Shipping Up to Boston had one. The demo plays Twinkle first, and Twinkle had none. So on the floor, Twinkle was silent unless a tile was hit. That is why "the background did not carry the song".
2. **The five that had a backing were not too quiet. They were too loud.** I rendered them with the old synth (backing alone against one hit note, same units as below): the hit sat 1.9 dB above the backing in Greensleeves and 0.9 to 3.8 dB below it in the other four. A hit did not stand out from the backing. My first guess (backing 17 dB under a hit) was wrong; sustained notes add up.
3. **When it plays.** `main.js` calls `synth.backing` every frame from the countdown to the end of the song, with the song clock. It does not depend on hits. It survives pause and resume (`stopAll` on pause, the scan starts again on resume and skips what is already past), skip, and the next song in a queue. It does not thin out on misses. Two real gaps: (a) a backing starts at beat 0, and the clock starts 5.5 s before that, so the lead-in was silent; (b) the scan after a resume skips any note that began more than 200 ms ago, so a bass note held across a pause is not restarted (up to one note of thinner sound after resume, measured as none audible in the counts below).
4. **Sound could be silent for a whole game.** `AudioContext` is only made on a key press or click on the laptop (`unlock()`). A game started from a phone with no touch on the laptop left `ctx` empty, so every call returned at once, and nothing said so. The only warning was "Click once for sound" in the lobby, and only while the page had never been clicked.

### Songs before and after

Longest silence = the longest stretch from beat 0 to the end of the tune where nothing in the backing sounds (before: from the entries' starts, ringing counted up to 3 s).

| song | entries before | entries after | longest silence before | after |
| --- | --- | --- | --- | --- |
| twinkle | 0 | 196 | whole song, 29 s | 0.0 s |
| mary-lamb | 0 | 132 | 21 s | 0.0 s |
| row-boat | 0 | 164 | 22 s | 0.0 s |
| happy-birthday | 0 | 100 | 22 s | 0.0 s |
| london-bridge | 0 | 148 | 27 s | 0.0 s |
| frere-jacques | 0 | 164 | 30 s | 0.0 s |
| saints | 0 | 257 | 42 s | 0.0 s |
| fur-elise | 0 | 201 | 42 s | 0.0 s |
| take-me-out-to-the-ball-game | 0 | 316 | 43 s | 0.0 s |
| jingle-bells | 0 | 324 | 59 s | 0.0 s |
| ode-to-joy | 0 | 324 | 59 s | 0.0 s |
| ship-never-returned | 0 | 484 | 115 s | 0.0 s |
| greensleeves | 218 (no drums) | 416 (198 drums) | 0.4 s | 0.1 s |
| sweet-caroline | 750 | 754 | 0.3 s | 0.3 s |
| dirty-water | 964 | 1000 | 0.7 s (3.4 s with no pitched note) | 0.3 s |
| more-than-a-feeling | 402 | 406 | 0.4 s | 0.4 s |
| shipping-up-to-boston | 280 | 292 | 1.6 s | 0.3 s |

After = 4 count-in clicks plus the music. The five MIDI songs keep their own arrangement. `midi-to-song.mjs` does bring bass, chords and drums in (it takes every track but the melody); it dropped nothing, so I left it alone. Not changed there: it does not add the count-in, because `midi-to-song.test.mjs` pins the exact backing and is not mine. Run `node tools/make-backing.mjs <id>` after an import.

### Levels (tools/sound-check.mjs, all 17 songs, 20 s each: 3 s of lead-in then 17 s of song, no hits)

Backing = RMS of the backing alone from beat 0; +guide = backing with the tune played quietly; hit = RMS of the first 0.5 s of one piano note (mean of C4 and C5). All in dBFS after the compressor. The target gap is 6 to 9 dB; the check fails outside 5 to 10.

| song | backing | +guide | hit | hit minus (backing+guide) | quietest second | peak with every hit on top |
| --- | --- | --- | --- | --- | --- | --- |
| twinkle | -37.1 | -36.8 | -29.9 | 6.8 | -38.5 | 0.448 |
| mary-lamb | -37.1 | -36.9 | -29.9 | 7.0 | -38.9 | 0.441 |
| row-boat | -37.4 | -37.3 | -29.9 | 7.4 | -38.2 | 0.449 |
| happy-birthday | -36.8 | -36.9 | -29.9 | 7.0 | -38.2 | 0.341 |
| london-bridge | -37.4 | -37.4 | -29.9 | 7.4 | -38.7 | 0.440 |
| frere-jacques | -37.3 | -37.1 | -29.9 | 7.2 | -38.4 | 0.443 |
| saints | -37.4 | -37.1 | -29.9 | 7.2 | -39.1 | 0.435 |
| fur-elise | -37.2 | -37.3 | -29.9 | 7.4 | -38.1 | 0.429 |
| take-me-out-to-the-ball-game | -37.5 | -37.4 | -29.9 | 7.5 | -38.3 | 0.421 |
| jingle-bells | -37.2 | -37.0 | -29.9 | 7.1 | -38.4 | 0.460 |
| ode-to-joy | -37.3 | -37.1 | -29.9 | 7.2 | -38.4 | 0.471 |
| ship-never-returned | -37.0 | -37.1 | -29.9 | 7.2 | -40.5 | 0.458 |
| greensleeves | -37.7 | -37.8 | -29.9 | 7.8 | -39.0 | 0.421 |
| sweet-caroline | -38.1 | -38.0 | -29.9 | 8.1 | -40.2 | 0.428 |
| dirty-water | -39.0 | -38.9 | -29.9 | 9.0 | -42.1 | 0.440 |
| more-than-a-feeling | -37.6 | -37.6 | -29.9 | 7.7 | -42.6 | 0.315 |
| shipping-up-to-boston | -38.6 | -38.2 | -29.9 | 8.3 | -42.3 | 0.449 |

Before (old synth, five songs that had a backing, hit minus backing): greensleeves +1.9, sweet-caroline -1.9, dirty-water -1.4, more-than-a-feeling -3.8, shipping-up-to-boston -0.9. The other 12 were silent. Nothing clips: the highest peak with all hits on top is 0.471.

## What I built

- **`src/game/synth.js`**
  - `backing(song, songMs)` now also plays the tune quietly (the guide), schedules negative-beat entries (the count-in), and does nothing while the browser keeps sound off (so a late unlock never dumps a pile of old notes).
  - Each song's backing is set to the same distance under a hit. `density()` counts weighted entries a second over the first 20 s; the backing's dB tracks `10*log10(density) - 32.3` within 1 dB on all 17 songs, so `backBus = BACK_GAIN * LOUD / sqrt(density)`. A thick MIDI arrangement and a thin bass-and-chord one end up 7 to 9 dB under a hit.
  - `GUIDE_LEVEL = 0.4` (share of a backing note; `0` turns the guide off). `createSynth({ guide })` overrides it for a check.
  - New: `locked()`, `scheduled()` (counts for scripted checks), `note(midi, when)` (optional start time), drum kinds `click` and `tick`. A song with no `notes` no longer throws.
  - `stopAll()` keeps the song's loudness (it used to reset the backing bus to a fixed gain).
- **`tools/make-backing.mjs`** (new). Per song a line in `SONGS` (pulse, bar, start of the first bar, and `key` only for Mary Lamb and Jingle Bells, whose melodies lean on E but end on C). From the melody it finds the key (Krumhansl profiles), picks one chord per half bar or bar from I, IV, V, ii, iii, vi (minor: i, iv, V, III, VI, VII) by fit to the notes with a pull towards plain moves, then writes bass on the strong pulses (root, fifth on the third pulse, root in the last bar), chords as close voicings under the tune, and kick, snare and hat in the metre (4/4, 3/4, 6/8 and 3/8 handled). It adds four count-in clicks at -4 to -1 pulses. Modes: `make: true` (whole backing), `"drums"` (Greensleeves: keep the Mutopia notes, add 6/8 drums), `"fill"` (Dirty Water, Shipping Up: keep the MIDI, add bass and chords only where it has a hole over 1.2 s), `false` (count-in only). It rewrites only the `backing` list in the text of each file. Re-run it after a melody changes: `node tools/make-backing.mjs` (all) or with song ids; `--dry` prints without writing.
- **`tools/make-backing.test.mjs`** (new, 18 tests): every song file has a line in SONGS and back; each has a count-in, a bass line, drums, at most 1,500 entries and no silence over 1.5 s; the key finder; the last bass note is the root; `setBacking` changes nothing else.
- **`songs/*.json`**: only the `backing` list. `notes`, `id`, `title`, `by`, `bpm` untouched.
- **`tools/sound-check.mjs`** (extended): each sound alone (as before, plus the count-in), then all 17 songs for 20 s with no hits and with every melody note as a hit, the table above, and WAV files. Fails when a second is silent, the gap leaves 5 to 10 dB, a count-in is missing, or anything clips. Runs in about a minute; needs the dev server on 5173.
- **`tools/music-check.mjs`** (new): the scripted run on the built copy (below).
- **`src/stage/main.js`**, audio lines only, all marked `AUDIO (music)`: lines 13 and 14 (two imports: `splitParts`, `backingLeft`), 64 (`window.synth = synth`, for the scripted check), 144 to 157 (the `backedSong` block: the song handed to the synth is `{ ...song, backing: backingLeft(song, splitParts(song, seats, { mode })) }`, built once per song and again when the song clock goes back), 253 (the `synth.backing` call uses it), 262 (`soundLocked: synth.locked()` added to the object passed to `draw`).

### The melody guide: recommendation and why

**On, quiet (`GUIDE_LEVEL = 0.4`, which puts the guide about as loud as the quiet part of the backing).** A missed tile then leaves no hole in the tune, a stranger on the platform can name the song from the first bar, and a hit still stands out because the hit is 7 to 9 dB over the whole bed and the guide is a small part of it. The cost: when a hit lands a little early or late, you hear the same pitch twice, quietly; the hit is far louder, so it reads as the player's note. If the team hears that as messy, set `GUIDE_LEVEL = 0` and everything else still works (the backing alone is already measured at the same level).

## How I checked

- `node tools/sound-check.mjs` on the dev server: exit 0, all 17 songs ok (table above).
- `npm.cmd test`: 513 pass, 2 fail, 1 skipped, 1 todo. The 2 failures are the `calibration:` tests in `src/track/taps.test.js` (the tracker builder's file, changing right now); my tests (`tools/make-backing.test.mjs`, 18) and `tools/midi-to-song.test.mjs` pass. `npm.cmd run build` from PowerShell: passes.
- `node tools/music-check.mjs` against the built copy on :4173 (page `stage.html?seats=2&demo=1&autostart=1&facing=0`, no mouse, so no foot is ever on a tile; every tile is missed). It reads `window.synth.scheduled()` once a second through two songs and a pause. Output pasted at the end.
- The floor message itself is not mine to draw; `locked()` is verified by the same script (true before the first key, false after one key press, and nothing is queued while locked).

## Not checked

Nobody listened. Please play these three files (in `shots/`), 20 seconds each, and listen for ten seconds:

- `music-twinkle-backing.wav` (no hits): four clicks, then bass, a chord on the off beats, kick and snare underneath the tune played softly. Listen for: is it a steady band you could tap along to, or does it sound busy or cheap? Is the snare too sharp for a nursery tune?
- `music-twinkle-with-hits.wav`: the same plus every note hit perfectly. Listen for: do the hit notes stand clearly on top, with the same note quietly underneath? Is the double note annoying?
- `music-greensleeves-backing.wav` and `music-greensleeves-with-hits.wav`: Mutopia's own accompaniment plus a 6/8 drum pattern I added. Listen for: do the drums fit a slow folk tune or fight it?
- `music-sweet-caroline-backing.wav`: the busiest MIDI arrangement. Listen for: is it clear, or a wall of sound, and is the count-in audible before it?

Also not checked: real speakers in the train car (the levels are relative to one hit note, not an absolute volume: the whole thing is quiet unless the phone's volume setting is up); the chord choices by ear (plain by design, but I cannot hear them, so a wrong-sounding chord in one bar of a song is possible; the key and the first bars are checked only by the numbers); the 3 s of nothing before the count-in on slow songs (fast songs click in the last second of the countdown only).

## Needs from others

- **Floor builder** (`src/game/floor-screens.js`, `tiles.js`): `draw` now gets `soundLocked` (true while the browser keeps sound off). Draw a message nobody can miss on every screen, not only the lobby, for example a full-width strip across the foot-zone edge reading "Sound is off. Press any key on the laptop." in large text, shown while `soundLocked` is true and a song is live (and in the lobby). The stage already unlocks on any key or click (`main.js` `keydown` and `pointerdown`), so the strip goes away by itself. Today's "Click once for sound" in the lobby is drawn from `navigator.userActivation`, which says nothing about whether the audio context is running; `soundLocked` replaces it.
- **Session owner** (optional): `main.js` rebuilds the split with `splitParts(song, view.pads.length, { mode: snap.mode })` to know which backing notes became tiles. It matches today. If the session ever splits another way (more seats than pads, another option), expose its `parts` in `view` and `backedSong` can use them directly.
- **Whoever owns `src/songs/*.json` melodies**: after any change to `notes`, run `node tools/make-backing.mjs <id>` so the chords follow the new tune. Notes and the backing sit in the same files; the tool changes only the `backing` list.
- **Hit loudness**: one hit is quiet in absolute terms (peak 0.2). If the floor is too quiet in a room, raise `HIT_PEAK` and `BACK_PEAK` together in `synth.js`, or the phone's volume.

## Calls I made

- The count-in is four clicks one pulse apart ending at beat 0, stored as negative-beat entries in each song's `backing`. A slow song starts clicking earlier than the end of the countdown; a fast one only in the last second of it. I did not fill the whole 3 s countdown.
- Level is set per song by a measured density rule, not one constant, because one constant left the thick MIDI songs 4 dB louder than the hand-made ones.
- `songs/*.json` `backing` entries use only `beat`, `midi`, `beats`, `drum`. Drum kinds `click` and `tick` are new.
- `HOLD_MS` is 500 in the engine now (lead's note); nothing in the backing depends on it.

## music-check output

`node tools/music-check.mjs` (built copy, about 3.5 minutes, exit 0):

```
ok   before any key: locked true, backing scheduled 0 (silent, says so, queues nothing)
ok   after one key press: sound is unlocked
ok   paused for 4 s: backing scheduled stayed at 61 (nothing new while the song is frozen)
ok   3 s after resume: 61 -> 85 (the backing carries on)
ok   first song (twinkle): 197 backing entries scheduled, its file gives 196; tune notes 43 of 42
ok   second song (greensleeves): 416 backing entries scheduled, its file gives 416; tune notes 58 of 58
ok   sweet caroline: 739 backing entries scheduled; its backing holds 754, 13 of them became tiles, so 741 are left
ok   sweet caroline: 36 tune notes scheduled (its file has 36)
ok   no page errors
```

The scheduled count for Sweet Caroline (739) is smaller than its backing (754) by the tiles that came from the backing (13), less 2 entries at the very start. The tile count moves as the rules builder changes the chart, so rebuild before running the check. Twinkle shows 197 instead of 196 and 43 tune notes instead of 42: a pause starts the scan again and re-schedules the entry that was due at that moment.
