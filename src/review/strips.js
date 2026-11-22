// The right side of the page: one canvas with the phase names along the top, a strip for each seat and a ruler, all on one time axis.
// Each seat's strip shows, for each foot, how far it is over its own ground (up is up), the ground, the threshold, a band where the
// seat was in the air, a mark for every tap and every beat. Returns the layout and the axis, so the page can map a click to a time.
import { nearestIndex, makeAxis, stripLayout, tickStep } from "./logic.js";
import { ALERT, INK, INK_2, seatColour, seatLine } from "./look.js";

const FONT = (px) => `700 ${px}px Nunito, system-ui, sans-serif`;
const MARK_H = 20; // the top of a strip, where the tap and beat marks sit
const secs = (t, step) => `${(t / 1000).toFixed(step < 1000 ? 1 : 0)} s`;

// The text, shortened with an ellipsis when it is wider than room pixels. The full phase names are listed beside the video.
function fit(ctx, text, room) {
  if (ctx.measureText(text).width <= room) return text;
  let n = text.length;
  while (n > 1 && ctx.measureText(`${text.slice(0, n)}…`).width > room) n--;
  return `${text.slice(0, n)}…`;
}

// st: { model, series, analysis, ts, top, head, view: [from, to] }
export function drawStrips(canvas, st) {
  const { model, series, analysis, ts, top, head, view } = st;
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
  const L = stripLayout(W, H, model.spotIds.length);
  const ax = makeAxis(view[0], view[1], L.plotLeft, L.plotRight);
  const i0 = Math.max(0, nearestIndex(ts, view[0]) - 1);
  const i1 = Math.min(ts.length - 1, nearestIndex(ts, view[1]) + 1);
  const inView = (t) => t >= view[0] && t <= view[1];

  // phases along the top
  ctx.font = FONT(12);
  ctx.textBaseline = "middle";
  model.phases.forEach((p, k) => {
    const a = Math.max(ax.toX(p.fromMs), L.plotLeft);
    const b = Math.min(ax.toX(p.toMs), L.plotRight);
    if (b <= a) return;
    ctx.fillStyle = INK;
    ctx.globalAlpha = k % 2 ? 0.1 : 0.05;
    ctx.fillRect(a, 0, b - a, L.phaseH - 2);
    ctx.globalAlpha = 1;
    ctx.fillRect(a, 0, 2, L.phaseH - 2);
    ctx.save();
    ctx.beginPath();
    ctx.rect(a + 2, 0, b - a - 2, L.phaseH);
    ctx.clip();
    ctx.fillText(fit(ctx, p.label, b - a - 14), a + 8, L.phaseH / 2 - 1);
    ctx.restore();
  });

  model.spotIds.forEach((id, row) => {
    const { top: y0, bottom: y1 } = L.rows[row];
    const plotTop = y0 + MARK_H;
    const plotBottom = y1 - 5;
    const lo = -0.12 * top;
    const yOf = (rise) => plotBottom - ((rise - lo) / (top - lo)) * (plotBottom - plotTop);
    const s = series[id];

    ctx.fillStyle = seatColour(id);
    ctx.globalAlpha = 0.1;
    ctx.fillRect(0, y0, W, y1 - y0);
    ctx.globalAlpha = 1;
    ctx.fillStyle = INK;
    ctx.globalAlpha = 0.15;
    ctx.fillRect(0, y0, W, 1);
    ctx.globalAlpha = 1;
    ctx.fillStyle = seatColour(id);
    ctx.fillRect(10, y0 + 12, 12, 12);
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1.5;
    ctx.strokeRect(10, y0 + 12, 12, 12);
    ctx.fillStyle = INK;
    ctx.font = FONT(13);
    ctx.fillText(`Seat ${id}`, 28, y0 + 19);

    ctx.save();
    ctx.beginPath();
    ctx.rect(L.plotLeft, y0, L.plotRight - L.plotLeft, y1 - y0);
    ctx.clip();

    // in the air
    ctx.fillStyle = seatColour(id);
    ctx.globalAlpha = 0.5;
    for (let i = i0; i <= i1; i++) {
      if (!s.lifted[i]) continue;
      let j = i;
      while (j < i1 && s.lifted[j + 1]) j++;
      const a = ax.toX((ts[Math.max(0, i - 1)] + ts[i]) / 2); // half way to the neighbouring frames
      const b = ax.toX((ts[j] + ts[Math.min(ts.length - 1, j + 1)]) / 2);
      ctx.fillRect(a, plotTop, Math.max(b - a, 1), plotBottom - plotTop);
      i = j;
    }
    ctx.globalAlpha = 1;

    // beats, thin
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1;
    ctx.globalAlpha = 0.28;
    for (const b of analysis.beats) {
      if (b.spotId !== id || !inView(b.atMs)) continue;
      const x = Math.round(ax.toX(b.atMs)) + 0.5;
      ctx.beginPath();
      ctx.moveTo(x, y0 + 2);
      ctx.lineTo(x, plotBottom);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    // ground, then each foot's threshold (dashed), then each foot
    const trace = (arr, yFn) => {
      ctx.beginPath();
      let pen = false;
      for (let k = i0; k <= i1; k++) {
        const v = arr[k];
        if (!Number.isFinite(v)) { pen = false; continue; }
        const x = ax.toX(ts[k]);
        if (pen) ctx.lineTo(x, yFn(v));
        else ctx.moveTo(x, yFn(v));
        pen = true;
      }
      ctx.stroke();
    };
    ctx.strokeStyle = INK;
    ctx.globalAlpha = 0.4;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(L.plotLeft, yOf(0) + 0.5);
    ctx.lineTo(L.plotRight, yOf(0) + 0.5);
    ctx.stroke();
    ctx.globalAlpha = 0.75;
    ctx.setLineDash([4, 3]);
    ctx.strokeStyle = INK_2;
    for (const tr of s.tracks) trace(tr.thr, yOf);
    ctx.setLineDash([]);
    ctx.globalAlpha = 1;
    ctx.lineWidth = 1.75;
    ctx.lineJoin = "round";
    s.tracks.forEach((tr, k) => {
      ctx.strokeStyle = seatLine(id, k ? 0.3 : 0.62);
      trace(tr.rise, yOf);
    });
    ctx.restore();

    // taps and missed beats, in the marks row
    const my = y0 + 11;
    for (const b of analysis.beats) {
      if (b.spotId !== id || b.caught || !inView(b.atMs)) continue;
      ctx.strokeStyle = INK;
      ctx.lineWidth = 1.75;
      ctx.beginPath();
      ctx.arc(ax.toX(b.atMs), my, 5, 0, Math.PI * 2);
      ctx.stroke();
    }
    for (const t of analysis.taps) {
      if (t.spotId !== id || !inView(t.atMs)) continue;
      const x = ax.toX(t.atMs);
      if (t.status === "false" || t.status === "extra") {
        ctx.strokeStyle = ALERT;
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(x, y0 + 2);
        ctx.lineTo(x, plotBottom);
        ctx.stroke();
        ctx.fillStyle = ALERT;
        ctx.strokeStyle = "#fff";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(x, my - 8);
        ctx.lineTo(x + 7, my);
        ctx.lineTo(x, my + 8);
        ctx.lineTo(x - 7, my);
        ctx.closePath();
        ctx.stroke();
        ctx.fill();
      } else {
        ctx.strokeStyle = INK;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x, my - 7);
        ctx.lineTo(x, my + 8);
        ctx.stroke();
        if (t.status === "match") {
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(x + 3, my + 1);
          ctx.lineTo(x + 6, my + 4);
          ctx.lineTo(x + 11, my - 3);
          ctx.stroke();
        }
      }
    }
  });

  // ruler
  const step = tickStep(view[1] - view[0], L.plotRight - L.plotLeft);
  ctx.fillStyle = INK_2;
  ctx.strokeStyle = INK_2;
  ctx.lineWidth = 1;
  ctx.font = FONT(12);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  for (let t = Math.ceil(view[0] / step) * step; t <= view[1]; t += step) {
    const x = Math.round(ax.toX(t)) + 0.5;
    ctx.beginPath();
    ctx.moveTo(x, L.rulerTop);
    ctx.lineTo(x, L.rulerTop + 5);
    ctx.stroke();
    if (x < W - 20) ctx.fillText(secs(t, step), x, L.rulerTop + 14); // a label that would run off the edge is left out
  }
  ctx.textAlign = "left";

  // play head
  const hx = Math.round(ax.toX(Math.min(Math.max(head, view[0]), view[1])));
  ctx.fillStyle = INK;
  ctx.fillRect(hx - 1, 0, 2, L.rulerTop);
  ctx.beginPath();
  ctx.moveTo(hx - 6, 0);
  ctx.lineTo(hx + 6, 0);
  ctx.lineTo(hx, 8);
  ctx.closePath();
  ctx.fill();
  return { L, ax };
}
