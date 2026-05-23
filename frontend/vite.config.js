import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],

  server: {
    port: 5173,
    // In development, proxy /api requests to the backend.
    // This means the browser never sees a cross-origin request during dev,
    // so we avoid CORS issues without disabling CORS security in production.
    proxy: {
      "/api": {
        target: "http://localhost:5000",
        changeOrigin: true,
      },
    },
  },
});
