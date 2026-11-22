// Every screen of the app. A screen is one file with `{ id, step, mount(app) }`; `mount` returns `{ el, update?(state), destroy?() }`.
// To add a screen: write its file, import it here, and add it to SCREENS. `step` is where the little train in the top bar sits (0 to 4).
// The flow (stops, song, seats) is moved through with app.go(id). LIVE says which screen takes over when the floor's
// game reaches a status while this phone holds a seat: a later screen (leaderboard, share, play again) replaces a value here.
import stops from "./stops.js";
import song from "./song.js";
import seats from "./seats.js";
import look from "./look.js";
import board from "./board.js";
import share from "./share.js";
import again from "./again.js";
import scan from "./scan.js";

export const SCREENS = [stops, song, seats, look, board, share, again, scan];
export const FIRST = "stops"; // where the flow starts
export const LANDING = "scan"; // where an app opened with no room and no train starts: the code reader
// A screen with `lands: true` (the leaderboard) joins the flow when a game puts the person there; see wanted() in main.js.
export const LIVE = { warmup: "look", countdown: "look", playing: "look", paused: "look", results: "board" };
