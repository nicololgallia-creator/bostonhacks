// The floor in the falling-tiles look (first drawn by Zohayb, refined in our style): black tiles the width of a lane
// slide toward the players on a field the colour of the line the train is on. Each seat's lane is drawn at that
// seat's pad, so the lanes sit at the players' feet. A lone player's pad is two lanes, one for each foot.
// Same call as render.js: createRenderer(canvas) returns draw(view). Every screen is drawn here: the lobby, the
// countdown, the song's title, playing, paused and the results. Flat shapes only, no shadowBlur, nothing built per frame.
import { HIT_V, ZONE_V } from "./engine.js";
import { INK, WHITE, GOLD, themeFor, seatOf, loadFonts, createKit, easeOut, spring } from "./floor-look.js";
import { createScreens, drawChip, HUD_BOTTOM } from "./floor-screens.js";

const TAP_H = 0.2; // a tap tile's length, as a share of its pad's length
const GAP_V = 0.012; // the field left between two tiles that follow each other in a lane
const FLASH_MS = 320;
const WORD_MS = 700;
const SQUASH_MS = 160;
const WORDS = ["", "Perfect", "Good", "Miss"];
const LANES = 64; // per-lane memory: 8 spots by 8 lanes
const slot = (spotId, lane) => ((spotId & 7) << 3) | (lane & 7);

