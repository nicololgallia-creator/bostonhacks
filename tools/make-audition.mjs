// Renders every song twice, the way the floor plays it, so a person can check each one by ear (shots/audition/index.html).
//   perfect: every tile is hit at its exact time. none: no tile is ever hit.
// Both go through the real src/game/synth.js on an OfflineAudioContext, and the song is split the way the stage splits it
// (src/stage/main.js backedSong, session.js): Team mode, 2 seats, volume 0.8, lag setting 120 ms. See reports/audition.md.
//
//   node tools/make-audition.mjs [http://localhost:5181] [song id ...]     (the vite dev server must be running)
//
// Writes shots/audition/audio/<song id>-perfect.mp3 and <song id>-none.mp3 (stereo, 44.1 kHz, 128 kb/s) and prints a check table.
import { mkdirSync, mkdtempSync, writeFileSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync, spawnSync } from "node:child_process";
import { launch } from "./browser.mjs";

const origin = process.argv[2]?.startsWith("http") ? process.argv[2] : "http://localhost:5181";
const only = process.argv.slice(2).filter((a) => !a.startsWith("http"));
const OUT = "shots/audition/audio";
const SR = 44100;
const TAIL_S = 2; // the file ends this long after the floor's results screen takes over
const SEATS = 2;

mkdirSync(OUT, { recursive: true });
const work = mkdtempSync(join(tmpdir(), "audition-"));
const browser = await launch({ protocolTimeout: 600000 });
let failed = false;
try {
  const page = await browser.newPage();
  await page.goto(origin + "/qa/person.jpg"); // any page on the dev server's origin, so the module imports work

  const ids = await page.evaluate(async ({ SR, TAIL_S, SEATS }) => {
    const { createSynth } = await import("/src/game/synth.js");
    const { songs } = await import("/src/songs/index.js");
    const { splitParts } = await import("/src/game/parts.js");
    const { backingLeft } = await import("/src/game/chart.js");
    const { songSeconds, GOOD_MS, FLICKER_MS } = await import("/src/game/engine.js");

    const OFFSET_MS = 120; // session.js settings.offsetMs: the backing runs this far ahead of the song clock the hits are judged on
    const VOLUME = 0.8; // session.js settings.volume
    const FRAME_MS = 16; // the floor's frame: a miss is judged on the first frame after GOOD_MS
    const STEP_S = 0.01; // how often the offline clock stops to do what the floor does every frame

    // One render. The song clock is in ms, as the stage keeps it: 0 is the first beat, the count-in is negative. `t0` is the song
    // clock at the start of the file.
    async function render(song, parts, kind, t0, endMs, lengthS) {
      const beatMs = 60000 / song.bpm;
      const ctx = new OfflineAudioContext(2, Math.ceil(lengthS * SR), SR);
      const synth = createSynth({ context: ctx });
      await synth.load();
      synth.setVolume(VOLUME);
      const backed = { ...song, backing: backingLeft(song, parts) }; // main.js backedSong

      // What the stage's playSounds does for each event of each seat's game (engine.js): a tap sounds as a note, a hold rings from
      // the foot landing until FLICKER_MS before its end, a missed tile is a thud once GOOD_MS has passed.
      const events = [];
      for (const part of parts) for (const n of part.notes) {
        const at = n.beat * beatMs;
        const tail = at + n.beats * beatMs;
        if (kind === "none") events.push({ at: at + GOOD_MS + FRAME_MS / 2, type: "thud" });
        else if (n.hold) events.push({ at, type: "holdStart", midi: n.midi }, { at: tail - FLICKER_MS, type: "holdEnd", midi: n.midi });
        else events.push({ at, type: "hit", midi: n.midi });
      }
      events.sort((a, b) => a.at - b.at);
      const ringing = []; // stop functions of the holds in progress, in order of their holdEnd
      let next = 0;
      let stopped = false;

      const tick = () => {
        const songMs = t0 + ctx.currentTime * 1000;
        if (songMs >= endMs) { // the results screen: stopSound()
          if (!stopped) { ringing.splice(0).forEach((stop) => stop()); synth.stopAll(); stopped = true; }
          return;
        }
        synth.backing(backed, songMs + OFFSET_MS); // main.js frame()
        for (; next < events.length && events[next].at <= songMs + 30; next++) {
          const e = events[next];
          const when = (e.at - t0) / 1000;
          if (e.type === "hit") synth.note(e.midi, when);
          else if (e.at > songMs) break; // thuds and holds act on the frame they are due, not ahead
          else if (e.type === "thud") synth.thud();
          else if (e.type === "holdStart") ringing.push({ midi: e.midi, stop: synth.noteOn(e.midi) });
          else ringing.splice(ringing.findIndex((r) => r.midi === e.midi), 1)[0]?.stop();
        }
      };
      const step = () => {
        const at = ctx.currentTime + STEP_S;
        if (at >= lengthS - 0.05) return;
        ctx.suspend(at).then(() => { tick(); step(); ctx.resume(); });
      };
      tick();
      step();
      const buf = await ctx.startRendering();
      return [buf.getChannelData(0), buf.getChannelData(1)];
    }

    const dbOf = (L, R, from, to) => {
      let sum = 0;
      for (let i = Math.round(from * SR); i < Math.round(to * SR); i++) sum += (L[i] * L[i] + R[i] * R[i]) / 2;
      return 10 * Math.log10(sum / Math.max(1, Math.round((to - from) * SR)) || 1e-12);
    };
    const peakOf = (L, R) => { let p = 0; for (let i = 0; i < L.length; i++) p = Math.max(p, Math.abs(L[i]), Math.abs(R[i])); return p; };
    let held = null; // the latest render, read back in pieces by readChunk

    window.makeSong = async (id) => {
      const song = songs.find((s) => s.id === id);
      const parts = splitParts(song, SEATS, { mode: "team" });
      const beatMs = 60000 / song.bpm;
      // When the file starts: half a second before the first sound the floor makes (the first count-in click).
      const firstMs = Math.min(...[...song.notes, ...(song.backing ?? [])].map((e) => e.beat * beatMs)) - OFFSET_MS;
      const t0 = firstMs - 500;
      const result = { id, title: song.title, bpm: song.bpm, songSeconds: songSeconds(song), files: {} };
      // The results screen comes when every seat's part is finished (engine.js `done`): its own end, and its last tile judged.
      const endOf = (kind) => Math.max(...parts.map((p) => Math.max(songSeconds(p) * 1000, ...p.notes.map((n) => {
        const at = n.beat * beatMs;
        return kind === "none" ? at + GOOD_MS + FRAME_MS : n.hold ? at + n.beats * beatMs - FLICKER_MS : at;
      }))));
      const pcm = {};
      for (const kind of ["perfect", "none"]) {
        const endMs = endOf(kind);
        const lengthS = (endMs - t0) / 1000 + TAIL_S;
        const [L, R] = await render(song, parts, kind, t0, endMs, lengthS);
        pcm[kind] = { L, R };
        const musicFrom = (0 * beatMs - t0 - OFFSET_MS) / 1000; // beat 0, where the count-in ends
        const musicTo = (endMs - t0) / 1000;
        let quietest = Infinity;
        for (let s = musicFrom; s + 2 <= musicTo; s += 0.5) quietest = Math.min(quietest, dbOf(L, R, s, s + 2));
        result.files[kind] = {
          seconds: L.length / SR, expected: lengthS, peak: peakOf(L, R), quietest2s: quietest === Infinity ? null : quietest,
          musicDb: dbOf(L, R, Math.max(0, musicFrom), musicTo),
        };
      }
      result.startsAtMs = t0;
      held = pcm;
      return result;
    };
    // 16-bit stereo WAV, in pieces of `bytes` bytes (piece 0 starts with the header), as base64.
    window.readChunk = (kind, index, bytes) => {
      const { L, R } = held[kind];
      const dataBytes = L.length * 4;
      const header = new DataView(new ArrayBuffer(44));
      const text = (at, s) => [...s].forEach((c, i) => header.setUint8(at + i, c.charCodeAt(0)));
      text(0, "RIFF"); header.setUint32(4, 36 + dataBytes, true); text(8, "WAVEfmt ");
      header.setUint32(16, 16, true); header.setUint16(20, 1, true); header.setUint16(22, 2, true); header.setUint32(24, SR, true);
      header.setUint32(28, SR * 4, true); header.setUint16(32, 4, true); header.setUint16(34, 16, true); text(36, "data"); header.setUint32(40, dataBytes, true);
      const from = index * bytes, to = Math.min(dataBytes + 44, from + bytes);
      if (from >= dataBytes + 44) return null;
      const out = new Uint8Array(to - from);
      const view = new DataView(out.buffer);
      for (let b = from; b < to; b++) {
        if (b < 44) { out[b - from] = header.getUint8(b); continue; }
        const i = (b - 44) >> 2, byte = (b - 44) & 3;
        const v = Math.max(-1, Math.min(1, (byte < 2 ? L : R)[i])) * 32767;
        out[b - from] = (Math.round(v) >> (byte & 1 ? 8 : 0)) & 255;
      }
      let bin = "";
      for (let i = 0; i < out.length; i += 0x8000) bin += String.fromCharCode(...out.subarray(i, i + 0x8000));
      return btoa(bin);
    };
    return songs.map((s) => s.id);
  }, { SR, TAIL_S, SEATS });

  const rows = [];
  for (const id of ids.filter((i) => !only.length || only.includes(i))) {
    const r = await page.evaluate((id) => window.makeSong(id), id);
    for (const kind of ["perfect", "none"]) {
      const wav = join(work, `${id}-${kind}.wav`);
      const chunks = [];
      for (let i = 0; ; i++) {
        const b64 = await page.evaluate((kind, i) => window.readChunk(kind, i, 3 * 1024 * 1024), kind, i);
        if (b64 === null) break;
        chunks.push(Buffer.from(b64, "base64"));
      }
      writeFileSync(wav, Buffer.concat(chunks));
      const mp3 = join(OUT, `${id}-${kind}.mp3`);
      execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-i", wav, "-ac", "2", "-ar", "44100", "-codec:a", "libmp3lame", "-b:a", "128k", mp3]);
      rmSync(wav);
      const probe = JSON.parse(execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "json", mp3]).toString());
      r.files[kind].mp3Seconds = Number(probe.format.duration);
      // The peak after the mp3 encode (the encode can add a little over the wav's peak).
      const vol = spawnSync("ffmpeg", ["-hide_banner", "-i", mp3, "-af", "volumedetect", "-f", "null", "-"], { encoding: "utf8" }).stderr; // volumedetect reports on stderr
      r.files[kind].mp3PeakDb = Number(/max_volume: (-?[\d.]+) dB/.exec(vol)?.[1] ?? NaN);
    }
    rows.push(r);
    console.log(`done ${id}`);
  }

  const f = (n, d = 1) => (n === null || !Number.isFinite(n) ? "n/a" : n.toFixed(d));
  console.log("\nsong                         song s  perfect s  none s  peak perfect  peak none  mp3 peak dB (p/n)  quietest 2 s none dB  tune louder dB  result");
  for (const r of rows) {
    const p = r.files.perfect, n = r.files.none;
    const lengthOk = [p, n].every((x) => Math.abs(x.seconds - x.expected) < 0.05 && Math.abs(x.mp3Seconds - x.seconds) < 0.15);
    const peakOk = [p, n].every((x) => x.peak <= 0.99 && x.mp3PeakDb <= -0.09);
    const silentOk = n.quietest2s === null || n.quietest2s > -55; // a 2 s window of no sound at all
    const louder = p.musicDb - n.musicDb;
    const loudOk = louder > 0;
    const ok = lengthOk && peakOk && silentOk && loudOk;
    if (!ok) failed = true;
    const why = [!lengthOk && "length", !peakOk && "peak", !silentOk && "silent window", !loudOk && "tune not louder"].filter(Boolean).join(", ");
    console.log(`${r.id.padEnd(28)} ${f(r.songSeconds).padStart(6)} ${f(p.mp3Seconds).padStart(10)} ${f(n.mp3Seconds).padStart(7)} ${f(p.peak, 3).padStart(13)} ${f(n.peak, 3).padStart(10)} ${(f(p.mp3PeakDb, 2) + "/" + f(n.mp3PeakDb, 2)).padStart(18)} ${f(n.quietest2s).padStart(21)} ${f(louder).padStart(15)}  ${ok ? "ok" : "FAIL " + why}`);
  }
  // The list the page shows, in the order of src/songs/index.js (only when every song was rendered).
  if (!only.length) writeFileSync("shots/audition/songs.json", JSON.stringify(rows.map((r) => ({ id: r.id, title: r.title, seconds: Math.round(r.files.perfect.mp3Seconds) }))));
} finally {
  await browser.close();
  rmSync(work, { recursive: true, force: true });
}
process.exit(failed ? 1 : 0);
