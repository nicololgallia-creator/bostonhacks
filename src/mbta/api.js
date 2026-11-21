// Live MBTA V3 data. Plain fetch, so it runs in the browser and in Node.
// Without a key the API allows 20 requests a minute, so listStops is cached.
const BASE = "https://api-v3.mbta.com";
const SUBWAY = ["Red", "Mattapan", "Orange", "Blue", "Green-B", "Green-C", "Green-D", "Green-E"];

async function get(path, params) {
  const key = import.meta.env?.VITE_MBTA_KEY ?? globalThis.process?.env?.VITE_MBTA_KEY;
  let res;
  try {
    res = await fetch(`${BASE}${path}?${new URLSearchParams(params)}`, {
      headers: key ? { "x-api-key": key } : {},
      signal: AbortSignal.timeout(10000),
    });
  } catch (e) {
    console.warn("MBTA", path, e.name);
    throw new Error(e.name === "TimeoutError"
      ? "The MBTA did not answer within 10 seconds. Try again."
      : "Could not reach the MBTA. Check the internet connection.");
  }
  if (!res.ok) {
    console.warn("MBTA", path, res.status);
    if (res.status === 429) throw new Error("The MBTA data service is busy. Without a key it allows 20 requests a minute. Wait a minute and try again.");
    if (res.status === 403) throw new Error("The MBTA refused the API key. Check VITE_MBTA_KEY.");
    throw new Error(`The MBTA data service had a problem (status ${res.status}). Try again in a moment.`);
  }
  return res.json();
}

const included = (j) => new Map((j.included ?? []).map((r) => [`${r.type}:${r.id}`, r]));
const timeOf = (a) => a.arrival_time ?? a.departure_time;

let stopsCache;
export function listStops() {
  stopsCache ??= Promise.all(SUBWAY.map((route) =>
    get("/stops", { "filter[route]": route, "filter[location_type]": "1", "fields[stop]": "name" })
      .then((j) => j.data.map((s) => ({ id: s.id, name: s.attributes.name, route })))))
    .then((perRoute) => {
      const byId = new Map();
      for (const { id, name, route } of perRoute.flat()) {
        if (!byId.has(id)) byId.set(id, { id, name, lines: [] });
        byId.get(id).lines.push(route);
      }
      return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name));
    })
    .catch((e) => { stopsCache = undefined; throw e; });
  return stopsCache;
}

// The stations of one line in the order a train going `directionId` visits them. Where a line splits
// (Red), the first branch's stations come first, then the second's that are not already listed.
export async function stopsOnRoute(routeId, directionId = 0) {
  if (!routeId) throw new Error("Pick a line first.");
  const j = await get("/route_patterns", {
    "filter[route]": routeId,
    "filter[direction_id]": directionId,
    include: "representative_trip.stops",
    "fields[route_pattern]": "typicality",
    "fields[stop]": "name",
    "fields[trip]": "headsign",
  });
  const inc = included(j);
  const typical = j.data.filter((p) => p.attributes.typicality === 1);
  const stations = new Map();
  for (const pattern of typical.length ? typical : j.data) {
    const trip = inc.get(`trip:${pattern.relationships.representative_trip.data?.id}`);
    for (const { id } of trip?.relationships.stops.data ?? []) {
      const stop = inc.get(`stop:${id}`);
      const stationId = stop?.relationships.parent_station.data?.id ?? id;
      if (stop && !stations.has(stationId)) stations.set(stationId, { id: stationId, name: stop.attributes.name });
    }
  }
  if (!stations.size) throw new Error(`The MBTA lists no stops for the ${routeId} line in that direction. Pick a different train.`);
  return [...stations.values()];
}

export async function nextTrains(stopId) {
  if (!stopId) throw new Error("Pick a stop first.");
  const j = await get("/predictions", {
    "filter[stop]": stopId,
    "filter[route_type]": "0,1",
    include: "route,trip",
    "fields[prediction]": "arrival_time,departure_time,direction_id",
    "fields[route]": "long_name",
    "fields[trip]": "headsign",
  });
  const inc = included(j);
  const now = Date.now();
  return j.data
    .map((p) => {
      const arrivesAt = timeOf(p.attributes);
      if (!arrivesAt) return null; // cancelled or skipped
      const routeId = p.relationships.route.data.id;
      return {
        routeId,
        line: inc.get(`route:${routeId}`)?.attributes.long_name ?? routeId,
        directionId: p.attributes.direction_id,
        headsign: inc.get(`trip:${p.relationships.trip.data?.id}`)?.attributes.headsign ?? "",
        arrivesAt,
        seconds: Math.round((Date.parse(arrivesAt) - now) / 1000),
      };
    })
    .filter((t) => t && t.seconds >= 0)
    .sort((a, b) => a.seconds - b.seconds);
}

// The soonest trip that has a row at both stops, the first stop before the second.
function pickRide(j, fromId, toId) {
  const inc = included(j);
  const station = (row) => {
    const stop = inc.get(`stop:${row.relationships.stop.data.id}`);
    return stop?.relationships.parent_station.data?.id ?? stop?.id;
  };
  const trips = new Map();
  for (const row of j.data) {
    const trip = row.relationships.trip.data?.id;
    const at = station(row);
    if (!trip || (at !== fromId && at !== toId)) continue;
    if (!trips.has(trip)) trips.set(trip, {});
    trips.get(trip)[at === fromId ? "from" : "to"] = row.attributes;
  }
  const now = Date.now();
  let best;
  for (const { from, to } of trips.values()) {
    if (!from || !to || from.stop_sequence >= to.stop_sequence) continue;
    const boards = Date.parse(from.departure_time ?? from.arrival_time);
    const arrivesAt = to.arrival_time ?? to.departure_time;
    const arrives = Date.parse(arrivesAt);
    if (boards >= now && arrives > boards && (!best || boards < best.boards)) best = { boards, arrives, arrivesAt };
  }
  return best && { seconds: Math.round((best.arrives - best.boards) / 1000), arrivesAt: best.arrivesAt };
}

// The time now in Boston as HH:MM, so the schedule skips trips already gone.
const bostonClock = () => new Intl.DateTimeFormat("en-GB", {
  timeZone: "America/New_York", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
}).format(new Date());

export async function rideSeconds({ fromStopId, toStopId, routeId, directionId }) {
  if (!fromStopId || !toStopId || fromStopId === toStopId) throw new Error("Pick two different stops to ride between.");
  for (const [source, path, extra] of [
    ["prediction", "/predictions", {}],
    ["schedule", "/schedules", { "filter[min_time]": bostonClock() }],
  ]) {
    const j = await get(path, {
      "filter[stop]": `${fromStopId},${toStopId}`,
      "filter[route]": routeId,
      "filter[direction_id]": directionId,
      include: "stop",
      [`fields[${source}]`]: "arrival_time,departure_time,stop_sequence",
      "fields[stop]": "name",
      ...extra,
    });
    const ride = pickRide(j, fromStopId, toStopId);
    if (ride) return { ...ride, source };
  }
  throw new Error("No train on that line runs from the first stop to the second in that direction right now. Check the line, the direction, and the stops.");
}
