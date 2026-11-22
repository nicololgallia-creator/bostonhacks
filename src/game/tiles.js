// The floor in the falling-tiles look (first drawn by Zohayb, refined in our style): black tiles the width of a lane
// slide toward the players on a field the colour of the line the train is on. Each seat's lane is drawn at that
// seat's pad, so the lanes sit at the players' feet. A lone player's pad is two lanes, one for each foot.
// Same call as render.js: createRenderer(canvas) returns draw(view). Every screen is drawn here: the lobby, the
// countdown, the song's title, playing, paused and the results. Flat shapes only, no shadowBlur, nothing built per frame.
import { HIT_V } from "./engine.js";
import { INK, WHITE, GOLD, themeFor, seatOf, isDuel, loadFonts, createKit, easeOut, easeIn, spring } from "./floor-look.js";
import { createScreens, drawBadge, drawLaneZone, drawSoundBanner, litLanes } from "./floor-screens.js";
import { createWarmup } from "./floor-warmup.js";
import { createDuel } from "./floor-duel.js";
import { createFloorFx, padGeom } from "./floor-fx.js";

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
  const warm = createWarmup(kit);
  const duel = createDuel(kit);
  const fx = createFloorFx(kit);
  const G = {}; // the pad being drawn
  const lg = {}; // the lane being drawn: x, w, top, yLine, bottom
  const hitAt = new Float64Array(LANES).fill(-1e9); // when a lane last scored
  const missAt = new Float64Array(LANES).fill(-1e9);
  const wordAt = new Float64Array(LANES).fill(-1e9);
  const wordGrade = new Uint8Array(LANES); // 1 perfect, 2 good, 3 miss
  const behind = new Float64Array(8); // for each lane of the pad being drawn, the front of the tile drawn before this one
  let ready = false;
  let wordW = [0, 0, 0, 0];
  let prevStatus = null;
  let lastNow = 0;
  let clock = 0; // the game clock: everything on the pads runs on it, and it stands still while paused

  function measure() { wordW = WORDS.map((w) => (w ? kit.width(w, kit.H * 0.06) + 44 * kit.U : 0)); }
  loadFonts().then(() => { ready = true; measure(); });
  window.addEventListener("resize", () => { kit.resize(); fx.clear(); if (ready) measure(); });

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

  // A hold tile is a long slab drawn at its full length: a ring at its head (where the foot lands), a line up to a bar at its
  // tail (where the foot lifts). Waiting, it is ink with the marks in the lane's colour. While a foot holds it, it is filled
  // with the seat's colour, marked in ink, and shrinks toward the line. A hold that was missed (the foot never landed on it,
  // or left too soon) goes dull with a cross at its far end, away from the player's number, so it reads as missed at once.
  // `top` is where the lane starts: the cross is never drawn above it. While a foot holds it, white dashes run up the slab
  // along both edges: `songMs` moves them at 1.5 times the speed the sleepers go by, `ph` is the pad's length.
  function holdTile(th, seat, tx, tw, yTop, yHead, t, top, songMs, ph) {
    const { H, U } = kit;
    ctx.beginPath();
    ctx.roundRect(tx, yTop, tw, yHead - yTop, 16 * U);
    const holding = t.state === "holding";
    ctx.fillStyle = holding ? seat.fill : t.state === "hit" ? th.ghost : t.state === "missed" ? th.dull : INK;
    ctx.fill();
    if (holding) { ctx.lineWidth = 5 * U; ctx.strokeStyle = INK; ctx.stroke(); }
    const cx = tx + tw / 2;
    const len = yHead - yTop;
    if (t.state === "missed") {
      const a = Math.min(tw * 0.14, H * 0.04, len * 0.2);
      const y = Math.max(yTop, top) + a * 1.6;
      ctx.lineCap = "round";
      ctx.lineWidth = 9 * U;
      ctx.strokeStyle = INK;
      ctx.beginPath();
      ctx.moveTo(cx - a, y - a); ctx.lineTo(cx + a, y + a);
      ctx.moveTo(cx + a, y - a); ctx.lineTo(cx - a, y + a);
      ctx.stroke();
      return;
    }
    if (!holding && t.state !== "waiting") return;
    const mark = holding ? INK : th.slot;
    const r = Math.min(tw * 0.16, H * 0.05, len * 0.2); // a short hold gets a smaller ring, so its tail still shows
    const ringY = yHead - r * 1.9;
    const barH = Math.min(H * 0.022, len * 0.07);
    const barY = yTop + Math.min(H * 0.03, len * 0.12);
    if (holding) {
      const gap = H * 0.09;
      const dash = H * 0.05;
      const dw = tw * 0.1;
      ctx.lineWidth = 4 * U;
      ctx.strokeStyle = INK;
      ctx.fillStyle = WHITE;
      for (let y = yHead - ((songMs * 0.00045 * ph) % gap); y - dash > yTop + 6 * U; y -= gap) { // one column along each edge, clear of the ring and the bar
        ctx.beginPath();
        ctx.roundRect(tx + tw * 0.1, y - dash, dw, dash, dw / 2);
        ctx.roundRect(tx + tw * 0.9 - dw, y - dash, dw, dash, dw / 2);
        ctx.fill();
        ctx.stroke();
      }
    }
    ctx.lineWidth = 5 * U;
    ctx.strokeStyle = mark;
    ctx.beginPath();
    ctx.arc(cx, ringY, r, 0, Math.PI * 2);
    ctx.stroke();
    if (ringY - r > barY + barH) { ctx.beginPath(); ctx.moveTo(cx, barY + barH); ctx.lineTo(cx, ringY - r); ctx.stroke(); }
    if (barY + barH < ringY - r) { // the tail's bar, once the slab is long enough to hold both
      ctx.beginPath();
      ctx.roundRect(tx + tw * 0.27, barY, tw * 0.46, barH, 6 * U);
      ctx.fillStyle = mark;
      ctx.fill();
    }
  }

  function drawPad(th, pad, spot, songMs, now) {
    const { H, U } = kit;
    const { px, pw, yBase, ph, top, yLine, bottom, n, gapX, laneW } = padGeom(kit, spot.rect, pad.lanes, G);
    const seat = seatOf(th, pad.spotId);
    const look = fx.look(th, pad.spotId); // the lane's colours at this seat's heat

    const lit = litLanes(pad.feet, n); // the lanes with a foot down, one bit each
    const sleeperGap = 0.1 * ph;
    const scroll = ((((songMs * HIT_V) / 2500) * ph) % sleeperGap + sleeperGap) % sleeperGap;

    ctx.save();
    ctx.translate(fx.shake(pad.spotId, now), 0); // one short shake when a streak breaks
    for (let i = 0; i < n; i++) {
      const x = px + i * (laneW + gapX);
      lg.x = x; lg.w = laneW; lg.top = top; lg.yLine = yLine; lg.bottom = bottom;
      const s = slot(pad.spotId, i);
      const hitAge = now - hitAt[s];
      const missAge = now - missAt[s];
      const pop = hitAge < 1000 ? 1 + 0.035 * spring(hitAge / 1000) : missAge < 1000 ? 1 - 0.02 * spring(missAge / 1000) : 1;
      ctx.save();
      if (pop !== 1) { ctx.translate(x + laneW / 2, bottom); ctx.scale(pop, pop); ctx.translate(-(x + laneW / 2), -bottom); }

      // The lane: a slot, the foot zone below the hit line, two rails, and sleepers running past with the song.
      ctx.beginPath();
      ctx.roundRect(x, top, laneW, bottom - top, kit.rad);
      ctx.fillStyle = look.slot;
      ctx.fill();
      ctx.save();
      ctx.clip();
      drawLaneZone(kit, th, x, laneW, yLine, bottom, n, i, lit & (1 << i) ? seat.fill : null, false);
      ctx.fillStyle = look.sleeper;
      for (let y = top - sleeperGap + scroll; y < yLine; y += sleeperGap) ctx.fillRect(x + 10 * U, y, laneW - 20 * U, 6 * U);
      ctx.fillStyle = look.rail;
      ctx.fillRect(x + 12 * U, top, look.railW * U, yLine - top);
      ctx.fillRect(x + laneW - (12 + look.railW) * U, top, look.railW * U, yLine - top);
      fx.laneBehind(pad.spotId, i, lg, now); // the heat's sweep and the points flying up this lane

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
        if (isHold) holdTile(th, seat, tx, tw, yTop, yHead, t, top, songMs, ph);
        else tapTile(th, tx, tw, yTop, yHead, t, t.state === "hit" && hitAge < SQUASH_MS && Math.abs(t.v - HIT_V) < 0.12 ? Math.sin((Math.PI * hitAge) / SQUASH_MS) : 0);
      }

      // The hit line is the platform's edge. A hit flashes the foot zone white, and a miss dims it.
      ctx.fillStyle = INK;
      ctx.fillRect(x, yLine - 5 * U, laneW, 10 * U);
      if (hitAge < FLASH_MS) { ctx.globalAlpha = 0.9 * (1 - hitAge / FLASH_MS); ctx.fillStyle = WHITE; ctx.fillRect(x, yLine, laneW, bottom - yLine); }
      else if (missAge < FLASH_MS) { ctx.globalAlpha = 0.4 * (1 - missAge / FLASH_MS); ctx.fillStyle = INK; ctx.fillRect(x, yLine, laneW, bottom - yLine); }
      ctx.globalAlpha = 1;
      fx.laneFront(pad.spotId, i, lg, now); // a together tile's gold and a finished hold's beat
      ctx.restore();

      // What the floor made of the last step in this lane: a word on a plate above the line.
      const wordAge = now - wordAt[s];
      if (wordAge < WORD_MS) {
        const g = wordGrade[s];
        const k = (1 + 0.25 * Math.max(0, 1 - wordAge / 120)) * (1 - easeIn((wordAge - 520) / (WORD_MS - 520))); // pops in, then shrinks away
        const w = wordW[g] * k;
        const h = H * 0.08 * k;
        const cy = yLine - H * 0.1 - easeOut(wordAge / 400) * H * 0.03;
        kit.plate(x + laneW / 2 - w / 2, cy - h / 2, w, h, h / 2, g === 1 ? GOLD : g === 2 ? WHITE : th.dull);
        kit.text(WORDS[g], x + laneW / 2, cy + 2 * U, H * 0.06 * k, g === 3 ? WHITE : INK);
      }
      ctx.restore();
    }

    // Whose feet these are: the player's number among the footprints, in the seat's colour.
    drawBadge(kit, th, pad.spotId, px + pw / 2, (yLine + bottom) / 2 + 4 * U, false);
    fx.stamp(pad.spotId, G, now); // the multiplier, when a streak steps up
    ctx.restore();

    // The floor sees each foot that is down: a ring in the seat's colour, where the foot is.
    for (let k = 0; k < pad.feet.length; k++) {
      const f = pad.feet[k];
      const footX = px + f.u * pw;
      const footY = yBase + f.v * ph;
      kit.disc(footX, footY, H * 0.034, WHITE);
      kit.disc(footX, footY, H * 0.02, seat.fill);
    }
  }

  // The screen of one status. Only the seats that are taken have a pad, each where its pad really is; a free seat is not drawn.
  // `now` is the wall clock, `game` the game clock that stands still in a pause. `stale` follows a long gap, such as a hidden tab.
  function paint(th, view, now, dt, game, stale) {
    const { status, layout, pads, songMs, song, events } = view;
    if (status === "lobby") return screens.lobby(th, view, now);
    if (status === "results") return screens.results(th, view, now);
    if (status === "warmup" || (status === "paused" && view.warmup)) { // a pause that began in the warm-up keeps drawing it
      warm.draw(th, view, now, status === "paused");
      if (status === "paused") screens.paused(now);
      return;
    }
    if (!song || songMs == null) return;

    for (let i = 0; i < events.length; i++) onEvent(events[i], game);
    fx.ingest(view, game, stale);
    fx.behind(game);
    screens.clock(th, view, now);
    fx.hud(); // points flying to the score pass under its digits
    screens.score(th, view, now, dt, fx.pendTeam);
    for (let i = 0; i < pads.length; i++) {
      const spot = layout.spots.find((s) => s.id === pads[i].spotId);
      if (spot) drawPad(th, pads[i], spot, songMs, game);
    }
    if (isDuel(view)) duel.plates(th, view, game, dt, fx.pend);
    fx.front(game);
    screens.title(th, song, songMs);
    if (status === "countdown") screens.countdown(songMs);
    else if (status === "paused") screens.paused(now);
  }

  // view: { status, mode, winner, warmup, soundLocked, layout, pads: [{ spotId, lanes, tiles, feet }], players, team, songMs, song, transit, train, events, qr, qrNote }
  return function draw(view) {
    const { status } = view;
    const now = performance.now();
    const gap = now - lastNow;
    const dt = Math.min(50, gap);
    lastNow = now;
    if (status !== "paused") clock += Math.min(100, gap); // a hidden tab moves the effects on by one frame, not by the whole gap
    const th = themeFor(view.train?.line ?? "Green-B");
    const { W, H } = kit;
    ctx.globalAlpha = 1;
    ctx.fillStyle = th.field;
    ctx.fillRect(0, 0, W, H);
    if (!ready) return; // the fonts come first, so no word is ever drawn in a stand-in face

    if (status !== prevStatus) {
      prevStatus = status;
      screens.enter(status, now);
      warm.enter(status);
      duel.enter(status);
      fx.enter(status);
      if (status === "lobby" || status === "countdown") { hitAt.fill(-1e9); missAt.fill(-1e9); wordAt.fill(-1e9); }
    }
    paint(th, view, now, dt, clock, gap > 250);
    if (view.soundLocked) drawSoundBanner(kit, status, now);
  };
}
