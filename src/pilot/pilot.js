// Pilot: screens 2 and 3 of the new flow. Where are you getting off, then the recommended song.
// The train comes from the page address: pilot.html?line=Green-B&dir=1&at=place-bucen&car=2
// The line you are on sets the colour of the whole page (its hero colour, from lines.js, as --c on <html>).
//
// Motion rules (a tab left and come back to must look the same as one never left):
// every movement is a CSS animation or transition, never a timer or requestAnimationFrame, so time away cannot
// leave one half-way. Entrances play only when a screen is first shown. On return, every animation that has an
// end is finished at once, and endless ones are paused while the tab is hidden.
import { stopsOnRoute, rideSeconds } from "../mbta/api.js";
import { pickSongs } from "../songs/pick.js";
import { songs, songById } from "../songs/index.js";
import { songSeconds } from "../game/engine.js";
import { coverUrl } from "./covers.js";
import { BUTTER, lineOf } from "./lines.js";

const q = new URLSearchParams(location.search);
const train = {
  line: q.get("line") ?? "Green-B",
  dir: Number(q.get("dir") ?? 1),
  at: q.get("at") ?? "place-bucen",
  car: q.get("car") ?? "2",
  to: q.get("to"), // optional name of the end of the line; otherwise the last stop is used
};
const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
const sleep = (ms) => new Promise((done) => setTimeout(done, reduce ? 0 : ms));

const screen = document.getElementById("screen");
const track = document.getElementById("track");
const back = document.getElementById("back");

// ---- small helpers ----
function h(tag, cls, ...kids) {
  const el = document.createElement(tag);
  if (cls) el.className = cls;
  el.append(...kids);
  return el;
}
const svg = (markup) => Object.assign(document.createElement("template"), { innerHTML: markup }).content.firstChild;
const CHECK = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const PLAY = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 1.5v13l11-6.5z" fill="currentColor"/></svg>';
const clock = (s) => `${Math.floor(Math.round(s) / 60)}:${String(Math.round(s) % 60).padStart(2, "0")}`;
const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;

// MASCOT MOUNT. The conductor is public/mascot/conductor.svg (the lead's drawing: not redrawn or recoloured here). Its markup is
// fetched once and put inline, so CSS can move its named groups (#arm-wave, #tentacles). Each screen asks for a mount
// beside its question ("stops", "song"); the mount keeps its size while the file loads, and hides if the file is missing.
let conductorSvg;
const loadConductor = () => (conductorSvg ??= fetch("/mascot/conductor.svg").then((r) => (r.ok ? r.text() : "")).catch(() => ""));
function mascotMount(where) {
  const el = h("div", "mascot-mount");
  el.dataset.mount = where;
  loadConductor().then((markup) => {
    if (!markup) { el.hidden = true; return; }
    if (document.hidden || performance.now() < calmUntil) el.classList.add("still"); // arrived while the tab was away: no entrance
    el.innerHTML = markup;
  });
  return el;
}

const line = lineOf(train.line);
const root = document.documentElement.style;
root.setProperty("--c", line.hero);          // the hero colour: this line's hero colour
root.setProperty("--butter", BUTTER);
root.setProperty("--badge", line.badge);       // the true line colour, for the round badge only
root.setProperty("--badge-ink", line.badgeInk);
document.getElementById("theme-colour").setAttribute("content", line.hero);
// Away and back: pause the endless motion while hidden; on return put every animation that has an end at its end.
// A screen that turns up while the tab is hidden, or in the moments right after it returns, is shown at rest too.
let calmUntil = 0;
const settle = () => { for (const a of document.getAnimations()) if (a.effect?.getComputedTiming().iterations !== Infinity) a.finish(); };
document.addEventListener("visibilitychange", () => {
  document.documentElement.classList.toggle("away", document.hidden);
  if (document.hidden) return;
  calmUntil = performance.now() + 2500;
  settle();
});

// The train, drawn as the side of a car: line colour, name, car number, a row of windows, rails under it.
function trainCar(headsign) {
  return h("div", "",
    h("div", "train",
      h("div", "who", h("span", "roundel", line.letter), h("div", "", h("b", "", line.name), h("small", "", `${headsign ? `to ${headsign} · ` : ""}Car ${train.car}`))),
      h("div", "windows", ...[0, 1, 2, 3, 4].map(() => h("i"))),
    ),
    h("div", "rails"),
  );
}

