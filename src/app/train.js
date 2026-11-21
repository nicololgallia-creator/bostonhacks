// The train this phone is on. The poster's QR code opens the app with ?line=Green-B&dir=1&at=place-bucen&car=2.
// With no address the stage's State says which train it is; with no stage either, the defaults below are used.
export const DEFAULT_TRAIN = { line: "Green-B", directionId: 1, atStopId: "place-bucen", car: 2 };

// The train an address names, or null when it names none of the four parts. A part that is missing or wrong takes the default's.
export function trainFromQuery(search) {
  const q = new URLSearchParams(search);
  if (!["line", "dir", "at", "car"].some((k) => q.has(k))) return null;
  const car = Number(q.get("car"));
  return {
    line: q.get("line") || DEFAULT_TRAIN.line,
    directionId: q.get("dir") === "0" ? 0 : q.get("dir") === "1" ? 1 : DEFAULT_TRAIN.directionId,
    atStopId: q.get("at") || DEFAULT_TRAIN.atStopId,
    car: Number.isInteger(car) && car >= 1 && car <= 12 ? car : DEFAULT_TRAIN.car,
  };
}

// The train the stage reports, in the same shape plus the names it knows. A stop name that is only the stop's id (the stage
// has not looked it up yet) is no name.
export const trainFromState = (t) => (t && t.line
  ? { line: t.line, directionId: t.directionId, atStopId: t.atStopId, car: t.car, headsign: t.headsign, atStopName: t.atStopName === t.atStopId ? undefined : t.atStopName }
  : null);

export const sameTrain = (a, b) => a.line === b.line && a.directionId === b.directionId && a.atStopId === b.atStopId && a.car === b.car;
