import test from "node:test";
import assert from "node:assert/strict";
import { ALPHABET, isRoom, makeRoom, stageRoom, topics } from "./link-relay.js";

test("the alphabet has 32 distinct letters and digits", () => {
  assert.equal(ALPHABET.length, 32);
  assert.equal(new Set(ALPHABET).size, 32);
});

test("a room code is 8 characters from the alphabet, and different each time", () => {
  const rooms = Array.from({ length: 50 }, () => makeRoom());
  for (const r of rooms) { assert.match(r, /^[A-HJ-NP-Z2-9]{8}$/); assert.ok(isRoom(r)); }
  assert.equal(new Set(rooms).size, 50);
});

test("every byte value maps to a letter, so no byte is unused or out of range", () => {
  const all = makeRoom((a) => a.map((_, i) => i * 37 + 5));
  assert.ok(isRoom(all));
});

test("isRoom rejects codes of the wrong shape", () => {
  for (const bad of [null, undefined, "", "abcdefgh", "ABCDEFG", "ABCDEFGHJ", "ABCDEFG0", "ABCDEFGI", 12345678]) assert.equal(isRoom(bad), false, String(bad));
});

test("topics hold a fixed prefix, the room, and the direction", () => {
  assert.deepEqual(topics("K7Q2M9XA"), { up: "platformpiano/v1/K7Q2M9XA/up", down: "platformpiano/v1/K7Q2M9XA/down" });
});

test("the stage makes a room once and keeps it", () => {
  const data = new Map();
  const store = { getItem: (k) => data.get(k) ?? null, setItem: (k, v) => data.set(k, v) };
  const first = stageRoom(store);
  assert.ok(isRoom(first));
  assert.equal(stageRoom(store), first);
  data.set("pp:room", "not a room");
  assert.ok(isRoom(stageRoom(store))); // a damaged value is replaced
});

test("blocked storage still gives a room", () => {
  const store = { getItem: () => { throw new Error("blocked"); }, setItem: () => {} };
  const room = stageRoom(store);
  assert.ok(isRoom(room));
  assert.equal(stageRoom(store), room);
});
