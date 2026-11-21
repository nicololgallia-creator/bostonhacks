// A fake stage for `?mock=1`, so every screen can be seen with no laptop running the game.
// It answers like the real one will (PLAN.md, "Seats and session"): three seats, one taken by another phone, and
// a whole song: countdown, playing with scores that change, pause, results, the queue, the lobby again.
// There are no names: `players` has one entry for each taken seat, and one phone can own several.
// Test hooks in the address: `&crowd=1` takes seat 1 as well, `&full=1` takes every seat, `&seat=3` or `&seat=1,3` gives
// whoever joins those seats, and `&running=playing|paused|results` opens with a song already going, started by the other
// phone (add `&transit=platform` or `train`).
import { makeLayout } from "../stage/layout.js";
import { songs, songById } from "../songs/index.js";
import { songSeconds } from "../game/engine.js";
import { COUNTDOWN_MS, RESULTS_MS } from "../stage/session.js";

const TICK_MS = 500; // the fake stage's clock, and how often it sends the State
const NOTICE_MS = 4000; // the real stage clears a refusal after this long
const SECTION = { name: "Car 2, front" };
const summary = (s) => ({ id: s.id, title: s.title, seconds: Math.round(songSeconds(s)) });
const stats = (total = 0) => ({
  score: 0, combo: 0, maxCombo: 0, multiplier: 1, counts: { perfect: 0, good: 0, miss: 0 }, total, grade: null,
});
const entry = (clientId, spotId) => ({ clientId, spotId, ...stats() });

