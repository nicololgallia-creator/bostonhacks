// The floor in the falling-tiles look: one lane for each seat (four at most), a lit field with dark
// tiles sliding toward the players, a glowing hit line, hold tiles that fill while a foot stays, and one
// big score with the last judgement and the combo under it.
// The lobby and the results still come from render.js, so this file only draws a song being played.
// Same call as render.js: createRenderer(canvas) returns draw(view).
import { HIT_V, TRAVEL_MS, songSeconds } from "./engine.js";
import { createRenderer as createPadsRenderer } from "./render.js";

const SEATS = ["#29D6FF", "#FF4FA3", "#FFD43B", "#7CFF6B"]; // Seat colours, shared with the phone page
const FAMILY = '"Bricolage Grotesque", "Arial Black", system-ui, sans-serif';
const WHITE = "#ffffff";
const TILE = "#07070d"; // a tile is a hole in the light
// The field's light moves through the T's four subway colours as the song goes: blue, green, orange, red.
const SKIES = [
  { top: [70, 120, 255], bottom: [40, 70, 220] },
  { top: [60, 205, 140], bottom: [10, 150, 95] },
  { top: [255, 190, 80], bottom: [240, 130, 30] },
  { top: [255, 120, 140], bottom: [225, 55, 75] },
];
const TAP_H = 0.2; // a tap tile's length, as a share of the lane's length
const GAP_V = 0.012; // the light left between two tiles that follow each other in a lane
const FLASH_MS = 320;
const WORD_MS = 700;
const WORDS = { perfect: "PERFECT", good: "GOOD", miss: "MISS" };
const WORD_FILL = { perfect: "#FFF27A", good: WHITE, miss: "#FF5468" };