// Showing a screen. `nav` counts screens shown: an answer that arrives for a screen the person already left is dropped,
// so a slow reply can never replace what they are looking at. `step` is 0 to 4, where the little train in the top bar rides to.
let nav = 0;
function show(node, step, enter = true) {
  nav++;
  if (enter) node.classList.add("enter");
  screen.replaceChildren(node);
  if (document.hidden || performance.now() < calmUntil) settle();
  track.style.setProperty("--p", `${step * 25}%`);
  track.setAttribute("aria-valuenow", step);
  return nav;
}

function showError(message, retry, retryLabel = "Try again") {
  const again = h("button", "btn", retryLabel);
  again.type = "button";
  again.onclick = retry;
  show(h("div", "notice", h("h2", "", "That did not load."), h("p", "", message), again), 1);
}

// ---- screen 2: where are you getting off? ----
let stopsCache;
const asking = () => h("div", "ask-row", h("h1", "ask", "Where are you ", h("span", "hl", "getting off?")), mascotMount("stops"));

async function startStops() {
  back.hidden = true;
  const wait = h("div", "sk-list");
  for (let i = 0; i < 5; i++) wait.append(Object.assign(h("div", "sk"), { style: `--i:${i}` }));
  const mine = show(h("div", "flow", trainCar(train.to), asking(), wait), 1);
  try {
    stopsCache ??= await stopsOnRoute(train.line, train.dir);
  } catch (e) {
    return mine === nav && showError(e.message, startStops);
  }
  if (mine === nav) showStops(stopsCache);
}

function showStops(stops) {
  const here = stops.findIndex((s) => s.id === train.at);
  const ahead = stops.slice(here + 1);
  back.hidden = true;
  if (!ahead.length) return showError("This train is at the end of the line. Check the address on the poster.", startStops);

  const map = h("ol", "map");
  const items = [Object.assign(h("li", "here", h("span", "dot"), h("i", "seg down"), h("div", "you", h("small", "", "You are here"), h("strong", "", stops[here]?.name ?? "This stop"))), { style: "--i:0" })];
  ahead.forEach((stop, i) => {
    const row = h("button", "row", h("span", "", stop.name), h("span", "chip", plural(i + 1, "stop")));
    row.type = "button";
    const dot = h("span", "dot");
    dot.append(svg(CHECK));
    const li = h("li", "", dot, h("i", "seg up"), row);
    li.style.setProperty("--i", Math.min(i + 1, 9));
    row.onclick = () => pick(map, items, li, stop);
    items.push(li);
  });
  items.slice(1, -1).forEach((li) => li.append(h("i", "seg down"))); // every stop but the last has a piece going on to the next
  const engine = h("span", "engine");
  map.append(...items, engine);

  show(h("div", "flow", trainCar(train.to ?? stops.at(-1).name), asking(), map), 1);

  // The train's marker is placed from measured positions, so measure again whenever the list changes size
  // (a font arriving, a rotated phone, a resized window) and keep its ride to the chosen stop true too.
  const state = { chosen: null };
  const place = () => {
    if (!map.isConnected) return watch.disconnect();
    const mid = (el) => el.offsetTop + el.offsetHeight / 2;
    map.style.setProperty("--top", `${mid(items[0])}px`);
    if (state.chosen) map.style.setProperty("--ride", `${mid(state.chosen) - mid(items[0])}px`);
  };
  const watch = new ResizeObserver(place);
  watch.observe(map);
  map._choose = (li) => { state.chosen = li; place(); };
}

let busy = false;
async function pick(map, items, li, stop) {
  if (busy) return;
  busy = true;
  map.classList.add("has-pick");
  const target = items.indexOf(li);
  const step = Math.min(70, 650 / target);
  items.slice(1, target + 1).forEach((item, i) => {
    item.style.setProperty("--d", `${i * step}ms`);
    item.classList.add(item === li ? "picked" : "passed");
  });
  map._choose(li); // the train rides the line to the stop, and the line darkens behind it
  await sleep(1100);
  await startSong(stop);
  busy = false;
}

