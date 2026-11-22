// The picture of a finished game that people share: 1080 by 1350, drawn on a canvas. The line's colour is the field, the
// conductor stands top right (public/mascot/conductor.svg, drawn as the file is, never redrawn or recoloured), then the
// song with its real cover when the cover can be drawn, the team's score and grade, and a row for each player.
// A cover that cannot be drawn to a canvas (the cover host not allowing it) is left out, and the title takes its room.
import { APP_NAME, rank, isTie, matchup } from "./after.js";
import { lineOf, seatOf, BUTTER } from "./lines.js";
import { songById } from "../songs/index.js";
import { coverUrl } from "./covers.js";

export const SIZE = { w: 1080, h: 1350 };
const INK = "#141413";
const INK_2 = "#444B5C";
const PAPER = "#FFFFFF";
const DISPLAY = '"Lilita One", "Nunito", system-ui, sans-serif';
const TEXT = '"Nunito", system-ui, sans-serif';
const M = 64;                 // the margin
const COVER_WAIT_MS = 2500;   // a cover that has not come by then is left out
const num = (n) => n.toLocaleString("en-US");

// A colour written as var(--name) is read from the page; anything else is already a colour.
const colour = (v) => (v.startsWith("var(") ? getComputedStyle(document.documentElement).getPropertyValue(v.slice(4, -1)).trim() : v);

function loadImage(src, wait, cors = false) {
  return new Promise((done) => {
    const img = new Image();
    if (cors) img.crossOrigin = "anonymous";
    const timer = setTimeout(() => done(null), wait);
    img.onload = () => { clearTimeout(timer); done(img); };
    img.onerror = () => { clearTimeout(timer); done(null); };
    img.src = src;
  });
}

async function conductorImage() {
  try {
    const res = await fetch("/mascot/conductor.svg");
    if (!res.ok) return null;
    const markup = (await res.text()).replace("<svg ", '<svg width="320" height="380" '); // sizes it for drawing; nothing else changes
    const url = URL.createObjectURL(new Blob([markup], { type: "image/svg+xml" }));
    const img = await loadImage(url, 4000);
    URL.revokeObjectURL(url);
    return img;
  } catch { return null; }
}

async function coverImage(song) {
  if (!song) return null;
  const url = await Promise.race([coverUrl(song), new Promise((r) => setTimeout(r, COVER_WAIT_MS, null))]);
  return url ? loadImage(url, COVER_WAIT_MS, true) : null; // with `crossOrigin`, a host that does not allow it fails here, and the canvas is never tainted
}

// ---- drawing ----
function box(ctx, x, y, w, h, r, fill, stroke = INK, line = 6) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (stroke) { ctx.lineWidth = line; ctx.strokeStyle = stroke; ctx.stroke(); }
}
function text(ctx, s, x, y, font, fill = INK, align = "left") {
  ctx.font = font;
  ctx.fillStyle = fill;
  ctx.textAlign = align;
  ctx.fillText(s, x, y);
}
function wrap(ctx, s, width) {
  const lines = [];
  let row = "";
  for (const word of s.split(" ")) {
    const next = row ? `${row} ${word}` : word;
    if (row && ctx.measureText(next).width > width) { lines.push(row); row = word; } else row = next;
  }
  return [...lines, row];
}
function circle(ctx, x, y, r, fill, line = 8) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.lineWidth = line;
  ctx.strokeStyle = INK;
  ctx.stroke();
}

