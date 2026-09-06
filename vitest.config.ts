import { defineConfig } from "vitest/config";
import path from "node:path";
import { fileURLToPath } from "node:url";

const dirname = path.dirname(fileURLToPath(import.meta.url));

// Deliberately separate from vite.config.ts: that file goes through
// @lovable.dev/vite-tanstack-config (TanStack Start + Nitro + Cloudflare
// build plugins), none of which unit tests need. This config only needs the
// "@" path alias the app's tsconfig defines, so the pure helpers under
// src/lib can be imported the same way the app imports them.
export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(dirname, "./src"),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
