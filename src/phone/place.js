// Where are you, in three small steps: your line, your car, then your section (section.js).
// This file draws the first two. Both are drawn from nothing the stage sends: the cars are a sample, and
// every car leads to the one real section. Colours come from the line tokens in tokens.css.
import "./map.css";
import { lineRows, seatTrains, chugOff, playOpening } from "./trains.js";

playOpening(); // the app opens with a train, whichever step comes first

const TAP_GUARD_MS = 400; // a double tap on one step must not land on the next
const CHEVRON = `<svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><path d="M10 3 5 8l5 5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

// `id` is the route id src/mbta/api.js uses. `key` picks the line colour. `cars` is how many cars one train has.
export const LINES = [
  { id: "Red", name: "Red", key: "red", cars: 6 },
  { id: "Orange", name: "Orange", key: "orange", cars: 6 },
  { id: "Blue", name: "Blue", key: "blue", cars: 6 },
  { id: "Mattapan", name: "Mattapan", key: "mattapan", cars: 1 },
  { id: "Green-B", name: "Green B", key: "green", cars: 2 },
  { id: "Green-C", name: "Green C", key: "green", cars: 2 },
  { id: "Green-D", name: "Green D", key: "green", cars: 2 },
  { id: "Green-E", name: "Green E", key: "green", cars: 2 },
];
export const lineById = (id) => LINES.find((l) => l.id === id) ?? null;
export const lineLabel = (l) => (l.key === "green" ? `Green Line ${l.name.slice(-1)}` : `${l.name} Line`);

function mount(screen, html, onTap, arrive) {
  const el = document.createElement("section");
  el.className = "place";
  if (arrive) el.dataset.arrive = "";
  el.innerHTML = html;
  const shownAt = Date.now();
  el.addEventListener("click", (e) => {
    if (Date.now() - shownAt < TAP_GUARD_MS) return;
    onTap(e);
  });
  screen.replaceChildren(el);
  return el;
}

// Step one, and the first thing a stranger sees: what this is, then which line.
export function mountLine({ screen, onPick }) {
  const el = mount(screen, `
    <div><h1 class="title">A piano on the floor.</h1><p class="sub">You play it with your feet.</p></div>
    <h2 class="ask">Which line are you on?</h2>
    <div class="lines">${lineRows(LINES)}</div>`, (e) => {
    const row = e.target.closest("[data-id]");
    if (!row || el.dataset.going) return; // a second tap while the train is leaving does nothing
    el.dataset.going = "";
    chugOff(row).then(() => onPick(lineById(row.dataset.id)));
  });
  seatTrains(el);
}

// Step two: the cars of a train on that line, in a row. Tap yours.
export function mountCar({ screen, line, onPick }) {
  mount(screen, `
    <button class="back" type="button" data-act="back">${CHEVRON}Back</button>
    <div><h1 class="title">Which car are you in?</h1><p class="sub">${lineLabel(line)}, ${line.cars === 1 ? "one car" : `${line.cars} cars`}.</p></div>
    <div class="train" data-line="${line.key}" role="group" aria-label="A ${lineLabel(line)} train, ${line.cars} cars">
      ${Array.from({ length: line.cars }, (_, i) => `<button class="car-cell" type="button" data-car="${i + 1}" aria-label="Car ${i + 1}"><span>${i + 1}</span></button>`).join("")}
    </div>
    <p class="hint">Only one section has a projector tonight. Any car leads to it.</p>`, (e) => {
    const n = e.target.closest("[data-car]")?.dataset.car;
    if (n) onPick(Number(n));
  }, true);
}
