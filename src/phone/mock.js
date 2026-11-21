// A fake stage for `?mock=1`, so every screen can be seen with no laptop running the game.
// It answers like the real one will (PLAN.md, "Seats and session"): three seats, one taken by Zo.
import { makeLayout } from "../stage/layout.js";
import { songById } from "../songs/index.js";
import { songSeconds } from "../game/engine.js";

const summary = (s) => ({ id: s.id, title: s.title, seconds: Math.round(songSeconds(s)) });

const player = (clientId, name, spotId = null) => ({
  clientId, name, spotId, score: 0, combo: 0, maxCombo: 0, multiplier: 1,
  counts: { perfect: 0, good: 0, miss: 0 }, total: 0, grade: null,
});

export function openMockLink(onMessage, onStatus) {
  const layout = makeLayout({ posture: "seated", seats: 3 });
  let players = [player("mock-zo", "Zo", 2)];
  let notice = null;
  let status = "lobby", song = null, queue = [], transit = null;
  const push = () => onMessage({
    type: "state", status, notice, layout, players, song, queue, secondsLeft: song ? song.seconds : 0,
    transit, ready: { camera: false, calibrated: false }, settings: { volume: 0.8, offsetMs: 120 },
  });

  const answer = (msg) => {
    const mine = players.find((p) => p.clientId === msg.clientId);
    notice = null;
    if (msg.type === "join") {
      if (mine) mine.name = String(msg.name);
      else players.push(player(msg.clientId, String(msg.name)));
    } else if (msg.type === "claim") {
      if (!mine) notice = "Join before you pick a seat.";
      else if (players.some((p) => p.spotId === msg.spotId)) notice = "That seat is taken.";
      else mine.spotId = msg.spotId;
    } else if (msg.type === "leave") {
      players = players.filter((p) => p.clientId !== msg.clientId);
    } else if (msg.type === "start") {
      const found = Array.isArray(msg.songIds) ? msg.songIds.map(songById) : [];
      if (status !== "lobby") notice = "A song is already running. Stop it first.";
      else if (!found.length) notice = "Pick at least one song.";
      else if (found.includes(undefined)) notice = "One of those songs is not in the library.";
      else if (!mine?.spotId) notice = "Pick a seat before starting.";
      else {
        [song, ...queue] = found.map(summary);
        transit = msg.transit ?? null;
        status = "countdown";
        // The playing screens are the next card. Until then the fake floor goes back to the lobby after a few seconds, so the flow can be run again.
        setTimeout(() => { status = "lobby"; song = null; queue = []; transit = null; push(); }, 6000);
      }
    }
  };

  const timer = setInterval(push, 500);
  setTimeout(() => { onStatus(true); push(); }, 50);
  return {
    send: (msg) => { answer(msg); setTimeout(push, 60); return true; },
    close: () => clearInterval(timer),
  };
}
