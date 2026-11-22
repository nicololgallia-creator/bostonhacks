import test from "node:test";
import assert from "node:assert/strict";
import { asksLan, joinBase } from "./address.js";

const lan = "http://192.168.1.20:5173";
const base = (o) => joinBase({ envUrl: "", origin: "https://ttiles.us", relayUp: false, lanUrl: null, ...o });

test("a public floor never asks /lan and always has its own origin, relay up or down, /lan failing or not", () => {
  for (const hostname of ["ttiles.us", "platform-piano.vercel.app", "8.8.8.8", "172.32.0.1"]) {
    assert.equal(asksLan(hostname), false, hostname);
    for (const relayUp of [true, false]) assert.equal(base({ hostname, relayUp }), "https://ttiles.us", hostname);
  }
});

test("a floor on the laptop's network asks /lan", () => {
  for (const hostname of ["localhost", "127.0.0.1", "192.168.1.20", "10.0.0.4", "172.20.10.2", "laptop.local"]) assert.equal(asksLan(hostname), true, hostname);
});

test("on the laptop's network the QR code holds the laptop's address, or nothing when /lan gave none", () => {
  for (const hostname of ["localhost", "192.168.1.20"]) {
    assert.equal(base({ hostname, lanUrl: lan }), lan);
    assert.equal(base({ hostname, lanUrl: lan, relayUp: true }), lan); // no public address set: the relay changes nothing
    assert.equal(base({ hostname, lanUrl: null }), null); // /lan failed or listed no address
  }
});

test("with a public address set, the laptop's floor switches to it when the relay is up and back when it is down", () => {
  const set = { hostname: "localhost", envUrl: "https://ttiles.us", origin: "http://localhost:5173" };
  assert.equal(joinBase({ ...set, relayUp: true, lanUrl: lan }), "https://ttiles.us");
  assert.equal(joinBase({ ...set, relayUp: false, lanUrl: lan }), lan);
  assert.equal(joinBase({ ...set, relayUp: true, lanUrl: null }), "https://ttiles.us"); // no Wi-Fi, but the relay is up
  assert.equal(joinBase({ ...set, relayUp: false, lanUrl: null }), null);
});
