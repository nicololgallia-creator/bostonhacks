# audio-1, card A1

## Done
- `src/game/synth.js`: rewritten. `unlock`, `note`, `noteOn`, `thud` work as `src/stage/main.js` calls them. Added `load()` (a promise that never rejects), `setVolume(0..1)`, `backing(song, songMs)` and `stopAll()`. `createSynth({ context })` is new and optional; sound-check uses it with an offline context.
- Piano: 21 Salamander Grand Piano samples (C2 to C7, every minor third), 1.3 MB of mp3 in `public/sounds/piano/`. The nearest sample is re-pitched with `playbackRate`. `note` dies away in about 1.4 s; `noteOn` rings until stopped, then fades in about 150 ms. `unlock()` starts `load()`, so main.js needs no change to get the piano. Until it has loaded, or if any file fails, notes use the old oscillator tone and a plain warning is logged.
- Backing: `backing(song, songMs)` plays each `song.backing` entry once, 120 ms ahead of the clock it is given. Pitched entries are piano at low volume, held for their `beats`. `kick`, `snare`, `hat` are made in code. A clock that goes back resets it. An entry more than 200 ms behind the clock is skipped, not played late. No `backing` plays nothing.
- Mix: every voice goes through one compressor. Backing sits about 12 dB under a hit. `stopAll()` fades out everything playing or scheduled and restarts the backing.
- `tools/sound-check.mjs`, `CREDITS.md` (name, author, licence, where downloaded).

## How I checked
- `node tools/sound-check.mjs` (real synth.js in a headless page, offline render), exits 0:
  piano note 0.332, held note 0.307, thud 0.199, Greensleeves backing 4 bars 0.223, drums 0.405, four players hitting over backing 0.489, plain oscillator fallback 0.239. It also fails if a "did not load" warning appears.
- `stage.html?feet=mouse`, Space, six clicks, in a real browser: 21 of 21 samples fetched with 200, no errors except the known `/favicon.ico` 404 (two requests). With the sample requests blocked: 21 failures and the plain warning "The piano samples did not load (C2.mp3 gave HTTP 404). Notes use a plain synth tone until they do. ...", game still runs.
- `npm.cmd test`: 121 pass, 1 skipped, 0 fail. `npm.cmd run build`: passes, samples land in `dist/sounds/piano` (21 files).
- Not checked: by ear. I cannot hear. Nicolo should listen to a hit, a hold, a miss and Greensleeves backing, and say if the backing is too loud or quiet (the levels are the constants in `voice(...)`, `backBus.gain` and `drum`). No screenshots: the card has no screen.

## Not done
- No backing is audible in the game yet, because nothing calls `synth.backing` (see below). Greensleeves has no drum entries, so only the pitched backing and the inline drum test have been rendered.
- Loop and stretch for holds longer than a sample (about 5 to 10 s): the note simply dies away with the sample. Not asked for.

## Needs from others
- G5 (owner of `src/stage/main.js`): call `synth.load()` when the page opens (so the piano is ready before the first key press), call `synth.backing(song, songMs)` every frame with the game's song clock while playing, and call `synth.stopAll()` on pause, stop and restart. `setVolume` is for the phone's volume control. The shape is exactly as in the card.
- `main.js` plays `thud()` for every event that is not hit, holdStart or holdEnd (including any `perfect`-style event if one exists). Not mine to change.
- A favicon (known, no owner).

## Calls I made
- Samples come from the Tone.js copy of Salamander (https://tonejs.github.io/audio/salamander/), already trimmed mp3. The original is on archive.org (named in CREDITS.md).
- The old per-partial decays were replaced by one decay for the whole oscillator tone. It is only the fallback.
- `load()` retries on the next `unlock()` after a failure, so a flaky first load fixes itself on the next Space.
- Hit peak is 1.6 on the voice gain with the compressor after it, because the Salamander samples are quiet. The check shows the output at about 0.33 for one note and 0.49 for four plus backing.
