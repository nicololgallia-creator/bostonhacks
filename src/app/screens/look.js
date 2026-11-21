// Screen 5: "Look down!" The game is on the floor, so this screen says so and then stays calm: the count, then the song's
// title, the train clock, the team's score, and Pause and Stop kept small. Stop needs a second tap.
import "./look.css";
import { h, svg, clock, button } from "../parts.js";
import { COUNTDOWN_MS } from "../../stage/session.js";

const ARROW = '<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M24 6v32M10 26l14 14 14-14" fill="none" stroke="currentColor" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/></svg>';
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
      if (kind === "count") {
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
        el.replaceChildren(parts.state, h("div", "now", h("small", "", "Playing"), parts.title),
          h("div", "stats", parts.clockBox, h("div", "stat", h("small", "", "Team score"), parts.score)),
          h("div", "pills", parts.pause, parts.stop));
      } else {
        parts.score = h("b", "");
        el.replaceChildren(h("h1", "ask", "That was ", h("span", "hl", "the song")), h("div", "stats", h("div", "stat", h("small", "", "Team score"), parts.score)), h("p", "sub", "Look at the floor to see how everyone did."));
      }
    }

    function write(state) {
      const live = state.status === "playing" || state.status === "paused" || state.status === "countdown";
      const kind = state.status === "countdown" ? "count" : live ? "play" : "done";
      if (kind !== parts.kind) build(kind);
      if (kind === "count") {
        if (!since) since = Date.now();
        const left = Math.max(1, Math.ceil((COUNTDOWN_MS - (Date.now() - since)) / 1000));
        if (String(left) !== parts.last) { parts.last = String(left); parts.digit.textContent = left; parts.number.classList.remove("pop"); void parts.number.offsetWidth; parts.number.classList.add("pop"); }
        return;
      }
      since = 0;
      parts.score.textContent = (state.team?.score ?? 0).toLocaleString("en-US");
      if (kind !== "play") return;
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
