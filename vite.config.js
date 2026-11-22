import { defineConfig } from "vite";
import { linkPlugin } from "./server/link.mjs";

// Folders builders download into or write reports to. Watching them crashed the server
// (EBUSY on a half-downloaded file, Sat 12:10 PM), and nothing in them is part of the app.
const notWatched = ["**/qa/**", "**/shots/**", "**/reports/**", "**/notes/**", "**/docs/**", "**/tools/**"];

export default defineConfig({
  plugins: [linkPlugin()],
  server: { host: true, port: 5173, strictPort: true, watch: { ignored: notWatched } },
  preview: { host: true, port: 5173, strictPort: true },
  build: { rollupOptions: { input: ["index.html", "stage.html", "track.html", "seats.html","floor-pilot.html", "review.html", "poster.html"] } },
});
