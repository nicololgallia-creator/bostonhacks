// The look of each line, in one place, so the colours can be tuned. A line sets the page's hero colour (a half-way between the true MBTA colour and a pastel, always
// with ink text on it). The true MBTA colour appears only in the small round badge, where riders expect it:
// `badge` is the colour (from src/tokens.css), `badgeInk` the letter on it (white, or ink on orange).
export const BUTTER = "#FFDB62"; // the highlighter stroke under a headline

const HERO = { red: "#E7685E", orange: "#F3AA45", blue: "#5B86D3", green: "#4FAF79" };
const WHITE = "#FFFFFF";

const GREEN = (letter) => ({ name: `Green Line ${letter}`, letter, hero: HERO.green, badge: "var(--line-green)", badgeInk: WHITE });

export const LINES = {
  Red: { name: "Red Line", letter: "R", hero: HERO.red, badge: "var(--line-red)", badgeInk: WHITE },
  Mattapan: { name: "Mattapan Line", letter: "M", hero: HERO.red, badge: "var(--line-mattapan)", badgeInk: WHITE },
  Orange: { name: "Orange Line", letter: "O", hero: HERO.orange, badge: "var(--line-orange)", badgeInk: "var(--line-orange-ink)" },
  Blue: { name: "Blue Line", letter: "B", hero: HERO.blue, badge: "var(--line-blue)", badgeInk: WHITE },
  "Green-B": GREEN("B"),
  "Green-C": GREEN("C"),
  "Green-D": GREEN("D"),
  "Green-E": GREEN("E"),
};

// A line the pilot does not know still renders: blue, named by its id.
export const lineOf = (id) => LINES[id] ?? { name: id, letter: id[0], hero: HERO.blue, badge: "var(--line-blue)", badgeInk: WHITE };

