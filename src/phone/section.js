// Step three of "where are you": a top-down map of the car, split into sections. One section is real
// (the stage's `section.name`, with its seats); the others are samples that cannot be entered and say so.
// Drawn only from the State. main.js decides when it shows and what a tap on the real section does.
import "./map.css";

const SAMPLES = ["Middle", "Rear"]; // quiet sections beside the real one
const SAMPLE_SEATS = 4;
const TAP_GUARD_MS = 400;           // a double tap on Join must not land on the map
const NO_PROJECTOR = "There is no projector in this section tonight. Tap the lit one.";

const CHEVRON = `<svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><path d="M10 3 5 8l5 5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
const cushions = (n) => "<i></i>".repeat(n);

export function mountSection({ screen, onPick }) {
  const el = document.createElement("section");
  el.className = "section";
  el.innerHTML = `
    <button class="back" type="button" data-act="back">${CHEVRON}Back</button>
    <div><h1 class="title">Which part of the car are you in?</h1><p class="sub">Tap the section you are sitting in.</p></div>
    <div class="car" role="group" aria-label="A train car seen from above, front on the left">
      <button class="part" type="button" data-real>
        <span class="part-bench" data-seats></span>
        <span class="part-text"><span class="part-name"></span><span class="part-free"></span></span>
        <span class="part-bench">${cushions(SAMPLE_SEATS)}</span>
      </button>
      ${SAMPLES.map((name) => `
      <button class="part" type="button" data-sample>
        <span class="part-bench">${cushions(SAMPLE_SEATS)}</span>
        <span class="part-text"><span class="part-name">${name}</span></span>
        <span class="part-bench">${cushions(SAMPLE_SEATS)}</span>
      </button>`).join("")}
    </div>
    <p class="car-ends" aria-hidden="true"><span>Front</span><span>Back</span></p>
    <p class="hint" role="status"></p>`;

  const q = (s) => el.querySelector(s);
  const real = q("[data-real]");
  const hint = q(".hint");
  const shownAt = Date.now();
  let drawn = "";

  el.addEventListener("click", (e) => {
    const part = e.target.closest(".part");
    if (!part || Date.now() - shownAt < TAP_GUARD_MS) return;
    if (part.hasAttribute("data-real")) onPick();
    else hint.textContent = NO_PROJECTOR;
  });
  screen.replaceChildren(el);

  return {
    // Called on every State. The seat colours on the bench are the floor's own: bright is free, dim is taken.
    sync(state) {
      const spots = state?.layout?.spots ?? [];
      const taken = new Set((state?.players ?? []).filter((p) => p.spotId).map((p) => p.spotId));
      const name = state?.section?.name ?? "Your section";
      const free = spots.filter((s) => !taken.has(s.id)).length;
      const key = `${name}|${spots.map((s) => `${s.id}${taken.has(s.id)}`)}`;
      if (key === drawn) return;
      drawn = key;
      const count = free === 0 ? "Every seat is taken" : `${free} ${free === 1 ? "seat" : "seats"} free`;
      real.querySelector(".part-name").textContent = name;
      real.querySelector(".part-free").textContent = count;
      real.setAttribute("aria-label", `${name}. ${count}. Choose this section.`);
      real.querySelector("[data-seats]").innerHTML = spots
        .map((s) => `<i data-seat="${s.id}"${taken.has(s.id) ? " data-taken" : ""}></i>`).join("");
    },
  };
}
