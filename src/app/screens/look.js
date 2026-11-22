// Screen 5: "Look down!" The game is on the floor, so this screen says so and then stays calm: the warm-up (each seat
// taps its foot four times), the count, then the song's title, the train clock, the score, and Pause and Stop kept small.
// Stop needs a second tap. In a duel there is no team, so the score box shows the top score on the floor.
import "./look.css";
import { h, svg, clock, button, CHECK } from "../parts.js";
import { seatOf } from "../lines.js";
import { COUNTDOWN_MS } from "../../stage/session.js";

const ARROW ='<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M24 6v32M10 26l14 14 14-14" fill="none" stroke="currentColor" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const SURE_MS = 3000; // a first tap on Stop is forgotten after this long

export default {
  id: "look",
  step: 4,
  mount(app) {
    let status = null; // the status this screen is drawn for, so a State that changes nothing here redraws nothing
    let since = 0; // when the count began, on this phone's clock
    let timer = 0;
    let sure = 0;
    const el = h("div", "flow look");
    const parts = {}; // the elements text is written into

    function build(kind) {
      parts.kind = kind;
      if (kind === "warm") {
        parts.times = h("span", "hl", "4 times");
        parts.rows = h("ul", "warm-rows");
        parts.key = "";
        parts.skip = button("skip", () => app.send({ type: "skipWarmup" }), "Skip");
        el.replaceChildren(h("h1", "ask", "Tap your foot ", parts.times), parts.rows,
          h("p", "sub", "Find your square on the floor. Tap it, then lift your foot, four times."), h("div", "pills", parts.skip));
      } else if (kind === "count") {
        parts.digit = h("b", "digit");
        parts.number = h("div", "count", parts.digit);
        el.replaceChildren(h("h1", "ask big", "Look ", h("span", "hl", "down!")), parts.number, h("span", "arrow", svg(ARROW)), h("p", "sub", "Your song starts on the floor."));
        parts.last = "";
      } else if (kind === "play") {
        parts.title = h("h2", "");
        parts.state = h("h1", "ask", "Eyes on the ", h("span", "hl", "floor"));
        parts.clockNum = h("b", "");
        parts.clockLabel = h("small", "");
        parts.score = h("b", "");
        parts.pause = button("pill", () => app.send({ type: parts.paused ? "resume" : "pause" }), "Pause");
        parts.stop = button("pill", () => {
          if (!sure) { sure = setTimeout(() => { sure = 0; parts.stop.textContent = "Stop"; parts.stop.classList.remove("sure"); }, SURE_MS); parts.stop.textContent = "Tap again to stop"; parts.stop.classList.add("sure"); return; }
          clearTimeout(sure); sure = 0;
          app.send({ type: "stop" });
        }, "Stop");
        parts.clockBox = h("div", "stat", h("small", "", "Your stop in"), parts.clockNum, parts.clockLabel);
        parts.scoreLabel = h("small", "", "Team score");
        el.replaceChildren(parts.state, h("div", "now", h("small", "", "Playing"), parts.title),
          h("div", "stats", parts.clockBox, h("div", "stat", parts.scoreLabel, parts.score)),
          h("div", "pills", parts.pause, parts.stop));
      } else {
        parts.score = h("b", "");
        el.replaceChildren(h("h1", "ask", "That was ", h("span", "hl", "the song")), h("div", "stats", h("div", "stat", h("small", "", "Team score"), parts.score)), h("p", "sub", "Look at the floor to see how everyone did."));
      }
    }

    // One row for each seat this phone holds: its colour, four station dots that fill as the floor sees a tap, and a tick when ready.
    function warmRow(spotId, need) {
      const { fill, ink } = seatOf(app.train.line, spotId);
      const chip = h("span", "seat-chip", String(spotId));
      const dots = h("span", "warm-dots", ...Array.from({ length: need }, () => h("i")));
      const tick = h("span", "warm-tick", svg(CHECK));
      const li = h("li", "warm-row", chip, h("span", "warm-who", h("b", "", `Player ${spotId}`), dots), tick);
      li.style.cssText = `--seat:${fill};--seat-ink:${ink}`;
      li.dataset.seat = spotId;
      return li;
    }
    function writeWarm(w) {
      const need = w?.need ?? 4;
      const seats = app.mine();
      const key = `${need}:${seats}`;
      if (key !== parts.key) { // the seats this phone holds changed: draw the rows again; otherwise they are only patched
        parts.key = key;
        parts.times.textContent = `${need} times`;
        parts.rows.replaceChildren(...seats.map((n) => warmRow(n, need)));
      }
      for (const li of parts.rows.children) {
        const p = w?.players?.[li.dataset.seat] ?? { taps: 0, ready: false };
        [...li.querySelector(".warm-dots").children].forEach((d, i) => d.classList.toggle("on", i < p.taps));
        li.classList.toggle("ready", p.ready);
        li.setAttribute("aria-label", `Player ${li.dataset.seat}, ${p.ready ? "ready" : `${Math.min(p.taps, need)} of ${need} taps`}`);
      }
    }

    function write(state) {
      const live = state.status === "playing" || state.status === "paused" || state.status === "countdown";
      const kind = state.status === "warmup" ? "warm" : state.status === "countdown" ? "count" : live ? "play" : "done";
      if (kind !== parts.kind) build(kind);
      if (kind === "warm") { since = 0; return writeWarm(state.warmup); }
      if (kind === "count") {
        if (!since) since = Date.now();
        const left = Math.max(1, Math.ceil((COUNTDOWN_MS - (Date.now() - since)) / 1000));
        if (String(left) !== parts.last) { parts.last = String(left); parts.digit.textContent = left; parts.number.classList.remove("pop"); void parts.number.offsetWidth; parts.number.classList.add("pop"); }
        return;
      }
      since = 0;
      const duel = state.mode === "versus";
      const top = Math.max(0, ...state.players.map((p) => p.score));
      parts.score.textContent = (duel ? top : state.team?.score ?? 0).toLocaleString("en-US");
      if (kind !== "play") return;
      parts.scoreLabel.textContent = duel ? "Top score" : "Team score";
      parts.title.textContent = state.song?.title ?? "";
      parts.paused = state.status === "paused";
      parts.pause.textContent = parts.paused ? "Resume" : "Pause";
      parts.state.firstChild.textContent = parts.paused ? "Paused" : "Eyes on the ";
      parts.state.lastChild.hidden = parts.paused;
      const left = state.transit?.endsAt ? Math.max(0, Math.round((state.transit.endsAt - Date.now()) / 1000)) : null;
      parts.clockBox.hidden = left === null;
      if (left !== null) {
        parts.clockNum.textContent = left > 0 ? clock(left) : "Now";
        parts.clockLabel.textContent = state.transit.stop;
      }
    }

    // The count and the train clock follow this phone's clock, so a second timer redraws them while the screen is open.
    const redraw = () => app.state && write(app.state);
    timer = setInterval(redraw, 250);
    redraw();
    return { el, update: (state) => state && write(state), destroy() { clearInterval(timer); clearTimeout(sure); } };
  },
};
