// The floor's screens that are not the lanes: the clock and score along the top, the countdown, the song's
// title, the pause, the lobby and the results board. Same look as the lanes (floor-look.js).
// Every text is at least a twentieth of the picture's height, so it reads from a seat on a dim projector.
import { HIT_V, ZONE_V, TRAVEL_MS, songSeconds } from "./engine.js";
import { INK, WHITE, GOLD, seatOf, isDuel, matchup, clamp01, easeOut, backOut, spring } from "./floor-look.js";

const clockText = (secs) => `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, "0")}`;
const MASCOT_URL = "/mascot/conductor.svg"; // public/mascot/conductor.svg, never redrawn or recoloured
const MASCOT_ASPECT = 320 / 380;
export const HUD_BOTTOM = 0.2; // as a share of the height: the lanes start under the clock and the score

// A seat's name plate at the players' edge, in the seat's colour. `lit` turns it white while a foot is down.
export function drawChip(kit, th, spotId, cx, cy, maxW, fillOverride) {
  const { H, U } = kit;
  const seat = seatOf(th, spotId);
  const h = H * 0.075;
  const w = Math.min(maxW, 0.17 * kit.W);
  kit.plate(cx - w / 2, cy - h / 2, w, h, h / 2, fillOverride ?? seat.fill);
  kit.text(`Player ${spotId}`, cx, cy + U, H * 0.055, fillOverride ? INK : seat.text, true, "center", w - 20 * U);
}

// One footprint, `s` tall, centred on (cx, cy), the toes up. A left foot has its big toe on the right. Filled while the
// foot is down, an outline when it is not. Same shapes in the lobby and in play.
const TOES = [[0.17, -0.25, 0.095], [0.0, -0.34, 0.065], [-0.12, -0.31, 0.057], [-0.22, -0.25, 0.05]];
function drawFoot(kit, cx, cy, s, left, filled, colour) {
  const { ctx, U } = kit;
  const sign = left ? 1 : -1;
  ctx.fillStyle = colour;
  ctx.beginPath(); // the toes are always solid
  for (let i = 0; i < TOES.length; i++) {
    const [dx, dy, r] = TOES[i];
    ctx.moveTo(cx + sign * dx * s + r * s, cy + dy * s);
    ctx.arc(cx + sign * dx * s, cy + dy * s, r * s, 0, Math.PI * 2);
  }
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(cx, cy + 0.22 * s, 0.27 * s, 0.3 * s, sign * -0.12, 0, Math.PI * 2);
  if (filled) ctx.fill();
  else { ctx.lineWidth = 4 * U; ctx.strokeStyle = colour; ctx.stroke(); }
}
// The gap between the two lanes of a lone player's pad, and the width of one lane.
export const laneGap = (kit, n) => (n > 1 ? 36 * kit.U : 0);

// The lanes of a pad with a foot down, one bit each. `feet` are in pad coordinates; one in the air is not passed in.
export function litLanes(feet, n) {
  let lit = 0;
  for (let k = 0; k < feet.length; k++) if (feet[k].v >= ZONE_V) lit |= 1 << Math.min(n - 1, Math.floor(feet[k].u * n));
  return lit;
}

// Browsers keep sound off until a key or a click. Until then every status carries this, and it is gone the moment sound is on.
// In the lobby it sits where the train's line is (the QR code must stay clear); in a song it crosses the middle of the picture.
export function drawSoundBanner(kit, status, now) {
  const { W, H, U } = kit;
  const lobby = status === "lobby";
  const h = H * (lobby ? 0.066 : 0.11);
  const w = W * 0.9;
  const cy = H * (lobby ? 0.1445 : 0.5) + Math.sin(now * 0.003) * H * 0.006; // the lobby's one bob clock
  kit.plate((W - w) / 2, cy - h / 2, w, h, h / 2, GOLD);
  kit.text("Press any key for sound", W / 2, cy + 2 * U, H * (lobby ? 0.05 : 0.08), INK, true, "center", w - 60 * U);
}

