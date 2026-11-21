// Screen 4: "How many players?" The floor as the stage has it, one pad for each seat. Tap an open seat to take it, tap one
// of yours to give it back. A phone can hold several. "Ready!" starts the chosen song on the floor.
import "./seats.css";
import { h, svg, PLAY, button, mascotMount } from "../parts.js";
import { seatOf } from "../lines.js";

const READY_WAIT_MS = 2500; // after Ready!, wait this long for the floor to answer before the button comes back

// Who holds a seat: "open", "mine" (this phone) or "taken" (another phone).
export function seatState(state, spotId, clientId) {
  const owner = state.players.find((p) => p.spotId === spotId);
  return !owner ? "open" : owner.clientId === clientId ? "mine" : "taken";
}

export default {
  id: "seats",
  step: 3,
  mount(app) {
    const floor = h("div", "floor");
    floor.setAttribute("role", "group");
    floor.setAttribute("aria-label", "The floor. Each pad is a seat.");
    const rules = h("ul", "rules",
      h("li", "", h("b", "", "1 player"), " gets 2 lanes, one for each foot."),
      h("li", "", h("b", "", "2 or more"), " get 1 lane each. Either foot plays it."));
    const ready = button("btn", () => start(), "Ready!", h("span", "go", svg(PLAY)));
    const hint = h("p", "later");
    const el = h("div", "flow seats", h("div", "top",
      h("div", "", h("h1", "ask", "How many ", h("span", "hl", "players?")), h("p", "sub", "Tap to highlight seats")), mascotMount("seats")),
    floor, rules, h("div", "actions", ready, hint));

    let pending = false;
    function start() {
      const { song, stop, ride } = app.trip;
      pending = true;
      setTimeout(() => { pending = false; if (el.isConnected) paint(app.state); }, READY_WAIT_MS);
      app.send({ type: "join" });
      app.send({ type: "start", songIds: [song.id], transit: { stop: stop.name, mode: "train", endsAt: Date.now() + Math.round(ride.seconds * 1000) } });
      paint(app.state);
    }
    function tap(spotId) {
      const state = app.state;
      if (!state) return;
      const giving = seatState(state, spotId, app.id) === "mine";
      app.want(spotId, !giving);
      if (giving) return app.send({ type: "release", spotId });
      app.send({ type: "join" }); // the stage may have forgotten this phone; joining again is harmless
      app.send({ type: "claim", spotId });
    }

    let key = "";
    function paint(state) {
      if (!state) {
        key = "";
        floor.className = "floor empty";
        floor.replaceChildren(h("p", "", app.floorGone() ? "No floor is connected. Seats show here when the game is open on the laptop." : "Looking for the floor."));
        ready.disabled = true;
        hint.textContent = "";
        return;
      }
      const { spots, lanes } = state.layout;
      const nextKey = `${lanes}:${spots.map((s) => `${s.id}@${Object.values(s.rect)}`)}`;
      if (nextKey !== key) { // the layout changed (or this is the first State): draw the pads again; otherwise they are only patched
        key = nextKey;
        floor.className = "floor";
        floor.replaceChildren(h("div", "floor-in", ...spots.map((s) => pad(s, lanes))));
      }
      const live = state.status !== "lobby";
      const mine = [];
      for (const b of floor.querySelectorAll(".pad")) {
        const n = Number(b.dataset.seat);
        const st = seatState(state, n, app.id);
        if (st === "mine") mine.push(n);
        b.dataset.state = st;
        b.disabled = st === "taken" || (live && st === "open");
        b.setAttribute("aria-label", { open: `Player ${n}, open. Tap to take this seat.`, mine: `Player ${n}, yours. Tap to give it back.`, taken: `Player ${n}, taken by another phone.` }[st]);
        b.querySelector(".tag").textContent = { open: "", mine: "Yours", taken: "Taken" }[st];
      }
      const [one, many] = rules.children;
      one.classList.toggle("on", lanes === 2);
      many.classList.toggle("on", lanes === 1);
      ready.disabled = !mine.length || live || pending;
      ready.firstChild.textContent = pending ? "Starting..." : "Ready!";
      hint.textContent = live && !mine.length ? "A song is playing. Seats open when it ends."
        : !mine.length ? "Take a seat to get ready."
          : `You are ${mine.map((n) => `Player ${n}`).join(mine.length === 2 ? " and " : ", ").replace(/, (Player \d)$/, ", and $1")}.`;
    }
    function pad(spot, lanes) {
      const seat = seatOf(app.train.line, spot.id);
      const { u, v, w, h: tall } = spot.rect;
      const b = h("button", "pad", h("span", "lanes", ...Array.from({ length: lanes }, () => h("i"))), h("span", "tag"), h("span", "plate", h("small", "", "Player"), h("b", "", String(spot.id))));
      b.type = "button";
      b.dataset.seat = spot.id;
      b.style.cssText = `left:${u * 100}%;top:${v * 100}%;width:${w * 100}%;height:${tall * 100}%;--seat:${seat.fill};--seat-ink:${seat.ink}`;
      b.onclick = () => tap(spot.id);
      return b;
    }
    paint(app.state);
    return { el, update: paint };
  },
};
