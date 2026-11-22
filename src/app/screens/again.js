// Screen 8: "Play again?" Two songs as tickets, the two that best fill what is left of the ride. Tapping one starts it on the
// floor with the seats this phone still holds, exactly as the song screen does. A phone that has lost its seats goes to
// the seats screen first. "Done" goes back to the start.
import "./after.css";
import { h, svg, PLAY, clock, button, coverTile, mascotMount } from "../parts.js";
import { songSeconds } from "../../game/engine.js";
import { lastResults, twoSongs, rideLeft } from "../after.js";

const WAIT_MS = 12000;    // a song picked while the floor still shows the last scores is sent when it goes quiet, and forgotten after this long
const ANSWER_MS = 2500;   // after the song is sent, this long for the floor to answer before the tickets come back

export default {
  id: "again",
  step: 4,
  mount(app) {
    const kept = lastResults();
    const left = rideLeft(kept?.transit);
    const options = twoSongs(left, kept?.song.id);
    let chosen = null; // the song picked
    let sent = false;  // and whether the floor has been told
    let since = 0;

    const note = h("p", "later");
    note.setAttribute("role", "status");
    const tickets = options.map((song) => {
      const b = button("ticket pick", () => choose(song), ticket(app, song, left));
      b.setAttribute("aria-label", `Play ${song.title}, ${clock(songSeconds(song))}`);
      return b;
    });
    const el = h("div", "flow again",
      h("div", "top", h("h1", "ask", "Play ", h("span", "hl", "again?")), mascotMount("again")),
      h("div", "picks", ...tickets),
      note,
      h("div", "actions", button("done", () => app.restart(), "Done")));

    function choose(song) {
      if (chosen) return;
      if (!app.mine().length) { // the seats were given up: pick them again first, with this song
        const t = kept?.transit;
        if (t) { app.trip.stop = { name: t.stop }; app.trip.ride = { seconds: Math.max(0, Math.round(rideLeft(t))) }; } // the clock keeps running
        else if (!app.trip.stop || !app.trip.ride) return app.restart();
        app.trip.song = song;
        return app.go("seats");
      }
      chosen = song;
      since = Date.now();
      paint(app.state);
    }

    function paint(state) {
      if (chosen && !sent && state?.status === "lobby" && app.mine().length) {
        sent = true;
        app.send({ type: "join" });
        app.send({ type: "start", songIds: [chosen.id], transit: kept?.transit ?? null });
        setTimeout(() => { chosen = null; sent = false; if (el.isConnected) paint(app.state); }, ANSWER_MS);
      }
      if (chosen && !sent && Date.now() - since > WAIT_MS) chosen = null;
      tickets.forEach((b, i) => { b.disabled = Boolean(chosen); b.dataset.picked = chosen?.id === options[i].id; });
      note.textContent = sent ? "Starting your song on the floor."
        : chosen ? "The floor is showing the last scores. Your song starts in a moment."
          : !app.mine().length ? "You gave up your seats. Pick a song, then take your seats again." : "";
    }

    paint(app.state);
    return { el, update: paint };
  },
};

// A song as a ticket: the line, the cover, the title, and how it sits in the ride that is left.
function ticket(app, song, left) {
  const { line, train } = app;
  const secs = songSeconds(song);
  const known = left > 0;
  const run = h("span", "run", h("i", "r-base"), h("i", "r-fill"), h("b"), h("b"), h("span", "t-train"));
  run.style.setProperty("--k", `${Math.max(8, Math.min(100, (secs / left) * 100))}%`);
  return h("span", "tk",
    h("span", "tk-top", h("span", "roundel", line.letter), h("span", "", `${line.name}, car ${train.car}`), h("span", "go", svg(PLAY))),
    h("span", "tk-main", coverTile(song, "big"), h("span", "pick-text", h("span", "title", song.title), h("span", "by", song.by.split(". ")[0]))),
    h("span", "tk-stub", known ? run : "",
      h("span", "times", h("span", "", h("b", "", clock(secs)), "song"), known ? h("span", "", `Your stop in ${Math.max(1, Math.round(left / 60))} min`) : "")));
}
