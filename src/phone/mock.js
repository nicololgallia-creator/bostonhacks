// A fake stage for `?mock=1`, so every screen can be seen with no laptop running the game.
// It answers like the real one will (PLAN.md, "Seats and session"): three seats, one taken by Zo, and
// a whole song: countdown, playing with scores that change, pause, results, the queue, the lobby again.
// Test hooks in the address: `&crowd=1` adds Ana in seat 1, `&seat=3` seats whoever joins in seat 3, and
// `&running=playing|paused|results` opens with a song already going, started by Zo (add `&transit=platform` or `train`).
import { makeLayout } from "../stage/layout.js";
import { songs, songById } from "../songs/index.js";
import { songSeconds } from "../game/engine.js";
import { COUNTDOWN_MS, RESULTS_MS } from "../stage/session.js";

const TICK_MS = 500; // the fake stage's clock, and how often it sends the State
const summary = (s) => ({ id: s.id, title: s.title, seconds: Math.round(songSeconds(s)) });
const stats = (total = 0) => ({
  score: 0, combo: 0, maxCombo: 0, multiplier: 1, counts: { perfect: 0, good: 0, miss: 0 }, total, grade: null,
});
const player = (clientId, name, spotId = null) => ({ clientId, name, spotId, ...stats() });

export function openMockLink(onMessage, onStatus) {
  const params = new URLSearchParams(location.search);
  let layout = makeLayout({ posture: "seated", seats: 3 });
  let players = [player("mock-zo", "Zo", 2)];
  if (params.has("crowd")) players.unshift(player("mock-ana", "Ana", 1));
  let notice = null;
  let status = "lobby", song = null, queue = [], transit = null;
  let before = "playing";   // what a paused song goes back to
  let phaseMs = 0;          // how long the current status has run
  let ready = { camera: false, calibrated: false };
  const settings = { volume: 0.8, offsetMs: 120 };

  const seated = () => players.filter((p) => p.spotId);
  const shown = () => (status === "paused" ? before : status);
  const push = () => onMessage({
    type: "state", status, notice, layout, players, song: song && summary(song), queue: queue.map(summary),
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
    for (const p of seated()) Object.assign(p, stats(song.notes.length));
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
      const due = Math.min(song.notes.length, Math.floor((phaseMs / 1000 / length) * song.notes.length));
      for (const p of seated()) while (judged(p) < due) judge(p);
      if (phaseMs / 1000 >= length) {
        seated().forEach(finish);
        status = "results";
        phaseMs = 0;
      }
    } else if (status === "results" && phaseMs >= RESULTS_MS) loadNext();
  }
  const begin = (list, sent) => { queue = list; transit = sent ?? null; loadNext(); };

  const answer = (msg) => {
    const mine = players.find((p) => p.clientId === msg.clientId);
    const live = status !== "lobby" && status !== "results";
    notice = null;
    if (msg.type === "join") {
      if (mine) mine.name = String(msg.name);
      else {
        const joined = player(msg.clientId, String(msg.name), Number(params.get("seat")) || null);
        if (joined.spotId && song) { joined.total = song.notes.length; if (status === "results") finish(joined); }
        players.push(joined);
      }
    } else if (msg.type === "claim") {
      if (!mine) notice = "Join before you pick a seat.";
      else if (!layout.spots.some((s) => s.id === msg.spotId)) notice = "That seat does not exist.";
      else if (live) notice = "A song is playing. Pick a seat when it ends.";
      else if (players.some((p) => p.spotId === msg.spotId)) notice = "That seat is taken.";
      else mine.spotId = msg.spotId;
    } else if (msg.type === "leave") {
      players = players.filter((p) => p.clientId !== msg.clientId);
    } else if (msg.type === "start") {
      const found = Array.isArray(msg.songIds) ? msg.songIds.map(songById) : [];
      if (status !== "lobby") notice = "A song is already running. Stop it first.";
      else if (!found.length) notice = "Pick at least one song.";
      else if (found.includes(undefined)) notice = "One of those songs is not in the library.";
      else if (!seated().length) notice = "Pick a seat before starting.";
      else begin(found, msg.transit);
    } else if (msg.type === "pause") {
      if (status !== "countdown" && status !== "playing") notice = "Nothing is playing to pause.";
      else { before = status; status = "paused"; }
    } else if (msg.type === "resume") {
      if (status !== "paused") notice = "The song is not paused.";
      else status = before;
    } else if (msg.type === "skip") {
      if (status === "lobby") notice = "Nothing is playing to skip.";
      else loadNext();
    } else if (msg.type === "stop") {
      if (status === "lobby") notice = "Nothing is playing to stop.";
      else toLobby();
    } else if (msg.type === "layout") {
      if (!Number.isInteger(msg.seats) || msg.seats < 1 || msg.seats > 4) notice = "Choose from 1 to 4 seats.";
      else if (live) notice = "The seats cannot change while a song is playing.";
      else {
        layout = makeLayout({ posture: msg.posture, seats: msg.seats });
        for (const p of players) if (!layout.spots.some((s) => s.id === p.spotId)) p.spotId = null;
      }
    } else if (msg.type === "set") {
      if (Number.isFinite(msg.volume)) settings.volume = Math.min(1, Math.max(0, msg.volume));
      if (Number.isFinite(msg.offsetMs)) settings.offsetMs = Math.round(msg.offsetMs);
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

  const timer = setInterval(() => { advance(); push(); }, TICK_MS);
  setTimeout(() => { onStatus(true); push(); }, 50);
  return {
    send: (msg) => { answer(msg); setTimeout(push, 60); return true; },
    close: () => clearInterval(timer),
  };
}
