// The review page's colours, shared by the two canvases. Seat colours come from the app (src/app/lines.js): red, orange, blue,
// green, in seat order. They are pastel, so a thin line in one is drawn darker (mixed with ink). The alert colour is for problems
// and nothing else; the app has none (it is a phone game), so this page names one.
import { LINES } from "../app/lines.js";
import { INK, mix } from "../game/floor-look.js";

export { INK, mix };
export const INK_2 = "#444B5C";
export const ALERT = "#B3261E"; // 6.6:1 on white
const SEATS = [LINES.Red.hero, LINES.Orange.hero, LINES.Blue.hero, LINES["Green-B"].hero];

export const seatColour = (spotId) => SEATS[(((spotId - 1) % 4) + 4) % 4];
export const seatLine = (spotId, share = 0.5) => mix(seatColour(spotId), INK, share);
