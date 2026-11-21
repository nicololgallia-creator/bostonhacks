// A fake stage for `?mock=1`, so every screen can be seen with no laptop running the game.
// It answers like the real one will (PLAN.md, "Seats and session"): three seats, one taken by Zo.
import { makeLayout } from "../stage/layout.js";

const player = (clientId, name, spotId = null) => ({
  clientId, name, spotId, score: 0, combo: 0, maxCombo: 0, multiplier: 1,
  counts: { perfect: 0, good: 0, miss: 0 }, total: 0, grade: null,
});

export function openMockLink(onMessage, onStatus) {
  const layout = makeLayout({ posture: "seated", seats: 3 });
  let players = [player("mock-zo", "Zo", 2)];
  let notice = null;
  const push = () => onMessage({
    type: "state", status: "lobby", notice, layout, players, song: null, queue: [], secondsLeft: 0,
    transit: null, ready: { camera: false, calibrated: false }, settings: { volume: 0.8, offsetMs: 120 },
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
    }
  };

  const timer = setInterval(push, 500);
  setTimeout(() => { onStatus(true); push(); }, 50);
  return {
    send: (msg) => { answer(msg); setTimeout(push, 60); return true; },
    close: () => clearInterval(timer),
  };
}
