import test from "node:test";
import assert from "node:assert/strict";
import { parseCode, ownAddress, codeProblem } from "./scan.js";

const OURS = "https://tiles.example/?room=K7M2QX9A&line=Red&dir=0&at=place-knncl&car=3";

test("a good link gives the room and the train", () => {
  assert.deepEqual(parseCode(OURS), { room: "K7M2QX9A", line: "Red", dir: "0", at: "place-knncl", car: "3" });
});

test("a link to another site with our parameters is read for the values only", () => {
  const parts = parseCode("https://evil.example/login?room=k7m2qx9a&line=Green-B&dir=1&at=place-bucen&car=2&next=//evil.example&token=abc");
  assert.deepEqual(parts, { room: "K7M2QX9A", line: "Green-B", dir: "1", at: "place-bucen", car: "2" });
  const address = ownAddress(parts, { origin: "https://tiles.example", pathname: "/" });
  assert.equal(address, "https://tiles.example/?room=K7M2QX9A&line=Green-B&dir=1&at=place-bucen&car=2");
  assert.ok(!address.includes("evil") && !address.includes("token"));
});

test("parts that are wrong are left out, a bad room is no code", () => {
  assert.deepEqual(parseCode("https://x.example/?room=K7M2QX9A&line=<script>&dir=7&at=a b&car=99"), { room: "K7M2QX9A" });
  assert.deepEqual(parseCode("https://x.example/?room=K7M2QX9A&car=3.5&line=" + "L".repeat(41)), { room: "K7M2QX9A" });
  assert.equal(parseCode("https://x.example/?room=K7M2QX9"), null);   // 7 characters
  assert.equal(parseCode("https://x.example/?room=K7M2QX9O"), null);  // an O is not in the alphabet
  assert.equal(parseCode("https://x.example/?room=K7M2QX9AB"), null); // 9 characters
  assert.equal(parseCode("https://x.example/?line=Red&dir=0"), null); // no room
});

test("plain text, a javascript link, other schemes and odd input are not codes", () => {
  for (const text of ["hello", "", "   ", "WIFI:S:home;T:WPA;P:secret;;", "javascript:alert(1)", "javascript:void(0)?room=K7M2QX9A", "data:text/html,<b>?room=K7M2QX9A</b>", "intent://x#Intent;scheme=https;end", "ftp://x.example/?room=K7M2QX9A", "//x.example/?room=K7M2QX9A", null, undefined, 42, "https://x.example/?room=K7M2QX9A&" + "a".repeat(3000)]) {
    assert.equal(parseCode(text), null, String(text).slice(0, 40));
  }
});

test("an 8-character code on its own is a room with no train, in either case and with spaces around it", () => {
  assert.deepEqual(parseCode("K7M2QX9A"), { room: "K7M2QX9A" });
  assert.deepEqual(parseCode("  k7m2qx9a\n"), { room: "K7M2QX9A" });
  assert.equal(parseCode("K7M2QX9"), null);
  assert.equal(parseCode("K7M2-X9A"), null);
});

test("the app's own address keeps its path and holds only the parsed values", () => {
  assert.equal(ownAddress({ room: "K7M2QX9A" }, { origin: "http://localhost:4173", pathname: "/phone/" }), "http://localhost:4173/phone/?room=K7M2QX9A");
});

test("a typed code that is wrong says why", () => {
  assert.equal(codeProblem("k7m2 qx9a"), "");
  assert.equal(codeProblem("K7M2-QX9A"), "");
  assert.match(codeProblem(""), /8 letters and numbers/);
  assert.match(codeProblem("K7M2QX9"), /8 characters\. You typed 7/);
  assert.match(codeProblem("K7M2QX9O"), /never has 0, 1, I, or O/);
  assert.match(codeProblem("K7M2QX9!"), /only letters and numbers/);
});
