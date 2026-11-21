// The link between the phone page and the stage page: every message one page sends
// goes to every other page that is connected. One stage, so no rooms.
// It rides on the dev server, so there is one command and one port.
import os from "node:os";
import { WebSocketServer } from "ws";

// The addresses a phone on the same Wi-Fi or hotspot can open. The stage runs on localhost
// (the browser only allows the camera there), so it asks the server for these to draw the QR code.
function lanUrls(port) {
  return Object.values(os.networkInterfaces())
    .flat()
    .filter((a) => a && a.family === "IPv4" && !a.internal)
    .map((a) => `http://${a.address}:${port}/`);
}

export function linkPlugin() {
  const attach = (server) => {
    server.middlewares.use("/lan", (req, res) => {
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ urls: lanUrls(req.socket.localPort ?? server.config.server.port ?? 5173) })); // the port this request came in on: the built copy runs on another port than the dev server
    });

    const wss = new WebSocketServer({ noServer: true });
    server.httpServer.on("upgrade", (req, socket, head) => {
      if (req.url !== "/link") return; // leave the dev server's own reload socket alone
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
