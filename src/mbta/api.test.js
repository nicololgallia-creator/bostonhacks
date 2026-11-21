import { test } from "node:test";
import assert from "node:assert/strict";
import { listStops, nextTrains, rideSeconds, stopsOnRoute } from "./api.js";

const realFetch = globalThis.fetch;
const realWarn = console.warn;
// Replace fetch with a function that answers from `reply(url)`; { status, body } or a thrown error.
function fake(reply) {
  console.warn = () => {};
  globalThis.fetch = async (url) => {
    const r = reply(new URL(url));
    return { ok: (r.status ?? 200) < 400, status: r.status ?? 200, json: async () => r.body };
  };
}
const restore = () => { globalThis.fetch = realFetch; console.warn = realWarn; };

const iso = (secs) => new Date(Date.now() + secs * 1000).toISOString();
const pred = (id, trip, route, attrs) => ({
  id, type: "prediction", attributes: attrs,
  relationships: { route: { data: { id: route } }, trip: { data: { id: trip } } },
});

test("errors say the real reason", async () => {
  globalThis.fetch = async () => { throw new TypeError("fetch failed"); };
  console.warn = () => {};
  await assert.rejects(listStops(), /Could not reach the MBTA/);
  fake(() => ({ status: 429, body: {} }));
  await assert.rejects(nextTrains("place-kencl"), /busy.*20 requests a minute/);
  fake(() => ({ status: 500, body: {} }));
  await assert.rejects(nextTrains("place-kencl"), /status 500/);
  restore();
  await assert.rejects(nextTrains(""), /Pick a stop/);
  await assert.rejects(rideSeconds({ fromStopId: "a", toStopId: "a" }), /two different stops/);
});

test("nextTrains drops past and cancelled, uses departure when arrival is null, sorts soonest first", async () => {
  fake(() => ({ body: {
    data: [
      pred("a", "t1", "Green-D", { arrival_time: iso(600), departure_time: iso(660), direction_id: 1 }),
      pred("b", "t2", "Green-B", { arrival_time: null, departure_time: iso(120), direction_id: 0 }),
      pred("c", "t3", "Green-C", { arrival_time: iso(-60), departure_time: iso(-30), direction_id: 0 }),
      pred("d", "t4", "Green-D", { arrival_time: null, departure_time: null, direction_id: 1 }),
    ],
    included: [
      { type: "route", id: "Green-B", attributes: { long_name: "Green Line B" } },
      { type: "trip", id: "t2", attributes: { headsign: "Boston College" } },
    ],
  } }));
  const trains = await nextTrains("place-kencl");
  restore();
  assert.deepEqual(trains.map((t) => t.routeId), ["Green-B", "Green-D"]);
  assert.equal(trains[0].line, "Green Line B");
  assert.equal(trains[0].headsign, "Boston College");
  assert.equal(trains[0].directionId, 0);
  assert.ok(Math.abs(trains[0].seconds - 120) <= 2);
});

// Two stations, one platform each. Trip t1 goes from -> to, trip t2 only has the from stop.
const stops = [
  { type: "stop", id: "plat-a", relationships: { parent_station: { data: { id: "place-a" } } } },
  { type: "stop", id: "plat-b", relationships: { parent_station: { data: { id: "place-b" } } } },
];
const row = (trip, platform, seq, arrival, departure) => ({
  id: `${trip}-${platform}`,
  attributes: { arrival_time: arrival, departure_time: departure, stop_sequence: seq },
  relationships: { trip: { data: { id: trip } }, stop: { data: { id: platform } } },
});

test("rideSeconds uses the prediction, then the schedule, then throws", async () => {
  const query = { fromStopId: "place-a", toStopId: "place-b", routeId: "Red", directionId: 0 };
  const rows = [row("t1", "plat-a", 10, iso(60), iso(90)), row("t1", "plat-b", 20, iso(690), iso(720)), row("t2", "plat-a", 10, iso(300), iso(330))];
  fake((u) => ({ body: u.pathname === "/predictions" ? { data: rows, included: stops } : { data: [] } }));
  const byPrediction = await rideSeconds(query);
  assert.equal(byPrediction.source, "prediction");
  assert.ok(Math.abs(byPrediction.seconds - 600) <= 2);

  fake((u) => ({ body: u.pathname === "/schedules" ? { data: rows, included: stops } : { data: [] } }));
  const bySchedule = await rideSeconds(query);
  assert.equal(bySchedule.source, "schedule");

  fake(() => ({ body: { data: [], included: [] } }));
  await assert.rejects(rideSeconds(query), /No train on that line/);
  // the wrong way round: second stop comes first in the trip
  fake((u) => ({ body: u.pathname === "/predictions" ? { data: rows, included: stops } : { data: [] } }));
  await assert.rejects(rideSeconds({ ...query, fromStopId: "place-b", toStopId: "place-a" }), /No train on that line/);
  restore();
});

