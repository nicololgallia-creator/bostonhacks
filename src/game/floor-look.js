// The floor's look, in one place: the colours of a line, the seat colours, the two fonts and the small
// drawing helpers every floor screen shares. Nothing here knows about a song or a score.
// Flat shapes only. The field is the colour of the line the train is on; tiles, outlines and text are ink;
// white is for the hit moment and for text that sits on ink; gold is the one highlight.
import { LINES, lineOf, BUTTER } from "../app/lines.js";

export const INK = "#141413";
export const WHITE = "#FFFFFF";
export const GOLD = BUTTER; // #FFDB62
const CAP = "#57679B"; // cap blue, the fourth seat colour when a line takes one of the other four

// The full-strength MBTA colour appears only in the small round line badge (values from src/tokens.css).
const BADGE = {
  Red: ["#DA291C", WHITE], Mattapan: ["#DA291C", WHITE], Orange: ["#ED8B00", INK], Blue: ["#003DA5", WHITE],
  "Green-B": ["#00843D", WHITE], "Green-C": ["#00843D", WHITE], "Green-D": ["#00843D", WHITE], "Green-E": ["#00843D", WHITE],
};
const POOL = [LINES.Red.hero, LINES.Orange.hero, LINES["Green-B"].hero, LINES.Blue.hero]; // the four half-way shades

const hexOf = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
export function mix(a, b, k) {
  const p = hexOf(a);
  const q = hexOf(b);
  return "#" + p.map((v, i) => Math.round(v + (q[i] - v) * k).toString(16).padStart(2, "0")).join("");
}

// Everything a screen needs to colour itself for one line. Built once for a line, then reused.
const themes = new Map();
export function themeFor(lineId) {
  if (themes.has(lineId)) return themes.get(lineId);
  const line = lineOf(lineId);
  const field = line.hero;
  // Seat colours: the half-way shades, minus the line's own, topped up with cap blue so there are always four.
  const seats = [...POOL.filter((c) => c !== field), CAP].slice(0, 4).map((fill) => ({ fill, text: fill === CAP ? WHITE : INK }));
  const [badge, badgeInk] = BADGE[lineId] ?? BADGE.Blue;
  const slot = mix(field, WHITE, 0.3); // a lane: lighter than the field, so ink tiles read on it
  const theme = {
    name: line.name, letter: line.letter, field, badge, badgeInk, seats,
    slot,
    slotOpen: mix(field, WHITE, 0.14), // a seat nobody has taken
    platform: mix(field, WHITE, 0.55), // the foot zone at rest
    rail: mix(slot, INK, 0.5),
    sleeper: mix(slot, INK, 0.16),
    ghost: mix(slot, INK, 0.12), // a tile that was played, sliding away
    dull: mix(slot, INK, 0.28), // a tile that was missed
    quiet: mix(field, INK, 0.55), // small text that is not for reading from across the car
    board: mix(INK, WHITE, 0.1), // a row of the departure board
  };
  themes.set(lineId, theme);
  return theme;
}
export const seatOf = (theme, spotId) => theme.seats[(((spotId - 1) % 4) + 4) % 4];

// A duel is a versus song with two or more seats. A versus start with one seat runs as team, and the State says so.
export const isDuel = (view) => view.mode === "versus" && view.players.length >= 2;
// What a duel is called by its players: "1v1", "1v1v1", "1v1v1v1".
export const matchup = (players) => Array(Math.max(2, players)).fill(1).join("v");

export const clamp01 = (x) => Math.min(1, Math.max(0, x));
export const easeOut = (x) => 1 - (1 - clamp01(x)) ** 3;
export const easeIn = (x) => clamp01(x) ** 3;
export const backOut = (x) => { x = clamp01(x); return 1 + 2.70158 * (x - 1) ** 3 + 1.70158 * (x - 1) ** 2; };
// 1 at t = 0 and settles to 0 in 0.4 s: the bounce behind a pop. t in seconds.
export const spring = (t) => (t < 0 || t > 0.6 ? 0 : Math.exp(-t * 10) * Math.cos(t * 26));

const DISPLAY = '"Lilita One", "Arial Black", system-ui, sans-serif';
const BODY = 'Nunito, system-ui, sans-serif';
const FONTS = [
  // Each address is written out in full here: the build only carries a font file along when it sees the literal path.
  ["Lilita One", new URL("../app/fonts/lilita-one-latin.woff2", import.meta.url).href, { weight: "400" }],
  ["Nunito", new URL("../app/fonts/nunito-latin.woff2", import.meta.url).href, { weight: "600 900" }],
];
// Resolves once both fonts are in, so the canvas never draws a word in a stand-in face.
export function loadFonts() {
  return Promise.all(FONTS.map(([name, path, descriptors]) =>
    new FontFace(name, `url(${path})`, descriptors).load().then((face) => document.fonts.add(face))))
    .then(() => true)
    .catch((err) => { console.warn("The floor's fonts did not load, so it uses a system font:", err.message); return false; });
}

// The canvas and its measures. H is what sizes text (nothing smaller than H / 20), U is a pixel at 1280 wide.
export function createKit(canvas) {
  const ctx = canvas.getContext("2d");
  const fonts = [new Map(), new Map()]; // [body, display]: size -> font string, so a frame builds none
  const kit = {
    ctx, W: 0, H: 0, U: 1, rad: 0, radBottom: [0, 0, 0, 0],
    resize() {
      const dpr = window.devicePixelRatio || 1;
      kit.W = window.innerWidth;
      kit.H = window.innerHeight;
      kit.U = kit.W / 1280;
      canvas.width = Math.round(kit.W * dpr);
      canvas.height = Math.round(kit.H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      kit.rad = 18 * kit.U;
      kit.radBottom = [0, 0, kit.rad, kit.rad];
    },
    font(px, display) {
      const size = Math.max(1, Math.round(px));
      const cache = fonts[display ? 1 : 0];
      let f = cache.get(size);
      if (!f) cache.set(size, (f = display ? `400 ${size}px ${DISPLAY}` : `800 ${size}px ${BODY}`));
      ctx.font = f;
    },
    // Centred by default. A line wider than maxW gets smaller, never cut.
    text(str, x, y, px, fill, display = true, align = "center", maxW = Infinity) {
      kit.font(px, display);
      if (maxW < Infinity) {
        const width = ctx.measureText(str).width;
        if (width > maxW) kit.font((px * maxW) / width, display);
      }
      ctx.textAlign = align;
      ctx.textBaseline = "middle";
      ctx.fillStyle = fill;
      ctx.fillText(str, x, y);
    },
    width(str, px, display = true) { kit.font(px, display); return ctx.measureText(str).width; },
    // A rounded shape with an ink outline: the floor's one kind of button, plate and chip.
    plate(x, y, w, h, r, fill, outline = true) {
      ctx.beginPath();
      ctx.roundRect(x, y, w, h, r);
      ctx.fillStyle = fill;
      ctx.fill();
      if (outline) { ctx.lineWidth = 4 * kit.U; ctx.strokeStyle = INK; ctx.stroke(); }
    },
    disc(x, y, r, fill, outline = true) {
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fillStyle = fill;
      ctx.fill();
      if (outline) { ctx.lineWidth = 4 * kit.U; ctx.strokeStyle = INK; ctx.stroke(); }
    },
  };
  kit.resize();
  return kit;
}
