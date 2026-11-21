// The floor in a new look, for Nicolo's yes. One canvas, 1280x720, that plays itself in a loop:
// pads rise, 3 2 1, a song with taps, a hold and a miss, then a departure board with the scores.
// Every frame is a pure function of the time `e` (seconds into the loop), so any moment can be
// drawn on request. The floor takes the colour of the line the train is on.
// Keys: 1 and 2 pick the ground, F is fullscreen, Space pauses.
// URL: ?v=1|2  ?line=Green-B|Green-C|Green-D|Green-E|Red|Orange|Blue|Mattapan  ?t=seconds  ?pause=1
import { buildChart, lanesPerPad, standing, BEAT, SONG, TARGET, BONUS } from "./chart.js";

const W = 1280, H = 720;
const WHITE = "#FFFFFF", BLACK = "#000000";

// ---- colour: a line's token colour becomes a ground, an accent that a projector can show, and four pad colours ----
const LINES = {
  "Green-B": ["green", "B"], "Green-C": ["green", "C"], "Green-D": ["green", "D"], "Green-E": ["green", "E"],
  Red: ["red", "R"], Orange: ["orange", "O"], Blue: ["blue", "BL"], Mattapan: ["mattapan", "M"],
};
const CYAN = "#2FD9FF", PINK = "#FF8AC4", YELLOW = "#FFD43B", LIME = "#86FF6E", VIOLET = "#B59BFF";
// Four clearly different pad colours that keep clear of the line's own hue.
const PADS = {
  green: [CYAN, PINK, YELLOW, VIOLET], red: [CYAN, YELLOW, LIME, VIOLET], mattapan: [CYAN, YELLOW, LIME, VIOLET],
  orange: [CYAN, PINK, LIME, VIOLET], blue: [CYAN, PINK, YELLOW, LIME],
};
const GROUND_LIGHT = { 1: 0.05, 2: 0.16 }; // share of full-white light the ground costs: deep, then bold
const ACCENT_LIGHT = 0.32; // a line colour is lifted to at least this, or a projector loses it (the blue line is 6%)

const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const rgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const hex = (v) => "#" + v.map((c) => Math.round(clamp(c, 0, 255)).toString(16).padStart(2, "0")).join("");
const mix = (a, b, t) => { const q = rgb(b); return hex(rgb(a).map((v, i) => v + (q[i] - v) * t)); };
const lin = (c) => ((c /= 255) <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const light = (h) => { const [r, g, b] = rgb(h).map(lin); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };

function hsl([r, g, b]) {
  r /= 255; g /= 255; b /= 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, d = mx - mn;
  if (!d) return [0, 0, l];
  const s = d / (1 - Math.abs(2 * l - 1));
  const h = mx === r ? ((g - b) / d + 6) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h * 60, s, l];
}
function fromHsl([h, s, l]) {
  const c = (1 - Math.abs(2 * l - 1)) * s, x = c * (1 - Math.abs(((h / 60) % 2) - 1)), m = l - c / 2;
  const [r, g, b] = [[c, x, 0], [x, c, 0], [0, c, x], [0, x, c], [x, 0, c], [c, 0, x]][Math.floor(h / 60) % 6];
  return hex([(r + m) * 255, (g + m) * 255, (b + m) * 255]);
}
// Keep the hue, raise the lightness (and keep it vivid) until the colour is bright enough to show.
function lift(h, minLight) {
  if (light(h) >= minLight) return h;
  let [hue, s, l] = hsl(rgb(h));
  s = Math.max(s, 0.8);
  while (light(fromHsl([hue, s, l])) < minLight && l < 0.95) l += 0.01;
  return fromHsl([hue, s, l]);
}
// The line colour darkened (or lightened) until it costs the wanted share of light.
function ground(h, want) {
  const to = light(h) > want ? BLACK : WHITE;
  let lo = 0, hi = 1;
  for (let i = 0; i < 20; i++) { const m = (lo + hi) / 2; (light(mix(h, to, m)) > want) === (to === BLACK) ? (lo = m) : (hi = m); }
  return mix(h, to, hi);
}

const params = new URLSearchParams(location.search);
const lineName = LINES[params.get("line")] ? params.get("line") : "Green-B";
const [lineKey, lineLetter] = LINES[lineName];
const lineColor = getComputedStyle(document.documentElement).getPropertyValue(`--line-${lineKey}`).trim() || "#00843D";
const SEATS = PADS[lineKey];

