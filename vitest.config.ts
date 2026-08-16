import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: { "@": path.resolve(__dirname) },
  },
  test: {
    environment: "node",
    setupFiles: ["./vitest.setup.ts"],
    // Evals hit a real running dev server and cost real API tokens — run them
    // explicitly via `npm run test:evals`, not as part of the default `npm test`.
    exclude: ["**/node_modules/**", "**/evals/**"],
  },
});
