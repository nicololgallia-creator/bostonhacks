// The trains on the phone: the opening, the track rows on the line step, and the chug off when a line is picked.
// The pictures are public/trains/<key>.png (key is the line's colour key: green, red, orange, blue, mattapan).
// A line with no picture yet shows its track and name only. Nothing is hard-coded: a picture is used once it loads.
import "./trains.css";

const OPENING_MS = 1400;
const CHUG_MS = 620;   // from the tap to the car step starting; the train is still leaving as it comes in
const quiet = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

const loading = new Map();
const src = (key) => `${import.meta.env.BASE_URL}trains/${key}.png`;
// Resolves true when the picture exists. One request for each line, kept for the life of the page.
function hasTrain(key) {
  if (!loading.has(key)) {
    loading.set(key, new Promise((done) => {
      const img = new Image();
      img.onload = () => done(true);
      img.onerror = () => done(false);
      img.src = src(key);
    }));
  }
  return loading.get(key);
}

// One row for each line: its name, its track in its colour, and (once the picture loads) its train on the track.
export function lineRows(lines) {
  return lines.map((l, i) => `
    <button class="line" type="button" data-line="${l.key}" data-id="${l.id}" style="--i:${i}">
      <span class="line-name">${l.name}</span>
      <span class="track"></span>
    </button>`).join("");
}

// Sets the trains on their tracks for the rows inside `root`.
export function seatTrains(root) {
  for (const row of root.querySelectorAll(".line")) {
    hasTrain(row.dataset.line).then((ok) => {
      if (!ok || !row.isConnected) return;
      const img = new Image();
      img.className = "loco";
      img.alt = "";
      img.src = src(row.dataset.line);
      row.querySelector(".track").append(img);
    });
  }
}

// The picked row's train chugs along its track and off the screen. Resolves when the next step should start.
// A line with no train yet, or a phone that asks for less motion, resolves at once.
export function chugOff(row) {
  const loco = row.querySelector(".loco");
  if (!loco || quiet()) return Promise.resolve();
  const app = row.closest(".app");
  app.dataset.chugging = ""; // clips the page sideways while the train is off the edge, so it cannot scroll
  loco.style.setProperty("--go", `${Math.ceil(innerWidth - loco.getBoundingClientRect().left + 24)}px`);
  row.dataset.go = "";
  return new Promise((done) => setTimeout(() => {
    delete app.dataset.chugging;
    done();
  }, CHUG_MS));
}

// The Green Line train chugs in from the left, bounces on its wheels and zooms off to the right with a puff.
// It sits over the first screen without catching a tap, and the cover behind it clears before the train is gone.
let opened = false;
export async function playOpening() {
  if (opened || quiet()) return;
  opened = true;
  if (!(await hasTrain("green"))) return;
  const el = document.createElement("div");
  el.className = "opening";
  el.setAttribute("aria-hidden", "true");
  el.innerHTML = `
    <i class="op-cover"></i>
    <div class="op-lane" data-line="green">
      <i class="op-rail"></i>
      <i class="op-puff"></i><i class="op-puff"></i><i class="op-puff"></i>
      <div class="op-run"><img src="${src("green")}" alt=""></div>
    </div>`;
  document.body.append(el);
  setTimeout(() => el.remove(), OPENING_MS + 100);
}
