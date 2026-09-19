import { defineConfig } from "vitest/config";

// Standalone test config: vite.config.ts loads the Cloudflare plugin, which
// rejects vitest's resolver options, so tests never touch it.
export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: { include: ["src/**/*.test.ts", "src/**/*.test.tsx"], environment: "node" },
});
