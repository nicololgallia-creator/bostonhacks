// Screen 2: "Where are you getting off?" The stops ahead on this train, live from the MBTA, as a piece of a transit map.
import { stopsOnRoute } from "../../mbta/api.js";
import { h, svg, CHECK, plural, button, trainCar, mascotMount, skeleton, failure, rest, sleep } from "../parts.js";

export default {
  id: "stops",
  step: 1,
  mount(app) {
    const body = h("div", "stops-body", skeleton(5));
    const head = h("div", "", trainCar(app.line, app.train.car, app.train.headsign));
    const el = h("div", "flow", head, h("div", "ask-row", h("h1", "ask", "Where are you ", h("span", "hl", "getting off?")), mascotMount("stops")), body);

    const load = () => {
      body.replaceChildren(skeleton(5));
      app.memo(`stops:${app.train.line}:${app.train.directionId}`, () => stopsOnRoute(app.train.line, app.train.directionId)).then(
        (stops) => { if (el.isConnected) { showStops(app, el, head, body, stops, load); rest(); } },
        (e) => { if (el.isConnected) body.replaceChildren(failure(e.message, load)); },
      );
    };
    load();
    return { el };
  },
};

function showStops(app, el, head, body, stops, retry) {
  const here = stops.findIndex((s) => s.id === app.train.atStopId);
  const ahead = stops.slice(here + 1);
  app.train.atStopName ??= stops[here]?.name;
  app.train.headsign ??= stops.at(-1).name;
  head.replaceChildren(trainCar(app.line, app.train.car, app.train.headsign));
  if (here < 0) return body.replaceChildren(failure("That stop is not on this line and direction. Check the address on the poster.", retry));
  if (!ahead.length) return body.replaceChildren(failure("This train is at the end of the line. Check the address on the poster.", retry));

  const map = h("ol", "map");
  const items = [Object.assign(h("li", "here", h("span", "dot"), h("i", "seg down"), h("div", "you", h("small", "", "You are here"), h("strong", "", app.train.atStopName ?? "This stop"))), { style: "--i:0" })];
  let busy = false;
  ahead.forEach((stop, i) => {
    const dot = h("span", "dot");
    dot.append(svg(CHECK));
    const row = button("row", () => pick(stop, li), h("span", "", stop.name), h("span", "chip", plural(i + 1, "stop")));
    const li = h("li", "", dot, h("i", "seg up"), row);
    li.style.setProperty("--i", Math.min(i + 1, 9));
    items.push(li);
  });
  items.slice(1, -1).forEach((li) => li.append(h("i", "seg down"))); // every stop but the last has a piece going on to the next
  const engine = h("span", "engine");
  map.append(...items, engine);
  body.replaceChildren(map);

  // The train's marker is placed from measured positions, so measure again whenever the list changes size
  // (a font arriving, a rotated phone, a resized window) and keep its ride to the chosen stop true too.
  let chosen = null;
  const place = () => {
    if (!map.isConnected) return watch.disconnect();
    const mid = (item) => item.offsetTop + item.offsetHeight / 2;
    map.style.setProperty("--top", `${mid(items[0])}px`);
    if (chosen) map.style.setProperty("--ride", `${mid(chosen) - mid(items[0])}px`);
  };
  const watch = new ResizeObserver(place);
  watch.observe(map);

  async function pick(stop, li) {
    if (busy) return;
    busy = true;
    map.classList.add("has-pick");
    const target = items.indexOf(li);
    const step = Math.min(70, 650 / target);
    items.slice(1, target + 1).forEach((item, i) => {
      item.style.setProperty("--d", `${i * step}ms`);
      item.classList.add(item === li ? "picked" : "passed");
    });
    chosen = li;
    place(); // the train rides the line to the stop, and the line darkens behind it
    await sleep(1100);
    if (!el.isConnected) return; // the person went somewhere else meanwhile (a song started, Back)
    app.trip.stop = stop;
    app.go("song");
  }
}