let variant = params.get("v") === "2" ? 2 : 1;
const theme = () => {
  const gr = ground(lineColor, GROUND_LIGHT[variant]);
  const ACCENT = lift(lineColor, Math.max(ACCENT_LIGHT, GROUND_LIGHT[variant] + 0.22)); // always clearly brighter than its ground
  const slot = mix(gr, WHITE, 0.07);
  return { ground: gr, slot, accent: ACCENT, grid: mix(gr, WHITE, 0.045), rail: mix(slot, ACCENT, 0.4), sleeper: mix(slot, ACCENT, 0.22), flap: mix(gr, BLACK, 0.4), pit: mix(gr, BLACK, 0.3) };
};

// ---- timeline of one loop, in seconds ----
const S0 = 3.5; // song time 0: the "GO"
const T_END = S0 + SONG;
const T_ARRIVE = T_END + 0.5; // the train reaches the station
const T_RES = T_END + 1.1; // pads drop away, results rise
const T_OUT = T_RES + 9; // results leave
const LOOP = T_OUT + 0.8;
const TRAVEL = 1.7; // seconds from the top of a lane to the hit line

// ---- pad geometry: one lane a player (either foot taps it); a lone player gets two lanes, one a foot.
// The fewer the players, the wider the lanes: the room is there to be used. ----
const players = clamp(Math.round(Number(params.get("players"))) || 4, 1, 4);
const lanesPer = lanesPerPad(players);
const LANE_W = { 1: 264, 2: 320, 3: 280, 4: 248 }[players];
const LANE_GAP = 28; // between a solo pad's two lanes
const PAD_W = lanesPer * LANE_W + (lanesPer - 1) * LANE_GAP;
const PAD_GAP = { 1: 0, 2: 120, 3: 80, 4: (W - 128 - 4 * 248) / 3 }[players];
const padX = (i) => (W - (players * PAD_W + (players - 1) * PAD_GAP)) / 2 + i * (PAD_W + PAD_GAP);
const laneX = (i, l) => padX(i) + l * (LANE_W + LANE_GAP);
const TOP = 188, LINE = 580, BOTTOM = 688, TILE_H = 104, LIP = 6, CAR_GAP = 12;
const V = (LINE - TOP) / TRAVEL; // pixels per second

const chart = buildChart(players);
const bySeatLane = [...Array(players).keys()].map((i) => [...Array(lanesPer).keys()].map((l) => chart.notes.filter((n) => n.seat === i && n.lane === l)));
const ranking = [1, 3, 0, 2].filter((seat) => seat < players); // seats by whiteboard score, best first

const canvas = document.getElementById("floor");
const ctx = canvas.getContext("2d");

// ---- drawing helpers ----
const easeOutBack = (x) => 1 + 2.70158 * Math.pow(x - 1, 3) + 1.70158 * Math.pow(x - 1, 2);
const easeIn = (x) => x * x * x;
const easeOut = (x) => 1 - Math.pow(1 - x, 3);
const spring = (a) => (a < 0 || a > 0.6 ? 0 : Math.exp(-a * 10) * Math.cos(a * 26)); // 1 at once, settles in 0.4 s
const edge = (c) => mix(c, BLACK, 0.28);

function rr(x, y, w, h, r) { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); }
function disc(x, y, r, color) { ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fillStyle = color; ctx.fill(); }
function fill(color) { ctx.fillStyle = color; ctx.fill(); }
function text(str, x, y, size, color, align = "left", weight = 900) {
  ctx.font = `${weight} ${size}px Nunito, system-ui, sans-serif`;
  ctx.textAlign = align;
  ctx.textBaseline = "middle";
  ctx.fillStyle = color;
  ctx.fillText(str, x, y);
}
// Draw something scaled around a point, so squash and pop stay anchored where they should.
function around(cx, cy, sx, sy, draw) {
  ctx.save(); ctx.translate(cx, cy); ctx.scale(sx, sy); ctx.translate(-cx, -cy); draw(); ctx.restore();
}
// A map station: a white dot inside a dark ring.
function station(x, y, r, g, inner = WHITE) { disc(x, y, r, g.ground); disc(x, y, r * 0.64, inner); }
const clock = (sec) => `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, "0")}`;

// A pale map grid under everything.
function drawGrid(g) {
  ctx.fillStyle = g.grid;
  for (let x = 40; x < W; x += 80) ctx.fillRect(x, 0, 2, H);
  for (let y = 40; y < H; y += 80) ctx.fillRect(0, y, W, 2);
}

