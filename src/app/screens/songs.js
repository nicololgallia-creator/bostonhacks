// Screen 3 with no train times: every song, as the "More songs" list, for a phone the MBTA did not answer. It is reached from
// the quiet "Pick a song without train times" button under "Try again". It says nothing about a ride, because none was loaded.
// Picking a song goes on to the seats. The trip then has a song and no stop and no ride, so the seats screen sends no transit.
import { songs } from "../../songs/index.js";
import { APPROVED } from "../../songs/pick.js";
import { songLevel } from "../../songs/level.js";
import { songSeconds } from "../../game/engine.js";
import { h, clock, button, coverTile, mascotMount } from "../parts.js";

// A label, never a control: the word and three pips, one, two or three filled, so it reads without colour. Worked out from the song.
const LEVELS = ["easy", "medium", "hard"];
export function levelBadge(song) {
  const rank = LEVELS.indexOf(songLevel(song));
  const pips = h("span", "pips", ...LEVELS.map((_, i) => h("i", i <= rank ? "on" : "")));
  pips.setAttribute("aria-hidden", "true");
  return h("span", "level", h("span", "sr", "Difficulty: "), LEVELS[rank][0].toUpperCase() + LEVELS[rank].slice(1), pips);
}

// One song as a row: cover, title with its difficulty, and how long it is. The "More songs" sheet and this list share it.
export const songRow = (s, onclick) => button("row", onclick, coverTile(s, "mini"), h("span", "name", s.title, levelBadge(s)), h("span", "chip", clock(songSeconds(s))));

// The second button of a failed load: the way on with no train times.
export const noTimes = (app) => ({ label: "Pick a song without train times", run: () => app.go("songs") });

// The songs Nicolo approved first, then the rest, each group shortest first.
const ordered = [...songs.filter((s) => APPROVED.includes(s.id)), ...songs.filter((s) => !APPROVED.includes(s.id))];

export default {
  id: "songs",
  step: 2,
  mount(app) {
    const list = h("ul", "all-songs");
    for (const s of ordered) {
      list.append(h("li", "", songRow(s, () => {
        delete app.trip.stop; // no stop and no ride were loaded, and none is claimed
        delete app.trip.ride;
        app.trip.song = s;
        app.go("seats");
      })));
    }
    const el = h("div", "flow", h("div", "top", h("div", "", h("h1", "ask", "Pick a ", h("span", "hl", "song")), h("p", "sub", "No train times right now. Any song works.")), mascotMount("song")),
      h("div", "sheet songs-list", list));
    return { el };
  },
};
