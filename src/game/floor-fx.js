// The floor's reactions to play. Each one is short and means one thing:
//   a hit      the points fly up out of the foot and land in the score (the team's, or the player's own plate in a duel)
//   a streak   at 10, 25 and 50 in a row the lane turns gold and the new multiplier is stamped on the pad
//   a break    the heat drops out at once and the pad shakes once (only when a streak of 10 or more ends)
//   a hold     (held tiles are drawn in tiles.js) a clear finish beat at the line when it is held to the end
//   together   when every player lands a tile they were all given, the whole floor flashes once
// It reads what the renderer already gets: the pads, the players and the engine's events. Time is the renderer's game clock,
// which stands still while paused. Flat shapes only, no shadows, nothing built per frame: a fixed pool of floaters and typed arrays.
import { HIT_V, multiplierFor } from "./engine.js";
import { INK, WHITE, GOLD, mix, clamp01, easeOut, easeIn, backOut, isDuel } from "./floor-look.js";
import { laneGap, HUD_BOTTOM } from "./floor-screens.js";

export const STREAK_MIN = 10; // a streak shorter than this breaks quietly
const SEATS = 8;
const KEYS = SEATS << 10; // one flag for each tile of each seat
const POOL = 24; // points in the air at once
const FLY_MS = 450;
const STAMP_MS = 700;
const SWEEP_MS = 450;
const SHAKE_MS = 220;
const TOGETHER_MS = 450;
const FINISH_MS = 400;
const STALE_MS = 250; // a frame this long after the last is a tab that was hidden: nothing is queued up from it
const SAME_V = 5e-4; // two tiles this close in v (under 2 ms of song) are the same moment
const HEAT_TINT = [0, 0.4, 0.6, 0.8]; // how far a lane turns from its own colour toward gold at each heat level

// ---- the rules, with no drawing (tested in floor-fx.test.js) ----

// 0 for no streak, then 1, 2, 3 at 10, 25 and 50 in a row: the combo multiplier minus one.
export const heatOf = (combo) => multiplierFor(combo) - 1;
export const breaksStreak = (before, after) => before >= STREAK_MIN && after === 0;
// How far the pad is pushed sideways `age` ms after a streak broke: two swings that die away. `amp` in pixels.
export const shakeOffset = (age, amp) => (age < 0 || age >= SHAKE_MS ? 0 : amp * (1 - age / SHAKE_MS) * Math.sin((age / SHAKE_MS) * Math.PI * 4));

// The tile in `tiles` at the same moment of the song as `v` (the engine's v for a tile's time), or null.
export function sameMoment(tiles, v) {
  for (let i = 0; i < tiles.length; i++) if (Math.abs(tiles[i].v - v) < SAME_V) return tiles[i];
  return null;
}
// A tile every pad has at once is a tile the chart gave to everyone.
export const everyoneHas = (pads, v) => pads.length > 1 && pads.every((p) => sameMoment(p.tiles, v));
export const everyoneLanded = (pads, v) => pads.every((p) => { const t = sameMoment(p.tiles, v); return !!t && (t.state === "hit" || t.state === "holding"); });

// Where a floater is `q` (0 to 1) of the way along: up its lane first, then across to where it lands. Writes into `out`.
export function flightAt(q, x0, y0, x1, y1, out) {
  out.x = x0 + (x1 - x0) * easeIn((q - 0.35) / 0.65);
  out.y = y0 + (y1 - y0) * easeOut(q);
  return out;
}

// A pad's measures in pixels, written into `g`. The renderer and the effects share this one reading of a pad.
export function padGeom(kit, rect, lanes, g) {
  g.px = rect.u * kit.W;
  g.pw = rect.w * kit.W;
  g.yBase = rect.v * kit.H;
  g.ph = rect.h * kit.H;
  g.top = Math.max(g.yBase, kit.H * HUD_BOTTOM); // the lanes start under the clock and the score
  g.yLine = g.yBase + HIT_V * g.ph;
  g.bottom = g.yBase + g.ph;
  g.n = Math.max(1, lanes | 0);
  g.gapX = laneGap(kit, g.n);
  g.laneW = (g.pw - g.gapX * (g.n - 1)) / g.n;
  return g;
}

