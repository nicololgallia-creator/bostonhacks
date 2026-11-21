// Client side of the link between the phone and the stage. Message shapes are in PLAN.md under "Data shapes".
// Two ways to carry the same messages:
//   local: a WebSocket to /link on the laptop's dev server (server/link.mjs). For pages the laptop serves.
//   relay: a public MQTT broker and a private room code (link-relay.js). For the hosted phone page, which
//          cannot reach the laptop. The stage opens both, so a hosted phone and a phone on the Wi-Fi reach it.
// Both reconnect by themselves, because phones drop off Wi-Fi all the time.
import { isRoom, makeCode, openRelay, stageRoom } from "./link-relay.js";

export { stageRoom };

// Hosts that are the laptop or its own network: localhost, *.local, and the private ranges.
const onLaptopNetwork = (host) =>
  /^(localhost|\[::1\]|127\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.)/.test(host) || host.endsWith(".local");

// Which transports a page opens. ?link=relay or ?link=local forces one. The stage page is the only one that opens both.
export function chooseTransports({ hostname, pathname, search }) {
  const role = /\/stage(\.html)?$/.test(pathname) ? "stage" : "phone";
  const forced = new URLSearchParams(search).get("link");
  if (forced === "relay" || forced === "local") return { role, local: forced === "local", relay: forced === "relay" };
  const local = onLaptopNetwork(hostname);
  return { role, local, relay: role === "stage" || !local };
}

// The address a phone is sent to: the base, the room, then the train's own query ("?line=..&dir=..").
export const joinHref = (base, room, trainQuery) => `${base.replace(/\/?$/, "/")}?room=${room}&${trainQuery.replace(/^\?/, "")}`;

const localTransport = ({ onText, onStatus }) => {
  let ws;
  let closed = false;
  const connect = () => {
    ws = new WebSocket(`${location.protocol === "https:" ? "wss" : "ws"}://${location.host}/link`);
    ws.onopen = () => onStatus(true);
    ws.onmessage = (e) => onText(e.data);
    ws.onclose = () => { onStatus(false); if (!closed) setTimeout(connect, 1000); };
  };
  connect();
  return {
    send: (text) => { if (ws.readyState === 1) ws.send(text); return ws.readyState === 1; },
    close: () => { closed = true; ws.close(); },
  };
};

// Joins the chosen transports into one link. Every message carries a short id so a message that comes
// in by two routes is handled once; the id is taken off before the message is handed on.
export function createLink({ plan, room, factories, onMessage, onStatus, onRelayStatus }) {
  const seen = new Set();
  const prefix = makeCode(4);
  let counter = 0;
  const up = {};
  const changed = (name) => (value) => {
    const before = !!(up.local || up.relay);
    up[name] = value;
    if (name === "relay") onRelayStatus(value);
    const now = !!(up.local || up.relay);
    if (before !== now) onStatus(now);
  };
  const receive = (text) => {
    let msg;
    try { msg = JSON.parse(text); } catch { return; } // not ours
    if (!msg || typeof msg !== "object") return;
    if (plan.role === "stage" && msg.type === "state") return; // States come from stages. Two stages on one link would answer each other forever.
    const id = msg._m;
    delete msg._m;
    if (id !== undefined) {
      if (seen.has(id)) return;
      seen.add(id);
      if (seen.size > 256) seen.delete(seen.values().next().value);
    }
    onMessage(msg);
  };

  const transports = [];
  for (const name of ["local", "relay"]) {
    if (!plan[name]) continue;
    if (name === "relay" && !isRoom(room)) { console.warn("This page has no room code, so the relay is off."); continue; }
    transports.push(factories[name]({ room, role: plan.role, onText: receive, onStatus: changed(name) }));
  }
  return {
    send(msg) {
      const text = JSON.stringify({ ...msg, _m: prefix + counter++ });
      return transports.map((t) => t.send(text)).some(Boolean);
    },
    close: () => transports.forEach((t) => t.close()),
    relayUp: () => up.relay === true,
  };
}

// onRelayStatus(up) is optional: the stage uses it to choose which address the QR code holds.
export function openLink(onMessage, onStatus = () => {}, onRelayStatus = () => {}) {
  const plan = chooseTransports(location);
  const room = plan.role === "stage" ? stageRoom() : new URLSearchParams(location.search).get("room")?.toUpperCase();
  return createLink({ plan, room, factories: { local: localTransport, relay: openRelay }, onMessage, onStatus, onRelayStatus });
}