// A foot zone for one lane, between the hit line and the players' edge: the platform and the footprints that say
// "your feet go here". A pad with two lanes has one foot in each lane; a pad with one lane has the pair. `lit` fills the
// footprints and floods the zone with the seat colour `litFill` (a foot is down; null when none is); `open` is a seat nobody has taken, drawn dimmer. The lobby and play both call this.
export function drawLaneZone(kit, th, x, laneW, yLine, bottom, n, i, litFill, open) {
  const { ctx, U } = kit;
  ctx.beginPath();
  ctx.roundRect(x, yLine, laneW, bottom - yLine, kit.radBottom);
  ctx.fillStyle = litFill ?? (open ? th.slotOpen : th.platform);
  ctx.fill();
  const lit = litFill !== null;
  const s = (bottom - yLine) * 0.74;
  const cy = (yLine + bottom) / 2 + 4 * U;
  const colour = open ? th.quiet : INK;
  if (n === 1) {
    const d = Math.min(laneW * 0.3, kit.H * 0.12);
    drawFoot(kit, x + laneW / 2 - d, cy, s, true, lit, colour);
    drawFoot(kit, x + laneW / 2 + d, cy, s, false, lit, colour);
  } else drawFoot(kit, x + laneW / 2, cy, s, i === 0, lit, colour);
}

// The player's number, in the seat's colour, among the footprints (the middle of the pad). Dim for an open seat.
export function drawBadge(kit, th, spotId, cx, cy, open) {
  const seat = seatOf(th, spotId);
  const r = kit.H * 0.05;
  kit.disc(cx, cy, r, open ? th.slot : seat.fill, true);
  kit.text(String(spotId), cx, cy + 2 * kit.U, kit.H * 0.065, open ? th.quiet : seat.text);
}