const looks = new WeakMap(); // theme -> what a lane looks like at each heat level
function lookOf(th, level) {
  let all = looks.get(th);
  if (!all) {
    all = HEAT_TINT.map((k, i) => {
      const slot = k ? mix(th.slot, GOLD, k) : th.slot;
      return { slot, sleeper: mix(slot, INK, 0.16), rail: i ? INK : th.rail, railW: 5 + 3 * i };
    });
    looks.set(th, all);
  }
  return all[level];
}

export function createFloorFx(kit) {
  const { ctx } = kit;
  const G = {}; // the pad being read
  const out = { x: 0, y: 0 };
  // per seat
  const prevCombo = new Int16Array(SEATS);
  const heat = new Uint8Array(SEATS);
  const stepAt = new Float64Array(SEATS).fill(-1e9);
  const stepMult = new Uint8Array(SEATS);
  const breakAt = new Float64Array(SEATS).fill(-1e9);
  const lastScore = new Float64Array(SEATS);
  const share = new Int16Array(SEATS); // the point events this frame, for each seat
  const gain = new Float64Array(SEATS); // the score each seat made this frame
  const pend = new Float64Array(SEATS); // points still flying, for each seat: the score has not "received" them yet
  const finishAt = new Float64Array(SEATS * 8).fill(-1e9); // when a hold was last held to the end, for each lane
  const tileFlag = new Uint8Array(KEYS); // 0 unseen, 1 one player's, 2 given to everyone, 3 everyone has landed it
  let togetherAt = -1e9;
  let togetherY = 0;
  // the floaters
  const on = new Uint8Array(POOL);
  const seatOf = new Uint8Array(POOL);
  const laneOf = new Uint8Array(POOL);
  const gold = new Uint8Array(POOL);
  const pts = new Int32Array(POOL);
  const startAt = new Float64Array(POOL);
  const x0 = new Float64Array(POOL);
  const y0 = new Float64Array(POOL);
  const x1 = new Float64Array(POOL);
  const y1 = new Float64Array(POOL);
  const laneTop = new Float64Array(POOL);
  const cx = new Float64Array(POOL);
  const cy = new Float64Array(POOL);
  const size = new Float64Array(POOL);
  const label = new Array(POOL).fill("");

  const fx = {
    pend, // points in the air for each seat, so the score can wait for them
    pendTeam: 0,

    // A new song starts everything again.
    enter(status) {
      if (status !== "lobby" && status !== "warmup" && status !== "countdown") return;
      fx.clear();
    },
    clear() {
      on.fill(0);
      prevCombo.fill(0);
      heat.fill(0);
      stepAt.fill(-1e9);
      breakAt.fill(-1e9);
      lastScore.fill(0);
      pend.fill(0);
      finishAt.fill(-1e9);
      tileFlag.fill(0);
      togetherAt = -1e9;
      fx.pendTeam = 0;
    },

    // Once a frame, before anything is drawn. `stale` is a frame that follows a long gap (a hidden tab): it only catches up.
    ingest(view, now, stale) {
      const { pads, players, events, layout } = view;
      const duel = isDuel(view);
      fx.pendTeam = 0;
      pend.fill(0);
      for (let f = 0; f < POOL; f++) {
        if (!on[f]) continue;
        const q = (now - startAt[f]) / FLY_MS;
        if (q >= 1) { on[f] = 0; continue; }
        flightAt(q, x0[f], y0[f], x1[f], y1[f], out);
        cx[f] = out.x;
        cy[f] = out.y;
        size[f] = (gold[f] ? kit.H * 0.085 : kit.H * 0.06) * (1 - 0.25 * easeIn(q));
        pend[seatOf[f]] += pts[f];
        fx.pendTeam += pts[f];
      }

      share.fill(0);
      gain.fill(0);
      for (let i = 0; i < pads.length; i++) {
        const p = players.find((q) => q.spotId === pads[i].spotId);
        if (!p) continue;
        const k = p.spotId & 7;
        const level = heatOf(p.combo);
        if (!stale) {
          if (level > heat[k]) { stepAt[k] = now; stepMult[k] = level + 1; }
          if (breaksStreak(prevCombo[k], p.combo)) breakAt[k] = now;
          gain[k] = p.score - lastScore[k];
        }
        heat[k] = level;
        prevCombo[k] = p.combo;
        lastScore[k] = p.score;
      }
      if (stale) return;

      // Each point-making event takes an equal part of what its seat scored this frame.
      for (let i = 0; i < events.length; i++) if (events[i].type === "hit" || events[i].type === "holdEnd") share[events[i].spotId & 7]++;
      for (let i = 0; i < events.length; i++) {
        const e = events[i];
        if (e.type !== "hit" && e.type !== "holdEnd") continue;
        const k = e.spotId & 7;
        const part = Math.round(gain[k] / share[k]);
        if (part <= 0) continue;
        const pad = pads.find((q) => q.spotId === e.spotId);
        const spot = layout.spots.find((s) => s.id === e.spotId);
        const p = players.find((q) => q.spotId === e.spotId);
        if (!pad || !spot || !p) continue;
        // A hold held to its end is paid more than a good one: that is the finish beat.
        if (e.type === "holdEnd" && part > 50 * p.multiplier) finishAt[(k << 3) | (e.lane & 7)] = now;
        spawn(e, part, pad, spot, duel, now);
      }

      // Everyone-at-once: a tile on the first pad that every pad has at the same moment, and every player has now landed.
      if (!duel && pads.length > 1) {
        const first = pads[0];
        for (let i = 0; i < first.tiles.length; i++) {
          const t = first.tiles[i];
          const key = ((first.spotId & 7) << 10) | (t.id & 1023);
          if (tileFlag[key] === 0) tileFlag[key] = everyoneHas(pads, t.v) ? 2 : 1;
          if (tileFlag[key] !== 2 || (t.state !== "hit" && t.state !== "holding") || !everyoneLanded(pads, t.v)) continue;
          tileFlag[key] = 3;
          togetherAt = now;
          const spot = layout.spots.find((s) => s.id === first.spotId);
          if (spot) togetherY = padGeom(kit, spot.rect, first.lanes, G).yLine;
        }
      }
    },

    // What a lane looks like at its seat's heat: its colours and how thick its rails are.
    look: (th, spotId) => lookOf(th, heat[spotId & 7]),
    // How far a seat's pad is pushed sideways now, in pixels.
    shake: (spotId, now) => shakeOffset(now - breakAt[spotId & 7], kit.W * 0.006),

    // The whole floor, behind everything: a flash when everyone lands a tile together.
    behind(now) {
      const age = now - togetherAt;
      if (age >= TOGETHER_MS) return;
      ctx.globalAlpha = 0.55 * (1 - easeOut(age / TOGETHER_MS));
      ctx.fillStyle = WHITE;
      ctx.fillRect(0, 0, kit.W, kit.H);
      ctx.globalAlpha = 1;
    },

    // The points still in the air above the lanes, before the score is drawn, so they fly in under it.
    hud() {
      for (let f = 0; f < POOL; f++) if (on[f] && cy[f] - size[f] / 2 < laneTop[f]) drawFloater(f);
    },

    // Inside one lane's clip, behind its tiles: the sweep of a step up in heat, and the points still in this lane.
    laneBehind(spotId, i, lg, now) {
      const k = spotId & 7;
      const age = now - stepAt[k];
      if (age < SWEEP_MS) {
        const e = easeOut(age / SWEEP_MS);
        const h = kit.H * 0.14;
        ctx.globalAlpha = 0.6 * (1 - e);
        ctx.fillStyle = GOLD;
        ctx.fillRect(lg.x, lg.yLine - h - e * (lg.yLine - lg.top), lg.w, h);
        ctx.globalAlpha = 1;
      }
      for (let f = 0; f < POOL; f++) if (on[f] && seatOf[f] === k && laneOf[f] === i && cy[f] + size[f] / 2 > lg.top) drawFloater(f);
    },

    // Inside one lane's clip, over its tiles and hit line: the foot zone's gold for a together tile or a finished hold,
    // and the finish beat's bar at the line.
    laneFront(spotId, i, lg, now) {
      const U = kit.U;
      const together = now - togetherAt;
      if (together < TOGETHER_MS) {
        ctx.globalAlpha = 0.85 * (1 - easeOut(together / TOGETHER_MS));
        ctx.fillStyle = GOLD;
        ctx.fillRect(lg.x, lg.yLine, lg.w, lg.bottom - lg.yLine);
      }
      const done = now - finishAt[((spotId & 7) << 3) | (i & 7)];
      if (done < FINISH_MS) {
        const e = easeOut(done / FINISH_MS);
        ctx.globalAlpha = 1 - e * e;
        ctx.fillStyle = GOLD;
        ctx.fillRect(lg.x, lg.yLine, lg.w, lg.bottom - lg.yLine);
        const h = kit.H * (0.012 + 0.05 * e);
        ctx.fillRect(lg.x, lg.yLine - h, lg.w, h);
        ctx.fillStyle = INK;
        ctx.fillRect(lg.x, lg.yLine - h - 4 * U, lg.w, 4 * U);
      }
      ctx.globalAlpha = 1;
    },

    // On the pad, in its foot zone: the new multiplier, stamped when a streak steps up.
    stamp(spotId, g, now) {
      const k = spotId & 7;
      const age = now - stepAt[k];
      if (age >= STAMP_MS || heat[k] === 0) return;
      const slam = 1 + 0.9 * (1 - easeOut(age / 150));
      const away = 1 - 0.3 * easeIn((age - 520) / 180);
      const px = Math.min(kit.H * 0.15, g.pw * 0.5) * slam * away;
      outlined(`x${stepMult[k]}`, g.px + g.pw / 2, (g.yLine + g.bottom) / 2 + 2 * kit.U, px, GOLD);
    },

    // Over everything: the whole floor's flash at the hit line, with its word.
    front(now) {
      const age = now - togetherAt;
      if (age >= TOGETHER_MS) return;
      const { W, H, U } = kit;
      const e = easeOut(age / TOGETHER_MS);
      const h = H * (0.03 + 0.03 * e);
      ctx.globalAlpha = 1 - e;
      ctx.fillStyle = GOLD;
      ctx.fillRect(0, togetherY - h / 2, W, h);
      ctx.globalAlpha = 1;
      const k = backOut(age / 150) * (1 - easeIn((age - 330) / 120));
      const ph = H * 0.1 * k;
      const pw = (kit.width("Together", H * 0.07) + 60 * U) * k;
      kit.plate(W / 2 - pw / 2, togetherY - ph / 2, pw, ph, ph / 2, WHITE);
      kit.text("Together", W / 2, togetherY + 2 * U, H * 0.07 * k, INK);
    },
  };

  // A floater starts in its lane's foot zone, at the foot, and lands in the team's score or in the player's own plate.
  function spawn(e, part, pad, spot, duel, now) {
    let f = 0;
    while (f < POOL && on[f]) f++;
    if (f === POOL) return; // the score takes these points at once
    padGeom(kit, spot.rect, pad.lanes, G);
    const lane = Math.min(G.n - 1, e.lane);
    on[f] = 1;
    seatOf[f] = e.spotId & 7;
    laneOf[f] = lane;
    gold[f] = e.grade === "perfect" ? 1 : 0;
    pts[f] = part;
    label[f] = `+${part}`;
    startAt[f] = now;
    laneTop[f] = G.top;
    x0[f] = G.px + lane * (G.laneW + G.gapX) + G.laneW / 2;
    y0[f] = Math.min(G.bottom - 0.05 * G.ph, Math.max(G.yLine + 0.04 * G.ph, G.yBase + e.v * G.ph));
    x1[f] = duel ? G.px + G.pw / 2 : kit.W / 2;
    y1[f] = duel ? G.top + kit.H * 0.055 : kit.H * 0.148; // a duel's plate sits at the far end of the lane
    cx[f] = x0[f];
    cy[f] = y0[f];
    size[f] = gold[f] ? kit.H * 0.085 : kit.H * 0.06;
  }

  function drawFloater(f) { outlined(label[f], cx[f], cy[f], size[f], gold[f] ? GOLD : WHITE); }

  // Big text with an ink outline, readable on any lane colour.
  function outlined(str, x, y, px, fill) {
    kit.font(px, true);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.lineJoin = "round";
    ctx.lineWidth = px * 0.2;
    ctx.strokeStyle = INK;
    ctx.strokeText(str, x, y);
    ctx.fillStyle = fill;
    ctx.fillText(str, x, y);
  }

  return fx;
}
