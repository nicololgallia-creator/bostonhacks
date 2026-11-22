// The relay on several brokers at once, with fake brokers (no network). Built the way the app builds it: openRelay under createLink.
import test from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { createLink } from "./link.js";
import { openRelay } from "./link-relay.js";

const A = "wss://a.example:1/mqtt", B = "wss://b.example:1/mqtt", C = "wss://c.example:1/mqtt";
const tick = (ms = 5) => new Promise((r) => setTimeout(r, ms));
const open = []; // every link a test made: closed when it ends, or the retry timers keep the process alive
const quiet = async (fn) => { // the relay logs each connection; keep test output small
  const w = console.warn, i = console.info;
  console.warn = console.info = () => {};
  try { return await fn(); } finally { console.warn = w; console.info = i; open.splice(0).forEach((l) => l.close()); }
};

// Each URL is a broker. A client reaches only the brokers named in `reach`. A broker hands a message to every other
// subscriber of the topic on that same broker, in order, at once or after delay[url] ms.
function world() {
  const subs = [];
  const w = { down: new Set(), clients: [], published: [], delay: {}, reconnects: [] };
  w.loader = (reach) => async () => (url) => {
    const c = Object.assign(new EventEmitter(), { connected: false, url });
    c.subscribe = (topic, _opts, cb) => { subs.push({ c, topic }); cb(null); };
    c.publish = (topic, text) => {
      w.published.push({ url, topic });
      for (const s of subs) {
        if (s.c.url !== url || s.topic !== topic || s.c === c || !s.c.connected || w.down.has(url)) continue;
        const deliver = () => s.c.emit("message", topic, Buffer.from(text));
        if (w.delay[url]) setTimeout(deliver, w.delay[url]); else deliver();
      }
    };
    c.end = () => { c.connected = false; c.emit("close"); };
    w.clients.push(c);
    // Like mqtt.js with reconnectPeriod 0: an attempt that fails says "error" then "close", and nothing retries until reconnect().
    const attempt = () => queueMicrotask(() => {
      if (reach.includes(url) && !w.down.has(url)) { c.connected = true; c.emit("connect"); } else { c.emit("error", new Error("getaddrinfo ENOTFOUND")); c.emit("close"); }
    });
    c.reconnect = () => { w.reconnects.push(url); attempt(); };
    attempt();
    return c;
  };
  w.kill = (url) => { // the broker drops everyone and answers nobody
    w.down.add(url);
    for (const c of w.clients) if (c.url === url && c.connected) { c.connected = false; c.emit("close"); }
  };
  return w;
}

function pair(w, floorReach, phoneReach, brokers = [A, B, C]) {
  const out = { floor: [], phone: [], floorUp: [], phoneUp: [] };
  const mk = (role, reach, got, upLog) => createLink({
    plan: { role, local: false, relay: true }, room: "ABCDEFGH",
    factories: { relay: (o) => openRelay({ ...o, brokers, loadConnect: w.loader(reach) }) },
    onMessage: (m) => got.push(m), onStatus: (s) => upLog.push(s), onRelayStatus() {},
  });
  out.floorLink = mk("stage", floorReach, out.floor, out.floorUp);
  out.phoneLink = mk("phone", phoneReach, out.phone, out.phoneUp);
  open.push(out.floorLink, out.phoneLink);
  return out;
}

test("the floor and a phone meet when each reaches a different pair of brokers that share only one", () => quiet(async () => {
  const p = pair(world(), [A, B], [B, C]);
  await tick();
  assert.deepEqual(p.floorUp, [true]);
  assert.deepEqual(p.phoneUp, [true]);
  p.phoneLink.send({ type: "ready", clientId: "p1" });
  p.floorLink.send({ type: "state", status: "lobby" });
  await tick();
  assert.deepEqual(p.floor, [{ type: "ready", clientId: "p1" }]);
  assert.deepEqual(p.phone, [{ type: "state", status: "lobby" }]);
}));

test("with no broker in common nothing is delivered", () => quiet(async () => {
  const p = pair(world(), [A], [C]);
  await tick();
  p.phoneLink.send({ type: "ready" });
  await tick();
  assert.equal(p.floor.length, 0);
}));

test("a message sent while all three brokers are up goes out on each and is handled once", () => quiet(async () => {
  const w = world();
  const p = pair(w, [A, B, C], [A, B, C]);
  await tick();
  p.phoneLink.send({ type: "ready", clientId: "p1" });
  p.phoneLink.send({ type: "claim", clientId: "p1", spotId: 2 });
  await tick();
  assert.equal(w.published.filter((m) => m.topic.endsWith("/up")).length, 6); // 2 messages on 3 brokers
  assert.deepEqual(p.floor.map((m) => m.type), ["ready", "claim"]); // handled twice, not six times
}));

test("a seat tapped once is held once: the toggle is not delivered again by the other brokers", () => quiet(async () => {
  const p = pair(world(), [A, B, C], [A, B, C]);
  await tick();
  const held = new Set();
  const toggle = (m) => (held.has(m.spotId) ? held.delete(m.spotId) : held.add(m.spotId));
  p.phoneLink.send({ type: "claim", clientId: "p1", spotId: 1 });
  await tick();
  p.floor.splice(0).forEach(toggle);
  assert.deepEqual([...held], [1]);
}));

