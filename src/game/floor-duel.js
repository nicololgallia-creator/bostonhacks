// In a duel each player's own score is drawn at their own pad, at the far end of their lane (the end the tiles come from),
// so it sits above them as they look across the floor. It is ink on a plate in the seat's colour. It counts up on each hit,
// and the plate of the player in the lead has a butter-yellow outline. When the lead changes hands the new leader's plate
// pulses once. The header's "Duel 1v1" is in floor-screens.js.
import { INK, GOLD, seatOf, easeOut } from "./floor-look.js";
import { HUD_BOTTOM } from "./floor-screens.js";

const SEATS = 8;
const PULSE_MS = 450;

// Who took the lead this frame, as a bit for each seat: the seats that lead now, when someone led before and none of them
// still does. Catching up to a tie, or pulling ahead of one, is not the lead changing hands; nor is the first score of a song.
export const newLeaders = (before, now) => (before && !(now & before) ? now : 0);
// The seats in the lead, one bit each: those on the top score, once it is above zero. `scores` holds -1 for a seat not playing.
export function leaderMask(scores) {
  let top = 0;
  for (let k = 0; k < scores.length; k++) if (scores[k] > top) top = scores[k];
  let mask = 0;
  if (top > 0) for (let k = 0; k < scores.length; k++) if (scores[k] === top) mask |= 1 << k;
  return mask;
}

export function createDuel(kit) {
  const { ctx } = kit;
  const shown = new Float64Array(SEATS); // the number on each plate, running toward the score
  const last = new Float64Array(SEATS); // the score seen last frame
  const bumpAt = new Float64Array(SEATS).fill(-1e9);
  const text = new Array(SEATS).fill("0");
  const pulseAt = new Float64Array(SEATS).fill(-1e9);
  const landed = new Float64Array(SEATS); // each seat's score as the plate shows it: without the points still flying
  let leaders = 0;

  return {
    // A new song starts every counter again.
    enter(status) {
      if (status !== "lobby" && status !== "warmup" && status !== "countdown") return;
      shown.fill(0);
      last.fill(0);
      bumpAt.fill(-1e9);
      pulseAt.fill(-1e9);
      leaders = 0;
      text.fill("0");
    },

    // One plate for each taken seat: view.pads says where, view.players says how they are doing. `pend` is the points
    // still flying toward each seat's plate (floor-fx.js): the plate takes them when they land, and the lead follows.
    plates(th, view, now, dt, pend) {
      const { H, U } = kit;
      landed.fill(-1);
      for (let i = 0; i < view.players.length; i++) { const p = view.players[i]; landed[p.spotId & 7] = p.score + p.bonus - pend[p.spotId & 7]; }
      const lead = leaderMask(landed);
      const took = newLeaders(leaders, lead);
      leaders = lead;
      for (let k = 0; k < SEATS; k++) if (took & (1 << k)) pulseAt[k] = now;
      for (let i = 0; i < view.pads.length; i++) {
        const spot = view.layout.spots.find((s) => s.id === view.pads[i].spotId);
        const p = view.players.find((q) => q.spotId === view.pads[i].spotId);
        if (!spot || !p) continue;
        const k = p.spotId & 7;
        const target = landed[k];
        if (target > last[k]) bumpAt[k] = now;
        last[k] = target;
        shown[k] += (target - shown[k]) * Math.min(1, dt * 0.012);
        if (Math.abs(target - shown[k]) < 1) shown[k] = target;
        const str = String(Math.round(shown[k]));
        if (str !== text[k]) text[k] = str;

        const r = spot.rect;
        const x = r.u * kit.W + 8 * U;
        const w = r.w * kit.W - 16 * U;
        const h = H * 0.11;
        const y = Math.max(r.v * H, H * HUD_BOTTOM); // flush with the lane's far end, so tiles come out from under it
        const leads = (lead & (1 << k)) !== 0;
        const pulse = (now - pulseAt[k]) / PULSE_MS;
        ctx.save();
        if (pulse >= 0 && pulse < 1) {
          // A ring spreads out from the new leader's plate (never up into the header), and the plate swells once.
          const e = easeOut(pulse);
          const grow = H * 0.06 * e;
          ctx.save();
          ctx.beginPath();
          ctx.rect(0, y, kit.W, H);
          ctx.clip();
          ctx.globalAlpha = 1 - e;
          ctx.beginPath();
          ctx.roundRect(x - grow, y - grow, w + grow * 2, h + grow * 2, (h + grow * 2) / 2);
          ctx.lineWidth = 22 * U;
          ctx.strokeStyle = INK;
          ctx.stroke();
          ctx.lineWidth = 14 * U;
          ctx.strokeStyle = GOLD;
          ctx.stroke();
          ctx.restore();
          const swell = 1 + 0.18 * Math.sin(Math.PI * pulse);
          ctx.translate(x + w / 2, y + h / 2);
          ctx.scale(swell, swell);
          ctx.translate(-(x + w / 2), -(y + h / 2));
        }
        ctx.beginPath();
        ctx.roundRect(x, y, w, h, h / 2);
        ctx.fillStyle = seatOf(th, p.spotId).fill;
        ctx.fill();
        ctx.lineJoin = "round";
        ctx.lineWidth = (leads ? 14 : 4) * U; // the leader's outline is ink on the outside and butter yellow within
        ctx.strokeStyle = INK;
        ctx.stroke();
        if (leads) { ctx.lineWidth = 8 * U; ctx.strokeStyle = GOLD; ctx.stroke(); }
        const bump = 1 + 0.12 * (1 - easeOut((now - bumpAt[k]) / 220));
        kit.text(text[k], x + w / 2, y + h / 2 + 3 * U, H * 0.075 * bump, seatOf(th, p.spotId).text, true, "center", w - 30 * U);
        ctx.restore();
      }
    },
  };
}
