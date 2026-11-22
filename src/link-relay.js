// The internet half of the link. A hosted (https) phone page cannot open a WebSocket to the laptop, so
// phone and stage meet on a free public MQTT broker instead, in a topic named by a private room code.
// The room code is the only secret: the brokers are public, so anyone who knows it can read the room.
// Messages are the same JSON text as on the local link, and carry only seat numbers, scores and the train.

// Eight characters from 32 (no I or O), so every random byte maps to a letter with no bias: 40 bits.
export const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export const makeCode = (length, random = (a) => crypto.getRandomValues(a)) =>
  Array.from(random(new Uint8Array(length)), (b) => ALPHABET[b & 31]).join("");
export const makeRoom = (random) => makeCode(8, random);
export const isRoom = (s) => typeof s === "string" && /^[A-HJ-NP-Z2-9]{8}$/.test(s);

// The stage listens on up and talks on down; a phone does the reverse.
export const topics = (room) => ({ up: `platformpiano/v1/${room}/up`, down: `platformpiano/v1/${room}/down` });

// Tested from a browser over wss on 21 Nov 2026 (see reports/relay.md). Both sides use every one of them at the same time,
// so a floor and a phone meet as long as they can reach one broker in common.
export const BROKERS = ["wss://broker.emqx.io:8084/mqtt", "wss://test.mosquitto.org:8081", "wss://broker.hivemq.com:8884/mqtt"];
const CONNECT_MS = 4000;
const MAX_TEXT = 4096; // the same cap the local server puts on a message

const ROOM_KEY = "pp:room";
let remembered = null;
// The stage keeps its room, so a reloaded stage is still the one the phones scanned.
// A printed poster holds one fixed room for its car, so the stage can be told to use that room: ?room=XXXXXXXX on the
// stage page sets and saves it. A value that is not a room code is ignored.
export function stageRoom(store = globalThis.localStorage, search = globalThis.location?.search ?? "") {
  const asked = new URLSearchParams(search).get("room")?.toUpperCase();
  try {
    if (isRoom(asked)) store.setItem(ROOM_KEY, asked);
    let room = store.getItem(ROOM_KEY);
    if (!isRoom(room)) store.setItem(ROOM_KEY, (room = makeRoom()));
    return room;
  } catch { // storage blocked: the room lasts as long as this page
    return (remembered ??= isRoom(asked) ? asked : makeRoom());
  }
}

// Loaded only when a relay is wanted, so the stage and the phone start without the library.
const loadMqtt = () => import("mqtt").then((m) => m.connect ?? m.default.connect);

// A State carries the sender's message id (link.js: four letters, then a count that only goes up). The same State comes in
// once for each broker, and one that lost its way on a slow broker can come in after a newer one. Both are harmless here:
//   same message twice: link.js already handles a message id once, so a toggle sent once takes effect once.
//   older State after a newer one: dropped below, so a phone's screen never goes back.
const idOf = (msg) => /^(.{4})(\d+)$/.exec(msg._m ?? "");

// { send(text), close() }. onStatus(true) once any broker has the room's topic subscribed, onStatus(false) when none has.
// Every broker is its own connection: one that fails or drops is retried by the mqtt library and disturbs no other.
// loadConnect is for tests.
export function openRelay({ room, role, onText, onStatus, brokers = BROKERS, loadConnect = loadMqtt }) {
  const t = topics(room);
  const [listenOn, talkOn] = role === "stage" ? [t.up, t.down] : [t.down, t.up];
  const clients = [];
  const live = new Set(); // the clients that are connected and subscribed
  const newest = new Map(); // sender -> the highest State count seen from it
  let closed = false;
  let up = false;
  let timer; // the library load retry
  const timers = new Set(); // each broker's reconnect pause
  const refresh = () => { if ((live.size > 0) !== up) { up = !up; onStatus(up); } };

  // True for a State older than one already taken from the same sender.
  function stale(text) {
    let msg;
    try { msg = JSON.parse(text); } catch { return false; } // the link ignores what is not ours
    const id = msg?.type === "state" ? idOf(msg) : null;
    if (!id) return false;
    const [, sender, count] = id;
    if (Number(count) < (newest.get(sender) ?? -1)) return true;
    newest.set(sender, Number(count));
    if (newest.size > 64) newest.delete(newest.keys().next().value);
    return false;
  }

  function join(connect, url) {
    const host = new URL(url).host;
    let warned = false;
    let fails = 0;
    // The library's own reconnect repeats every second for ever, which floods the console when a broker is unreachable.
    // This one is the same retry with a pause that grows to 8 seconds.
    const c = connect(url, { connectTimeout: CONNECT_MS, reconnectPeriod: 0, keepalive: 30, clean: true, queueQoSZero: false });
    c.on("connect", () => c.subscribe(listenOn, { qos: 0 }, (err) => {
      if (err || closed || !c.connected) return;
      warned = false;
      fails = 0;
      live.add(c);
      console.info("Relay connected:", host);
      refresh();
    }));
    c.on("message", (_topic, payload) => {
      const text = payload.toString();
      if (!stale(text)) onText(text);
    });
    c.on("error", (err) => { if (!warned) console.warn("Relay error:", host, err.message); warned = true; }); // mqtt retries every second; say it once
    c.on("close", () => {
      live.delete(c);
      refresh();
      if (closed) return;
      const wait = setTimeout(() => { timers.delete(wait); c.reconnect(); }, Math.min(1000 * 2 ** fails++, 8000));
      timers.add(wait);
    });
    return c;
  }

  async function begin() {
    let connect;
    try { connect = await loadConnect(); } catch (err) { console.warn("Relay library did not load:", err.message); timer = setTimeout(begin, CONNECT_MS); return; }
    if (!closed) for (const url of brokers) clients.push(join(connect, url));
  }
  begin();

  return {
    // Goes out on every broker that is up. One that is down is skipped, not queued: a late State would be stale.
    send(text) {
      if (text.length > MAX_TEXT) return false;
      for (const c of live) c.publish(talkOn, text, { qos: 0 });
      return live.size > 0;
    },
    close() { closed = true; clearTimeout(timer); timers.forEach(clearTimeout); clients.forEach((c) => c.end(true)); live.clear(); refresh(); },
  };
}