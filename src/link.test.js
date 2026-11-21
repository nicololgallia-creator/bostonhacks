import test from "node:test";
import assert from "node:assert/strict";
import { chooseTransports, createLink, joinHref } from "./link.js";

const pick = (hostname, pathname, search = "") => chooseTransports({ hostname, pathname, search });

test("the stage opens the local link and the relay", () => {
  assert.deepEqual(pick("localhost", "/stage.html"), { role: "stage", local: true, relay: true });
  assert.deepEqual(pick("192.168.1.20", "/stage.html"), { role: "stage", local: true, relay: true });
});

test("a phone served by the laptop uses the local link only", () => {
  for (const host of ["localhost", "127.0.0.1", "192.168.0.7", "10.0.0.4", "172.20.10.2", "169.254.3.3", "laptop.local"]) {
    assert.deepEqual(pick(host, "/"), { role: "phone", local: true, relay: false }, host);
  }
});

test("a phone served from anywhere else uses the relay only", () => {
  for (const host of ["platform-piano.vercel.app", "172.32.0.1", "8.8.8.8", "example.com"]) {
    assert.deepEqual(pick(host, "/"), { role: "phone", local: false, relay: true }, host);
  }
});

test("?link= forces one transport", () => {
  assert.deepEqual(pick("localhost", "/", "?link=relay&room=ABCDEFGH"), { role: "phone", local: false, relay: true });
  assert.deepEqual(pick("example.com", "/", "?link=local"), { role: "phone", local: true, relay: false });
  assert.deepEqual(pick("localhost", "/", "?link=nonsense"), { role: "phone", local: true, relay: false });
});

test("joinHref puts the room first and keeps the train's query", () => {
  const q = "?line=Red&dir=0&at=place-pktrm&car=3";
  assert.equal(joinHref("https://piano.example.app", "ABCDEFGH", q), "https://piano.example.app/?room=ABCDEFGH&line=Red&dir=0&at=place-pktrm&car=3");
  assert.equal(joinHref("http://192.168.1.20:5173/", "ABCDEFGH", q), "http://192.168.1.20:5173/?room=ABCDEFGH&line=Red&dir=0&at=place-pktrm&car=3");
});

// A transport that records what it sends and lets the test deliver text as if it came in.
function fake() {
  const t = { sent: [], open: true };
  const factory = (opts) => { t.opts = opts; t.send = (text) => (t.sent.push(text), t.open); t.close = () => {}; return t; };
  return [t, factory];
}

function link(plan = { role: "stage", local: true, relay: true }) {
  const [local, local_] = fake();
  const [relay, relay_] = fake();
  const got = [], status = [], relayStatus = [];
  const l = createLink({
    plan, room: "ABCDEFGH", factories: { local: local_, relay: relay_ },
    onMessage: (m) => got.push(m), onStatus: (s) => status.push(s), onRelayStatus: (s) => relayStatus.push(s),
  });
  return { l, local, relay, got, status, relayStatus };
}

test("a message that arrives on both transports is handled once, without its id", () => {
  const { local, relay, got } = link();
  const text = JSON.stringify({ type: "claim", clientId: "a1", spotId: 2, _m: "Q4ZK0" });
  local.opts.onText(text);
  relay.opts.onText(text);
  assert.deepEqual(got, [{ type: "claim", clientId: "a1", spotId: 2 }]);
  relay.opts.onText(JSON.stringify({ type: "claim", clientId: "a1", spotId: 2, _m: "Q4ZK1" })); // a second claim is a new message
  assert.equal(got.length, 2);
});

test("a stage ignores States, so two stages cannot answer each other, and a phone still gets them", () => {
  const stage = link();
  stage.local.opts.onText(JSON.stringify({ type: "state", status: "lobby", _m: "AAAA1" }));
  assert.equal(stage.got.length, 0);
  const phone = link({ role: "phone", local: true, relay: false });
  phone.local.opts.onText(JSON.stringify({ type: "state", status: "lobby", _m: "AAAA1" }));
  assert.equal(phone.got.length, 1);
});

test("messages with no id (older pages) and junk are handled sensibly", () => {
  const { local, got } = link();
  local.opts.onText(JSON.stringify({ type: "here" }));
  local.opts.onText(JSON.stringify({ type: "here" }));
  local.opts.onText("not json");
  local.opts.onText("42");
  assert.equal(got.length, 2);
});

test("send goes out on every transport with the same id, and the caller's message is not changed", () => {
  const { l, local, relay } = link();
  const msg = { type: "state", status: "lobby" };
  assert.equal(l.send(msg), true);
  assert.deepEqual(msg, { type: "state", status: "lobby" });
  assert.equal(local.sent.length, 1);
  assert.equal(relay.sent[0], local.sent[0]);
  l.send(msg);
  assert.notEqual(JSON.parse(local.sent[1])._m, JSON.parse(local.sent[0])._m);
});

test("send says false only when no transport took the message", () => {
  const { l, local, relay } = link();
  relay.open = false;
  assert.equal(l.send({ type: "here" }), true);
  local.open = false;
  assert.equal(l.send({ type: "here" }), false);
});

test("a phone on the relay opens only the relay, with its role and room", () => {
  const { relay, local } = link({ role: "phone", local: false, relay: true });
  assert.equal(local.opts, undefined);
  assert.equal(relay.opts.role, "phone");
  assert.equal(relay.opts.room, "ABCDEFGH");
});

test("with no room code the relay stays off", () => {
  const warn = console.warn;
  console.warn = () => {};
  try {
    const [relay, relay_] = fake();
    createLink({ plan: { role: "phone", local: false, relay: true }, room: null, factories: { relay: relay_ }, onMessage() {}, onStatus() {}, onRelayStatus() {} });
    assert.equal(relay.opts, undefined);
  } finally { console.warn = warn; }
});

test("status is up when either transport is up, and the relay's own status is reported", () => {
  const { local, relay, status, relayStatus, l } = link();
  relay.opts.onStatus(true);
  local.opts.onStatus(true);
  relay.opts.onStatus(false);
  assert.deepEqual(status, [true]);
  local.opts.onStatus(false);
  assert.deepEqual(status, [true, false]);
  assert.deepEqual(relayStatus, [true, false]);
  assert.equal(l.relayUp(), false);
  relay.opts.onStatus(true);
  assert.equal(l.relayUp(), true);
});
