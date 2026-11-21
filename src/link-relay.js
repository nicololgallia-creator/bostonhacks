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

// Tested from a browser over wss on 21 Nov 2026 (see reports/relay.md). Each gets 4 seconds, then the next.
export const BROKERS = ["wss://broker.emqx.io:8084/mqtt", "wss://test.mosquitto.org:8081", "wss://broker.hivemq.com:8884/mqtt"];
const GIVE_UP_MS = 4000;
const MAX_TEXT = 4096; // the same cap the local server puts on a message

const ROOM_KEY = "pp:room";
let remembered = null;
// The stage keeps its room, so a reloaded stage is still the one the phones scanned.
export function stageRoom(store = globalThis.localStorage) {
  try {
    let room = store.getItem(ROOM_KEY);
    if (!isRoom(room)) store.setItem(ROOM_KEY, (room = makeRoom()));
    return room;
  } catch { // storage blocked: the room lasts as long as this page
    return (remembered ??= makeRoom());
  }
}

// Loaded only when a relay is wanted, so the stage and the phone start without the library.
const loadMqtt = () => import("mqtt").then((m) => m.connect ?? m.default.connect);

// { send(text), close() }. onStatus(true) comes once the room's topic is subscribed.
export function openRelay({ room, role, onText, onStatus, brokers = BROKERS }) {
  const t = topics(room);
  const [listenOn, talkOn] = role === "stage" ? [t.up, t.down] : [t.down, t.up];
  let client = null;
  let closed = false;
  let up = false;
  let turn = 0;
  let timer;
  const setUp = (v) => { if (v !== up) { up = v; onStatus(v); } };
  const next = () => { client?.end(true); client = null; turn++; attempt(); };
  const wait = (fn) => { clearTimeout(timer); timer = setTimeout(fn, GIVE_UP_MS); };

  async function attempt() {
    if (closed) return;
    let connect;
    try { connect = await loadMqtt(); } catch (err) { console.warn("Relay library did not load:", err.message); return wait(attempt); }
    if (closed) return;
    const url = brokers[turn % brokers.length];
    const c = (client = connect(url, { connectTimeout: GIVE_UP_MS, reconnectPeriod: 1000, keepalive: 30, clean: true }));
    wait(next); // no subscription in 4 seconds: try the next broker
    c.on("connect", () => c.subscribe(listenOn, { qos: 0 }, (err) => {
      if (err || c !== client) return;
      clearTimeout(timer);
      console.info("Relay connected:", new URL(url).host);
      setUp(true);
    }));
    c.on("message", (_topic, payload) => onText(payload.toString()));
    c.on("error", (err) => console.warn("Relay error:", new URL(url).host, err.message));
    c.on("close", () => { // mqtt retries by itself; a connection that was up and cannot come back in 4 seconds moves on
      if (c !== client) return;
      const wasUp = up;
      setUp(false);
      if (wasUp) wait(next);
    });
  }
  attempt();

  return {
    send(text) {
      if (!up || text.length > MAX_TEXT) return false;
      client.publish(talkOn, text, { qos: 0 });
      return true;
    },
    close() { closed = true; clearTimeout(timer); client?.end(true); setUp(false); },
  };
}
