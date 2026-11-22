// All the game's sound, made with the Web Audio API.
// Notes are a sampled grand piano (public/sounds/piano, see CREDITS.md). Until the samples have
// loaded, or if they fail, notes use a plain oscillator tone. Drums are made in code.
// Browsers keep sound off until a key press, so call unlock() from one. unlock() also starts load().
//
//   createSynth()                      -> the sound player for the page
//   createSynth({ context })           -> the same on a given AudioContext (sound-check uses an offline one)
//   createSynth({ context, guide })    -> the same with another GUIDE_LEVEL (sound-check compares 0 with the default)
//
// Every voice goes through one compressor, so four players hitting at once never clips.
//
// The backing is the song's own `backing` list (songs/*.json; negative beats are the count-in) plus, quietly, the tune itself
// (the guide), so a missed tile leaves no hole. It follows the song clock: nothing here depends on a hit.

const FIRST = 36; // midi of the lowest sample (C2)
const STEP = 3; // a sample every minor third
const COUNT = 21; // C2 up to C7
const DECAY = 1.4; // seconds a struck note takes to die away
const AHEAD_MS = 120; // backing looks this far ahead of the song clock
const LATE_MS = 200; // a backing note this far behind the clock is skipped, not played late
const HIT_PEAK = 1.6; // a hit note's voice gain
const BACK_PEAK = 0.9; // a backing note's voice gain, before BACK_GAIN
const BACK_GAIN = 0.5; // the backing bus; tools/sound-check.mjs measures backing against a hit (aim: hit 6 to 9 dB above)
const LOUD = 0.55; // sets how far under a hit the backing sits: backBus = BACK_GAIN * LOUD / sqrt(density), see density()
const WEIGHT = { kick: 1, snare: 1, hat: 0.1, click: 0, tick: 0 }; // what each drum adds to density; a pitched note adds 1
const GUIDE_LEVEL = 0.4; // the tune itself under the backing, as a share of a backing note. 0 turns the guide off
const NAMES = { 0: "C", 3: "Ds", 6: "Fs", 9: "A" };

const sampleName = (midi) => NAMES[midi % 12] + (Math.floor(midi / 12) - 1); // 36 -> "C2", 39 -> "Ds2"

