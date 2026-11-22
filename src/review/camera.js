// The left side of the page: what the camera saw, drawn over the video (or over a plain dark panel when there is none). The seat
// slices as tinted bands with each seat's number, a dot on each foot from the frame nearest the play head (ringed while the seat's
// foot is in the air), and a ring that spreads from a foot when its seat taps. x and y in the file are 0 to 1 of the picture.
import { ALERT, INK, seatColour } from "./look.js";

export const RING_MS = 500;

// st: { model, analysis, frame (the nearest frame), head, mirror }
export function drawOverlay(canvas, st) {
  const { model, analysis, frame, head, mirror } = st;
  const dpr = window.devicePixelRatio || 1;
  const W = canvas.clientWidth;
  const H = canvas.clientHeight;
  if (canvas.width !== Math.round(W * dpr) || canvas.height !== Math.round(H * dpr)) {
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
  }
  const ctx = canvas.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, W, H);
  const px = (x) => (mirror ? 1 - x : x) * W;

  ctx.font = "800 15px Nunito, system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  for (const s of model.slices) {
    const a = Math.min(px(s.x0), px(s.x1));
    const b = Math.max(px(s.x0), px(s.x1));
    ctx.fillStyle = seatColour(s.spotId);
    ctx.globalAlpha = 0.22;
    ctx.fillRect(a, 0, b - a, H);
    ctx.globalAlpha = 0.9;
    ctx.fillRect(a, 0, b - a, 3);
    ctx.globalAlpha = 1;
    ctx.beginPath();
    ctx.arc((a + b) / 2, 20, 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.fillStyle = INK;
    ctx.fillText(String(s.spotId), (a + b) / 2, 21);
  }

  for (const seat of frame.seats) {
    const air = frame.lifted[seat.spotId];
    for (const f of seat.feet) {
      const x = px(f.x);
      const y = f.y * H;
      if (air) {
        ctx.strokeStyle = INK;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(x, y, 12, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.fillStyle = seatColour(seat.spotId);
      ctx.strokeStyle = "#fff";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(x, y, 6.5, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fill();
      ctx.strokeStyle = INK;
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
  }

  for (const t of analysis.taps) {
    const age = head - t.atMs;
    if (age < 0 || age > RING_MS || !Number.isFinite(t.x) || !Number.isFinite(t.y)) continue;
    const bad = t.status === "false" || t.status === "extra";
    ctx.strokeStyle = bad ? ALERT : INK;
    ctx.globalAlpha = 1 - age / RING_MS;
    ctx.lineWidth = bad ? 4 : 3;
    ctx.beginPath();
    ctx.arc(px(t.x), t.y * H, 14 + (28 * age) / RING_MS, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
}
