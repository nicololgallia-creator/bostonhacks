// Notes and misses made with the Web Audio API. No audio files.
// Browsers keep sound off until a key press, so call unlock() from one.
export function createSynth() {
  let ctx = null;
  let out = null;

  function unlock() {
    if (!ctx) {
      ctx = new AudioContext();
      out = ctx.createGain();
      out.gain.value = 0.6;
      out.connect(ctx.destination);
    }
    if (ctx.state === "suspended") ctx.resume();
  }

  // One partial of a piano-like tone: a quick attack, then a fall to silence.
  // With `sustain` it stays at a steady level instead, and the returned function fades it out.
  function partial(freq, peak, decay, type, sustain = false) {
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(peak, t + 0.008);
    if (!sustain) gain.gain.exponentialRampToValueAtTime(0.0001, t + decay);
    osc.connect(gain).connect(out);
    osc.start(t);
    if (!sustain) osc.stop(t + decay + 0.05);
    return () => {
      const end = ctx.currentTime;
      gain.gain.setTargetAtTime(0, end, 0.05);
      osc.stop(end + 0.4);
    };
  }

  const hz = (midi) => 440 * 2 ** ((midi - 69) / 12);

  return {
    unlock,
    note(midi) {
      if (!ctx) return;
      partial(hz(midi), 0.5, 1.1, "triangle");
      partial(hz(midi) * 2, 0.15, 0.6, "sine");
      partial(hz(midi) * 3, 0.06, 0.35, "sine");
    },
    // A note that rings until the returned function is called, for hold tiles.
    noteOn(midi) {
      if (!ctx) return () => {};
      const stops = [
        partial(hz(midi), 0.4, 0, "triangle", true),
        partial(hz(midi) * 2, 0.12, 0, "sine", true),
        partial(hz(midi) * 3, 0.05, 0, "sine", true),
      ];
      return () => stops.forEach((s) => s());
    },
    thud() {
      if (!ctx) return;
      const t = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(110, t);
      osc.frequency.exponentialRampToValueAtTime(45, t + 0.18);
      gain.gain.setValueAtTime(0.5, t);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
      osc.connect(gain).connect(out);
      osc.start(t);
      osc.stop(t + 0.25);
    },
  };
}