const clamp01 = (x) => Math.min(1, Math.max(0, x));
const mix = (a, b, k) => Math.round(a + (b - a) * k);
const rgb = (c) => `rgb(${c[0]},${c[1]},${c[2]})`;
const blend = (a, b, k) => [mix(a[0], b[0], k), mix(a[1], b[1], k), mix(a[2], b[2], k)];
const seatColour = (spotId) => SEATS[(((spotId - 1) % SEATS.length) + SEATS.length) % SEATS.length];
const clockText = (ms) => { const s = Math.max(0, Math.ceil(ms / 1000)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`; };

export function createRenderer(canvas) {
  const padsDraw = createPadsRenderer(canvas); // owns the canvas size and loads the font
  const ctx = canvas.getContext("2d");
  const flashes = new Map(); // "spotId:lane" -> { at, miss }
  const bursts = []; // rings that open where a foot landed
  let word = null; // the last judgement: { grade, at }
  let shownScore = 0;
  let prevStatus = null;

  function text(str, x, y, size, fill = WHITE, maxW = Infinity) {
    ctx.font = `800 ${Math.max(1, Math.round(size))}px ${FAMILY}`;
    const width = ctx.measureText(str).width;
    if (width > maxW) { size *= maxW / width; ctx.font = `800 ${Math.max(1, Math.round(size))}px ${FAMILY}`; }
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.lineJoin = "round";
    ctx.lineWidth = size * 0.14;
    ctx.strokeStyle = "rgba(0,0,0,0.55)";
    ctx.strokeText(str, x, y);
    ctx.fillStyle = fill;
    ctx.fillText(str, x, y);
  }

  function rounded(x, y, w, h, r) {
    r = Math.max(0, Math.min(r, w / 2, h / 2));
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, r);
  }

  // Each seat is one lane. A lane runs from halfway to the seat on its left to halfway to the seat on its
  // right, and the outer lanes run to the edges, so the lanes touch and fill the picture.
  function lanesOf(layout, W, H) {
    const spots = [...layout.spots].sort((a, b) => a.rect.u - b.rect.u);
    return spots.map((spot, i) => {
      const left = i === 0 ? 0 : (spots[i - 1].rect.u + spots[i - 1].rect.w + spot.rect.u) / 2;
      const right = i === spots.length - 1 ? 1 : (spot.rect.u + spot.rect.w + spots[i + 1].rect.u) / 2;
      return {
        spot, x: left * W, w: (right - left) * W,
        y: (v) => (spot.rect.v + v * spot.rect.h) * H, // a tile's v, in pixels down the picture
      };
    });
  }

  function sky(W, H, progress) {
    const at = clamp01(progress) * (SKIES.length - 1);
    const i = Math.min(SKIES.length - 2, Math.floor(at));
    const k = at - i;
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, rgb(blend(SKIES[i].top, SKIES[i + 1].top, k)));
    g.addColorStop(1, rgb(blend(SKIES[i].bottom, SKIES[i + 1].bottom, k)));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  }

  function tapTile(x, w, yHead, yTop, state) {
    if (state === "hit") { ctx.globalAlpha = 0.16; ctx.fillStyle = TILE; } // a played tile stays as a ghost and slides away
    else if (state === "missed") { ctx.globalAlpha = 0.4; ctx.fillStyle = "#5a1020"; }
    else { ctx.globalAlpha = 1; ctx.fillStyle = TILE; }
    rounded(x, yTop, w, yHead - yTop, 10);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  function holdTile(x, w, yHead, yTop, state, colour, yLine) {
    const done = state === "hit";
    const missed = state === "missed";
    ctx.save();
    rounded(x, yTop, w, yHead - yTop, 10);
    ctx.clip();
    ctx.globalAlpha = done ? 0.3 : missed ? 0.4 : 1;
    if (missed) ctx.fillStyle = "#5a1020";
    else {
      const g = ctx.createLinearGradient(0, yTop, 0, yHead);
      g.addColorStop(0, colour);
      g.addColorStop(0.75, TILE);
      ctx.fillStyle = g;
    }
    ctx.fillRect(x, yTop, w, yHead - yTop);
    if (state === "holding") {
      // The part already played fills with the seat's colour, with a round cap at the line.
      const cap = w * 0.5;
      ctx.fillStyle = colour;
      ctx.beginPath();
      ctx.ellipse(x + w / 2, yLine, w / 2, cap * 0.5, 0, Math.PI, 0);
      ctx.lineTo(x + w, yHead);
      ctx.lineTo(x, yHead);
      ctx.closePath();
      ctx.fill();
    } else if (!done && !missed) {
      // A waiting hold shows where to stand and how long: a ring at its front and a line to its end.
      const unit = Math.min(w, 320); // a wide lane keeps the ring the size a foot can read
      const ringY = yHead - unit * 0.2;
      ctx.strokeStyle = WHITE;
      ctx.lineWidth = Math.max(4, unit * 0.022);
      if (ringY - unit * 0.07 > yTop + unit * 0.1) {
        ctx.beginPath();
        ctx.moveTo(x + w / 2, yTop + unit * 0.1);
        ctx.lineTo(x + w / 2, ringY - unit * 0.07);
        ctx.stroke();
      }
      ctx.beginPath();
      ctx.arc(x + w / 2, ringY, unit * 0.07, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }

  function onEvent(e, now) {
    if (e.type !== "hit" && e.type !== "holdStart" && e.type !== "miss") return;
    const miss = e.type === "miss";
    flashes.set(`${e.spotId}:${e.lane}`, { at: now, miss });
    word = { grade: miss ? "miss" : e.grade === "perfect" ? "perfect" : "good", at: now };
    if (!miss) bursts.push({ spotId: e.spotId, lane: e.lane, at: now });
  }

  function hud(view, W, H, now) {
    const { song, songMs, transit, team, players } = view;
    const total = songSeconds(song) * 1000;
    // Progress: a thick bar across the top, with three marks on the way.
    const bx = W * 0.22, bw = W * 0.56, by = H * 0.045, bh = Math.max(8, H * 0.014);
    ctx.fillStyle = "rgba(255,255,255,0.35)";
    rounded(bx, by - bh / 2, bw, bh, bh / 2); ctx.fill();
    ctx.fillStyle = WHITE;
    rounded(bx, by - bh / 2, bw * clamp01(songMs / total), bh, bh / 2); ctx.fill();
    for (const k of [0.25, 0.5, 0.75, 1]) {
      ctx.beginPath();
      ctx.arc(bx + bw * k, by, bh * 1.1, 0, Math.PI * 2);
      ctx.fillStyle = songMs / total >= k ? WHITE : "rgba(255,255,255,0.55)";
      ctx.fill();
    }
    // The time left: to the train when the set has one, else to the end of the song.
    const left = transit?.endsAt ? transit.endsAt - Date.now() : total - Math.max(0, songMs);
    text(clockText(left), W * 0.1, H * 0.06, H * 0.085);

    const target = team?.score ?? players.reduce((s, p) => s + p.score, 0);
    shownScore += (target - shownScore) * 0.25;
    if (Math.abs(target - shownScore) < 1) shownScore = target;
    text(String(Math.round(shownScore)), W / 2, H * 0.155, H * 0.13);

    if (word && now - word.at < WORD_MS) {
      const age = (now - word.at) / WORD_MS;
      const pop = 1 + 0.35 * Math.max(0, 1 - age * 5); // lands big, settles at once
      ctx.globalAlpha = age < 0.7 ? 1 : 1 - (age - 0.7) / 0.3;
      text(WORDS[word.grade], W / 2, H * 0.265, H * 0.075 * pop, WORD_FILL[word.grade]);
      const combo = Math.max(0, ...players.map((p) => p.combo));
      if (combo > 1 && word.grade !== "miss") text(`×${combo}`, W / 2, H * 0.345, H * 0.06);
      ctx.globalAlpha = 1;
    }
  }

  return function draw(view) {
    const { status, layout, pads, songMs, song, events } = view;
    const now = performance.now();
    if (status !== prevStatus) {
      if (status === "countdown" || status === "lobby") { shownScore = 0; word = null; flashes.clear(); bursts.length = 0; }
      prevStatus = status;
    }
    const live = song && songMs != null && (status === "countdown" || status === "playing" || status === "paused");
    if (!live) return padsDraw(view);

    const W = window.innerWidth;
    const H = window.innerHeight;
    for (const e of events) onEvent(e, now);
    const total = songSeconds(song) * 1000;
    ctx.globalAlpha = 1;
    sky(W, H, songMs / total);

    const lanes = lanesOf(layout, W, H);
    for (const lane of lanes) {
      const pad = pads.find((p) => p.spotId === lane.spot.id);
      const colour = seatColour(lane.spot.id);
      const yLine = lane.y(HIT_V);
      if (!pad) { // an empty seat: its lane is there, with the light turned down
        ctx.fillStyle = "rgba(0,0,0,0.45)";
        ctx.fillRect(lane.x, 0, lane.w, H);
        continue;
      }
      // Where the feet go: from the line to the players' edge, a little brighter than the rest.
      ctx.fillStyle = "rgba(255,255,255,0.14)";
      ctx.fillRect(lane.x, yLine, lane.w, H - yLine);

      const n = Math.max(1, pad.lanes | 0);
      const w = lane.w / n;
      // Far tiles first. A tile never runs into the one behind it: it is cut short so light shows between them.
      const behind = Array(n).fill(-Infinity); // for each lane, the front of the tile drawn before this one
      for (const t of [...pad.tiles].sort((a, b) => a.v - b.v)) {
        const x = lane.x + t.lane * w;
        const yHead = lane.y(t.v);
        const top = Math.max(t.kind === "hold" ? t.vTail : t.v - TAP_H, behind[t.lane] + GAP_V);
        behind[t.lane] = t.v;
        const yTop = lane.y(top);
        if (yTop > H || yHead < 0 || yHead - yTop < 2) continue;
        if (t.kind === "hold") holdTile(x, w, yHead, yTop, t.state, colour, yLine);
        else tapTile(x, w, yHead, yTop, t.state);
      }

      // A hit lights the lane's foot zone in the seat's colour; a miss dims it.
      for (let i = 0; i < n; i++) {
        const f = flashes.get(`${lane.spot.id}:${i}`);
        if (!f || now - f.at > FLASH_MS) continue;
        const k = 1 - (now - f.at) / FLASH_MS;
        ctx.globalAlpha = (f.miss ? 0.5 : 0.75) * k;
        ctx.fillStyle = f.miss ? "#000" : colour;
        ctx.fillRect(lane.x + i * w, yLine, w, H - yLine);
        ctx.globalAlpha = 1;
      }
      for (const b of bursts) {
        if (b.spotId !== lane.spot.id) continue;
        const k = (now - b.at) / 450;
        if (k >= 1) continue;
        ctx.globalAlpha = 1 - k;
        ctx.strokeStyle = WHITE;
        ctx.lineWidth = Math.max(6, w * 0.035) * (1 - k * 0.6);
        ctx.beginPath();
        ctx.arc(lane.x + (b.lane + 0.5) * w, yLine, w * (0.12 + 0.3 * k), 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = 1;
      }

      // The hit line: a band of light across the lane.
      const band = H * 0.035;
      const g = ctx.createLinearGradient(0, yLine - band, 0, yLine + band);
      g.addColorStop(0, "rgba(255,255,255,0)");
      g.addColorStop(0.5, "rgba(255,255,255,0.7)");
      g.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = g;
      ctx.fillRect(lane.x, yLine - band, lane.w, band * 2);
      ctx.fillStyle = WHITE;
      ctx.fillRect(lane.x, yLine - 3, lane.w, 6);
    }
    while (bursts.length && now - bursts[0].at > 450) bursts.shift();

    // Lines between the lanes.
    ctx.fillStyle = "rgba(255,255,255,0.5)";
    for (let i = 1; i < lanes.length; i++) ctx.fillRect(lanes[i].x - 2, 0, 4, H);

    // Every tracked foot, so players see the floor knows where they are.
    for (const f of view.feet ?? []) {
      const lane = lanes.find((l) => f.u * W >= l.x && f.u * W < l.x + l.w);
      const x = f.u * W, y = f.v * H, r = H * 0.05;
      const glow = ctx.createRadialGradient(x, y, 0, x, y, r);
      glow.addColorStop(0, "rgba(255,255,255,0.95)");
      glow.addColorStop(0.45, lane ? seatColour(lane.spot.id) : WHITE);
      glow.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }

    hud(view, W, H, now);

    if (songMs < -1500) { // the song's title, until the first tiles are well on their way
      ctx.globalAlpha = clamp01((-1500 - songMs) / 1000);
      text(song.title, W / 2, H * 0.88, H * 0.075, WHITE, W * 0.9);
      ctx.globalAlpha = 1;
    }
    if (status === "countdown") {
      const remain = -TRAVEL_MS - songMs;
      const n = Math.min(3, Math.max(1, Math.ceil(remain / 1000)));
      const e = clamp01((n * 1000 - remain) / 1000); // 0 when the number lands, 1 as the next one is due
      ctx.globalAlpha = e < 0.75 ? 1 : 1 - ((e - 0.75) / 0.25) * 0.8;
      text(String(n), W / 2, H * 0.55, H * 0.4 * (1 + 0.6 * Math.max(0, 1 - e / 0.2)));
      ctx.globalAlpha = 1;
    } else if (status === "paused") {
      ctx.fillStyle = "rgba(0,0,0,0.55)";
      ctx.fillRect(0, 0, W, H);
      text("Paused", W / 2, H * 0.5, H * 0.2);
    }
  };
}