export function createSynth({ context = null, guide = GUIDE_LEVEL } = {}) {
  let ctx = null;
  const scheduled = { backing: 0, guide: 0 }; // entries handed to the audio clock, for scripted checks
  let volume = 0.6;
  let master, bus, backBus; // master volume -> compressor -> speakers; bus holds every voice
  let buffers = null; // decoded samples, or null while the oscillator is used
  let loading = null;
  let noise = null;
  let song = null; // the song whose backing is being followed
  let list = []; // its backing, sorted by beat
  let next = 0; // index of the next backing entry to play
  let lastMs = -Infinity;
  let scale = 1; // this song's backing loudness, from density()

  function newBus() {
    bus = ctx.createGain();
    bus.connect(master);
    backBus = ctx.createGain();
    backBus.gain.value = BACK_GAIN * scale;
    backBus.connect(bus);
  }

  function init() {
    if (ctx) return;
    ctx = context || new AudioContext();
    master = ctx.createGain();
    master.gain.value = volume;
    const squash = ctx.createDynamicsCompressor();
    squash.threshold.value = -14;
    squash.knee.value = 10;
    squash.ratio.value = 12;
    squash.attack.value = 0.002;
    squash.release.value = 0.2;
    master.connect(squash).connect(ctx.destination);
    newBus();
  }

  // How loud a backing plays, measured: weighted entries a second over the first 20 s, with a note of the tune counting guide squared.
  // Backing level in dB runs 10 * log10(density) - 32.3, to within 1 dB on all 17 songs (tools/sound-check.mjs), so a thick
  // MIDI arrangement and a thin bass-and-chord one both end up the same distance under a hit.
  function density(entries, msPerBeat) {
    const end = Math.min(20, (entries.at(-1)?.beat * msPerBeat) / 1000);
    if (!(end > 0)) return 0;
    let sum = 0;
    for (const e of entries) if (e.beat >= 0 && (e.beat * msPerBeat) / 1000 <= end) sum += e.guide ? guide ** 2 : e.drum ? WEIGHT[e.drum] ?? 0 : 1;
    return sum / end;
  }

  function unlock() {
    init();
    if (ctx.state === "suspended") ctx.resume();
    load();
  }

  function load() {
    if (loading) return loading;
    init();
    loading = (async () => {
      try {
        buffers = await Promise.all(Array.from({ length: COUNT }, async (_, i) => {
          const name = sampleName(FIRST + i * STEP) + ".mp3";
          const res = await fetch("/sounds/piano/" + name);
          if (!res.ok) throw new Error(`${name} gave HTTP ${res.status}`);
          return ctx.decodeAudioData(await res.arrayBuffer());
        }));
      } catch (err) {
        buffers = null;
        loading = null; // the next load() tries again
        console.warn(`The piano samples did not load (${err.message}). Notes use a plain synth tone until they do. Check that public/sounds/piano has all ${COUNT} files.`);
      }
    })();
    return loading;
  }

  // One note. Starts at `when` (audio clock seconds). With `sustain` it rings until the returned
  // function is called, which fades it out in about 150 ms. Otherwise it dies away by itself.
  function voice(midi, peak, { when = ctx.currentTime, sustain = false, dest = bus } = {}) {
    const gain = ctx.createGain();
    gain.connect(dest);
    gain.gain.setValueAtTime(0, when);
    gain.gain.linearRampToValueAtTime(peak, when + 0.004);
    if (!sustain) gain.gain.exponentialRampToValueAtTime(0.001, when + DECAY);

    const sources = [];
    if (buffers) {
      const i = Math.min(COUNT - 1, Math.max(0, Math.round((midi - FIRST) / STEP)));
      const src = ctx.createBufferSource();
      src.buffer = buffers[i];
      src.playbackRate.value = 2 ** ((midi - (FIRST + i * STEP)) / 12);
      src.connect(gain);
      sources.push(src);
    } else {
      const hz = 440 * 2 ** ((midi - 69) / 12);
      for (const [mult, level, type] of [[1, 0.28, "triangle"], [2, 0.08, "sine"], [3, 0.03, "sine"]]) {
        const osc = ctx.createOscillator();
        const part = ctx.createGain();
        osc.type = type;
        osc.frequency.value = hz * mult;
        part.gain.value = level;
        osc.connect(part).connect(gain);
        sources.push(osc);
      }
    }
    sources.forEach((s) => {
      s.start(when);
      if (!sustain) s.stop(when + DECAY + 0.05);
    });
    return (at = ctx.currentTime) => {
      gain.gain.setTargetAtTime(0, at, 0.05);
      sources.forEach((s) => s.stop(at + 0.4));
    };
  }

  function drum(kind, when) {
    const gain = ctx.createGain();
    gain.connect(backBus);
    if (kind === "click" || kind === "tick") { // the count-in: "click" is the high first one
      const osc = ctx.createOscillator();
      osc.type = "triangle";
      osc.frequency.value = kind === "click" ? 1568 : 1046;
      gain.gain.setValueAtTime(0.6, when);
      gain.gain.exponentialRampToValueAtTime(0.0001, when + 0.06);
      osc.connect(gain);
      osc.start(when);
      osc.stop(when + 0.08);
      return;
    }
    if (kind === "kick") {
      const osc = ctx.createOscillator();
      osc.frequency.setValueAtTime(150, when);
      osc.frequency.exponentialRampToValueAtTime(45, when + 0.12);
      gain.gain.setValueAtTime(0.5, when);
      gain.gain.exponentialRampToValueAtTime(0.0001, when + 0.3);
      osc.connect(gain);
      osc.start(when);
      osc.stop(when + 0.35);
      return;
    }
    if (!noise) {
      noise = ctx.createBuffer(1, Math.round(ctx.sampleRate * 0.3), ctx.sampleRate);
      noise.getChannelData(0).forEach((_, i, d) => { d[i] = Math.random() * 2 - 1; });
    }
    const [cutoff, peak, decay] = kind === "snare" ? [1200, 0.4, 0.18] : [7000, 0.2, 0.05];
    const src = ctx.createBufferSource();
    const filter = ctx.createBiquadFilter();
    src.buffer = noise;
    filter.type = "highpass";
    filter.frequency.value = cutoff;
    gain.gain.setValueAtTime(peak, when);
    gain.gain.exponentialRampToValueAtTime(0.0001, when + decay);
    src.connect(filter).connect(gain);
    src.start(when);
    src.stop(when + decay + 0.05);
  }

  if (context) init(); // a given context needs no key press

  return {
    unlock,
    load,
    setVolume(v) {
      volume = Math.min(1, Math.max(0, v));
      if (ctx) master.gain.setTargetAtTime(volume, ctx.currentTime, 0.02);
    },
    note(midi, when = ctx?.currentTime) {
      if (ctx) voice(midi, HIT_PEAK, { when });
    },
    // True while the browser keeps sound off: no key or click yet, or the context is not running. The floor shows it.
    locked: () => !context && (!ctx || ctx.state !== "running"),
    scheduled: () => ({ ...scheduled }),
    // A note that rings until the returned function is called, for hold tiles.
    noteOn(midi) {
      return ctx ? voice(midi, 1.4, { sustain: true }) : () => {};
    },
    thud() {
      if (!ctx) return;
      const t = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.setValueAtTime(110, t);
      osc.frequency.exponentialRampToValueAtTime(45, t + 0.18);
      gain.gain.setValueAtTime(1.2, t);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
      osc.connect(gain).connect(bus);
      osc.start(t);
      osc.stop(t + 0.25);
    },
    // Call every frame with the game's own song clock (negative in the count-in). Plays each backing entry, and each
    // note of the tune at guide level, once as the clock passes it. A paused clock plays nothing new; a clock that jumps
    // back starts the backing over. While the browser keeps sound off it plays nothing and skips ahead, so a late unlock
    // never dumps a pile of old notes.
    backing(forSong, songMs) {
      if (!ctx || !forSong || (!context && ctx.state !== "running")) return;
      if (forSong !== song) {
        song = forSong;
        const tune = guide > 0 ? (forSong.notes ?? []).map((n) => ({ beat: n.beat, midi: n.midi, beats: n.beats, guide: true })) : [];
        list = [...(forSong.backing ?? []), ...tune].sort((a, b) => a.beat - b.beat);
        next = 0;
        const d = density(list, 60000 / forSong.bpm);
        scale = d > 0 ? Math.min(1.5, Math.max(0.1, LOUD / Math.sqrt(d))) : 1;
        backBus.gain.setValueAtTime(BACK_GAIN * scale, ctx.currentTime);
      }
      if (songMs < lastMs) next = 0;
      lastMs = songMs;
      const msPerBeat = 60000 / song.bpm;
      for (; next < list.length && list[next].beat * msPerBeat <= songMs + AHEAD_MS; next++) {
        const e = list[next];
        const startMs = e.beat * msPerBeat;
        if (startMs < songMs - LATE_MS) continue;
        const when = ctx.currentTime + Math.max(0, startMs - songMs) / 1000;
        scheduled[e.guide ? "guide" : "backing"]++;
        if (e.drum) drum(e.drum, when);
        else voice(e.midi, BACK_PEAK * (e.guide ? guide : 1), { when, sustain: true, dest: backBus })(when + (e.beats * msPerBeat) / 1000);
      }
    },
    // Fades out everything playing or scheduled, and starts the backing over. Call it on pause and on stop.
    stopAll() {
      if (!ctx) return;
      const old = bus;
      old.gain.setTargetAtTime(0, ctx.currentTime, 0.04);
      setTimeout(() => old.disconnect(), 500);
      newBus();
      next = 0;
      lastMs = -Infinity;
    },
  };
}
