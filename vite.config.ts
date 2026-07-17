import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: "./src/test/setup.ts",
  },
 server: {
    host: '0.0.0.0',
    allowedHosts: ['.ngrok-free.dev']
  }
});