// ---- the ride: a train on a map line, reaching its station ----
const ROUTE = [[252, 62], [700, 62], [724, 40], [1000, 40]];
const SEG = ROUTE.slice(1).map((p, i) => Math.hypot(p[0] - ROUTE[i][0], p[1] - ROUTE[i][1]));
const ROUTE_LEN = SEG.reduce((a, b) => a + b, 0);
const TRAIN_LEN = 108;
function onRoute(d) {
  d = clamp(d, 0, ROUTE_LEN);
  let i = 0;
  while (i < SEG.length - 1 && d > SEG[i]) { d -= SEG[i]; i++; }
  const [a, b] = [ROUTE[i], ROUTE[i + 1]], k = d / SEG[i];
  return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k];
}
function drawClock(e, g) {
  text(clock(Math.max(0, Math.ceil(T_ARRIVE - e))), 64, 62, 46, WHITE);
  // the line's bullet, then the line itself in thick rounded strokes
  disc(214, 62, 24, g.accent);
  text(lineLetter, 214, 64, lineLetter.length > 1 ? 22 : 28, g.ground, "center");
  ctx.beginPath(); ctx.moveTo(...ROUTE[0]); ROUTE.slice(1).forEach((p) => ctx.lineTo(...p));
  ctx.lineWidth = 18; ctx.lineCap = "round"; ctx.lineJoin = "round"; ctx.strokeStyle = g.accent; ctx.stroke();
  [0.22, 0.48, 0.74].forEach((f) => station(...onRoute(ROUTE_LEN * f), 15, g));
  const pop = e >= T_ARRIVE ? 1 + 0.3 * spring(e - T_ARRIVE) : 1;
  around(1000, 40, pop, pop, () => station(1000, 40, 25, g));
  text("Kenmore", 1042, 42, 28, WHITE, "left", 800);

  // the train: a white body, a window in every seat's colour, wheels set apart under it
  const d = TRAIN_LEN + (ROUTE_LEN - TRAIN_LEN - 40) * clamp(e / T_ARRIVE); // tail on the first stop, nose short of the station
  const front = onRoute(d), back = onRoute(d - 40);
  const angle = Math.atan2(front[1] - back[1], front[0] - back[0]);
  const beat = e > S0 && e < T_END ? Math.pow(Math.max(0, 1 - ((e - S0) % BEAT) / 0.2), 2) : 0;
  ctx.save();
  ctx.translate(front[0], front[1] - 4); ctx.rotate(angle); ctx.translate(0, -beat * 3);
  rr(-TRAIN_LEN, -17, TRAIN_LEN, 34, [10, 17, 17, 10]); fill(WHITE);
  SEATS.slice(0, players).forEach((c, i) => { rr(-98 + i * 20, -9, 14, 12, 4); fill(c); });
  disc(-86, 24, 6, mix(g.ground, WHITE, 0.5)); disc(-22, 24, 6, mix(g.ground, WHITE, 0.5));
  ctx.restore();
}

// ---- what one lane is doing at song time s ----
function laneState(notes, s) {
  let pop = 0, flash = 0, held = false, word = null;
  for (const n of notes) {
    const a = s - n.t;
    if (a >= 0 && a < 0.6) {
      if (n.grade === "miss") pop = -0.5 * spring(a);
      else { pop = spring(a); flash = Math.max(flash, clamp(1 - a / 0.2)); }
      if (a < 0.55) word = { text: n.grade === "perfect" ? "Perfect" : n.grade === "great" ? "Great" : "Miss", grade: n.grade, a };
    }
    if (n.dur && s >= n.t && s < n.t + n.dur) held = true;
    if (n.dur && s >= n.t + n.dur && s < n.t + n.dur + 0.5) { pop = Math.max(pop, spring(s - n.t - n.dur)); flash = Math.max(flash, clamp(1 - (s - n.t - n.dur) / 0.2)); }
  }
  return { pop, flash, held, word };
}

// ---- a train car: a flat slab with a hard lip, a windscreen at the front, no outline, no glow.
// A hold is a train of cars coupled together. ----
function cars(x, yTop, yBottom, color, g) {
  const n = Math.max(1, Math.round((yBottom - yTop + CAR_GAP) / (TILE_H + CAR_GAP)));
  const h = (yBottom - yTop - CAR_GAP * (n - 1)) / n;
  for (let k = 0; k < n; k++) {
    const y = yBottom - (k + 1) * h - k * CAR_GAP;
    rr(x, y + LIP, LANE_W, h, 22); fill(edge(color));
    rr(x, y, LANE_W, h, 22); fill(color);
    if (k === 0) { rr(x + LANE_W * 0.275, y + h - 28, LANE_W * 0.45, 12, 6); fill(g.ground); } // the front window
    if (k < n - 1) { rr(x + LANE_W / 2 - 7, y - CAR_GAP - 2, 14, CAR_GAP + 6, 3); fill(edge(color)); } // coupling
  }
}

