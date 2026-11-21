import test from "node:test";
import assert from "node:assert/strict";
import { trainFromQuery, trainFromState, sameTrain, DEFAULT_TRAIN } from "./train.js";

test("the poster's address names the train", () => {
  assert.deepEqual(trainFromQuery("?line=Red&dir=0&at=place-pktrm&car=3"), { line: "Red", directionId: 0, atStopId: "place-pktrm", car: 3 });
});

test("an address with none of the four parts names no train", () => {
  assert.equal(trainFromQuery(""), null);
  assert.equal(trainFromQuery("?mock=1"), null);
});

test("a part that is missing or wrong takes the default", () => {
  assert.deepEqual(trainFromQuery("?line=Orange"), { ...DEFAULT_TRAIN, line: "Orange" });
  assert.equal(trainFromQuery("?dir=7&car=0").directionId, DEFAULT_TRAIN.directionId);
  assert.equal(trainFromQuery("?dir=7&car=0").car, DEFAULT_TRAIN.car);
  assert.equal(trainFromQuery("?car=40").car, DEFAULT_TRAIN.car);
  assert.equal(trainFromQuery("?car=abc").car, DEFAULT_TRAIN.car);
});

test("the stage's train: a stop name that is only its id is no name", () => {
  const sent = { line: "Red", directionId: 0, headsign: "Ashmont/Braintree", atStopId: "place-pktrm", atStopName: "place-pktrm", car: 3 };
  assert.equal(trainFromState(sent).atStopName, undefined);
  assert.equal(trainFromState({ ...sent, atStopName: "Park Street" }).atStopName, "Park Street");
  assert.equal(trainFromState(null), null);
  assert.equal(trainFromState({}), null);
});

test("two trains are the same when line, direction, stop and car agree", () => {
  const a = trainFromQuery("?line=Red&dir=0&at=place-pktrm&car=3");
  assert.ok(sameTrain(a, { ...a, headsign: "x" }));
  assert.ok(!sameTrain(a, { ...a, car: 4 }));
});
