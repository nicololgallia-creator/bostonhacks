import test from "node:test";
import assert from "node:assert/strict";
import { LINES, seatsOf, seatOf, lineOf } from "./lines.js";
import { themeFor } from "../game/floor-look.js";

test("every line has four distinct seat colours, none the line's own", () => {
  for (const id of Object.keys(LINES)) {
    const seats = seatsOf(id);
    assert.equal(seats.length, 4, id);
    assert.equal(new Set(seats.map((s) => s.fill)).size, 4, id);
    assert.ok(!seats.some((s) => s.fill === lineOf(id).hero), id);
  }
});

test("the phone's seat colours are the floor's", () => {
  for (const id of Object.keys(LINES)) {
    const floor = themeFor(id).seats.map((s) => ({ fill: s.fill, ink: s.text }));
    assert.deepEqual(seatsOf(id), floor, id);
  }
});

test("a seat number picks its colour, wrapping after four", () => {
  assert.deepEqual(seatOf("Red", 1), seatsOf("Red")[0]);
  assert.deepEqual(seatOf("Red", 4), seatsOf("Red")[3]);
  assert.deepEqual(seatOf("Red", 5), seatsOf("Red")[0]);
});
