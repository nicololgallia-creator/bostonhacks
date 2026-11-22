// Small parts every screen shares: element helpers, icons, the train car, the conductor, a song's cover.
//
// Motion rules (a tab left and come back to must look the same as one never left): every movement is a CSS animation or
// transition, never a timer or requestAnimationFrame, so time away cannot leave one half-way. Entrances play only when a
// screen is first shown. On return, every animation that has an end is finished at once, and endless ones are paused while
// the tab is hidden. A screen or the conductor arriving while the tab is hidden, or within 2.5 s after returning, is shown at rest.
import { coverUrl } from "./covers.js";

export function h(tag, cls, ...kids) {
  const el = document.createElement(tag);
  if (cls) el.className = cls;
  el.append(...kids);
  return el;
}
export const svg = (markup) => Object.assign(document.createElement("template"), { innerHTML: markup }).content.firstChild;
export const CHECK = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/></svg>';
export const PLAY = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 1.5v13l11-6.5z" fill="currentColor"/></svg>';
export const clock = (s) => `${Math.floor(Math.round(s) / 60)}:${String(Math.round(s) % 60).padStart(2, "0")}`;
export const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;

// A button: type set once, so no caller forgets it.
export function button(cls, onclick, ...kids) {
  const el = h("button", cls, ...kids);
  el.type = "button";
  el.onclick = onclick;
  return el;
}

// ---- away and back ----
export const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
export const sleep = (ms) => new Promise((done) => setTimeout(done, reduceMotion ? 0 : ms));
let calmUntil = 0;
export const isCalm = () => document.hidden || performance.now() < calmUntil;
const settle = () => { for (const a of document.getAnimations()) if (a.effect?.getComputedTiming().iterations !== Infinity) a.finish(); };
// Call after putting something new on screen: if the tab is away or just back, it shows at rest.
export const rest = () => { if (isCalm()) settle(); };
document.addEventListener("visibilitychange", () => {
  document.documentElement.classList.toggle("away", document.hidden);
  if (document.hidden) return;
  calmUntil = performance.now() + 2500;
  settle();
});

// MASCOT MOUNT. The conductor is public/mascot/conductor.svg (the lead's drawing: never redrawn or recoloured here). Its markup is
// fetched once and put inline, so CSS can move its named groups (#arm-wave, #tentacles). Each screen asks for a mount
// beside its question; the mount keeps its size while the file loads, and hides if the file is missing.
let conductorSvg;
const loadConductor = () => (conductorSvg ??= fetch("/mascot/conductor.svg").then((r) => (r.ok ? r.text() : "")).catch(() => ""));
export function mascotMount(where) {
  const el = h("div", "mascot-mount");
  el.dataset.mount = where;
  loadConductor().then((markup) => {
    if (!markup) { el.hidden = true; return; }
    if (isCalm()) el.classList.add("still"); // arrived while the tab was away: no entrance
    el.innerHTML = markup;
  });
  return el;
}

// The train, drawn as the side of a car: line colour, name, car number, a row of windows, rails under it.
export function trainCar(line, car, headsign) {
  return h("div", "",
    h("div", "train",
      h("div", "who", h("span", "roundel", line.letter), h("div", "", h("b", "", line.name), h("small", "", `${headsign ? `to ${headsign} · ` : ""}Car ${car}`))),
      h("div", "windows", ...[0, 1, 2, 3, 4].map(() => h("i"))),
    ),
    h("div", "rails"),
  );
}

// A song's cover: the real album cover when we have one, else a tile in the line's colour with the first letter.
// Covers load lazily (when the tile scrolls into view); the letter is already there, so nothing jumps when the picture lands.
const lazy = "IntersectionObserver" in window ? new IntersectionObserver((seen) => {
  for (const { target, isIntersecting } of seen) if (isIntersecting) { lazy.unobserve(target); target._load(); }
}, { rootMargin: "200px" }) : null;

export function coverTile(song, size) {
  const tile = h("span", `cover ${size}`, h("span", "letter", song.title.trim()[0].toUpperCase()));
  tile._load = async () => {
    const url = await coverUrl(song);
    if (!url || !tile.isConnected) return;
    const img = h("img");
    img.alt = "";
    img.onload = () => { img.classList.add("on"); tile.classList.add("has-art"); };
    img.src = url;
    tile.append(img);
  };
  if (lazy) lazy.observe(tile); else tile._load();
  return tile;
}

// A loading placeholder: a few pills that breathe.
export function skeleton(count, style = "") {
  return h("div", "sk-list", ...Array.from({ length: count }, (_, i) => Object.assign(h("div", "sk"), { style: `--i:${i};${style}` })));
}

// A load that failed: the real reason, and a button that tries again. `way` is an optional second, quieter way on:
// { label, run }, shown under "Try again" so a failed load is never a dead end.
export function failure(message, retry, way) {
  return h("div", "notice", h("h2", "", "That did not load."), h("p", "", message), button("btn", retry, "Try again"),
    ...(way ? [button("btn ghost", way.run, way.label)] : []));
}
