// The link between the phone page and the stage page: every message one page sends
// goes to every other page that is connected. One stage, so no rooms.
// It rides on Vite's own server, so there is one command and one port.
import { WebSocketServer } from "ws";

export function linkPlugin() {
  const attach = (server) => {
    const wss = new WebSocketServer({ noServer: true });
    server.httpServer.on("upgrade", (req, socket, head) => {
      if (req.url !== "/link") return; // leave Vite's own reload socket alone
      wss.handleUpgrade(req, socket, head, (ws) => wss.emit("connection", ws));
    });
    wss.on("connection", (ws) => {
      ws.on("message", (data, isBinary) => {
        if (isBinary || data.length > 4096) return; // only small text messages are relayed
        for (const other of wss.clients) if (other !== ws && other.readyState === 1) other.send(data.toString());
      });
    });
  };
  return { name: "platform-piano-link", configureServer: attach, configurePreviewServer: attach };
}