function drawLane(i, l, e, g, beatPulse) {
  const s = e - S0;
  const x = laneX(i, l), cx = x + LANE_W / 2, color = SEATS[i];
  const notes = bySeatLane[i][l];
  const st = laneState(notes, s);

  rr(x, TOP, LANE_W, BOTTOM - TOP, 22); fill(mix(g.slot, WHITE, beatPulse * 0.04));

  // the track: two rails and sleepers that run past with the song, so the tiles ride along it
  ctx.save();
  rr(x, TOP, LANE_W, BOTTOM - TOP, 22); ctx.clip();
  rr(x + 14, TOP, 5, BOTTOM - TOP, 2.5); fill(g.rail);
  rr(x + LANE_W - 19, TOP, 5, BOTTOM - TOP, 2.5); fill(g.rail);
  const gapPx = V * BEAT;
  for (let y = TOP + (((s * V) % gapPx) + gapPx) % gapPx - gapPx; y < LINE; y += gapPx) { rr(x + 8, y, LANE_W - 16, 7, 3.5); fill(g.sleeper); }

  for (const n of notes) {
    const dt = n.t - s, head = LINE - dt * V, a = -dt;
    const tail = head - TILE_H - n.dur * V;
    if (head < TOP || tail > BOTTOM) continue; // not in the lane yet, or already out of it
    if (n.grade === "miss") continue; // drawn after the zone, so a missed car stays in sight as it rolls through
    if (n.dur) {
      if (s < n.t + n.dur) {
        ctx.save(); ctx.beginPath(); ctx.rect(x - 10, TOP - 10, LANE_W + 20, LINE - TOP + 10); ctx.clip();
        cars(x, tail, head, color, g); ctx.restore();
      } else if (s - n.t - n.dur < 0.3) land(x, s - n.t - n.dur, color, g);
    } else if (a < 0) cars(x, head - TILE_H, head, color, g);
    else if (a < 0.3) land(x, a, color, g);
  }
  ctx.restore();

  // the platform: a thick accent line across the lane, a foot zone below it, a station dot in the zone
  const zoneH = BOTTOM - LINE;
  const k = 1 + 0.13 * st.pop + (st.held ? 0.04 : 0) + 0.03 * beatPulse;
  around(cx, LINE + zoneH / 2, k, k, () => {
    rr(x, LINE, LANE_W, zoneH, [0, 0, 22, 22]);
    fill(mix(mix(g.pit, color, st.held ? 0.6 : 0), WHITE, st.flash));
    rr(x, LINE - 7, LANE_W, 14, 7); fill(g.accent);
    const cy = LINE + zoneH / 2 + 6;
    disc(cx, cy, 46, color);
    disc(cx, cy, 34, mix(WHITE, color, st.held ? 0.9 : st.flash * 0.9));
    // a solo pad has a lane for each foot; with company, the number on the floor says whose lane it is
    text(lanesPer === 2 ? (l ? "R" : "L") : String(i + 1), cx, cy + 2, 38, g.ground, "center");
  });

  // a missed car goes dull, shrugs once, and rolls on through the zone and out
  ctx.save();
  rr(x, TOP, LANE_W, BOTTOM - TOP, 22); ctx.clip();
  for (const n of notes) {
    if (n.grade !== "miss") continue;
    const a = s - n.t, head = LINE + a * V;
    if (head < TOP || head - TILE_H > BOTTOM) continue;
    const wobble = a > 0 && a < 0.35 ? 3 * Math.sin(a * 60) * (1 - a / 0.35) : 0;
    ctx.translate(wobble, 0);
    cars(x, head - TILE_H, head, a > 0 ? mix(color, g.slot, 0.7) : color, g);
    ctx.translate(-wobble, 0);
  }
  ctx.restore();

  if (st.word) {
    const { a, grade } = st.word;
    ctx.globalAlpha = 1 - clamp((a - 0.3) / 0.25);
    const c = grade === "perfect" ? WHITE : grade === "great" ? color : mix(WHITE, g.slot, 0.45);
    const wy = LINE - 50 - easeOut(clamp(a / 0.4)) * 26;
    rr(cx - 82, wy - 24, 164, 48, 24); fill(g.ground); // a plate, so the word reads over any car behind it
    text(st.word.text, cx, wy + 2, 32, c, "center");
    ctx.globalAlpha = 1;
  }
}

