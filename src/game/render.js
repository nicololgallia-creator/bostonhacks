// Draws the game on a full-window canvas. Built for a dim 720p projector on a floor (PLAN.md,
// "Projection rules"): pure black field, bright saturated fills, no thin lines, big text only.
import { HIT_V, ZONE_V } from "./engine.js";

const TILE_H = 0.12; // tile height, as a share of the picture height
const FLASH_MS = 350;
const GAP = 10; // black gap between lanes, in pixels

const hue = (lane, lanes) => (lanes === 1 ? 0 : Math.round((lane * 320) / (lanes - 1)));

export function createRenderer(canvas) {
  const ctx = canvas.getContext("2d");
  const flashes = [];
  let W = 0;
  let H = 0;

  function resize() {
    const dpr = window.devicePixelRatio || 1;
    W = window.innerWidth;
    H = window.innerHeight;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  window.addEventListener("resize", resize);
  resize();

  function text(str, y, size, alpha = 1) {
    ctx.font = `800 ${size}px system-ui, "Segoe UI", sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.lineJoin = "round";
    ctx.lineWidth = size * 0.14;
    ctx.strokeStyle = "#000";
    ctx.strokeText(str, W / 2, y);
    ctx.fillStyle = `rgba(255,255,255,${alpha})`;
    ctx.fillText(str, W / 2, y);
  }

  function block(x, y, w, h, fill) {
    ctx.fillStyle = fill;
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, Math.min(16, w / 4));
    ctx.fill();
  }

  // view: the engine's output plus { status: "idle"|"playing"|"done", lanes, feet }
  return function draw(view) {
    const { status, lanes, tiles, events, feet, score, combo, multiplier, grade } = view;
    const now = performance.now();
    for (const e of events) if (e.type === "hit" || e.type === "holdStart") flashes.push({ lane: e.lane, at: now });
    while (flashes.length && now - flashes[0].at > FLASH_MS) flashes.shift();

    const laneW = W / lanes;
    const litLane = new Set(feet.filter((f) => f.v >= ZONE_V && f.u >= 0 && f.u <= 1).map((f) => Math.min(lanes - 1, Math.floor(f.u * lanes))));

    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, W, H);

    // Lanes: a dim channel the tiles slide down, and the hit zone at the players' end.
    for (let i = 0; i < lanes; i++) {
      const x = i * laneW + GAP / 2;
      const w = laneW - GAP;
      block(x, 0, w, ZONE_V * H, `hsla(${hue(i, lanes)},100%,55%,0.07)`);
      block(x, ZONE_V * H, w, H - ZONE_V * H, `hsla(${hue(i, lanes)},100%,55%,${litLane.has(i) ? 0.6 : 0.16})`);
      block(x, HIT_V * H - 6, w, 12, "rgba(255,255,255,0.9)");
    }

    for (const f of flashes) {
      const a = 1 - (now - f.at) / FLASH_MS;
      block(f.lane * laneW + GAP / 2, ZONE_V * H, laneW - GAP, H - ZONE_V * H, `hsla(${hue(f.lane, lanes)},100%,75%,${a})`);
    }

    for (const t of tiles) {
      if (t.state === "hit") continue;
      const lit = t.state === "holding";
      const fill = t.state === "missed" ? "hsl(0,0%,22%)" : `hsl(${hue(t.lane, lanes)},100%,${lit ? 80 : 58}%)`;
      // A hold runs from its far end to its head. While it is held the head stays on the hit line.
      const head = lit ? Math.min(t.v, HIT_V) : t.v;
      const length = t.kind === "hold" ? head - t.vTail : TILE_H;
      block(t.lane * laneW + GAP / 2, (head - length) * H, laneW - GAP, length * H, fill);
    }

    if (status === "idle") {
      text("Platform Piano", H * 0.3, H * 0.16);
      text("Press Space to play", H * 0.45, H * 0.1);
    } else if (status === "playing") {
      text(String(score), H * 0.08, H * 0.12);
      text(multiplier > 1 ? `Combo ${combo}  x${multiplier}` : `Combo ${combo}`, H * 0.2, H * 0.1);
    } else {
      text(grade, H * 0.28, H * 0.26);
      text(String(score), H * 0.5, H * 0.14);
      text("Space to play again", H * 0.65, H * 0.1);
    }
  };
}
