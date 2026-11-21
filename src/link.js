// Client side of the link in server/link.mjs. Message shapes are in PLAN.md under "Data shapes".
// It reconnects by itself, because phones drop off Wi-Fi all the time.
export function openLink(onMessage, onStatus = () => {}) {
  let ws;
  let closed = false;
  const connect = () => {
    ws = new WebSocket(`${location.protocol === "https:" ? "wss" : "ws"}://${location.host}/link`);
    ws.onopen = () => onStatus(true);
    ws.onmessage = (e) => { try { onMessage(JSON.parse(e.data)); } catch { /* not ours */ } };
    ws.onclose = () => { onStatus(false); if (!closed) setTimeout(connect, 1000); };
  };
  connect();
  return {
    send: (msg) => { if (ws.readyState === 1) ws.send(JSON.stringify(msg)); return ws.readyState === 1; },
    close: () => { closed = true; ws.close(); },
  };
}
