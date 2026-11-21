// The remote's settings: seats, volume, the camera and the lag. One tap from the seated screen in the
// lobby (the button in the top bar), and gone from it as soon as a song starts. Every control sends one
// message from PLAN.md ("Seats and session"); what is drawn comes from the stage's State.
import "./settings.css";

const VOLUME_STEP = 10;                // percent
const LAG_STEP = 10;                   // ms; the lag test in setup rounds to 10 too
const LAG_MAX = 400;                   // the lag test never gives more, so neither do the buttons
const SETTLE_MS = 1000;                // after a tap, the stage's older answer must not move the number back

const CHEVRON = `<svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><path d="M10 3 5 8l5 5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
const SLIDERS = `<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 7h8M18 7h2M4 17h2M12 17h8"/><circle cx="15" cy="7" r="2.5"/><circle cx="9" cy="17" r="2.5"/></g></svg>`;

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

// The button in the top bar that opens settings. main.js decides when it shows.
export function settingsGear(onTap) {
  const b = document.createElement("button");
  b.className = "gear";
  b.type = "button";
  b.hidden = true;
  b.setAttribute("aria-label", "Settings");
  b.innerHTML = SLIDERS;
  b.addEventListener("click", onTap);
  return b;
}

const stepper = (key, less, more) => `
  <div class="step">
    <button class="btn btn-quiet" type="button" data-step="${key}" data-by="-1" aria-label="${less}">&minus;</button>
    <output class="step-value" data-value="${key}"></output>
    <button class="btn btn-quiet" type="button" data-step="${key}" data-by="1" aria-label="${more}">+</button>
  </div>`;

export function openSettings({ screen, send, state, onClose }) {
  const el = document.createElement("section");
  el.className = "settings";
  el.innerHTML = `
    <button class="back" type="button" data-back>${CHEVRON}Back</button>
    <h1 class="title" tabindex="-1">Settings</h1>
    <section class="set" aria-labelledby="set-seats">
      <h2 id="set-seats">Seats</h2>
      <div class="seg" role="group" aria-label="Sitting or standing">
        <button class="btn btn-quiet" type="button" data-posture="seated">Sitting</button>
        <button class="btn btn-quiet" type="button" data-posture="standing">Standing</button>
      </div>
      <div class="seg" role="group" aria-label="How many seats">
        ${[1, 2, 3, 4].map((n) => `<button class="btn btn-quiet" type="button" data-seats="${n}" aria-label="${n} ${n === 1 ? "seat" : "seats"}">${n}</button>`).join("")}
      </div>
      <p class="hint">Fewer seats move players out of the seats that go away.</p>
    </section>
    <section class="set" aria-labelledby="set-volume">
      <h2 id="set-volume">Volume</h2>
      ${stepper("volume", "Quieter", "Louder")}
    </section>
    <section class="set" aria-labelledby="set-camera">
      <h2 id="set-camera">Camera</h2>
      <button class="btn btn-quiet" type="button" data-calibrate>Line up the camera</button>
      <p class="hint" role="status" data-camera></p>
    </section>
    <section class="set" aria-labelledby="set-lag">
      <h2 id="set-lag">Lag</h2>
      ${stepper("lag", "Less lag", "More lag")}
      <p class="hint">The lag test in setup measures this for you.</p>
    </section>`;
  const q = (s) => el.querySelector(s);

  let last = state;
  let tappedAt = 0;          // the last volume or lag tap, so the next State does not undo quick taps
  const value = {};          // volume in percent, lag in ms: what the numbers show now
  const read = (s) => {
    value.volume = Math.round((s?.settings?.volume ?? 0.8) * 100);
    value.lag = Math.round(s?.settings?.offsetMs ?? 0);
  };
  read(state);

  function paint() {
    for (const b of el.querySelectorAll("[data-posture]")) b.setAttribute("aria-pressed", String(b.dataset.posture === last?.layout?.posture));
    for (const b of el.querySelectorAll("[data-seats]")) b.setAttribute("aria-pressed", String(Number(b.dataset.seats) === last?.layout?.spots?.length));
    q('[data-value="volume"]').textContent = `${value.volume}%`;
    q('[data-value="lag"]').textContent = `${value.lag} ms`;
    q('[data-step="volume"][data-by="-1"]').disabled = value.volume <= 0;
    q('[data-step="volume"][data-by="1"]').disabled = value.volume >= 100;
    q('[data-step="lag"][data-by="-1"]').disabled = value.lag <= 0;
    q('[data-step="lag"][data-by="1"]').disabled = value.lag >= LAG_MAX;
  }

  el.addEventListener("click", (e) => {
    const b = e.target.closest("button");
    if (!b) return;
    if (b.hasAttribute("data-back")) return onClose();
    const layout = last?.layout;
    if (b.dataset.posture) send({ type: "layout", posture: b.dataset.posture, seats: layout?.spots?.length ?? 3 });
    else if (b.dataset.seats) send({ type: "layout", posture: layout?.posture ?? "seated", seats: Number(b.dataset.seats) });
    else if (b.hasAttribute("data-calibrate")) {
      send({ type: "calibrate" });
      q("[data-camera]").textContent = "Setup is open on the laptop.";
    } else if (b.dataset.step) {
      const by = Number(b.dataset.by);
      tappedAt = Date.now();
      if (b.dataset.step === "volume") {
        value.volume = clamp(value.volume + by * VOLUME_STEP, 0, 100);
        send({ type: "set", volume: value.volume / 100 });
      } else {
        value.lag = clamp(value.lag + by * LAG_STEP, 0, LAG_MAX);
        send({ type: "set", offsetMs: value.lag });
      }
      paint();
    }
  });

  screen.replaceChildren(el);
  paint();
  q(".title").focus({ preventScroll: true });
  window.scrollTo(0, 0);

  return {
    onState(s) {
      last = s;
      if (s.status !== "lobby") return onClose(); // the songs are going, so settings step aside
      if (Date.now() - tappedAt > SETTLE_MS) read(s);
      paint();
    },
  };
}
