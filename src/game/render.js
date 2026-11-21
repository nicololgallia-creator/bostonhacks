// Draws the floor on a full-window canvas. Built for a dim 720p projector (PLAN.md, "Projection
// rules"): pure black field, bright saturated fills, thick shapes, big text. Glows come from sprites
// made once (fx.js), never shadowBlur, because the pose model shares the laptop.
// The canvas is the whole field: u runs across it and v runs down it, v = 1 at the players' edge,
// so upright text reads right for the people standing there.
import { HIT_V, ZONE_V, TRAVEL_MS, songSeconds } from "./engine.js";
import { createFx, lighten, darken, easeOut, backOut } from "./fx.js";

const SEATS = ["#29D6FF", "#FF4FA3", "#FFD43B", "#7CFF6B"]; // Seat colours, shared with the phone page
const FAMILY = '"Bricolage Grotesque", "Arial Black", system-ui, sans-serif'; // the phone's own font, so floor and phone match
const FONT_URL = new URL("../phone/fonts/bricolage-latin.woff2", import.meta.url).href;
const WHITE = "#ffffff";
const DULL = "#6b6b6b"; // a miss, and a broken combo: the opposite of bright
const TILE_H = 0.12; // a tap tile's height, as a share of its pad's height
const GAP = 10; // black gap between lanes, in pixels
const TEXT = 0.1; // the biggest text row on the floor, as a share of the picture height
const HIT_FLASH_MS = 300;
const MISS_FLICKER_MS = 220;
const MISSED_FADE_MS = 220; // a missed tile fades where it is
const DROP_MS = 600; // a broken combo falls away for this long
const MAX_LANES = 8;
const NO_DASH = [];
const PLATE = [{ h: 0.12, alpha: 0.85 }, { h: 0.04, alpha: 0.55 }, { h: 0.04, alpha: 0.25 }]; // the dark plate under a pad's score

const seatColour = (spotId) => SEATS[(((spotId - 1) % SEATS.length) + SEATS.length) % SEATS.length];
const clamp01 = (x) => Math.min(1, Math.max(0, x));
const palettes = new Map();
// Every shade a seat needs, as solid colours, so alpha is never built into a string in the frame loop.
function palette(spotId) {
  const base = seatColour(spotId);
  if (!palettes.has(base)) {
    palettes.set(base, { base, light: lighten(base, 0.6), floor: darken(base, 0.2), lit: darken(base, 0.55), deep: darken(base, 0.08), dull: darken(base, 0.4) });
  }
  return palettes.get(base);
}

const newPadState = () => ({
  lv: 0, lastMult: 1, lastCombo: 0, multAt: -1e9, dropAt: -1e9, dropVal: 0, score: 0, shown: 0, scoreAt: -1e9,
  hitAt: Array(MAX_LANES).fill(-1e9), missAt: Array(MAX_LANES).fill(-1e9), ember: Array(MAX_LANES).fill(0),
  missed: new Map(), stamped: false,
});

