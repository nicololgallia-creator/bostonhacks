// The warm-up, before the first 3, 2, 1: every taken seat taps its foot a few times so the floor knows that player's foot.
// One instruction across the top, and a thin bar for the time left. At each taken seat's pad: dots that fill as that
// player's taps arrive, and when they are all in a tick, with the seat's colour flooding the pad. The foot zone flashes
// on every beat so people tap together. A seat that is not ready near the end is told to lift its foot higher.
// Seats nobody took are not drawn. Every repeating motion here is the one beat; nothing else moves on its own.
import { INK, WHITE, seatOf, clamp01, easeOut, backOut, spring } from "./floor-look.js";
import { drawLaneZone, drawBadge, laneGap, litLanes, HUD_BOTTOM } from "./floor-screens.js";
import { HIT_V } from "./engine.js";

const SEATS = 8;
const FLOOD_MS = 260;
const HINT_MS = 6000; // a seat that is still not ready this close to the end is told to lift its foot higher

export function createWarmup(kit) {
  const { ctx } = kit;
  const wasTaps = new Int8Array(SEATS); // taps seen last frame, to time each new dot's pop
  const popAt = new Float64Array(SEATS * 8).fill(-1e9); // when each dot filled
  const readyAt = new Float64Array(SEATS).fill(-1e9);
  const wasReady = new Uint8Array(SEATS);
  let frozen = null; // the time a pause began: the beat and the bar stand still while paused

  // A tick of two strokes, `size` tall. It arrives at size 0 and grows to full.
  function drawTick(cx, cy, size, colour) {
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.lineWidth = size * 0.2;
    ctx.strokeStyle = colour;
    ctx.beginPath();
    ctx.moveTo(cx - size * 0.5, cy + size * 0.02);
    ctx.lineTo(cx - size * 0.15, cy + size * 0.37);
    ctx.lineTo(cx + size * 0.55, cy - size * 0.4);
    ctx.stroke();
  }

  function pad(th, view, p, spot, now, phase, elapsed) {
    const { W, H, U } = kit;
    const w = view.warmup;
    const r = spot.rect;
    const px = r.u * W;
    const pw = r.w * W;
    const yBase = r.v * H;
    const ph = r.h * H;
    const top = Math.max(yBase, H * HUD_BOTTOM);
    const yLine = yBase + HIT_V * ph;
    const bottom = yBase + ph;
    const n = Math.max(1, p.lanes | 0);
    const gapX = laneGap(kit, n);
    const laneW = (pw - gapX * (n - 1)) / n;
    const seat = seatOf(th, p.spotId);
    const mine = w.players[p.spotId] ?? { taps: 0, ready: false };
    const s = p.spotId & 7;

    // New dots pop, and the pad floods the moment the last one is in.
    if (mine.taps > wasTaps[s]) for (let i = wasTaps[s]; i < Math.min(mine.taps, 8); i++) popAt[s * 8 + i] = now;
    wasTaps[s] = mine.taps;
    if (mine.ready && !wasReady[s]) readyAt[s] = now;
    wasReady[s] = mine.ready ? 1 : 0;
    const flood = mine.ready ? easeOut((now - readyAt[s]) / FLOOD_MS) : 0;
    const beat = (1 - phase) ** 3; // 1 on the beat, gone by the next
    const lit = litLanes(p.feet, n);

    for (let i = 0; i < n; i++) {
      const x = px + i * (laneW + gapX);
      ctx.beginPath();
      ctx.roundRect(x, top, laneW, bottom - top, kit.rad);
      ctx.fillStyle = th.slot;
      ctx.fill();
      ctx.save();
      ctx.clip();
      ctx.globalAlpha = flood; // a ready seat's pad floods with its colour
      ctx.fillStyle = seat.fill;
      ctx.fillRect(x, top, laneW, yLine - top);
      ctx.globalAlpha = 1;
      drawLaneZone(kit, th, x, laneW, yLine, bottom, n, i, mine.ready || lit & (1 << i) ? seat.fill : null, false);
      if (!mine.ready) { // the beat: the foot zone flashes white, the way a hit does
        ctx.globalAlpha = 0.55 * beat;
        ctx.fillStyle = WHITE;
        ctx.fillRect(x, yLine, laneW, bottom - yLine);
        ctx.globalAlpha = 1;
      }
      ctx.fillStyle = INK;
      ctx.fillRect(x, yLine - 5 * U, laneW, 10 * U);
      ctx.restore();
    }
    drawBadge(kit, th, p.spotId, px + pw / 2, (yLine + bottom) / 2 + 4 * U, false);

    const laneH = yLine - top;
    const cx = px + pw / 2;
    // The dots: filled when tapped. The next one to tap breathes on the beat.
    const ink = mine.ready ? seat.text : INK; // the flooded pad is the seat's colour, so its marks take the seat's text colour
    const rd = Math.min(pw * 0.085, H * 0.04);
    const dy = top + laneH * 0.66;
    for (let i = 0; i < w.need; i++) {
      const dx = cx + (i - (w.need - 1) / 2) * (rd * 2.7);
      const filled = i < mine.taps;
      const k = filled ? 1 + 0.35 * spring((now - popAt[s * 8 + (i & 7)]) / 1000) : !mine.ready && i === mine.taps ? 1 + 0.18 * beat : 1;
      ctx.beginPath();
      ctx.arc(dx, dy, rd * k, 0, Math.PI * 2);
      if (filled) { ctx.fillStyle = ink; ctx.fill(); }
      else { ctx.lineWidth = 5 * U; ctx.strokeStyle = ink; ctx.stroke(); }
    }

    if (mine.ready) {
      drawTick(cx, top + laneH * 0.3, H * 0.19 * backOut((now - readyAt[s]) / 400), ink);
    } else if (elapsed >= w.maxMs - HINT_MS) {
      const hw = pw - 20 * U;
      const hh = H * 0.19;
      kit.plate(cx - hw / 2, top + laneH * 0.3 - hh / 2, hw, hh, 20 * U, WHITE);
      kit.text("Lift your", cx, top + laneH * 0.3 - H * 0.04, H * 0.055, INK, true, "center", hw - 24 * U);
      kit.text("foot higher", cx, top + laneH * 0.3 + H * 0.04, H * 0.055, INK, true, "center", hw - 24 * U);
    }

    // The floor sees each foot that is down: a ring in the seat's colour, where the foot is.
    for (let k = 0; k < p.feet.length; k++) {
      const f = p.feet[k];
      kit.disc(px + f.u * pw, yBase + f.v * ph, H * 0.034, WHITE);
      kit.disc(px + f.u * pw, yBase + f.v * ph, H * 0.02, seat.fill);
    }
  }

  return {
    // A new warm-up starts every dot again.
    enter() {
      wasTaps.fill(0);
      popAt.fill(-1e9);
      readyAt.fill(-1e9);
      wasReady.fill(0);
      frozen = null;
    },

    draw(th, view, now, paused) {
      const { W, H, U } = kit;
      const w = view.warmup;
      if (!w) return;
      if (paused) frozen ??= now;
      else frozen = null;
      // The stage's clock runs a little behind performance.now() (the lag setting), so the bar and the beat are that much early.
      const elapsed = Math.max(0, (paused ? frozen : now) - w.startedAtMs);
      const phase = (elapsed % w.beatMs) / w.beatMs;

      kit.text(`Tap your foot ${w.need} times`, W / 2, H * 0.09, H * 0.11, INK, true, "center", W * 0.94);
      const bw = W * 0.4;
      const bh = H * 0.018;
      const by = H * 0.17;
      ctx.beginPath();
      ctx.roundRect((W - bw) / 2, by - bh / 2, bw, bh, bh / 2);
      ctx.fillStyle = th.slot;
      ctx.fill();
      const left = clamp01(1 - elapsed / w.maxMs);
      if (left > 0) {
        ctx.beginPath();
        ctx.roundRect((W - bw) / 2, by - bh / 2, Math.max(bh, bw * left), bh, bh / 2);
        ctx.fillStyle = INK;
        ctx.fill();
      }

      for (let i = 0; i < view.pads.length; i++) {
        const p = view.pads[i];
        const spot = view.layout.spots.find((q) => q.id === p.spotId);
        if (spot) pad(th, view, p, spot, now, phase, elapsed);
      }
    },
  };
}