export function createScreens(kit) {
  const { ctx } = kit;
  const trip = { stop: null, endsAt: 0, from: 0 }; // the set's ride to the stop the player picked
  let enteredAt = 0; // when the status last changed
  let ranked = null; // the results, best first, built when the board opens
  let shownScore = 0;
  let lastTarget = 0;
  let scoreAt = -1e9;
  let scoreStr = "0";
  let lastSecs = -1;
  let secsStr = "0:00";
  let comboStr = "";
  let lastCombo = 0;
  let comboAt = -1e9;
  let qrSprite = null; // { qr, size, canvas }
  let mascot = null; // { img, sprite, h }

  const img = new Image();
  img.onload = () => { mascot = { img, sprite: null, h: 0 }; };
  img.onerror = () => console.warn("The mascot picture did not load, so the lobby leaves it out.");
  img.src = MASCOT_URL;

  function qrCanvas(qr, size) {
    const dpr = window.devicePixelRatio || 1;
    const px = Math.round(size * dpr);
    if (qrSprite && qrSprite.qr === qr && qrSprite.px === px) return qrSprite.canvas;
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = px;
    const g = canvas.getContext("2d");
    const cells = qr.size + 8; // a quiet zone of four cells on every side, so phones can read it
    const cell = px / cells;
    g.fillStyle = WHITE;
    g.fillRect(0, 0, px, px);
    g.fillStyle = INK;
    for (let row = 0; row < qr.size; row++) {
      for (let col = 0; col < qr.size; col++) {
        if (qr.get(row, col)) g.fillRect(Math.floor((col + 4) * cell), Math.floor((row + 4) * cell), Math.ceil(cell), Math.ceil(cell));
      }
    }
    qrSprite = { qr, px, canvas };
    return canvas;
  }

  // The mascot is rasterised once for the size on screen, so a frame draws one picture.
  function mascotCanvas(h) {
    const dpr = window.devicePixelRatio || 1;
    const px = Math.round(h * dpr);
    if (mascot.sprite && mascot.h === px) return mascot.sprite;
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(px * MASCOT_ASPECT);
    canvas.height = px;
    canvas.getContext("2d").drawImage(mascot.img, 0, 0, canvas.width, canvas.height);
    mascot.sprite = canvas;
    mascot.h = px;
    return canvas;
  }

  return {
    // Called when the status changes: a new song or a new lobby starts every counter again.
    enter(status, now) {
      enteredAt = now;
      ranked = null;
      if (status === "lobby" || status === "countdown") {
        shownScore = lastTarget = lastCombo = 0;
        scoreStr = "0";
        comboStr = "";
        scoreAt = comboAt = -1e9;
      }
      if (status === "lobby") trip.stop = null;
    },

    // The clock along the top: time left, the line's badge, a small train on a map line, and the station it is heading for.
    // Without a ride the train reaches the end of the line (the headsign) as the song ends; with a ride it reaches the stop
    // the player picked at the real arrival time.
    clock(th, view, now) {
      const { W, H, U } = kit;
      const { song, songMs, transit, train, pads } = view;
      const total = songSeconds(song) * 1000;
      let p;
      let secs;
      if (transit?.endsAt) {
        if (trip.stop !== transit.stop || trip.endsAt !== transit.endsAt) { trip.stop = transit.stop; trip.endsAt = transit.endsAt; trip.from = Date.now(); }
        const left = Math.max(0, transit.endsAt - Date.now());
        p = clamp01(1 - left / Math.max(1, transit.endsAt - trip.from));
        secs = Math.ceil(left / 1000);
      } else {
        p = clamp01((songMs + TRAVEL_MS) / (total + TRAVEL_MS));
        secs = Math.ceil(Math.max(0, total - Math.max(0, songMs)) / 1000);
      }
      if (secs !== lastSecs) { lastSecs = secs; secsStr = clockText(secs); }
      const y = H * 0.062;
      kit.text(secsStr, W * 0.035, y + U, H * 0.075, INK, true, "left");

      const bx = W * 0.175;
      kit.disc(bx, y, H * 0.04, th.badge);
      kit.text(th.letter, bx, y + 2 * U, H * 0.055, th.badgeInk);

      const x0 = W * 0.235;
      const x1 = W * 0.5;
      ctx.lineCap = "round";
      ctx.lineWidth = 11 * U;
      ctx.strokeStyle = INK;
      ctx.beginPath();
      ctx.moveTo(x0, y);
      ctx.lineTo(x1, y);
      ctx.stroke();
      // Station dots draw above the line.
      kit.disc(x0 + (x1 - x0) / 3, y, H * 0.022, WHITE);
      kit.disc(x0 + ((x1 - x0) * 2) / 3, y, H * 0.022, WHITE);
      const arrived = p >= 0.995;
      const pop = arrived ? 1 + 0.3 * spring((now - enteredAt) / 1000 % 1.5) : 1;
      kit.disc(x1, y, H * 0.036 * pop, WHITE);
      const stop = transit?.stop ?? train?.headsign ?? "";
      kit.text(stop, x1 + H * 0.06, y + U, H * 0.055, INK, false, "left", W * 0.96 - (x1 + H * 0.06));

      // The train: a white body with a window for every seat in play, nose to the right, riding the line.
      const trainW = W * 0.09;
      const trainH = H * 0.05;
      const cx = x0 + trainW / 2 + p * (x1 - x0 - H * 0.07 - trainW);
      kit.plate(cx - trainW / 2, y - trainH / 2 - H * 0.002, trainW, trainH, trainH * 0.4, WHITE);
      kit.disc(cx - trainW * 0.3, y + trainH / 2, H * 0.011, INK, false);
      kit.disc(cx + trainW * 0.3, y + trainH / 2, H * 0.011, INK, false);
      const n = pads.length;
      const ww = (trainW - H * 0.04) / Math.max(1, n) - 4 * U;
      for (let i = 0; i < n; i++) {
        ctx.beginPath();
        ctx.roundRect(cx - trainW / 2 + H * 0.02 + i * (ww + 4 * U), y - trainH * 0.28, ww, trainH * 0.34, 4 * U);
        ctx.fillStyle = seatOf(th, pads[i].spotId).fill;
        ctx.fill();
      }
    },

    // The team's score, big, with the combo beside it. It counts up, and bumps each time it rises. `pending` is points
    // still flying toward it: the score takes them when they land.
    score(th, view, now, dt, pending = 0) {
      const { W, H, U } = kit;
      const { team, players, pads } = view;
      if (isDuel(view)) { // each player's score is at their own pad (floor-duel.js); the header only names the duel
        const y = H * 0.148;
        const label = matchup(players.length);
        const size = H * 0.1;
        const tag = kit.width(label, H * 0.055) + 44 * U;
        const word = kit.width("Duel", size);
        const x0 = (W - (word + 24 * U + tag)) / 2;
        const h = H * 0.075;
        kit.text("Duel", x0, y + 2 * U, size, INK, true, "left");
        kit.plate(x0 + word + 24 * U, y - h / 2, tag, h, h / 2, GOLD);
        kit.text(label, x0 + word + 24 * U + tag / 2, y + 3 * U, H * 0.055, INK);
        return;
      }
      let combo = 0;
      for (let i = 0; i < players.length; i++) combo = Math.max(combo, players[i].combo);
      const target = (team?.score ?? 0) - pending;
      if (target !== lastTarget) { if (target > lastTarget) scoreAt = now; lastTarget = target; }
      shownScore += (target - shownScore) * Math.min(1, dt * 0.012);
      if (Math.abs(target - shownScore) < 1) shownScore = target;
      const shown = Math.round(shownScore);
      if (String(shown) !== scoreStr) scoreStr = String(shown);
      const bump = 1 + 0.12 * (1 - easeOut((now - scoreAt) / 220));
      const y = H * 0.148;
      const size = H * 0.105 * bump;
      kit.text(scoreStr, W / 2, y + 2 * U, size, INK);
      const half = kit.width(scoreStr, size) / 2;
      kit.text(pads.length > 1 ? "Team" : "Score", W / 2 - half - 16 * U, y + 4 * U, H * 0.06, INK, false, "right");
      if (combo >= 2) {
        if (combo !== lastCombo) { if (combo > lastCombo) comboAt = now; lastCombo = combo; comboStr = `${combo} combo`; }
        const k = 1 + 0.18 * spring((now - comboAt) / 1000);
        const w = kit.width(comboStr, H * 0.055) + 36 * U;
        const px = W / 2 + half + 16 * U;
        const h = H * 0.075 * k;
        kit.plate(px, y - h / 2, w * k, h, h / 2, GOLD);
        kit.text(comboStr, px + (w * k) / 2, y + 3 * U, H * 0.055 * k, INK);
      } else lastCombo = 0;
    },

    // The song's title on a ticket, from the countdown until the first tiles are on their way.
    title(th, song, songMs) {
      if (songMs >= -1500) return;
      const { W, H, U } = kit;
      ctx.globalAlpha = clamp01((-1500 - songMs) / 1000);
      const px = H * 0.065;
      const w = Math.min(W * 0.9, kit.width(song.title, px) + 60 * U);
      kit.plate((W - w) / 2, H * 0.275 - H * 0.055, w, H * 0.11, H * 0.03, WHITE);
      kit.text(song.title, W / 2, H * 0.275 + 2 * U, px, INK, true, "center", w - 50 * U);
      ctx.globalAlpha = 1;
    },

    // 3, 2, 1: each number lands big and settles with a bounce, then thins out as the next one is due.
    countdown(songMs) {
      const { W, H } = kit;
      const remain = -TRAVEL_MS - songMs;
      const n = Math.min(3, Math.max(1, Math.ceil(remain / 1000)));
      const e = clamp01((n * 1000 - remain) / 1000); // 0 when the number lands, 1 as the next one is due
      ctx.globalAlpha = e < 0.75 ? 1 : 1 - ((e - 0.75) / 0.25) * 0.8;
      kit.text(String(n), W / 2, H * 0.52, H * 0.4 * (1 + 0.5 * (1 - easeOut(e / 0.22))), INK);
      ctx.globalAlpha = 1;
    },

    paused(now) {
      const { W, H } = kit;
      ctx.globalAlpha = 0.62;
      ctx.fillStyle = INK;
      ctx.fillRect(0, 0, W, H);
      ctx.globalAlpha = 1;
      kit.text("Paused", W / 2, H * 0.45 + Math.sin(now * 0.004) * H * 0.008, H * 0.2, WHITE);
    },

    // The lobby: scan to play. The QR code is big, black on white, and never moves; the mascot waits beside it.
    // Every seat's platform is drawn where its pad is, with its name plate: coloured when someone has taken it.
    lobby(th, view, now) {
      const { W, H, U } = kit;
      const { layout, players, train, qr, qrNote } = view;
      // One gentle bob for everything that moves in the lobby, so the headline and the mascot move as one. The headline
      // used to pulse in size instead: text sizes step in whole pixels, so it jerked at its own pace beside the mascot.
      const bob = Math.sin(now * 0.003);
      kit.text("Scan to play", W / 2, H * 0.062 + bob * H * 0.006, H * 0.1, INK);
      // One row under the headline: the mode ("Team" or "Duel") on a plate, then where the train is going.
      const mode = view.mode === "versus" ? "Duel" : "Team";
      const modeW = kit.width(mode, H * 0.052) + 44 * U;
      const modeH = H * 0.066;
      const where = train ? `${th.name} to ${train.headsign}, car ${train.car}` : "";
      const whereW = train ? Math.min(kit.width(where, H * 0.052, false), W * 0.92 - modeW - 28 * U) : 0;
      const rowX = (W - (modeW + (train ? 28 * U + whereW : 0))) / 2;
      if (!view.soundLocked) {
        kit.plate(rowX, H * 0.1445 - modeH / 2, modeW, modeH, modeH / 2, WHITE);
        kit.text(mode, rowX + modeW / 2, H * 0.1445 + 2 * U, H * 0.052, INK);
        if (train) kit.text(where, rowX + modeW + 28 * U, H * 0.1445, H * 0.052, INK, false, "left", whereW);
      }

      const size = H * 0.47; // 0.52 reached down into the free seats' "Open" with four seats in the layout
      const gap = H * 0.08;
      const mh = H * 0.42; // a little smaller than the QR code is tall, so the free seats' "Open" has room under it
      const mw = mh * MASCOT_ASPECT;
      const left = qr && mascot ? (W - (size + gap + mw)) / 2 : (W - size) / 2;
      const qy = H * 0.195;
      if (qr) {
        kit.plate(left - 6 * U, qy - 6 * U, size + 12 * U, size + 12 * U, 22 * U, WHITE);
        ctx.save();
        ctx.beginPath();
        ctx.roundRect(left, qy, size, size, 16 * U); // concentric with the plate: its corners never poke out past the outline
        ctx.clip();
        ctx.drawImage(qrCanvas(qr, size), left, qy, size, size);
        ctx.restore();
      } else {
        for (let i = 0; i < qrNote.length; i++) kit.text(qrNote[i], W / 2, H * (0.33 + i * 0.1), H * 0.07, INK, true, "center", W * 0.9);
      }
      if (qr && mascot) ctx.drawImage(mascotCanvas(mh), left + size + gap, qy + (size - mh) / 2 + bob * H * 0.01, mw, mh);

      for (let i = 0; i < layout.spots.length; i++) {
        const spot = layout.spots[i];
        const x = spot.rect.u * W;
        const w = spot.rect.w * W;
        const yLine = (spot.rect.v + HIT_V * spot.rect.h) * H;
        const yBottom = (spot.rect.v + spot.rect.h) * H;
        const open = !players.some((p) => p.spotId === spot.id);
        const n = layout.lanes;
        const gx = laneGap(kit, n);
        const laneW = (w - gx * (n - 1)) / n;
        for (let k = 0; k < n; k++) {
          drawLaneZone(kit, th, x + k * (laneW + gx), laneW, yLine, yBottom, n, k, null, open);
          ctx.fillStyle = INK;
          ctx.fillRect(x + k * (laneW + gx), yLine - 4 * U, laneW, 8 * U);
        }
        drawBadge(kit, th, spot.id, x + w / 2, (yLine + yBottom) / 2 + 4 * U, open);
        if (open) kit.text("Open", x + w / 2, yLine - H * 0.036, H * 0.052, th.quiet, true, "center", w - 20 * U);
      }
    },

    // The results as a departure board: the team's grade on top, then each seat ranked, with its bonus called out.
    results(th, view, now) {
      const { W, H, U } = kit;
      const { players, team, song, train, transit } = view;
      const s = (now - enteredAt) / 1000;
      const duel = isDuel(view);
      const { winner } = view;
      if (!ranked) {
        ranked = players.map((p) => ({ ...p, total: p.score + p.bonus }));
        ranked.sort(duel ? (a, b) => a.rank - b.rank || a.spotId - b.spotId : (a, b) => b.total - a.total || a.spotId - b.spotId);
      }

      // The top band. Team: the grade, the team's score, the song. Duel: its name, who played, a plain "Tie" when nobody won, and the song.
      if (duel) {
        const tag = kit.width(matchup(players.length), H * 0.055) + 44 * U;
        const word = kit.width("Duel", H * 0.1);
        kit.text("Duel", W * 0.06, H * 0.1, H * 0.1, INK, true, "left");
        kit.plate(W * 0.06 + word + 24 * U, H * 0.1 - H * 0.0375, tag, H * 0.075, H * 0.0375, GOLD);
        kit.text(matchup(players.length), W * 0.06 + word + 24 * U + tag / 2, H * 0.1 + 3 * U, H * 0.055, INK);
        if (!winner && s > 0.3) {
          const k = backOut((s - 0.3) / 0.45);
          const w = kit.width("Tie", H * 0.09) + 70 * U;
          kit.plate(W * 0.5 - (w * k) / 2, H * 0.105 - (H * 0.12 * k) / 2, w * k, H * 0.12 * k, H * 0.06 * k, GOLD);
          kit.text("Tie", W * 0.5, H * 0.11, H * 0.09 * k, INK);
        }
        if (song) kit.text(song.title, W * 0.96, H * 0.06, H * 0.055, INK, true, "right", W * 0.3);
      } else {
        const gs = backOut((s - 0.3) / 0.45);
        if (s > 0.3) {
          kit.disc(W * 0.11, H * 0.115, H * 0.085 * gs, GOLD);
          kit.text(team?.grade ?? "-", W * 0.11, H * 0.12, H * 0.11 * gs, INK);
        }
        kit.text("Team score", W * 0.2, H * 0.075, H * 0.055, INK, false, "left");
        kit.text(String(Math.round((team?.score ?? 0) * easeOut((s - 0.5) / 1.1))), W * 0.2, H * 0.155, H * 0.1, INK, true, "left");
        if (song) kit.text(song.title, W * 0.96, H * 0.075, H * 0.06, INK, true, "right", W * 0.5);
        kit.text(`${team?.hits ?? 0} of ${team?.total ?? 0} hit`, W * 0.96, H * 0.155, H * 0.055, INK, false, "right");
      }

      // The board.
      const gap = H * 0.013;
      const head = H * 0.085;
      const pad = H * 0.02;
      const by = H * 0.235;
      const rowH = Math.min(H * 0.19, (H * 0.96 - by - head - pad * 2 - (ranked.length - 1) * gap) / ranked.length); // fewer seats, taller rows
      const bx = W * 0.06;
      const bw = W * 0.88;
      const bh = head + pad * 2 + ranked.length * rowH + (ranked.length - 1) * gap;
      const slide = (1 - easeOut(s / 0.5)) * H;
      kit.plate(bx, by + slide, bw, bh, 24 * U, INK, false);
      kit.text(transit?.stop ?? train?.headsign ?? "", bx + 28 * U, by + slide + head / 2, H * 0.055, WHITE, true, "left", bw * 0.6);
      kit.text("Arrived", bx + bw - 28 * U, by + slide + head / 2, H * 0.055, GOLD, true, "right");
      ctx.save(); // rows slide in from the right: they stay inside the board
      ctx.beginPath();
      ctx.roundRect(bx, by + slide, bw, bh, 24 * U);
      ctx.clip();
      for (let r = 0; r < ranked.length; r++) {
        const a = s - (0.5 + (ranked.length - 1 - r) * 0.25); // last place first, the winner last
        if (a < 0) continue;
        const p = ranked[r];
        const win = a > 1.4 && (duel ? winner?.spotId === p.spotId : r === 0 && p.total > 0);
        const y = by + head + pad + r * (rowH + gap);
        const dx = (1 - easeOut(a / 0.45)) * W * 0.4;
        const mid = y + rowH / 2;
        kit.plate(bx + pad + dx, y, bw - pad * 2, rowH, 20 * U, win ? WHITE : th.board, false);
        const ink = win ? INK : WHITE;
        kit.text(String(duel ? p.rank : r + 1), bx + 62 * U + dx, mid + 2 * U, H * 0.075, ink); // in a duel, equal scores share a rank
        drawChip(kit, th, p.spotId, bx + 100 * U + dx + 0.085 * W, mid, W);
        // The score counts up in split-flap tiles.
        const value = String(Math.round(p.total * easeOut((a - 0.25) / 1.1)));
        const len = Math.max(4, String(p.total).length);
        const tw = 56 * U;
        const th2 = rowH * 0.76;
        for (let d = 0; d < len; d++) {
          const ch = value[d - (len - value.length)] ?? "";
          const tx = bx + 340 * U + dx + d * (tw + 8 * U);
          kit.plate(tx, mid - th2 / 2, tw, th2, 10 * U, INK, false);
          ctx.fillStyle = th.board;
          ctx.fillRect(tx, mid - 1.5 * U, tw, 3 * U);
          kit.text(ch, tx + tw / 2, mid + 2 * U, H * 0.075, WHITE);
        }
        const label = duel ? (p.rank === 1 ? (winner ? "Winner" : "Tie") : "") : p.bonus > 0 ? `+${p.bonus} ${p.bonusFor ?? ""}`.trim() : ""; // a duel pays no bonus
        if (label && a > 1.4) {
          const k = 1 + 0.25 * spring(a - 1.4);
          const room = bw - 340 * U - len * (tw + 8 * U) - pad * 2 - 90 * U;
          const w = Math.min(room, kit.width(label, H * 0.05, false) + 40 * U);
          const bxr = bx + bw - pad - 28 * U + dx;
          const h = rowH * 0.62 * k;
          kit.plate(bxr - w * k, mid - h / 2, w * k, h, h / 2, GOLD);
          kit.text(label, bxr - (w * k) / 2, mid + 2 * U, H * 0.05 * k, INK, false, "center", w - 30 * U);
        }
      }
      ctx.restore();
    },

  };
}