function draw(ctx, { kept, line, train, cover, conductor, myId }) {
  const { w, h } = SIZE;
  const hero = line.hero;
  ctx.fillStyle = hero;
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = "rgb(255 255 255 / 0.3)"; // the app's blueprint grid
  for (let x = 54; x < w; x += 108) ctx.fillRect(x, 0, 3, h);
  for (let y = 54; y < h; y += 108) ctx.fillRect(0, y, w, 3);

  if (conductor) ctx.drawImage(conductor, w - M - 256, 40, 256, 304);

  // the line and the car
  circle(ctx, M + 56, M + 56, 56, colour(line.badge));
  ctx.textBaseline = "alphabetic";
  text(ctx, line.letter, M + 56, M + 80, `400 68px ${DISPLAY}`, colour(line.badgeInk), "center");
  text(ctx, line.name, M + 140, M + 66, `400 76px ${DISPLAY}`);
  const car = `Car ${train.car}`;
  ctx.font = `400 40px ${DISPLAY}`;
  const carW = ctx.measureText(car).width + 56;
  box(ctx, M + 140, M + 96, carW, 66, 33, null, INK, 6);
  text(ctx, car, M + 140 + carW / 2, M + 146, `400 40px ${DISPLAY}`, INK, "center");

  // the song
  const song = songById(kept.song.id);
  const top = 372;
  const textX = cover ? M + 230 + 38 : M;
  if (cover) {
    ctx.save();
    box(ctx, M, top, 230, 230, 44, null, null);
    ctx.clip();
    ctx.drawImage(cover, M, top, 230, 230);
    ctx.restore();
    box(ctx, M, top, 230, 230, 44, null, INK, 8);
  }
  const room = w - M - textX;
  let size = 80;
  let lines;
  for (; size >= 52; size -= 4) { ctx.font = `400 ${size}px ${DISPLAY}`; lines = wrap(ctx, kept.song.title, room); if (lines.length <= 3) break; }
  lines.forEach((l, i) => text(ctx, l, textX, top + 70 + i * size * 1.05, `400 ${size}px ${DISPLAY}`));
  const by = song?.by.split(". ")[0];
  if (by) text(ctx, by, textX, top + 70 + (lines.length - 1) * size * 1.05 + 46, `800 32px ${TEXT}`, INK);

  const rows = rank(kept.players, myId, kept);
  const duel = kept.mode === "versus" && rows.length > 1;

  // the team, or in a duel who played (1v1, 1v1v1) and who won: no team score and no bonuses
  box(ctx, M, 650, w - 2 * M, 200, 44, PAPER);
  if (duel) {
    text(ctx, "Duel", M + 40, 716, `800 34px ${TEXT}`, INK_2);
    text(ctx, isTie(rows, kept) ? "Tie" : matchup(rows.length), M + 40, 816, `400 110px ${DISPLAY}`);
    if (kept.winner) {
      text(ctx, "Winner", w - M - 40, 716, `800 34px ${TEXT}`, INK_2, "right");
      text(ctx, `Player ${kept.winner.spotId}`, w - M - 40, 800, `400 70px ${DISPLAY}`, INK, "right");
    }
  } else {
    text(ctx, "Team score", M + 40, 716, `800 34px ${TEXT}`, INK_2);
    text(ctx, num(kept.team.score), M + 40, 816, `400 110px ${DISPLAY}`);
    if (kept.team.grade) {
      text(ctx, "Grade", 810, 780, `800 36px ${TEXT}`, INK_2, "right");
      circle(ctx, 920, 750, 66, BUTTER);
      text(ctx, kept.team.grade, 920, 784, `400 92px ${DISPLAY}`, INK, "center");
    }
  }

  // the players
  const gap = 14;
  const rowH = Math.min(120, (356 - gap * (rows.length - 1)) / rows.length);
  rows.forEach((r, i) => {
    const y = 882 + i * (rowH + gap);
    const seat = seatOf(train.line, r.spotId);
    box(ctx, M, y, w - 2 * M, rowH, 34, PAPER);
    const p = rowH - 24;
    box(ctx, M + 14, y + 12, p, p, 18, seat.fill, INK, 5);
    text(ctx, String(r.spotId), M + 14 + p / 2, y + 12 + p / 2 + p * 0.2, `400 ${p * 0.72}px ${DISPLAY}`, seat.ink, "center");
    const nameX = M + 14 + p + 24;
    const twoLines = rowH >= 90;
    text(ctx, `Player ${r.spotId}`, nameX, twoLines ? y + rowH / 2 - 2 : y + rowH / 2 + 15, `400 46px ${DISPLAY}`);
    if (twoLines) text(ctx, `Best combo ${r.maxCombo}  ·  ${r.perfects} perfect`, nameX, y + rowH / 2 + 38, `800 28px ${TEXT}`, INK_2);
    let right = w - M - 34;
    text(ctx, num(r.total), right, y + rowH / 2 + 20, `400 60px ${DISPLAY}`, INK, "right");
    if (r.bonus || r.winner) {
      ctx.font = `400 38px ${DISPLAY}`;
      const tag = r.winner ? "Winner" : `+${r.bonus}!`;
      const tw = ctx.measureText(tag).width + 40;
      ctx.font = `400 60px ${DISPLAY}`;
      right -= ctx.measureText(num(r.total)).width + 24 + tw;
      box(ctx, right, y + rowH / 2 - 29, tw, 58, 29, BUTTER, INK, 5);
      text(ctx, tag, right + tw / 2, y + rowH / 2 + 13, `400 38px ${DISPLAY}`, INK, "center");
    }
  });

  text(ctx, APP_NAME, w / 2, 1316, `400 50px ${DISPLAY}`, INK, "center");
}

// Draws the picture and returns { blob, url }. The caller revokes the url when it is done.
export async function makeStatsImage(kept, train, myId) {
  await Promise.all([document.fonts.load(`400 40px ${DISPLAY}`), document.fonts.load(`800 30px ${TEXT}`)]);
  const [conductor, cover] = await Promise.all([conductorImage(), coverImage(songById(kept.song.id))]);
  const canvas = document.createElement("canvas");
  canvas.width = SIZE.w;
  canvas.height = SIZE.h;
  draw(canvas.getContext("2d"), { kept, line: lineOf(train.line), train, cover, conductor, myId });
  const blob = await new Promise((done) => canvas.toBlob(done, "image/png"));
  if (!blob) throw new Error("This browser could not turn the picture into a file.");
  return { blob, url: URL.createObjectURL(blob), hasCover: Boolean(cover) };
}
