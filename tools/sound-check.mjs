// Renders the game's sounds offline through the real synth.js (no speakers needed) and checks them.
//   1. Each sound alone: fails if it is silent (peak under 0.05), clips (peak over 0.99), or the piano samples did not load.
//   2. Every song, 20 seconds from the end of the countdown (3 s of lead-in, then 17 s of song), with NO hits: the backing
//      plus the tune must sound in every second after the first, and the hit-over-backing gap must be 6 to 9 dB (checked as 5 to 10).
//      With the tune played as hits on top, it must not clip.
//   3. Writes shots/music-<song>-backing.wav (no hits) and shots/music-<song>-with-hits.wav for the three WAV_SONGS.
//
//   node tools/sound-check.mjs [http://localhost:5173]     (the dev server must be running)
import { mkdirSync, writeFileSync } from "node:fs";
import { launch } from "./browser.mjs";

const origin = process.argv[2] || "http://localhost:5173";
const WAV_SONGS = ["twinkle", "greensleeves", "sweet-caroline"];
const browser = await launch({ protocolTimeout: 240000 });
let failed = false;
const say = (ok, text) => { if (!ok) failed = true; console.log(`${ok ? "ok  " : "FAIL"} ${text}`); };
try {
  const page = await browser.newPage();
  const warnings = [];
  page.on("console", (m) => { if (m.type() === "warning" || m.type() === "error") warnings.push(m.text()); });
  await page.goto(origin + "/qa/person.jpg"); // any page on the dev server's origin, so the module imports work

  const { sounds, ids } = await page.evaluate(async () => {
    const { createSynth } = await import("/src/game/synth.js");
    const { songs: all } = await import("/src/songs/index.js");
    const greensleeves = all.find((s) => s.id === "greensleeves");
    const drums = { bpm: 120, backing: [0, 1, 2, 3, 4, 5, 6, 7].flatMap((b) => [{ beat: b, drum: b % 2 ? "snare" : "kick" }, { beat: b, drum: "hat" }]) };
    const SR = 44100;
    const SECONDS = 20;
    const LEAD_MS = 3000; // the clock starts here before beat 0, as at the end of the game's 3 s countdown

    // Renders `seconds` of sound. play(synth, ctx) starts it; it may call ctx.suspend() to act at a later time. Returns the mono mix.
    async function render(seconds, { samples = true, guide, play }) {
      const ctx = new OfflineAudioContext(2, SR * seconds, SR);
      const synth = createSynth({ context: ctx, ...(guide === undefined ? {} : { guide }) });
      if (samples) await synth.load();
      play(synth, ctx);
      const buf = await ctx.startRendering();
      const a = buf.getChannelData(0), b = buf.getChannelData(1);
      return Float32Array.from(a, (v, i) => (v + b[i]) / 2);
    }
    const peakOf = (pcm) => pcm.reduce((p, v) => Math.max(p, Math.abs(v)), 0);
    const dbOf = (pcm, fromS, toS) => {
      const part = pcm.subarray(Math.round(fromS * SR), Math.round(toS * SR));
      return 20 * Math.log10(Math.sqrt(part.reduce((s, v) => s + v * v, 0) / part.length) || 1e-9);
    };
    // Calls synth.backing(song, ms) every 50 ms of audio time, the way the game calls it every frame.
    const follow = (synth, ctx, song, seconds, leadMs = 0) => {
      for (let t = 0.05; t < seconds - 0.1; t += 0.05) ctx.suspend(t).then(() => { synth.backing(song, t * 1000 - leadMs); ctx.resume(); });
    };
    const hitsOn = (synth, song) => {
      for (const n of song.notes) {
        const when = (n.beat * 60000) / song.bpm / 1000 + LEAD_MS / 1000;
        if (when < SECONDS - 0.3) synth.note(n.midi, when);
      }
    };

    const alone = {
      "piano note": await render(2, { play: (s) => s.note(60) }),
      "held note": await render(2, { play: (s, ctx) => { const stop = s.noteOn(64); ctx.suspend(1).then(() => { stop(); ctx.resume(); }); } }),
      "thud": await render(1, { play: (s) => s.thud() }),
      "drum backing (kick, snare, hat)": await render(4, { play: (s, ctx) => follow(s, ctx, drums, 4) }),
      "count-in clicks": await render(3, { play: (s, ctx) => follow(s, ctx, { bpm: 120, notes: [], backing: [{ beat: -4, drum: "click" }, { beat: -3, drum: "tick" }, { beat: -2, drum: "tick" }, { beat: -1, drum: "tick" }] }, 3, 2000) }),
      "plain synth tone (no samples)": await render(2, { samples: false, play: (s) => s.note(60) }),
    };
    const sounds = Object.fromEntries(Object.entries(alone).map(([k, pcm]) => [k, { peak: peakOf(pcm) }]));

    // A hit note on its own: the mean level of the first 0.5 s of a note at C4 and one at C5.
    const hitDb = (await Promise.all([60, 72].map(async (m) => dbOf(await render(1, { play: (s) => s.note(m) }), 0, 0.5)))).reduce((a, b) => a + b) / 2;

    const bytes = (pcm) => { // 16-bit mono WAV, as base64
      const out = new DataView(new ArrayBuffer(44 + pcm.length * 2));
      const text = (at, s) => [...s].forEach((c, i) => out.setUint8(at + i, c.charCodeAt(0)));
      text(0, "RIFF"); out.setUint32(4, 36 + pcm.length * 2, true); text(8, "WAVEfmt ");
      out.setUint32(16, 16, true); out.setUint16(20, 1, true); out.setUint16(22, 1, true); out.setUint32(24, SR, true);
      out.setUint32(28, SR * 2, true); out.setUint16(32, 2, true); out.setUint16(34, 16, true); text(36, "data"); out.setUint32(40, pcm.length * 2, true);
      pcm.forEach((v, i) => out.setInt16(44 + i * 2, Math.max(-1, Math.min(1, v)) * 32767, true));
      let bin = "";
      const u8 = new Uint8Array(out.buffer);
      for (let i = 0; i < u8.length; i += 0x8000) bin += String.fromCharCode(...u8.subarray(i, i + 0x8000));
      return btoa(bin);
    };

    // One song at a time, so each browser call stays short.
    window.checkSong = async (id, wanted) => {
      const song = all.find((s) => s.id === id);
      const bed = await render(SECONDS, { play: (s, ctx) => follow(s, ctx, song, SECONDS, LEAD_MS) });
      const bedNoGuide = await render(SECONDS, { guide: 0, play: (s, ctx) => follow(s, ctx, song, SECONDS, LEAD_MS) });
      const withHits = await render(SECONDS, { play: (s, ctx) => { follow(s, ctx, song, SECONDS, LEAD_MS); hitsOn(s, song); } });
      // second by second, from the second second of the song (the first holds the count-in's last click and the first note's start)
      const musicEnd = Math.min(SECONDS, LEAD_MS / 1000 + (Math.max(...song.notes.map((n) => n.beat + n.beats)) * 60) / song.bpm);
      const perSecond = [], rawSecond = [];
      for (let t = LEAD_MS / 1000 + 1; t + 1 <= musicEnd; t++) { perSecond.push(dbOf(bed, t, t + 1)); rawSecond.push(dbOf(bedNoGuide, t, t + 1)); }
      const row = {
        id: song.id,
        entries: song.backing?.length ?? 0,
        quietestSecond: Math.min(...perSecond),
        quietestRaw: Math.min(...rawSecond),
        countIn: peakOf(bedNoGuide.subarray(Math.round(0.5 * SR), Math.round((LEAD_MS / 1000) * SR))), // the end of the countdown: the count-in clicks
        backingDb: dbOf(bedNoGuide, LEAD_MS / 1000, musicEnd),
        withGuideDb: dbOf(bed, LEAD_MS / 1000, musicEnd),
        hitDb,
        peakBed: peakOf(bed),
        peakHits: peakOf(withHits),
        hitsOnTopDb: dbOf(withHits, LEAD_MS / 1000, musicEnd),
        musicSeconds: musicEnd - LEAD_MS / 1000,
      };
      if (wanted) row.wav = { backing: bytes(bed), withHits: bytes(withHits) };
      return row;
    };
    return { sounds, ids: all.map((s) => s.id) };
  });
  const songs = [];
  for (const id of ids) songs.push(await page.evaluate((id, wanted) => window.checkSong(id, wanted), id, WAV_SONGS.includes(id)));

  console.log("Each sound alone");
  for (const [name, { peak }] of Object.entries(sounds)) say(peak >= 0.05 && peak <= 0.99, `${name.padEnd(34)} peak ${peak.toFixed(3)}`);

  mkdirSync("shots", { recursive: true });
  console.log("\nEvery song: 3 s lead-in (the end of the countdown) and up to 17 s of song, no hits. dB are RMS, dBFS.");
  console.log("song                           entries  quietest 1 s (no guide)  backing  +guide   hit   hit-backing  hit-(backing+guide)  count-in peak  peak with hits");
  for (const s of songs) {
    const gap = s.hitDb - s.backingDb;
    const gapGuide = s.hitDb - s.withGuideDb;
    say(
      s.quietestSecond > -50 && gapGuide >= 5 && gapGuide <= 10 && s.peakBed <= 0.99 && s.peakHits <= 0.99 && s.countIn > 0.03,
      `${s.id.padEnd(30)} ${String(s.entries).padStart(5)}  ${s.quietestSecond.toFixed(1).padStart(6)} (${s.quietestRaw.toFixed(1).padStart(6)})  ${s.backingDb.toFixed(1).padStart(8)} ${s.withGuideDb.toFixed(1).padStart(7)} ${s.hitDb.toFixed(1).padStart(6)}  ${gap.toFixed(1).padStart(10)}  ${gapGuide.toFixed(1).padStart(18)}  ${s.countIn.toFixed(2).padStart(13)}  ${s.peakHits.toFixed(3)}`,
    );
    if (s.wav) {
      writeFileSync(`shots/music-${s.id}-backing.wav`, Buffer.from(s.wav.backing, "base64"));
      writeFileSync(`shots/music-${s.id}-with-hits.wav`, Buffer.from(s.wav.withHits, "base64"));
    }
  }
  console.log(`\nWrote shots/music-<song>-backing.wav (no hits) and shots/music-<song>-with-hits.wav for ${WAV_SONGS.join(", ")}.`);

  const bad = warnings.filter((w) => /did not load/.test(w));
  if (bad.length) say(false, "piano samples: " + bad[0]);
} finally {
  await browser.close();
}
process.exit(failed ? 1 : 0);