// A car landing on the line: wide and short for a beat, flashing white, then gone.
function land(x, a, color, g) {
  const squash = Math.sin(Math.PI * clamp(a / 0.16));
  const gone = a > 0.16 ? 1 - easeIn(clamp((a - 0.16) / 0.14)) : 1;
  around(x + LANE_W / 2, LINE, (1 + 0.12 * squash) * gone, (1 - 0.18 * squash) * gone, () =>
    cars(x, LINE - TILE_H, LINE, mix(color, WHITE, a < 0.1 ? 0.85 : 0), g));
}

function drawPad(i, e, g, beatPulse) {
  const s = e - S0, color = SEATS[i], st = standing(chart, s)[i], px = padX(i);
  for (let l = 0; l < lanesPer; l++) drawLane(i, l, e, g, beatPulse);
  // header: seat station, score, combo
  station(px + 30, 134, 34, g, color);
  text(String(i + 1), px + 30, 136, 30, g.ground, "center");
  const bump = 1 + 0.14 * spring(s - st.last);
  around(px + 76, 136, bump, bump, () => text(String(st.score), px + 76, 136, 46, WHITE));
  if (st.combo >= 3) {
    const cb = 1 + 0.25 * spring(s - st.last);
    const cx = px + PAD_W - 31;
    around(cx, 136, cb, cb, () => {
      rr(cx - 31, 114, 62, 44, 22); fill(st.combo >= 10 ? WHITE : color);
      text("x" + st.combo, cx, 137, 25, g.ground, "center");
    });
  }
}

// ---- 3, 2, 1, go ----
function drawCountdown(e) {
  for (const [label, start] of [["3", 0.5], ["2", 1.5], ["1", 2.5], ["GO", S0]]) {
    const a = e - start;
    if (a < 0 || a > (label === "GO" ? 0.7 : 1)) continue;
    const grow = a < 0.4 ? easeOutBack(a / 0.4) : 1;
    const sq = a < 0.2 ? 0.1 * (1 - a / 0.2) : 0;
    const out = a > 0.85 ? 1 - 0.3 * easeIn((a - 0.85) / 0.15) : 1;
    const sc = (0.3 + 0.7 * grow) * out;
    around(W / 2, 380, sc * (1 + sq), sc * (1 - sq), () => text(label, W / 2, 380, label === "GO" ? 190 : 300, WHITE, "center"));
  }
}

