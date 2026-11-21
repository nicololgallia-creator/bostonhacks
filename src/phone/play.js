// The remote while a song runs, and after it: the live screen and the results.
// Everything is drawn from the stage's State (PLAN.md, "Seats and session"). main.js calls show() on
// every State and hide() when the stage is back in the lobby. The screen is built once and then
// changed in place, so a Stop that is waiting for its second tap is never drawn away.
// It reuses .row, .order and .foot from ride.css; colours, sizes and motion come from tokens.css.
import "./play.css";
import { RESULTS_MS } from "../stage/session.js";

const STOP_CONFIRM_MS = 3000; // the second tap on Stop has to come within this

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const num = (x) => Number(x).toLocaleString("en-US");
const dur = (sec) => {
  sec = Math.max(0, Math.round(sec));
  const m = Math.floor(sec / 60), s = sec % 60;
  return m ? (s ? `${m} min ${s} s` : `${m} min`) : `${s} s`;
};
const seatColour = (n) => (n ? `var(--seat-${n})` : "var(--text)");
// The stage sends the team's totals; if an older stage does not, add up every seat.
const teamOf = (state) => state.team ?? { score: state.players.reduce((n, p) => n + (p.score || 0), 0), grade: null };

export function createPlay({ screen, send, id }) {
  let mode = null;     // "live" or "results": the screen that is drawn now
  let el = null;       // its section
  let last = null;     // the latest State
  let armed = 0;       // timer of a Stop that has had its first tap
  let clock = 0;       // the one-second timer for the clock and the next-song line
  let resultsAt = 0;   // when results first showed, for "Next song in N s"
  const q = (s) => el.querySelector(s);

  function disarm() {
    clearTimeout(armed);
    armed = 0;
    const stop = el?.querySelector("[data-stop]");
    if (!stop) return;
    stop.removeAttribute("data-armed");
    stop.textContent = "Stop";
  }

  // ---- Countdown, playing, paused ----

  function buildLive() {
    el = document.createElement("section");
    el.className = "play";
    el.innerHTML = `
      <div><h1 class="title"></h1><p class="sub"></p></div>
      <p class="clock"><span class="clock-label"></span> <span class="clock-time"></span></p>
      <dl class="stats">
        <div><dt>Team score</dt><dd data-score></dd></div>
      </dl>
      <div class="foot">
        <button class="btn btn-primary" type="button" data-pause></button>
        <div class="pair">
          <button class="btn btn-quiet" type="button" data-skip>Skip</button>
          <button class="btn btn-quiet" type="button" data-stop aria-live="polite">Stop</button>
        </div>
      </div>`;
    el.addEventListener("click", (e) => {
      const b = e.target.closest("button");
      if (!b) return;
      if (b.hasAttribute("data-pause")) send({ type: last.status === "paused" ? "resume" : "pause" });
      else if (b.hasAttribute("data-skip")) send({ type: "skip" });
      else if (b.hasAttribute("data-stop")) {
        if (armed) { disarm(); send({ type: "stop" }); return; }
        b.setAttribute("data-armed", "");
        b.textContent = "Tap again to stop";
        armed = setTimeout(disarm, STOP_CONFIRM_MS);
      }
    });
    screen.replaceChildren(el);
  }

  // Everyone plays one song together, so the number on the live screen is the team's.
  function paintLive(state, mine) {
    const paused = state.status === "paused";
    q(".title").textContent = state.song?.title ?? "Now playing";
    q(".sub").textContent = paused ? "Paused."
      : !mine.length ? "You are watching this song. Pick a seat when it ends."
      : state.status === "countdown" ? "Get ready. Look at the floor."
      : "Look at the floor.";
    q("[data-pause]").textContent = paused ? "Resume" : "Pause";
    q("[data-score]").textContent = num(teamOf(state).score);
    paintClock();
  }

  // With a train (the State has `transit`) the clock counts to the train, else to the end of the song.
  function paintClock() {
    if (mode !== "live") return;
    const t = last.transit;
    let label, time = "";
    if (t?.endsAt) {
      const left = (t.endsAt - Date.now()) / 1000;
      if (left > 0) { label = t.mode === "train" ? `${t.stop} in` : "Train in"; time = dur(left); }
      else label = t.mode === "train" ? `You are at ${t.stop}.` : "Your train is due now.";
    } else {
      label = "Song ends in";
      time = dur(Math.min(last.secondsLeft, last.song?.seconds ?? last.secondsLeft));
    }
    q(".clock-label").textContent = label;
    q(".clock-time").textContent = time;
  }

  // ---- Results ----

  // The team first: its grade and score, then each of your seats with the hits out of its own total.
  function buildResults(state, mine) {
    resultsAt = Date.now();
    const team = teamOf(state);
    const together = state.players.filter((p) => p.spotId).length > 1;
    const rows = mine.map((p) => `
      <div class="row" data-static style="--c: ${seatColour(p.spotId)}">
        <span class="order">${p.spotId}</span>
        <span class="row-main"><span class="row-title">Seat ${p.spotId}</span><span class="row-sub">${p.counts.perfect + p.counts.good} of ${p.total} hits</span></span>
        <span class="row-end">${num(p.score)}</span>
      </div>`).join("");
    el = document.createElement("section");
    el.className = "play";
    el.innerHTML = `
      <div><h1 class="title">${together ? "You played it together." : "Your result."}</h1><p class="sub"></p></div>
      <div class="grade-row">
        ${team.grade ? `<span class="grade" role="img" aria-label="Team grade ${esc(team.grade)}">${esc(team.grade)}</span>` : ""}
        <div class="grade-side"><span class="grade-score">${num(team.score)}</span><span class="grade-best">${together ? "Team score" : "Score"}</span></div>
      </div>
      ${mine.length ? `<p class="hint">${mine.length > 1 ? "Your seats" : "Your seat"}</p><div class="ranks">${rows}</div>` : ""}
      <div class="foot"><p class="next"></p></div>`;
    q(".sub").textContent = state.song?.title ?? "";
    screen.replaceChildren(el);
  }

  function paintNext() {
    if (mode !== "results") return;
    const n = Math.max(0, Math.ceil((RESULTS_MS - (Date.now() - resultsAt)) / 1000));
    const next = last.queue[0];
    q(".next").textContent = next
      ? (n ? `Next song in ${n} s: ${next.title}` : `Next song: ${next.title}`)
      : (n ? `That was the last song. Back to the lobby in ${n} s.` : "That was the last song.");
  }

  return {
    show(state) {
      last = state;
      const want = state.status === "results" ? "results" : "live";
      const mine = state.players.filter((p) => p.clientId === id && p.spotId).sort((a, b) => a.spotId - b.spotId);
      if (want !== mode) {
        disarm();
        mode = want;
        if (want === "live") buildLive(); else buildResults(state, mine);
        if (!clock) clock = setInterval(() => { paintClock(); paintNext(); }, 1000);
      }
      if (want === "live") paintLive(state, mine); else paintNext();
    },
    hide() {
      clearInterval(clock);
      clock = 0;
      disarm();
      mode = null;
      el = null;
    },
  };
}