export function createRenderer(canvas) {
  const kit = createKit(canvas);
  const { ctx } = kit;
  const screens = createScreens(kit);
  const hitAt = new Float64Array(LANES).fill(-1e9); // when a lane last scored
  const missAt = new Float64Array(LANES).fill(-1e9);
  const wordAt = new Float64Array(LANES).fill(-1e9);
  const wordGrade = new Uint8Array(LANES); // 1 perfect, 2 good, 3 miss
  const behind = new Float64Array(8); // for each lane of the pad being drawn, the front of the tile drawn before this one
  let ready = false;
  let wordW = [0, 0, 0, 0];
  let prevStatus = null;
  let lastNow = 0;

  function measure() { wordW = WORDS.map((w) => (w ? kit.width(w, kit.H * 0.06) + 44 * kit.U : 0)); }
  loadFonts().then(() => { ready = true; measure(); });
  window.addEventListener("resize", () => { kit.resize(); if (ready) measure(); });

  function onEvent(e, now) {
    if (e.type !== "hit" && e.type !== "holdStart" && e.type !== "miss") return;
    const i = slot(e.spotId, e.lane);
    wordAt[i] = now;
    if (e.type === "miss") { missAt[i] = now; wordGrade[i] = 3; return; }
    hitAt[i] = now;
    wordGrade[i] = e.grade === "perfect" ? 1 : 2;
  }

  // A tap tile is a black slab with a small window at its front. One that was just played squashes against the line.
  function tapTile(th, tx, tw, yTop, yHead, t, squash) {
    const { H, U } = kit;
    let w = tw;
    let h = yHead - yTop;
    let x = tx;
    if (squash > 0) { h *= 1 - 0.22 * squash; w *= 1 + 0.06 * squash; x -= (w - tw) / 2; yTop = yHead - h; }
    ctx.beginPath();
    ctx.roundRect(x, yTop, w, h, 16 * U);
    ctx.fillStyle = t.state === "hit" ? (squash > 0 ? INK : th.ghost) : t.state === "missed" ? th.dull : INK;
    ctx.fill();
    if (t.state === "waiting" && h > H * 0.08) {
      ctx.beginPath();
      ctx.roundRect(x + w * 0.27, yHead - H * 0.052, w * 0.46, H * 0.022, 6 * U);
      ctx.fillStyle = th.slot;
      ctx.fill();
    }
  }

  // A hold tile is a long slab. Waiting, it shows where to stand with a ring at its front and a line to its end.
  // While a foot holds it, it fills with the seat's colour and shrinks toward the line.
  function holdTile(th, seat, tx, tw, yTop, yHead, t) {
    const { H, U } = kit;
    ctx.beginPath();
    ctx.roundRect(tx, yTop, tw, yHead - yTop, 16 * U);
    if (t.state === "holding") {
      ctx.fillStyle = seat.fill;
      ctx.fill();
      ctx.lineWidth = 5 * U;
      ctx.strokeStyle = INK;
      ctx.stroke();
      return;
    }
    ctx.fillStyle = t.state === "hit" ? th.ghost : t.state === "missed" ? th.dull : INK;
    ctx.fill();
    if (t.state !== "waiting") return;
    const r = Math.min(tw * 0.16, H * 0.05);
    const ringY = yHead - r * 1.9;
    ctx.lineWidth = 5 * U;
    ctx.strokeStyle = th.slot;
    ctx.beginPath();
    ctx.arc(tx + tw / 2, ringY, r, 0, Math.PI * 2);
    ctx.stroke();
    if (ringY - r > yTop + r) { ctx.beginPath(); ctx.moveTo(tx + tw / 2, yTop + r); ctx.lineTo(tx + tw / 2, ringY - r); ctx.stroke(); }
  }

  function drawPad(th, pad, spot, songMs, now) {
    const { W, H, U } = kit;
    const r = spot.rect;
    const px = r.u * W;
    const pw = r.w * W;
    const yBase = r.v * H;
    const ph = r.h * H;
    const top = Math.max(yBase, H * HUD_BOTTOM);
    const yLine = yBase + HIT_V * ph;
    const bottom = yBase + ph;
    const n = Math.max(1, pad.lanes | 0);
    const gapX = n > 1 ? 36 * U : 0;
    const laneW = (pw - gapX * (n - 1)) / n;
    const seat = seatOf(th, pad.spotId);

    let lit = 0; // the lanes with a foot down, one bit each
    for (let k = 0; k < pad.feet.length; k++) {
      const f = pad.feet[k];
      if (f.v >= ZONE_V) lit |= 1 << Math.min(n - 1, Math.floor(f.u * n));
    }
    const sleeperGap = 0.1 * ph;
    const scroll = ((((songMs * HIT_V) / 2500) * ph) % sleeperGap + sleeperGap) % sleeperGap;

    for (let i = 0; i < n; i++) {
      const x = px + i * (laneW + gapX);
      const s = slot(pad.spotId, i);
      const hitAge = now - hitAt[s];
      const missAge = now - missAt[s];
      const pop = hitAge < 1000 ? 1 + 0.035 * spring(hitAge / 1000) : missAge < 1000 ? 1 - 0.02 * spring(missAge / 1000) : 1;
      ctx.save();
      if (pop !== 1) { ctx.translate(x + laneW / 2, bottom); ctx.scale(pop, pop); ctx.translate(-(x + laneW / 2), -bottom); }

      // The lane: a slot, the foot zone below the hit line, two rails, and sleepers running past with the song.
      ctx.beginPath();
      ctx.roundRect(x, top, laneW, bottom - top, kit.rad);
      ctx.fillStyle = th.slot;
      ctx.fill();
      ctx.save();
      ctx.clip();
      ctx.fillStyle = lit & (1 << i) ? seat.fill : th.platform;
      ctx.fillRect(x, yLine, laneW, bottom - yLine);
      ctx.fillStyle = th.sleeper;
      for (let y = top - sleeperGap + scroll; y < yLine; y += sleeperGap) ctx.fillRect(x + 10 * U, y, laneW - 20 * U, 6 * U);
      ctx.fillStyle = th.rail;
      ctx.fillRect(x + 12 * U, top, 5 * U, yLine - top);
      ctx.fillRect(x + laneW - 17 * U, top, 5 * U, yLine - top);

      // Tiles, far ones first. A tile never runs into the one behind it: it is cut short so the lane shows between them.
      // The engine lists tiles in the order of their notes, so the last in the list is the farthest.
      behind[i] = -Infinity;
      const tx = x + 28 * U;
      const tw = laneW - 56 * U;
      for (let k = pad.tiles.length - 1; k >= 0; k--) {
        const t = pad.tiles[k];
        if (t.lane !== i) continue;
        const isHold = t.kind === "hold";
        const head = t.state === "holding" && t.v > HIT_V ? HIT_V : t.v; // while held, the front waits on the line
        const tail = Math.max(isHold ? t.vTail : head - TAP_H, behind[i] + GAP_V);
        behind[i] = t.v;
        const yTop = yBase + tail * ph;
        const yHead = yBase + head * ph;
        if (yTop > bottom || yHead < top || yHead - yTop < 2) continue;
        if (isHold) holdTile(th, seat, tx, tw, yTop, yHead, t);
        else tapTile(th, tx, tw, yTop, yHead, t, t.state === "hit" && hitAge < SQUASH_MS && Math.abs(t.v - HIT_V) < 0.12 ? Math.sin((Math.PI * hitAge) / SQUASH_MS) : 0);
      }

      // The hit line is the platform's edge. A hit flashes the foot zone white, and a miss dims it.
      ctx.fillStyle = INK;
      ctx.fillRect(x, yLine - 5 * U, laneW, 10 * U);
      if (hitAge < FLASH_MS) { ctx.globalAlpha = 0.9 * (1 - hitAge / FLASH_MS); ctx.fillStyle = WHITE; ctx.fillRect(x, yLine, laneW, bottom - yLine); }
      else if (missAge < FLASH_MS) { ctx.globalAlpha = 0.4 * (1 - missAge / FLASH_MS); ctx.fillStyle = INK; ctx.fillRect(x, yLine, laneW, bottom - yLine); }
      ctx.globalAlpha = 1;
      ctx.restore();
      if (n === 2) kit.text(i ? "Right foot" : "Left foot", x + laneW / 2, yLine + H * 0.07, H * 0.06, INK, true, "center", laneW - 24 * U);

      // What the floor made of the last step in this lane: a word on a plate above the line.
      const wordAge = now - wordAt[s];
      if (wordAge < WORD_MS) {
        const g = wordGrade[s];
        const k = 1 + 0.25 * Math.max(0, 1 - wordAge / 120);
        const w = wordW[g] * k;
        const h = H * 0.08 * k;
        const cy = yLine - H * 0.1 - easeOut(wordAge / 400) * H * 0.03;
        ctx.globalAlpha = wordAge < 500 ? 1 : 1 - (wordAge - 500) / (WORD_MS - 500);
        kit.plate(x + laneW / 2 - w / 2, cy - h / 2, w, h, h / 2, g === 1 ? GOLD : g === 2 ? WHITE : th.dull);
        kit.text(WORDS[g], x + laneW / 2, cy + 2 * U, H * 0.06 * k, g === 3 ? WHITE : INK);
        ctx.globalAlpha = 1;
      }
      ctx.restore();
    }

    // Whose lane it is, at the players' edge, in the seat's colour; white while a foot is down.
    drawChip(kit, th, pad.spotId, px + pw / 2, bottom - H * 0.05, pw - 16 * U, lit ? WHITE : undefined);

    // The floor sees each foot that is down: a ring in the seat's colour, where the foot is.
    for (let k = 0; k < pad.feet.length; k++) {
      const f = pad.feet[k];
      const fx = px + f.u * pw;
      const fy = yBase + f.v * ph;
      kit.disc(fx, fy, H * 0.034, WHITE);
      kit.disc(fx, fy, H * 0.02, seat.fill);
    }
  }

  // A seat nobody has taken: its slot, with the light turned down.
  function drawOpen(th, spot) {
    const { W, H, U } = kit;
    const r = spot.rect;
    const top = Math.max(r.v * H, H * HUD_BOTTOM);
    ctx.beginPath();
    ctx.roundRect(r.u * W, top, r.w * W, (r.v + r.h) * H - top, kit.rad);
    ctx.fillStyle = th.slotOpen;
    ctx.fill();
    kit.text(`Seat ${spot.id}`, (r.u + r.w / 2) * W, (r.v + r.h * 0.6) * H, H * 0.06, th.quiet, true, "center", r.w * W - 20 * U);
  }

  // view: { status, layout, pads: [{ spotId, lanes, tiles, feet }], players, team, songMs, song, transit, train, events, qr, qrNote }
  return function draw(view) {
    const { status, layout, pads, songMs, song, events } = view;
    const now = performance.now();
    const dt = Math.min(50, now - lastNow);
    lastNow = now;
    const th = themeFor(view.train?.line ?? "Green-B");
    const { W, H } = kit;
    ctx.globalAlpha = 1;
    ctx.fillStyle = th.field;
    ctx.fillRect(0, 0, W, H);
    if (!ready) return; // the fonts come first, so no word is ever drawn in a stand-in face

    if (status !== prevStatus) {
      prevStatus = status;
      screens.enter(status, now);
      if (status === "lobby" || status === "countdown") { hitAt.fill(-1e9); missAt.fill(-1e9); wordAt.fill(-1e9); }
    }
    if (status === "lobby") return screens.lobby(th, view, now);
    if (status === "results") return screens.results(th, view, now);
    if (!song || songMs == null) return;

    for (let i = 0; i < events.length; i++) onEvent(events[i], now);
    screens.clock(th, view, now);
    screens.score(th, view, now, dt);
    for (let i = 0; i < layout.spots.length; i++) {
      const spot = layout.spots[i];
      let pad = null;
      for (let k = 0; k < pads.length; k++) if (pads[k].spotId === spot.id) pad = pads[k];
      if (pad) drawPad(th, pad, spot, songMs, now);
      else drawOpen(th, spot);
    }
    screens.title(th, song, songMs);
    if (status === "countdown") screens.countdown(songMs);
    else if (status === "paused") screens.paused(now);
  };
}
