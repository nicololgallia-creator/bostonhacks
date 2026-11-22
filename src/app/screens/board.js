// Screen 6: "Leaderboard". The players ranked by score, each with the bonus they earned and what it was for. The rows that
// belong to this phone are marked. One player gets their own card (grade, best combo, perfects) instead of a one-row table.
// Drawn from the copy of the results kept in after.js, so the stage going back to the lobby does not change it.
import "./after.css";
import { h, svg, PLAY, button, mascotMount, reduceMotion, isCalm } from "../parts.js";
import { lastResults, rank, isTie, matchup } from "../after.js";
import { seatOf } from "../lines.js";

const COUNT_MS = 900;   // how long a score takes to count up
const STAGGER_MS = 90;  // each row starts this much after the one above
const fmt = (n) => n.toLocaleString("en-US");
const ease = (k) => 1 - (1 - k) ** 3;

// A number that counts up from 0. It is a function of the clock, so a tab left and come back to shows the final number at once.
// The real number is in place from the start, for reduced motion and for anyone who cannot watch it count.
function countUp(el, to, delay, stops) {
  el.textContent = fmt(to);
  if (reduceMotion || isCalm() || to === 0) return;
  const begin = performance.now() + delay;
  let frame = 0;
  const done = () => { cancelAnimationFrame(frame); el.textContent = fmt(to); document.removeEventListener("visibilitychange", done); };
  const step = (now) => {
    const k = (now - begin) / COUNT_MS;
    if (k >= 1) return done();
    el.textContent = fmt(Math.round(to * ease(Math.max(0, k))));
    frame = requestAnimationFrame(step);
  };
  el.textContent = "0";
  frame = requestAnimationFrame(step);
  document.addEventListener("visibilitychange", done);
  stops.push(done);
}

const bonusTag = (row) => h("span", "bonus", h("b", "", `+${row.bonus}!`), ` ${row.bonusFor}`);
const place = (row) => h("span", `place${row.place === 1 ? " first" : ""}`, String(row.place));
const seatChip = (train, spotId) => {
  const { fill, ink } = seatOf(train.line, spotId);
  const el = h("span", "seat-chip", String(spotId));
  el.style.cssText = `--seat:${fill};--seat-ink:${ink}`;
  return el;
};
const you = () => h("span", "you", "You");

function rowOf(row, i, train, stops) {
  const score = h("b", "score");
  countUp(score, row.total, i * STAGGER_MS, stops);
  const li = h("li", "rank", place(row), seatChip(train, row.spotId), h("span", "who", `Player ${row.spotId}`, row.mine ? you() : ""), score);
  li.style.setProperty("--i", i);
  li.style.setProperty("--seat", seatOf(train.line, row.spotId).fill);
  li.dataset.mine = row.mine;
  li.setAttribute("aria-label", `${row.place}. Player ${row.spotId}${row.mine ? ", you" : ""}, ${fmt(row.total)} points${row.bonus ? `, ${row.bonus} bonus for ${row.bonusFor}` : ""}${row.winner ? ", winner" : ""}`);
  if (row.bonus) li.append(bonusTag(row));
  if (row.winner) li.append(h("span", "bonus", h("b", "", "Winner")));
  return li;
}

const gradeBadge = (grade) => h("span", "grade", h("small", "", "Grade"), h("b", "", grade));

function team(kept, stops) {
  const score = h("b", "");
  countUp(score, kept.team.score, kept.players.length * STAGGER_MS, stops);
  return h("div", "team", h("div", "", h("small", "", "Team score"), score), kept.team.grade ? gradeBadge(kept.team.grade) : "");
}

function solo(row, kept, train, stops) {
  const score = h("b", "big-score");
  countUp(score, row.total, 0, stops);
  const stat = (label, value) => h("div", "stat", h("small", "", label), h("b", "", String(value)));
  return h("div", "solo",
    h("div", "solo-card",
      h("div", "solo-who", seatChip(train, row.spotId), h("span", "", `Player ${row.spotId}`), row.mine ? you() : ""),
      h("div", "solo-score", h("div", "", h("small", "", "Score"), score), row.grade ? gradeBadge(row.grade) : "")),
    h("div", "stats", stat("Best combo", row.maxCombo), stat("Perfect", row.perfects)),
    row.bonus ? bonusTag(row) : "");
}

export default {
  id: "board",
  step: 4,
  lands: true, // a finished song puts the person here once, and Back does not come back to it
  mount(app) {
    const kept = lastResults();
    if (!kept) {
      return { el: h("div", "flow", h("h1", "ask", "No song ", h("span", "hl", "yet")),
        h("div", "notice", h("h2", "", "No scores to show."), h("p", "", "Play a song on the floor and the scores show here when it ends."), button("btn", () => app.restart(), "Pick a song"))) };
    }
    const stops = [];
    const rows = rank(kept.players, app.id, kept);
    const one = rows.length === 1;
    const duel = kept.mode === "versus" && !one; // a duel has no team score and no bonuses
    const title = one ? ["Your ", h("span", "hl", "score")] : duel ? [h("span", "hl", isTie(rows, kept) ? "Tie" : matchup(rows.length))] : [h("span", "hl", "Leaderboard")];
    const body = one ? solo(rows[0], kept, app.train, stops) : h("ol", "ranks", ...rows.map((r, i) => rowOf(r, i, app.train, stops)));
    const el = h("div", "flow board",
      h("div", "top", h("h1", "ask", ...title), mascotMount("board")),
      body,
      one || duel ? "" : team(kept, stops),
      h("div", "actions", button("btn", () => app.go("share"), "Next", h("span", "go", svg(PLAY)))));
    return { el, destroy: () => stops.forEach((stop) => stop()) };
  },
};