export function openMockLink(onMessage, onStatus) {
  const params = new URLSearchParams(location.search);
  let layout = makeLayout({ seats: 3 });
  let players = [entry("mock-b", 2)];
  if (params.has("crowd") || params.has("full")) players.unshift(entry("mock-a", 1));
  if (params.has("full")) players.push(entry("mock-c", 3));
  const joined = new Set();
  let notice = null, noticeTimer = 0;
  const heard = {};         // how many messages of each type the phone has sent, for a test script
  let status = "lobby", song = null, queue = [], transit = null;
  let before = "playing";   // what a paused song goes back to
  let phaseMs = 0;          // how long the current status has run
  let ready = { camera: false, calibrated: false };
  const settings = { volume: 0.8, offsetMs: 120 };

  const seated = () => players.filter((p) => p.spotId);
  // A refusal is for the phone that sent it (or everyone when `who` is null) and clears by itself.
  const refuse = (text, who = null) => {
    notice = { for: who, text };
    clearTimeout(noticeTimer);
    noticeTimer = setTimeout(() => { notice = null; push(); }, NOTICE_MS);
  };
  // Team totals over every seated player, like the real session's.
  const team = () => {
    const hits = seated().reduce((n, p) => n + p.counts.perfect + p.counts.good, 0);
    const total = seated().reduce((n, p) => n + p.total, 0);
    const share = total ? hits / total : 0;
    const done = status === "results" && total;
    return { score: seated().reduce((n, p) => n + p.score, 0), hits, total, grade: done ? (share >= 0.95 ? "S" : share >= 0.85 ? "A" : share >= 0.7 ? "B" : "C") : null };
  };
  const shown = () => (status === "paused" ? before : status);
  const push = () => onMessage({
    type: "state", status, notice, layout, section: SECTION, team: team(), players, song: song && summary(song), queue: queue.map(summary),
    secondsLeft: shown() === "playing" ? Math.ceil(songSeconds(song) - phaseMs / 1000) : song ? Math.round(songSeconds(song)) : 0,
    transit, ready, settings: { ...settings },
  });

  function toLobby() {
    status = "lobby"; song = null; queue = []; transit = null;
    for (const p of players) Object.assign(p, stats());
  }
  // The next queued song on every seated player, or the lobby when there is none.
  function loadNext() {
    const next = queue.shift();
    if (!next || !seated().length) return toLobby();
    song = next;
    status = "countdown";
    phaseMs = 0;
    // Each player's own part: the notes are shared out between the seated players.
    for (const p of seated()) Object.assign(p, stats(Math.ceil(song.notes.length / seated().length)));
  }
  function judge(p) {
    const r = Math.random();
    const grade = r < 0.6 ? "perfect" : r < 0.9 ? "good" : "miss";
    p.counts[grade] += 1;
    if (grade === "miss") p.combo = 0;
    else {
      p.score += (grade === "perfect" ? 100 : 50) * p.multiplier;
      p.maxCombo = Math.max(p.maxCombo, ++p.combo);
    }
    p.multiplier = p.combo >= 50 ? 4 : p.combo >= 25 ? 3 : p.combo >= 10 ? 2 : 1;
  }
  const judged = (p) => p.counts.perfect + p.counts.good + p.counts.miss;
  // The end of a song for one player: every tile judged, then the grade.
  function finish(p) {
    while (judged(p) < p.total) judge(p);
    const share = (p.counts.perfect + p.counts.good) / p.total;
    p.grade = share >= 0.95 ? "S" : share >= 0.85 ? "A" : share >= 0.7 ? "B" : "C";
  }
  // Moves the fake song on by one tick; the clock stands still while paused.
  function advance() {
    if (status === "lobby" || status === "paused") return;
    phaseMs += TICK_MS;
    if (status === "countdown" && phaseMs >= COUNTDOWN_MS) { status = "playing"; phaseMs = 0; }
    else if (status === "playing") {
      const length = songSeconds(song);
      for (const p of seated()) while (judged(p) < Math.floor((phaseMs / 1000 / length) * p.total)) judge(p);
      if (phaseMs / 1000 >= length) {
        seated().forEach(finish);
        status = "results";
        phaseMs = 0;
      }
    } else if (status === "results" && phaseMs >= RESULTS_MS) loadNext();
  }
  const begin = (list, sent) => { queue = list; transit = sent ?? null; loadNext(); };

  const answer = (msg) => {
    const live = status !== "lobby" && status !== "results";
    const who = msg.clientId;
    heard[msg.type] = (heard[msg.type] ?? 0) + 1;
    if (msg.type === "join") {
      if (joined.has(who)) return;
      joined.add(who);
      for (const spotId of (params.get("seat") ?? "").split(",").map(Number).filter(Boolean)) {
        if (players.some((p) => p.spotId === spotId)) continue;
        const e = entry(who, spotId);
        if (song) { e.total = Math.ceil(song.notes.length / (seated().length + 1)); if (status === "results") finish(e); }
        players.push(e);
      }
    } else if (msg.type === "claim") {
      if (!joined.has(who)) refuse("Join before you pick a seat.", who);
      else if (!layout.spots.some((s) => s.id === msg.spotId)) refuse("That seat does not exist.", who);
      else if (live) refuse("A song is playing. Pick a seat when it ends.", who);
      else if (players.some((p) => p.spotId === msg.spotId)) refuse("That seat is taken.", who);
      else players.push(entry(who, msg.spotId));
    } else if (msg.type === "release") {
      if (live) refuse("A song is playing. Give a seat back when it ends.", who);
      else players = players.filter((p) => !(p.clientId === who && p.spotId === msg.spotId));
    } else if (msg.type === "leave") {
      joined.delete(who);
      players = players.filter((p) => p.clientId !== who);
    } else if (msg.type === "start") {
      const found = Array.isArray(msg.songIds) ? msg.songIds.map(songById) : [];
      if (status !== "lobby") refuse("A song is already running.", who);
      else if (!found.length) refuse("Pick at least one song.", who);
      else if (found.includes(undefined)) refuse("One of those songs is not in the library.", who);
      else if (!seated().length) refuse("Pick a seat before starting.", who);
      else begin(found, msg.transit);
    } else if (msg.type === "pause") {
      if (status !== "countdown" && status !== "playing") refuse("Nothing is playing to pause.", who);
      else { before = status; status = "paused"; }
    } else if (msg.type === "resume") {
      if (status !== "paused") refuse("The song is not paused.", who);
      else status = before;
    } else if (msg.type === "skip") {
      if (status === "lobby") refuse("Nothing is playing to skip.", who);
      else loadNext();
    } else if (msg.type === "stop") {
      if (status === "lobby") refuse("Nothing is playing to stop.", who);
      else toLobby();
    } else if (msg.type === "layout") {
      if (!Number.isInteger(msg.seats) || msg.seats < 1 || msg.seats > 4) refuse("Choose from 1 to 4 seats.", who);
      else if (live) refuse("The seats cannot change while a song is playing.", who);
      else {
        layout = makeLayout({ seats: msg.seats });
        players = players.filter((p) => layout.spots.some((s) => s.id === p.spotId));
      }
    } else if (msg.type === "set") {
      if (Number.isFinite(msg.volume)) settings.volume = Math.min(1, Math.max(0, msg.volume));
      if (Number.isFinite(msg.offsetMs)) settings.offsetMs = Math.round(msg.offsetMs);
    } else if (msg.type === "here") {
      // nothing to do: the real stage frees the seat of a phone it stops hearing from
    } else if (msg.type === "calibrate") {
      // The real stage opens setup on the laptop. Here the floor is lined up a few seconds later.
      setTimeout(() => { ready = { camera: true, calibrated: true }; push(); }, 4000);
    }
  };

  const running = params.get("running");
  if (running) {
    const mode = params.get("transit"); // `&transit=platform` or `train`: the train is due in 2 min 10 s
    begin(songs.slice(0, 2), mode ? { stop: "Kenmore", mode, endsAt: Date.now() + 130000 } : null);
    phaseMs = COUNTDOWN_MS; // skip the countdown
    advance();
    phaseMs = (running === "results" ? songSeconds(song) * 1000 : 6000) - TICK_MS;
    advance();
    if (running === "paused") answer({ type: "pause" });
  }

  // For a test script: forget everyone like a reloaded stage, or show a refusal meant for another phone.
  window.ppMock = {
    heard,
    restart() { players = []; joined.clear(); toLobby(); refuse("The floor restarted. Start the song again."); push(); },
    refuse(text, who) { refuse(text, who); push(); },
  };

  const timer = setInterval(() => { advance(); push(); }, TICK_MS);
  setTimeout(() => { onStatus(true); push(); }, 50);
  return {
    send: (msg) => { answer(msg); setTimeout(push, 60); return true; },
    close: () => clearInterval(timer),
  };
}