// ---- screen 3: recommended song ----
async function startSong(stop) {
  back.hidden = false;
  back.onclick = () => showStops(stopsCache);
  const mine = show(h("div", "flow", h("h1", "ask", "Finding your ", h("span", "hl", "song")), h("div", "sk-list", ...[0, 1].map((i) => Object.assign(h("div", "sk"), { style: `--i:${i};margin-left:0;height:8rem` })))), 2);
  let ride;
  try {
    ride = await rideSeconds({ fromStopId: train.at, toStopId: stop.id, routeId: train.line, directionId: train.dir });
  } catch (e) {
    return mine === nav && showError(e.message, () => startSong(stop), "Try again");
  }
  if (mine !== nav) return;
  const { songIds, fits } = pickSongs({ seconds: ride.seconds });
  const fitting = songs.filter((s) => songSeconds(s) + 4 <= ride.seconds - 20).reverse(); // longest first
  const options = fits ? fitting : songs.slice(0, 3);
  showSong(songById(songIds[0]) ?? songs[0], ride.seconds, options, true);
}

// A song's cover: the real album cover when we have one, else a tile in the line's colour with the first letter.
// Covers load lazily (when the tile scrolls into view); the letter is already there, so nothing jumps when the picture lands.
const lazy = "IntersectionObserver" in window ? new IntersectionObserver((seen) => {
  for (const { target, isIntersecting } of seen) if (isIntersecting) { lazy.unobserve(target); target._load(); }
}, { rootMargin: "200px" }) : null;

function coverTile(song, size) {
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

function showSong(song, rideSecs, options, enter) {
  const secs = songSeconds(song);
  const run = h("div", "run", h("i", "r-base"), h("i", "r-fill"), h("b"), h("b"), h("span", "t-train"));
  run.style.setProperty("--k", `${Math.max(8, Math.min(100, (secs / rideSecs) * 100))}%`);
  const ticket = h("div", `ticket${enter ? "" : " swap"}`, h("article", "tk",
    h("div", "tk-top", h("span", "roundel", line.letter), h("span", "", line.name), h("span", "", `Car ${train.car}`)),
    h("div", "tk-main",
      coverTile(song, "big"),
      h("h2", "", song.title),
      h("p", "", song.by.split(". ")[0]), // the composer and year; the long credit stays in the song file
    ),
    h("div", "tk-stub", run, h("p", "times", h("span", "", h("b", "", clock(secs)), "song"), h("span", "", `Your ride ${Math.max(1, Math.round(rideSecs / 60))} min`))),
  ));
  const play = h("button", "btn", "Play this song", h("span", "go"));
  play.lastChild.append(svg(PLAY));
  const more = h("button", "btn ghost", "See more songs");
  const later = h("p", "later");
  play.type = more.type = "button";
  play.onclick = () => { later.textContent = "Picking seats is the next screen. It is not built in this pilot."; };
  more.onclick = () => openSheet(options, song, (next) => showSong(next, rideSecs, options, false));

  show(h("div", enter ? "flow" : "flow still", // a swap of the song on the same screen shows at rest: nothing replays
    h("div", "top", h("h1", "ask", "Recommended ", h("span", "hl", "song")), mascotMount("song")),
    ticket,
    h("div", "actions", play, more, later),
  ), 2, enter);
}

function openSheet(options, current, choose) {
  const sheet = h("dialog", "sheet", h("h2", "", "More songs"));
  const list = h("ul");
  for (const s of options) {
    const row = h("button", "row", coverTile(s, "mini"), h("span", "name", s.title), h("span", "chip", clock(songSeconds(s))));
    row.type = "button";
    if (s.id === current.id) row.setAttribute("aria-current", "true");
    row.onclick = () => { sheet.close(); choose(s); };
    list.append(h("li", "", row));
  }
  const close = h("button", "btn ghost", "Close");
  close.type = "button";
  close.onclick = () => sheet.close();
  sheet.append(list, close);
  sheet.onclose = () => sheet.remove();
  sheet.onclick = (e) => { if (e.target === sheet) sheet.close(); };
  document.body.append(sheet);
  sheet.showModal();
}

startStops();





