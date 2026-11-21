import { defineConfig } from "vite";
import { linkPlugin } from "./server/link.mjs";

export default defineConfig({
  plugins: [linkPlugin()],
  server: { host: true, port: 5173, strictPort: true },
  preview: { host: true, port: 5173, strictPort: true },
  build: { rollupOptions: { input: ["index.html", "stage.html", "track.html"] } },
});