export function createRenderer(canvas) {
  const ctx = canvas.getContext("2d");
  const fx = createFx();
  const states = new Map(); // spotId -> pad state
  const rects = []; // one scratch rectangle for each pad, reused every frame
  const fonts = new Map();
  const dash = [0, 0];
  const lit = Array(MAX_LANES).fill(false); // which lanes of the pad being drawn have a foot in their square
  let W = 0;
  let H = 0;
  let prevStatus = null;
  let statusAt = 0;
  let lastNow = 0;
  let qrSprite = null;

  new FontFace("Bricolage Grotesque", `url(${FONT_URL})`, { weight: "400 800" })
    .load().then((face) => document.fonts.add(face))
    .catch(() => console.warn("The floor font did not load. The floor uses a system font instead."));

  function resize() {
    const dpr = window.devicePixelRatio || 1;
    W = window.innerWidth;
    H = window.innerHeight;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    qrSprite = null;
  }
  window.addEventListener("resize", resize);
  resize();

  const stateOf = (id) => { let s = states.get(id); if (!s) states.set(id, (s = newPadState())); return s; };
  function rectOf(spot, i) {
    const r = (rects[i] ??= { x: 0, y: 0, w: 0, h: 0 });
    r.x = spot.rect.u * W; r.y = spot.rect.v * H; r.w = spot.rect.w * W; r.h = spot.rect.h * H;
    return r;
  }

  function setFont(px) {
    const size = Math.max(1, Math.round(px));
    let f = fonts.get(size);
    if (!f) fonts.set(size, (f = `800 ${size}px ${FAMILY}`));
    ctx.font = f;
  }
  // Centred text. A line wider than maxW is made smaller, never cut. edge false is for text on a light panel.
  function text(str, x, y, size, fill = WHITE, maxW = Infinity, edge = true) {
    setFont(size);
    const width = ctx.measureText(str).width;
    if (width > maxW) { size *= maxW / width; setFont(size); }
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    if (edge) {
      ctx.lineJoin = "round";
      ctx.lineWidth = size * 0.14;
      ctx.strokeStyle = "#000";
      ctx.strokeText(str, x, y);
    }
    ctx.fillStyle = fill;
    ctx.fillText(str, x, y);
  }
  const word = (str, x, y, size, fill) => text(str, x, y, size, fill, W * 0.4);

  function block(x, y, w, h, fill, radius = Math.min(16, w / 4)) {
    if (w <= 0 || h <= 0) return;
    ctx.fillStyle = fill;
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, radius);
    ctx.fill();
  }

  // What each engine event does to the picture: a burst at the foot, a ring, a word, a lit square.
  function onEvent(e, layout, events, now) {
    const i = layout.spots.findIndex((s) => s.id === e.spotId);
    if (i < 0) return;
    const r = rectOf(layout.spots[i], i);
    const pal = palette(e.spotId);
    const st = stateOf(e.spotId);
    const lane = Math.min(MAX_LANES - 1, e.lane);
    if (e.type === "hit" || e.type === "holdStart") {
      const perfect = e.grade === "perfect";
      const x = r.x + e.u * r.w;
      const y = r.y + e.v * r.h;
      st.hitAt[lane] = now;
      fx.burst(x, y, pal.light, perfect ? 14 : 8, H * (perfect ? 0.9 : 0.6), H * 0.026);
      if (perfect) fx.burst(x, y, WHITE, 4, H * 0.7, H * 0.02);
      fx.ring(x, y, perfect ? WHITE : pal.base, H * 0.2, 12);
      fx.word(`p${e.spotId}`, perfect ? "PERFECT" : "GOOD", r.x + r.w / 2, r.y + r.h * 0.56, perfect ? WHITE : pal.base, H * (perfect ? 0.08 : 0.07));
    } else if (e.type === "miss") {
      st.missAt[lane] = now;
    } else if (e.type === "holdEnd" && !events.some((m) => m.type === "miss" && m.spotId === e.spotId && m.lane === e.lane)) {
      const x = r.x + ((e.lane + 0.5) * r.w) / layout.lanes;
      fx.burst(x, r.y + HIT_V * r.h, pal.light, 12, H * 0.8, H * 0.035);
      fx.ring(x, r.y + HIT_V * r.h, pal.base, H * 0.18, 12);
    }
  }

  // The pad's frame. It is the combo meter: it gets thicker, brighter and livelier at x2, x3 and x4,
  // flashes when a multiplier is reached, and turns dull when the combo breaks.
  function frame(r, pal, st, now) {
    const lv = st.lv;
    const pulse = 0.5 + 0.5 * Math.sin(now * (0.004 + 0.0025 * lv));
    const w = 6 + 3.5 * lv;
    ctx.beginPath();
    ctx.roundRect(r.x - 2, r.y - 2, r.w + 4, r.h + 4, 20);
    ctx.lineJoin = "round";
    ctx.strokeStyle = pal.base;
    for (let k = 3; k >= 1 && lv > 0.05; k--) {
      ctx.globalAlpha = Math.min(0.5, 0.06 * lv * (4 - k) * (0.7 + 0.3 * pulse));
      ctx.lineWidth = w + k * 10 * (0.5 + lv / 3);
      ctx.stroke();
    }
    ctx.globalAlpha = 0.4 + 0.6 * Math.min(1, lv);
    ctx.lineWidth = w;
    ctx.stroke();
    if (lv >= 1.2) { // light chasing round the frame
      dash[0] = r.w * 0.1;
      dash[1] = r.w * 0.3;
      ctx.setLineDash(dash);
      ctx.lineDashOffset = -now * 0.25;
      ctx.strokeStyle = pal.light;
      ctx.globalAlpha = Math.min(1, lv - 1) * (0.7 + 0.3 * pulse);
      ctx.lineWidth = w + 2;
      ctx.stroke();
      ctx.setLineDash(NO_DASH);
    }
    if (lv >= 2.4) {
      ctx.strokeStyle = WHITE;
      ctx.globalAlpha = Math.min(1, lv - 2.4) * 0.9;
      ctx.lineWidth = 4;
      ctx.stroke();
    }
    const flash = (now - st.multAt) / 450;
    if (flash < 1) {
      ctx.globalAlpha = 0.3 * (1 - flash);
      ctx.fillStyle = pal.light;
      ctx.fill();
      ctx.globalAlpha = 1 - flash;
      ctx.strokeStyle = WHITE;
      ctx.lineWidth = 6 + 12 * (1 - flash);
      ctx.stroke();
    }
    const drop = (now - st.dropAt) / 380;
    if (drop < 1) {
      ctx.globalAlpha = 1 - drop;
      ctx.strokeStyle = DULL;
      ctx.lineWidth = 12;
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  // A tap tile is a solid block with a bright leading edge and an arrow cut into it.
  function tapTile(x, y, w, h, pal) {
    block(x, y, w, h, pal.base, 14);
    ctx.fillStyle = pal.light;
    ctx.beginPath();
    ctx.roundRect(x, y + h * 0.62, w, h * 0.38, [0, 0, 14, 14]);
    ctx.fill();
    const s = Math.min(w, h) * 0.2;
    ctx.fillStyle = pal.deep;
    ctx.beginPath();
    ctx.moveTo(x + w / 2 - s, y + h * 0.2);
    ctx.lineTo(x + w / 2 + s, y + h * 0.2);
    ctx.lineTo(x + w / 2, y + h * 0.2 + s * 1.5);
    ctx.fill();
  }

  // A hold tile is a long hollow tube with a bright head. While a foot is on it the tube fills and
  // pulses, and it shrinks toward the line, so what is left is what is still to hold.
  function holdTile(x, y, w, h, pal, holding, now) {
    const cap = Math.min(h, H * 0.05);
    block(x, y, w, h, pal.base, 14);
    if (holding) {
      block(x + 10, y + 10, w - 20, h - 20, pal.base, 8);
      ctx.globalAlpha = 0.25 + 0.2 * Math.sin(now * 0.016);
      block(x + 10, y + 10, w - 20, h - 20, WHITE, 8);
      ctx.globalAlpha = 1;
    } else {
      block(x + 10, y + 10, w - 20, h - 20, pal.floor, 8);
      block(x + w / 2 - 5, y + 22, 10, Math.max(0, h - cap - 30), pal.dull, 5);
    }
    ctx.fillStyle = pal.light;
    ctx.beginPath();
    ctx.roundRect(x, y + h - cap, w, cap, [0, 0, 14, 14]);
    ctx.fill();
  }

  // A pad with a song on it.
  function livePad(spot, r, pad, player, now, dt, layout) {
    const pal = palette(spot.id);
    const st = stateOf(spot.id);
    const laneW = r.w / pad.lanes;
    const zoneY = r.y + ZONE_V * r.h;
    const zoneH = r.h - ZONE_V * r.h;
    const lineY = r.y + HIT_V * r.h;
    const cx = r.x + r.w / 2;
    const mult = player?.multiplier ?? 1;
    const combo = player?.combo ?? 0;
    const score = player?.score ?? 0;

    if (mult > st.lastMult) {
      st.multAt = now;
      fx.word(`m${spot.id}`, `x${mult}`, cx, r.y + r.h * 0.3, pal.light, H * 0.17, H * 0.08, 950);
      fx.ring(cx, r.y + r.h * 0.5, pal.light, r.w * 0.75, 16, 600);
      fx.burst(cx, r.y + r.h * 0.5, pal.light, 20, H * 1.1, H * 0.04);
    }
    if (combo === 0 && st.lastCombo >= 3) { st.dropAt = now; st.dropVal = st.lastCombo; st.lv = 0; }
    st.lastMult = mult;
    st.lastCombo = combo;
    st.lv += (mult - 1 - st.lv) * Math.min(1, dt * 0.006);
    if (score !== st.score) { st.score = score; st.scoreAt = now; }
    st.shown += (score - st.shown) * Math.min(1, dt * 0.012);
    if (Math.abs(score - st.shown) < 1) st.shown = score;

    lit.fill(false);
    for (const f of pad.feet) if (f.v >= ZONE_V) lit[Math.min(pad.lanes - 1, Math.floor(f.u * pad.lanes))] = true;
    for (let i = 0; i < pad.lanes; i++) {
      const x = r.x + i * laneW + GAP / 2;
      const w = laneW - GAP;
      const hitAge = now - st.hitAt[i];
      const missAge = now - st.missAt[i];
      block(x, r.y, w, zoneY - r.y, pal.deep);
      block(x, zoneY, w, zoneH, lit[i] ? pal.lit : pal.floor);
      ctx.globalAlpha = 0.7;
      block(x, zoneY, w, 8, pal.base, 4);
      ctx.globalAlpha = 1;
      if (hitAge < HIT_FLASH_MS) {
        ctx.globalAlpha = 0.65 * (1 - hitAge / HIT_FLASH_MS);
        block(x, zoneY, w, zoneH, pal.light);
        ctx.globalAlpha = 1;
      } else if (missAge < MISS_FLICKER_MS && Math.floor(missAge / 55) % 2 === 0) {
        ctx.globalAlpha = 0.55;
        block(x, zoneY, w, zoneH, DULL);
        ctx.globalAlpha = 1;
      }
      block(x, lineY - 7, w, 14, hitAge < HIT_FLASH_MS || lit[i] ? pal.light : "#e6e6e6", 7);
    }

    ctx.save();
    ctx.beginPath();
    ctx.rect(r.x, r.y, r.w, r.h); // tiles appear at the pad's far edge
    ctx.clip();
    for (const t of pad.tiles) {
      if (t.state === "hit") continue;
      const holding = t.state === "holding";
      let head = holding ? Math.min(t.v, HIT_V) : t.v; // while held, the head stays on the line
      let tail = t.kind === "hold" ? t.vTail : head - TILE_H;
      let alpha = 1;
      if (t.state === "missed") { // fade out where it stands, never slide on
        let m = st.missed.get(t.id);
        if (!m) st.missed.set(t.id, (m = { at: now, head, tail }));
        const age = (now - m.at) / MISSED_FADE_MS;
        if (age >= 1) continue;
        head = m.head;
        tail = m.tail;
        alpha = 0.7 * (1 - age);
      }
      alpha *= clamp01((head - 0.04) / 0.2); // tiles come up out of the dark under the score
      const x = r.x + t.lane * laneW + GAP / 2;
      const w = laneW - GAP;
      const y = r.y + tail * r.h;
      const h = (head - tail) * r.h;
      ctx.globalAlpha = alpha;
      if (t.state === "missed") block(x, y, w, h, pal.dull, 14);
      else if (t.kind === "hold") holdTile(x, y, w, h, pal, holding, now);
      else tapTile(x, y, w, h, pal);
      ctx.globalAlpha = 1;
      if (holding) {
        const hx = x + w / 2;
        fx.light(ctx, pal.light, hx, lineY, H * (0.07 + 0.012 * Math.sin(now * 0.02)), 0.8);
        if (now - st.ember[t.lane] > 70) { st.ember[t.lane] = now; fx.burst(hx, lineY, pal.light, 1, H * 0.5, H * 0.03); }
      }
    }
    ctx.restore();
    ctx.fillStyle = "#000"; // a dark plate under the score that thins out in three steps, so tiles come up from behind it
    let plateY = r.y;
    for (const step of PLATE) {
      ctx.globalAlpha = step.alpha;
      ctx.fillRect(r.x, plateY, r.w, H * step.h);
      plateY += H * step.h;
    }
    ctx.globalAlpha = 1;

    frame(r, pal, st, now);

    const pop = 1 + 0.2 * (1 - easeOut((now - st.scoreAt) / 180));
    text(String(Math.round(st.shown)), cx, r.y + H * 0.06, H * 0.085 * pop, mult > 1 ? pal.light : pal.base, r.w - 20);
    if (combo >= 2) text(mult > 1 ? `${combo} COMBO  x${mult}` : `${combo} COMBO`, cx, r.y + H * 0.135, H * 0.065, mult > 1 ? pal.light : WHITE, r.w - 20);
    const drop = (now - st.dropAt) / DROP_MS;
    if (drop < 1) {
      ctx.globalAlpha = 1 - drop;
      text(`${st.dropVal} COMBO`, cx, r.y + H * 0.135 + easeOut(drop) * H * 0.09, H * 0.065, DULL, r.w - 20);
      ctx.globalAlpha = 1;
    }
  }

  // A pad with no song on it: the lobby, or a seat nobody sits in. In the lobby only the squares are
  // drawn, so the QR code above belongs to no seat. Empty seats light their lanes one after another,
  // a come-and-stand-here; a seat with a player is solid and its frame breathes.
  function idlePad(spot, r, player, lobby, now, layout) {
    const pal = palette(spot.id);
    const top = lobby ? ZONE_V * r.h : 0;
    const y = r.y + top;
    const h = r.h - top;
    const laneW = r.w / layout.lanes;
    const beat = lobby && !player ? Math.floor(now / 450 + spot.id * 2) % (layout.lanes + 2) : -1;
    for (let i = 0; i < layout.lanes; i++) {
      block(r.x + i * laneW + GAP / 2, y, laneW - GAP, h, player || i === beat ? pal.lit : pal.floor);
    }
    if (player) {
      ctx.globalAlpha = 0.55 + 0.45 * Math.sin(now * 0.004);
      ctx.beginPath();
      ctx.roundRect(r.x - 2, y - 2, r.w + 4, h + 4, 20);
      ctx.strokeStyle = pal.base;
      ctx.lineWidth = 8;
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
    ctx.globalAlpha = player ? 1 : 0.6;
    text(String(spot.id), r.x + r.w / 2, y + h * 0.42, Math.min(H * 0.22, r.w * 0.5), pal.base);
    ctx.globalAlpha = 1;
    if (player) text(player.name, r.x + r.w / 2, y + h * 0.78, H * TEXT, WHITE, r.w - 24);
  }

  // Each seat's grade stamps in, one after another, then its score counts up. The top score gets the hot frame.
  function resultsPad(spot, r, player, now, index, top) {
    const pal = palette(spot.id);
    const st = stateOf(spot.id);
    const cx = r.x + r.w / 2;
    const since = now - statusAt - 200 - index * 260;
    const grade = player?.grade ?? "-";
    block(r.x, r.y, r.w, r.h, pal.deep, 18);
    if (top) { st.lv = 3; frame(r, pal, st, now); } else frame(r, pal, st, now);
    if (since < 0) return;
    if (!st.stamped) {
      st.stamped = true;
      fx.ring(cx, r.y + r.h * 0.3, pal.light, r.w * 0.7, 16, 600);
      fx.burst(cx, r.y + r.h * 0.3, pal.light, grade === "S" ? 36 : 14, H * 1.1, H * 0.04);
    }
    text(grade, cx, r.y + r.h * 0.3, Math.min(H * 0.3, r.w * 0.7) * backOut(since / 450), grade === "C" ? pal.dull : pal.base);
    text(String(Math.round((player?.score ?? 0) * easeOut((since - 300) / 900))), cx, r.y + r.h * 0.58, H * TEXT, WHITE, r.w - 24);
    text(`Best ${player?.maxCombo ?? 0}`, cx, r.y + r.h * 0.72, H * 0.07, pal.light, r.w - 24);
    if (player) text(player.name, cx, r.y + r.h * 0.88, H * TEXT, pal.base, r.w - 24);
    if (top) text("TOP SCORE", cx, r.y + r.h * 0.07, H * 0.065, WHITE, r.w - 24);
  }

  // The train clock along the top edge: the train leaves as the tiles start and reaches its station as
  // the song ends. Time left is in big digits, and the station carries the stop's name.
  function clock(view, now) {
    const { song, songMs, transit, layout } = view;
    const total = songSeconds(song) * 1000;
    const p = clamp01((songMs + TRAVEL_MS) / (total + TRAVEL_MS));
    const secs = Math.ceil(Math.max(0, total - Math.max(0, songMs)) / 1000);
    const urgent = songMs >= 0 && secs <= 10;
    const cy = H * 0.05;
    text(`${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, "0")}`, W * 0.085, cy, H * 0.085, urgent && Math.floor(now / 250) % 2 ? SEATS[2] : WHITE, W * 0.15);

    const sh = H * 0.07;
    let sw = sh;
    if (transit?.stop) { setFont(H * 0.05); sw = Math.min(W * 0.3, ctx.measureText(transit.stop).width + H * 0.06); }
    const sx = W * 0.98 - sw;
    if (p >= 0.995) fx.light(ctx, WHITE, sx + sw / 2, cy, sw * 0.8, 0.3 + 0.2 * Math.sin(now * 0.02));
    block(sx, cy - sh / 2, sw, sh, WHITE, 14);
    if (transit?.stop) text(transit.stop, sx + sw / 2, cy, H * 0.05, "#000", sw - H * 0.04, false);
    else { // no stop named: a finish flag
      const q = sh / 4;
      for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) if ((i + j) % 2 === 0) block(sx + i * q, cy - sh / 2 + j * q, q, q, "#000", 0);
    }

    const x0 = W * 0.17;
    const x1 = sx - 14;
    const th = H * 0.016;
    block(x0, cy - th / 2, x1 - x0, th, "#3d3d3d", th / 2);
    const carW = W * 0.042;
    const carH = H * 0.05;
    const locoW = W * 0.06;
    const locoH = H * 0.06;
    const trainLen = locoW + layout.spots.length * (carW + 7);
    const nose = x0 + trainLen + p * (x1 - x0 - trainLen);
    layout.spots.forEach((spot, i) => {
      const pal = palette(spot.id);
      const x = nose - locoW - (i + 1) * (carW + 7);
      block(x, cy - carH / 2, carW, carH, pal.base, 10);
      block(x + 7, cy - carH / 2 + 7, carW - 14, carH * 0.28, pal.deep, 4);
    });
    block(nose - locoW, cy - locoH / 2, locoW, locoH, WHITE, 16);
    block(nose - locoW * 0.62, cy - locoH / 2 + 8, locoW * 0.42, locoH * 0.32, "#1b1b1b", 5);
    fx.light(ctx, "#FFE9A8", nose + 4, cy, H * 0.06, 0.9);
  }

  // The QR code is drawn into its own picture when it changes, so a frame is one image, not 800 squares.
  function qrCode(qr, now) {
    const size = H * 0.38;
    const x = (W - size) / 2;
    const y = H * 0.14;
    if (!qrSprite || qrSprite.qr !== qr) {
      const dpr = window.devicePixelRatio || 1;
      const picture = document.createElement("canvas");
      picture.width = picture.height = Math.round(size * dpr);
      const g = picture.getContext("2d");
      const cells = qr.size + 8; // a quiet zone of four cells on every side, so phones can read it
      const cell = picture.width / cells;
      g.fillStyle = WHITE;
      g.fillRect(0, 0, picture.width, picture.height);
      g.fillStyle = "#000";
      for (let row = 0; row < qr.size; row++) {
        for (let col = 0; col < qr.size; col++) {
          if (qr.get(row, col)) g.fillRect(Math.floor((col + 4) * cell), Math.floor((row + 4) * cell), Math.ceil(cell), Math.ceil(cell));
        }
      }
      qrSprite = { qr, picture };
    }
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(x, y, size, size, 16);
    ctx.clip();
    ctx.drawImage(qrSprite.picture, x, y, size, size);
    ctx.restore();
    // The four seat colours chase round the code. It sits outside the white quiet zone, so the code itself never moves.
    const pad = 16;
    const perimeter = 4 * (size + 2 * pad);
    ctx.lineWidth = 12;
    ctx.lineJoin = "round";
    dash[0] = perimeter / 16;
    dash[1] = (perimeter * 3) / 16;
    ctx.setLineDash(dash);
    SEATS.forEach((col, k) => {
      ctx.beginPath();
      ctx.roundRect(x - pad, y - pad, size + 2 * pad, size + 2 * pad, 28);
      ctx.strokeStyle = col;
      ctx.lineDashOffset = -(now * 0.12) + (k * perimeter) / 16;
      ctx.stroke();
    });
    ctx.setLineDash(NO_DASH);
  }

  // view: { status, layout, pads: [{ spotId, lanes, tiles, feet }], players, songMs, song, transit, events, feet, qr, qrNote }
  // feet is every tracked foot on the field, [{ u, v }]. qr is the QR matrix ({ size, get(row, col) }) or
  // null, and qrNote says why there is none. song and transit are null when there is none.
  return function draw(view) {
    const { status, layout, pads, players, songMs, song, events, qr, qrNote } = view;
    const feet = view.feet ?? [];
    const now = performance.now();
    const dt = Math.min(50, now - lastNow);
    lastNow = now;
    if (status !== prevStatus) {
      prevStatus = status;
      statusAt = now;
      if (status === "lobby" || status === "countdown" || status === "results") states.clear(); // a new song, a new meter
    }
    layout.spots.forEach((spot, i) => rectOf(spot, i));
    for (const e of events) onEvent(e, layout, events, now);

    ctx.globalAlpha = 1;
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, W, H);

    const liveSong = song && songMs != null && (status === "countdown" || status === "playing" || status === "paused");
    if (liveSong) clock(view, now);

    const scores = players.filter((p) => pads.some((x) => x.spotId === p.spotId)).map((p) => p.score);
    const best = scores.length > 1 ? Math.max(...scores) : -1;
    layout.spots.forEach((spot, i) => {
      const r = rects[i];
      const pad = pads.find((p) => p.spotId === spot.id);
      const player = players.find((p) => p.spotId === spot.id);
      if (!pad) idlePad(spot, r, status === "lobby" ? player : null, status === "lobby", now, layout);
      else if (status === "results") resultsPad(spot, r, player, now, i, player?.score === best);
      else livePad(spot, r, pad, player, now, dt, layout);
    });

    for (const f of feet) { // the floor knows where every foot is, even between notes
      const spot = layout.spots.find((s) => f.u >= s.rect.u - 0.1 * s.rect.w && f.u <= s.rect.u + 1.1 * s.rect.w && f.v >= s.rect.v - 0.1 * s.rect.h && f.v <= s.rect.v + 1.1 * s.rect.h);
      fx.foot(f.u * W, f.v * H, spot ? palette(spot.id).base : WHITE, now);
    }
    fx.drawFeet(ctx, now, H);
    fx.draw(ctx, now, word);

    if (status === "lobby") {
      const pulse = 1 + 0.03 * Math.sin(now * 0.004);
      text("Scan to play", W / 2, H * 0.05, H * 0.085 * pulse);
      if (qr) qrCode(qr, now);
      else qrNote.forEach((line, i) => text(line, W / 2, H * (0.25 + i * 0.12), H * TEXT, WHITE, W * 0.9));
    } else if (liveSong && songMs < -1500) {
      // The song's title, from the countdown until the first tiles are well on their way.
      ctx.globalAlpha = clamp01((-1500 - songMs) / 1000);
      text(song.title, W / 2, H * 0.82, H * 0.085, WHITE, W * 0.9);
      ctx.globalAlpha = 1;
    }
    if (status === "countdown") {
      const remain = -TRAVEL_MS - songMs;
      const n = Math.min(3, Math.max(1, Math.ceil(remain / 1000)));
      const e = clamp01((n * 1000 - remain) / 1000); // 0 when the number lands, 1 as the next one is due
      const col = SEATS[3 - n];
      if (e < 0.15) { ctx.globalAlpha = 0.14 * (1 - e / 0.15); ctx.fillStyle = WHITE; ctx.fillRect(0, 0, W, H); }
      ctx.globalAlpha = (1 - e) ** 1.5;
      ctx.strokeStyle = col;
      ctx.lineWidth = 16;
      ctx.beginPath();
      ctx.arc(W / 2, H * 0.45, H * (0.18 + 0.5 * e), 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = e < 0.75 ? 1 : 1 - ((e - 0.75) / 0.25) * 0.8;
      text(String(n), W / 2, H * 0.45, H * 0.42 * (1 + 0.9 * (1 - easeOut(e / 0.22))), col);
      ctx.globalAlpha = 1;
    } else if (status === "paused") {
      ctx.globalAlpha = 0.6;
      ctx.fillStyle = "#000";
      ctx.fillRect(0, 0, W, H);
      ctx.globalAlpha = 0.85 + 0.15 * Math.sin(now * 0.005);
      text("Paused", W / 2, H * 0.45, H * 0.2);
      ctx.globalAlpha = 1;
    } else if (status === "results" && song) {
      text(song.title, W / 2, H * 0.045, H * 0.065, WHITE, W * 0.9);
    }
  };
}

