// Renders the game's sounds offline through the real synth.js and prints the peak level of each.
// Fails if a sound is silent (peak under 0.05), clips (peak over 0.99), or the piano samples did not load.
//
//   node tools/sound-check.mjs [http://localhost:5173]     (the dev server must be running)
import { launch } from "./browser.mjs";

const origin = process.argv[2] || "http://localhost:5173";
const browser = await launch();
let failed = false;
try {
  const page = await browser.newPage();
  const warnings = [];
  page.on("console", (m) => { if (m.type() === "warning" || m.type() === "error") warnings.push(m.text()); });
  await page.goto(origin + "/qa/person.jpg"); // any page on the dev server's origin, so the module imports work

  const results = await page.evaluate(async () => {
    const { createSynth } = await import("/src/game/synth.js");
    const greensleeves = await (await fetch("/songs/greensleeves.json")).json();
    const drums = { bpm: 120, backing: [0, 1, 2, 3, 4, 5, 6, 7].flatMap((b) => [{ beat: b, drum: b % 2 ? "snare" : "kick" }, { beat: b, drum: "hat" }]) };
    const SR = 44100;

    // Renders `seconds` of sound. play(synth, ctx) starts it; it may call ctx.suspend() to act at a later time.
    async function render(seconds, { samples = true, play }) {
      const ctx = new OfflineAudioContext(2, SR * seconds, SR);
      const synth = createSynth({ context: ctx });
      if (samples) await synth.load();
      play(synth, ctx);
      const buf = await ctx.startRendering();
      let peak = 0;
      for (let c = 0; c < 2; c++) for (const v of buf.getChannelData(c)) peak = Math.max(peak, Math.abs(v));
      return peak;
    }
    // Calls synth.backing(song, ms) every 50 ms of audio time, the way the game calls it every frame.
    const follow = (synth, ctx, song, seconds) => {
      for (let t = 0.05; t < seconds - 0.1; t += 0.05) ctx.suspend(t).then(() => { synth.backing(song, t * 1000); ctx.resume(); });
    };

    return {
      "piano note": await render(2, { play: (s) => s.note(60) }),
      "held note": await render(2, { play: (s, ctx) => { const stop = s.noteOn(64); ctx.suspend(1).then(() => { stop(); ctx.resume(); }); } }),
      "thud": await render(1, { play: (s) => s.thud() }),
      "greensleeves backing, 4 bars": await render(5, { play: (s, ctx) => follow(s, ctx, greensleeves, 5) }),
      "drum backing (kick, snare, hat)": await render(4, { play: (s, ctx) => follow(s, ctx, drums, 4) }),
      "4 players hitting over backing": await render(5, { play: (s, ctx) => { follow(s, ctx, greensleeves, 5); for (const m of [48, 60, 64, 72]) s.note(m); } }),
      "plain synth tone (no samples)": await render(2, { samples: false, play: (s) => s.note(60) }),
    };
  });

  for (const [name, peak] of Object.entries(results)) {
    const ok = peak >= 0.05 && peak <= 0.99;
    if (!ok) failed = true;
    console.log(`${ok ? "ok  " : "FAIL"} ${name.padEnd(34)} peak ${peak.toFixed(3)}`);
  }
  const bad = warnings.filter((w) => /did not load/.test(w));
  if (bad.length) { failed = true; console.log("FAIL piano samples: " + bad[0]); }
} finally {
  await browser.close();
}
process.exit(failed ? 1 : 0);
