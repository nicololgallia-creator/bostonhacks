// Short-lived effects for the floor: glow sprites, sparks, shock rings, rising words and the foot trail.
// The pose model shares the laptop, so nothing here allocates per frame and nothing uses shadowBlur:
// every pool is made once, and every glow is a sprite drawn with additive light.

const SPARKS = 160;
const RINGS = 24;
const WORDS = 10;
const TRAIL = 96;
const TRAIL_MS = 220; // how long a foot's glow takes to die out behind it
const GRAVITY = 1600; // pixels per second squared, so sparks arc and fall

const channels = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
const toHex = (c) => `#${c.map((v) => Math.round(v).toString(16).padStart(2, "0")).join("")}`;
// A colour moved toward white by k (0 to 1).
export const lighten = (hex, k) => toHex(channels(hex).map((v) => v + (255 - v) * k));
// A solid colour at k times its brightness, so it can sit on black with no transparency.
export const darken = (hex, k) => toHex(channels(hex).map((v) => v * k));

const clamp01 = (t) => Math.min(1, Math.max(0, t));
export const easeOut = (t) => 1 - (1 - clamp01(t)) ** 3;
// Overshoots a little before it settles, for things that land.
export const backOut = (t) => { const x = clamp01(t) - 1; return 1 + 2.7 * x ** 3 + 1.7 * x ** 2; };

export function createFx() {
  const glows = new Map();
  const sparks = Array.from({ length: SPARKS }, () => ({ on: false, x: 0, y: 0, vx: 0, vy: 0, age: 0, life: 1, size: 1, col: "#fff" }));
  const rings = Array.from({ length: RINGS }, () => ({ on: false, x: 0, y: 0, r: 0, age: 0, life: 1, width: 1, col: "#fff" }));
  const words = Array.from({ length: WORDS }, () => ({ on: false, key: "", str: "", x: 0, y: 0, size: 1, rise: 0, age: 0, life: 1, col: "#fff" }));
  const trail = Array.from({ length: TRAIL }, () => ({ x: 0, y: 0, col: "#fff", at: -1e9 }));
  let trailNext = 0;
  let last = 0;

  // A soft round light in one colour, made once: white-hot in the middle, the colour around it.
  function glow(hex) {
    let sprite = glows.get(hex);
    if (!sprite) {
      sprite = document.createElement("canvas");
      sprite.width = sprite.height = 96;
      const g = sprite.getContext("2d");
      const grad = g.createRadialGradient(48, 48, 0, 48, 48, 48);
      grad.addColorStop(0, "#ffffff");
      grad.addColorStop(0.18, lighten(hex, 0.55));
      grad.addColorStop(0.45, hex);
      grad.addColorStop(1, `${hex}00`);
      g.fillStyle = grad;
      g.fillRect(0, 0, 96, 96);
      glows.set(hex, sprite);
    }
    return sprite;
  }

  const free = (pool) => pool.find((p) => !p.on);

  const fx = {
    // A glow at (x, y); size is its radius in pixels, alpha 0 to 1. Drawn with additive light.
    light(ctx, hex, x, y, size, alpha) {
      ctx.globalCompositeOperation = "lighter";
      ctx.globalAlpha = alpha;
      ctx.drawImage(glow(hex), x - size, y - size, size * 2, size * 2);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = "source-over";
    },

    // n sparks flying out from (x, y) at up to `speed` pixels a second. When the pool is full the rest are dropped.
    burst(x, y, hex, n, speed, size) {
      for (let i = 0; i < n; i++) {
        const s = free(sparks);
        if (!s) return;
        const a = Math.random() * Math.PI * 2;
        const v = speed * (0.35 + Math.random() * 0.65);
        s.on = true; s.x = x; s.y = y; s.vx = Math.cos(a) * v; s.vy = Math.sin(a) * v - speed * 0.3;
        s.age = 0; s.life = 380 + Math.random() * 320; s.size = size * (0.6 + Math.random() * 0.7); s.col = hex;
      }
    },

    ring(x, y, hex, radius, width, life = 420) {
      const r = free(rings);
      if (r) { r.on = true; r.x = x; r.y = y; r.r = radius; r.width = width; r.age = 0; r.life = life; r.col = hex; }
    },

    // A word that pops, rises and fades. There is one word for each key at a time, so a seat's feed stays readable.
    word(key, str, x, y, hex, size, rise = size * 1.4, life = 750) {
      const w = words.find((e) => e.on && e.key === key) ?? free(words);
      if (w) { w.on = true; w.key = key; w.str = str; w.x = x; w.y = y; w.size = size; w.rise = rise; w.age = 0; w.life = life; w.col = hex; }
    },

    // Remember a foot at (x, y) so its glow can trail off behind it.
    foot(x, y, hex, now) {
      const t = trail[trailNext];
      t.x = x; t.y = y; t.col = hex; t.at = now;
      trailNext = (trailNext + 1) % TRAIL;
    },

    // Every foot's glow, newest brightest. unit is the picture height, so it scales with the projector.
    drawFeet(ctx, now, unit) {
      for (const t of trail) {
        const age = now - t.at;
        if (age < 0 || age > TRAIL_MS) continue;
        const k = 1 - age / TRAIL_MS;
        fx.light(ctx, t.col, t.x, t.y, unit * (0.03 + 0.06 * k), 0.55 * k);
        if (age < 40) fx.light(ctx, "#ffffff", t.x, t.y, unit * 0.026, 0.9);
      }
    },

    // Sparks, rings and words, in that order. word(str, x, y, size, colour) draws text in the renderer's style.
    draw(ctx, now, word) {
      const dt = Math.min(50, now - last);
      last = now;
      for (const s of sparks) {
        if (!s.on) continue;
        s.age += dt;
        if (s.age >= s.life) { s.on = false; continue; }
        s.vy += (GRAVITY * dt) / 1000;
        s.x += (s.vx * dt) / 1000;
        s.y += (s.vy * dt) / 1000;
        const k = 1 - s.age / s.life;
        fx.light(ctx, s.col, s.x, s.y, s.size * (0.4 + 0.6 * k), 0.8 * k);
      }
      for (const r of rings) {
        if (!r.on) continue;
        r.age += dt;
        if (r.age >= r.life) { r.on = false; continue; }
        const t = r.age / r.life;
        ctx.globalAlpha = (1 - t) ** 1.5;
        ctx.strokeStyle = r.col;
        ctx.lineWidth = r.width * (1 - t * 0.6);
        ctx.beginPath();
        ctx.arc(r.x, r.y, r.r * (0.25 + 0.75 * easeOut(t)), 0, Math.PI * 2);
        ctx.stroke();
      }
      for (const w of words) {
        if (!w.on) continue;
        w.age += dt;
        if (w.age >= w.life) { w.on = false; continue; }
        const t = w.age / w.life;
        ctx.globalAlpha = t < 0.6 ? 1 : 1 - (t - 0.6) / 0.4;
        word(w.str, w.x, w.y - w.rise * easeOut(t), w.size * (1 + 0.4 * (1 - easeOut(t * 6))), w.col);
      }
      ctx.globalAlpha = 1;
    },
  };
  return fx;
}
