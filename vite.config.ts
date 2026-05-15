import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    execArgv: ["--no-experimental-webstorage"],
    globals: true,
    setupFiles: "./src/test/setup.ts",
  },
});
