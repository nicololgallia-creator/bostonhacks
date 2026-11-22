// A small fake stage for `?mock=1`, so every screen can be seen with no laptop running the game. It is the real session
// (src/stage/session.js) with a player who steps on most tiles, so it speaks exactly the State the real stage sends.
// Options in the address: `&seats=1..4` (default 3), `&others=2,3` (seats other phones hold, default 2), and the train
// (`&line=Red&dir=0&at=place-knncl&car=3`), which the real stage takes from its own address too.
import { createSession, trainFromAddress } from "../stage/session.js";
import { makeLayout, MAX_SEATS } from "../stage/layout.js";
import { songs } from "../songs/index.js";
import { keepable } from "./after.js";

const TICK_MS = 100;  // the fake player's feet and the game clock
const PUSH_MS = 500;  // the real stage sends the State twice a second, and at once on a change
const SKIPPED = 7;    // the fake player misses every seventh tile, so scores and misses both move

// A floor with explicit time, so a test can run a whole song in no time: apply(message, now), tick(now), state(now).
export function createFakeFloor({ seats = 3, others = [2], train = null } = {}) {
  const session = createSession({ songs, layout: makeLayout({ seats }), train });
  const phones = others.filter((n) => n >= 1 && n <= seats).map((n) => ({ clientId: `mock-phone-${n}`, spotId: n }));
  let view = null;
  let started = false;
  // The other phones hold their seats and keep saying so, or the session would free them after ten seconds.
  const keepOthers = (now) => {
    for (const { clientId, spotId } of phones) {
      if (!started) { session.apply({ type: "join", clientId }, now); session.apply({ type: "claim", clientId, spotId }, now); }
      else session.apply({ type: "here", clientId }, now);
    }
    started = true;
  };
  // Feet for each pad: on a lane's square when a tile reaches the hit line, and nowhere else.
  const feet = () => Object.fromEntries((view?.pads ?? []).map((pad) => [pad.spotId, pad.tiles
    .filter((t) => t.state === "holding" || (t.state === "waiting" && t.id % SKIPPED !== 3 && t.v >= 0.7 && t.v <= 0.8))
    .map((t) => ({ u: (t.lane + 0.5) / pad.lanes, v: 0.8 }))]));
  return {
    apply: (message, now) => session.apply(message, now),
    tick(now) {
      keepOthers(now);
      view = session.tick(now, feet());
      session.drain();
    },
    state: (now) => session.snapshot(now),
  };
}

// A finished song for `?mock=1&screen=board|share|again`: the fake floor plays the shortest song to the end in no time, with
// the phone holding every seat the other phones do not, and the results State is kept as the app would have kept it.
export function demoResults(clientId, { seats, others, train }) {
  const floor = createFakeFloor({ seats, others, train });
  const mine = Array.from({ length: seats }, (_, i) => i + 1).filter((n) => !others.includes(n));
  let t = 0;
  floor.tick(t);
  floor.apply({ type: "join", clientId }, t);
  for (const spotId of mine) floor.apply({ type: "claim", clientId, spotId }, t);
  floor.apply({ type: "start", clientId, songIds: [songs[0].id], transit: { stop: "Kenmore", mode: "train", endsAt: Date.now() + 420000 } }, t);
  while (floor.state(t).status !== "results" && t < 120000) {
    t += TICK_MS;
    if (t % 3000 === 0) floor.apply({ type: "here", clientId }, t);
    floor.tick(t);
  }
  return keepable(floor.state(t), clientId);
}

// The options in the address, shared by the fake link and the demo results.
export function mockOptions(search = location.search) {
  const q = new URLSearchParams(search);
  return {
    seats: Math.min(MAX_SEATS, Math.max(1, Math.round(Number(q.get("seats"))) || 3)),
    others: (q.get("others") ?? "2").split(",").map(Number).filter(Boolean),
    train: trainFromAddress(search),
  };
}

export function openMockLink(onMessage, onStatus) {
  const floor = createFakeFloor(mockOptions());
  const push = () => onMessage(floor.state(Date.now()));
  let pushedAt = 0;
  floor.tick(Date.now());
  const timer = setInterval(() => {
    floor.tick(Date.now());
    if (Date.now() - pushedAt >= PUSH_MS) { pushedAt = Date.now(); push(); }
  }, TICK_MS);
  setTimeout(() => { onStatus(true); push(); }, 50);
  return {
    send(message) {
      floor.apply(message, Date.now());
      setTimeout(push, 60);
      return true;
    },
    close: () => clearInterval(timer),
  };
}