test("stopsOnRoute lists stations in trip order, branches after each other, no repeats", async () => {
  const platform = (id, station, name) => ({ type: "stop", id, attributes: { name }, relationships: { parent_station: { data: station && { id: station } } } });
  const trip = (id, ...stopIds) => ({ type: "trip", id, relationships: { stops: { data: stopIds.map((s) => ({ id: s })) } } });
  const pattern = (id, typicality, tripId) => ({ id, attributes: { typicality }, relationships: { representative_trip: { data: { id: tripId } } } });
  let asked;
  fake((u) => {
    asked = u;
    return { body: {
      data: [pattern("p1", 1, "t1"), pattern("p2", 1, "t2"), pattern("shuttle", 5, "t3")],
      included: [
        platform("1", "place-a", "Alpha"), platform("2", "place-b", "Bravo"), platform("3", "place-c", "Charlie"),
        platform("4", "place-b", "Bravo"), platform("5", null, "Delta"), platform("9", "place-z", "Shuttle stop"),
        trip("t1", "1", "2", "3"), trip("t2", "4", "5"), trip("t3", "9"),
      ],
    } };
  });
  const list = await stopsOnRoute("Red", 1);
  assert.deepEqual(list, [{ id: "place-a", name: "Alpha" }, { id: "place-b", name: "Bravo" }, { id: "place-c", name: "Charlie" }, { id: "5", name: "Delta" }]);
  assert.equal(asked.searchParams.get("filter[route]"), "Red");
  assert.equal(asked.searchParams.get("filter[direction_id]"), "1");

  fake(() => ({ body: { data: [], included: [] } }));
  await assert.rejects(stopsOnRoute("Red"), /lists no stops/);
  restore();
  await assert.rejects(stopsOnRoute(""), /Pick a line/);
});

// Costs about 11 of the 20 requests a minute a keyless network gets, so it only runs when asked:
// MBTA_LIVE=1 node --test src/mbta/api.test.js
test("live API: stops, next trains at Kenmore, Kenmore to Park Street", { skip: !process.env.MBTA_LIVE }, async () => {
  const stopList = await listStops();
  const kenmore = stopList.find((s) => s.id === "place-kencl");
  assert.deepEqual(kenmore, { id: "place-kencl", name: "Kenmore", lines: ["Green-B", "Green-C", "Green-D"] });
  assert.deepEqual(stopList.map((s) => s.name), [...stopList.map((s) => s.name)].sort((a, b) => a.localeCompare(b)));
  console.log(`${stopList.length} subway stations`);

  const trains = await nextTrains("place-kencl");
  assert.ok(trains.length > 0, "no trains at Kenmore");
  assert.ok(trains.every((t, i) => t.seconds >= 0 && (i === 0 || t.seconds >= trains[i - 1].seconds)));
  console.log("Next at Kenmore:", trains.slice(0, 3).map((t) => `${t.line} to ${t.headsign} in ${Math.round(t.seconds / 60)} min`).join("; "));

  const ride = await rideSeconds({ fromStopId: "place-kencl", toStopId: "place-pktrm", routeId: "Green-B", directionId: 1 });
  assert.ok(ride.seconds > 120 && ride.seconds < 1800, `odd ride time ${ride.seconds}`);
  console.log(`Kenmore to Park Street: ${ride.seconds} s (${ride.source})`);

  const greenB = (await stopsOnRoute("Green-B", 1)).map((s) => s.id);
  assert.ok(greenB.indexOf("place-kencl") >= 0 && greenB.indexOf("place-kencl") < greenB.indexOf("place-pktrm"), "Kenmore should come before Park Street eastbound");
});
