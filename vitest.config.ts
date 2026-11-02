import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      "server-only": fileURLToPath(new URL("./tests/stubs/empty.ts", import.meta.url)),
      "next/headers": fileURLToPath(new URL("./tests/stubs/next-headers.ts", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    env: { DATABASE_URL: "pglite://memory", CAMPUSLY_NO_DEMO: "1", TZ: "UTC" },
    testTimeout: 60_000,
    hookTimeout: 120_000,
    pool: "forks",
  },
});