test("a broker that dies mid-game changes nothing the players see, and the link stays up", () => quiet(async () => {
  const w = world();
  const p = pair(w, [A, B, C], [A, B, C]);
  await tick();
  w.kill(A);
  p.floorLink.send({ type: "state", status: "playing" });
  p.phoneLink.send({ type: "here" });
  await tick();
  assert.deepEqual(p.phone.map((m) => m.status), ["playing"]);
  assert.deepEqual(p.floor.map((m) => m.type), ["here"]);
  assert.deepEqual(p.floorUp, [true]); // never flickered to down
  assert.deepEqual(p.phoneUp, [true]);
  w.kill(B);
  w.kill(C);
  assert.deepEqual(p.phoneUp, [true, false]); // all gone: now it says so, and send says so too
  assert.equal(p.phoneLink.send({ type: "here" }), false);
}));

test("an older State that comes in after a newer one is dropped", () => quiet(async () => {
  const w = world();
  w.delay[C] = 30; // C is slow
  const p = pair(w, [A, C], [A, C]);
  await tick();
  w.down.add(A); // State 1 reaches only the slow broker
  p.floorLink.send({ type: "state", status: "lobby", n: 1 });
  w.down.delete(A);
  p.floorLink.send({ type: "state", status: "countdown", n: 2 }); // State 2 reaches both; the fast one wins
  await tick(80); // State 1, and State 2's second copy, now arrive by C
  assert.deepEqual(p.phone.map((m) => m.n), [2]);
}));

test("the relay drops a State with a lower count from the same sender, and nothing else", () => quiet(async () => {
  const w = world();
  const got = [];
  const relay = openRelay({ room: "ABCDEFGH", role: "phone", onText: (t) => got.push(t.startsWith("{") ? JSON.parse(t) : { n: t }), onStatus() {}, brokers: [A], loadConnect: w.loader([A]) });
  open.push(relay);
  await tick();
  const feed = (m) => w.clients[0].emit("message", "t", Buffer.from(typeof m === "string" ? m : JSON.stringify(m)));
  feed({ type: "state", _m: "ABCD5", n: "five" });
  feed({ type: "state", _m: "ABCD4", n: "four" }); // older: dropped
  feed({ type: "state", _m: "ABCD5", n: "five again" }); // same count: passed on (link.js drops repeats)
  feed({ type: "state", _m: "WXYZ1", n: "other sender" }); // another sender has its own count
  feed({ type: "claim", _m: "ABCD3", n: "claim" }); // not a State: never ordered
  feed({ type: "state", n: "no id" }); // no id: cannot be compared
  feed("not json");
  assert.deepEqual(got.map((m) => m.n), ["five", "five again", "other sender", "claim", "no id", "not json"]); // the link, not the relay, ignores what is not ours
}));

test("a reconnecting broker is not double counted, and a broker that never answers does not stop the others", () => quiet(async () => {
  const w = world();
  const p = pair(w, [A, B], [A, B, C]); // C answers nobody
  await tick();
  w.clients.find((c) => c.url === B && c.connected).emit("connect"); // a reconnect of a broker that is already counted
  p.phoneLink.send({ type: "here" });
  await tick();
  assert.equal(p.floor.length, 1);
  assert.deepEqual(p.phoneUp, [true]);
}));

test("a broker that drops comes back by itself, with a pause that grows, and the others are not disturbed", () => quiet(async () => {
  const w = world();
  const p = pair(w, [A, B], [A, B]);
  await tick();
  w.kill(A); // A drops everyone; B carries on
  w.down.delete(A); // ... and is reachable again
  await tick(2200); // first retry after 1 s; if it were to fail, the next waits 2 s
  assert.equal(w.reconnects.filter((u) => u === A).length, 2); // floor and phone, once each
  assert.equal(w.reconnects.filter((u) => u === B).length, 0);
  assert.deepEqual(p.phoneUp, [true]);
  p.phoneLink.send({ type: "here" });
  await tick();
  assert.equal(p.floor.length, 1); // once, though two brokers carry it again
}));

test("an unreachable broker is retried 1, 2, 4 seconds apart, not every second", () => quiet(async () => {
  const w = world();
  pair(w, [A], [A], [A, B]); // B never answers
  await tick(3500);
  assert.equal(w.reconnects.filter((u) => u === B).length, 4); // floor and phone: at 1 s and at 3 s each
}));

test("close ends every connection and reports down once", () => quiet(async () => {
  const w = world();
  const status = [];
  const relay = openRelay({ room: "ABCDEFGH", role: "stage", onText() {}, onStatus: (s) => status.push(s), brokers: [A, B, C], loadConnect: w.loader([A, B, C]) });
  await tick();
  relay.close();
  assert.deepEqual(status, [true, false]);
  assert.equal(w.clients.every((c) => !c.connected), true);
  assert.equal(relay.send("x"), false);
}));
