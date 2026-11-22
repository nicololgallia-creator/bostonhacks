// Screen 3: "Recommended song". One song that fits the ride, shown as a ticket, with "See more songs".
// "Play this song" goes on to the seats.
import { rideSeconds } from "../../mbta/api.js";
import { pickSongs } from "../../songs/pick.js";
import { songs, songById } from "../../songs/index.js";
import { songSeconds } from "../../game/engine.js";
import { fitting } from "../fit.js";
import { h, svg, PLAY, clock, button, coverTile, mascotMount, skeleton, failure, rest } from "../parts.js";
import { noTimes, levelBadge, songRow } from "./songs.js";

export default {
  id: "song",
  step: 2,
  mount(app) {
    const body = h("div", "song-body", skeleton(2, "margin-left:0;height:8rem"));
    const el = h("div", "flow", h("div", "top", h("h1", "ask", "Recommended ", h("span", "hl", "song")), mascotMount("song")), body);
    const { stop } = app.trip;

    const load = () => {
      body.replaceChildren(skeleton(2, "margin-left:0;height:8rem"));
      app.memo(`ride:${app.train.atStopId}:${stop.id}`, () => rideSeconds({ fromStopId: app.train.atStopId, toStopId: stop.id, routeId: app.train.line, directionId: app.train.directionId })).then(
        (ride) => { if (el.isConnected) { showSong(app, body, ride); rest(); } },
        (e) => { if (el.isConnected) body.replaceChildren(failure(e.message, load, noTimes(app))); },
      );
    };
    load();
    return { el };
  },
};

function showSong(app, body, ride) {
  const { songIds, fits } = pickSongs({ seconds: ride.seconds });
  const options = fits ? fitting(ride.seconds) : songs.slice(0, 3);
  app.trip.ride = ride;
  const first = app.trip.song && options.some((s) => s.id === app.trip.song.id) ? app.trip.song : songById(songIds[0]) ?? songs[0]; // Back from the seats keeps the pick
  draw(app, body, first, options, true);
}

function draw(app, body, song, options, enter) {
  const { line, train, trip } = app;
  const secs = songSeconds(song);
  const rideSecs = trip.ride.seconds;
  const run = h("div", "run", h("i", "r-base"), h("i", "r-fill"), h("b"), h("b"), h("span", "t-train"));
  run.style.setProperty("--k", `${Math.max(8, Math.min(100, (secs / rideSecs) * 100))}%`);
  const ticket = h("div", `ticket${enter ? "" : " swap"}`, h("article", "tk",
    h("div", "tk-top", h("span", "roundel", line.letter), h("span", "", line.name), h("span", "", `Car ${train.car}`)),
    h("div", "tk-main",
      h("div", "tk-cover", coverTile(song, "big"), levelBadge(song)),
      h("h2", "", song.title),
      h("p", "", song.by.split(". ")[0]), // the composer and year; the long credit stays in the song file
    ),
    h("div", "tk-stub", run, h("p", "times", h("span", "", h("b", "", clock(secs)), "song"), h("span", "", `Your ride ${Math.max(1, Math.round(rideSecs / 60))} min`))),
  ));
  const play = button("btn", () => { trip.song = song; app.go("seats"); }, "Play this song", h("span", "go", svg(PLAY)));
  const more = button("btn ghost", () => openSheet(options, song, (next) => draw(app, body, next, options, false)), "See more songs");
  body.className = enter ? "song-body flow" : "song-body flow still"; // a swap of the song on the same screen shows at rest: nothing replays
  body.replaceChildren(ticket, h("div", "actions", play, more));
  rest();
}

function openSheet(options, current, choose) {
  const list = h("ul");
  const sheet = h("dialog", "sheet", h("h2", "", "More songs"), list);
  for (const s of options) {
    const row = songRow(s, () => { sheet.close(); choose(s); });
    if (s.id === current.id) row.setAttribute("aria-current", "true");
    list.append(h("li", "", row));
  }
  sheet.append(button("btn ghost", () => sheet.close(), "Close"));
  sheet.onclose = () => sheet.remove();
  sheet.onclick = (e) => { if (e.target === sheet) sheet.close(); };
  document.body.append(sheet);
  sheet.showModal();
}
