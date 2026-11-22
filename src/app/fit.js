// The songs that fit a ride, longest first: the song plus 4 s of lead-in and score screen, with 20 s to spare (the same
// budget as src/songs/pick.js). The song screen and the play-again screen both choose from this list.
import { songs } from "../songs/index.js";
import { songSeconds } from "../game/engine.js";

export const fitting = (seconds) => songs.filter((s) => songSeconds(s) + 4 <= seconds - 20).reverse();