// ---- the departure board ----
const ROWS = ranking.length, ROW_H = 92, ROW_GAP = 12, HEAD_H = 58;
const BOARD = { x: 200, w: 880, h: ROW_H, gap: ROW_GAP, head: Math.round(366 - (HEAD_H + 20 + ROWS * ROW_H + (ROWS - 1) * ROW_GAP) / 2) };
BOARD.rowY = BOARD.head + HEAD_H + 20;
function flap(x, y, ch, g, onSeat) {
  const face = onSeat ? g.ground : g.flap;
  rr(x, y, 46, 64, 9); fill(face);
  ctx.fillStyle = mix(face, BLACK, 0.5);
  ctx.fillRect(x, y + 31, 46, 2);
  if (ch) text(ch, x + 23, y + 34, 44, WHITE, "center");
}
function drawResults(e, g) {
  const t = e - T_RES;
  const leave = e > T_OUT ? easeIn(clamp((e - T_OUT) / 0.8)) : 0;
  const slideIn = (a) => (1 - easeOut(clamp(a / 0.5))) * 560 + leave * 560;
  // the board's header: station and status
  ctx.save(); ctx.translate(0, slideIn(t - 0.3));
  rr(BOARD.x, BOARD.head, BOARD.w, 58, 20); fill(g.accent);
  text("Kenmore", BOARD.x + 30, BOARD.head + 31, 32, g.ground, "left");
  text("Arrived", BOARD.x + BOARD.w - 30, BOARD.head + 31, 32, g.ground, "right");
  ctx.restore();
  ranking.forEach((seat, r) => {
    const a = t - (0.6 + (3 - r) * 0.3); // last place first, the winner last
    if (a < 0) return;
    const y = BOARD.rowY + r * (BOARD.h + BOARD.gap);
    const count = clamp((a - 0.2) / 1.2);
    const done = a - 1.4; // the bonus pops after the count lands
    const color = SEATS[seat], win = r === 0 && count >= 1;
    const ink = win ? g.ground : WHITE;
    ctx.save();
    ctx.translate(0, slideIn(a));
    rr(BOARD.x, y, BOARD.w, BOARD.h, 24); fill(win ? color : g.slot);
    text(String(r + 1), BOARD.x + 40, y + BOARD.h / 2 + 2, 40, win ? g.ground : mix(g.slot, WHITE, 0.55), "center");
    station(BOARD.x + 112, y + BOARD.h / 2, 38, g, color);
    text(String(seat + 1), BOARD.x + 112, y + BOARD.h / 2 + 2, 34, g.ground, "center");
    text(`Player ${seat + 1}`, BOARD.x + 170, y + BOARD.h / 2 + 2, 38, ink, "left", 800);
    const digits = String(Math.round(TARGET[seat] * easeOut(count))).padStart(4, " ");
    for (let d = 0; d < 4; d++) flap(BOARD.x + 470 + d * 52, y + 14, digits[d].trim(), g, win);
    if (BONUS[seat] && done > 0) {
      const k = 1 + 0.3 * spring(done), bx = BOARD.x + 790;
      around(bx, y + BOARD.h / 2, k, k, () => {
        rr(bx - 56, y + BOARD.h / 2 - 25, 112, 50, 25); fill(WHITE);
        text("+" + BONUS[seat], bx, y + BOARD.h / 2 + 2, 30, g.ground, "center");
      });
    }
    if (win && done > 0.2) drawCrown(BOARD.x + 372, y + BOARD.h / 2 + Math.sin(e * 3) * 2, 1 + 0.4 * spring(done - 0.2));
    ctx.restore();
  });
}
function drawCrown(cx, cy, k) {
  around(cx, cy, k, k, () => {
    ctx.beginPath();
    ctx.moveTo(cx - 24, cy + 2); ctx.lineTo(cx - 28, cy - 22); ctx.lineTo(cx - 10, cy - 10);
    ctx.lineTo(cx, cy - 28); ctx.lineTo(cx + 10, cy - 10); ctx.lineTo(cx + 28, cy - 22); ctx.lineTo(cx + 24, cy + 2);
    ctx.closePath(); fill(WHITE);
  });
}

// ---- one frame ----
function draw(e) {
  const g = theme();
  ctx.fillStyle = g.ground;
  ctx.fillRect(0, 0, W, H);
  drawGrid(g);
  drawClock(e, g);

  if (e < T_RES + 0.9) {
    const s = e - S0;
    const beatPulse = s > 0 && s < SONG ? Math.pow(Math.max(0, 1 - (s % BEAT) / 0.2), 2) : 0;
    const drop = e > T_END + 0.6 ? easeIn(clamp((e - (T_END + 0.6)) / 0.9)) * 800 : 0;
    for (let i = 0; i < players; i++) {
      const rise = easeOutBack(clamp((e - 0.05 * i) / 0.55)); // pads pop in at the start of the loop
      ctx.save();
      ctx.translate(0, (1 - clamp(rise, 0, 1.1)) * 90 + drop);
      drawPad(i, e, g, beatPulse);
      ctx.restore();
    }
    drawCountdown(e);
  }
  if (e >= T_RES) drawResults(e, g);
}

// ---- run it ----
let paused = params.get("pause") === "1";
let at = Number(params.get("t")) || 0;
let last = performance.now();
function frame(now) {
  if (!paused) at = (at + (now - last) / 1000) % LOOP;
  last = now;
  draw(at);
  requestAnimationFrame(frame);
}
function setVariant(v) {
  variant = v;
  document.body.style.background = theme().ground;
  const u = new URL(location.href);
  u.searchParams.set("v", v);
  history.replaceState(null, "", u);
}
addEventListener("keydown", (ev) => {
  if (ev.key === "1" || ev.key === "2") setVariant(Number(ev.key));
  else if (ev.key === " ") { paused = !paused; ev.preventDefault(); }
  else if (ev.key.toLowerCase() === "f") document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen();
});
window.floorPilot = { time: () => at, seek: (e) => { at = e; paused = true; draw(e); }, play: () => { paused = false; }, loop: LOOP, line: lineName, notes: chart.notes, players };

setVariant(variant);
document.fonts.load("900 40px Nunito").then(() => document.fonts.load("800 40px Nunito")).then(() => requestAnimationFrame(frame));
