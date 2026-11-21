// The opening: the line's train pulls in over the line's colour, holds a moment, and the screen underneath comes up.
// It ignores every tap (pointer-events: none), so it can never block one, and it is gone after 1.5 s.
import { h, trainCar, reduceMotion } from "./parts.js";

const GONE_MS = 2500; // in case the browser never reports the animation ending

export function playOpening(line, car, headsign) {
  if (reduceMotion || document.hidden) return;
  const el = h("div", "opening", trainCar(line, car, headsign), h("p", "opening-name", "Platform Piano"));
  el.setAttribute("aria-hidden", "true");
  document.body.append(el);
  el.addEventListener("animationend", (e) => { if (e.target === el) el.remove(); });
  setTimeout(() => el.remove(), GONE_MS);
}
