import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    environment: "node",
    include: ["src/**/*.integration.test.ts"],
    globalSetup: ["src/test/global-setup.ts"],
    setupFiles: ["src/test/setup.ts"],
    // One shared database — files must not run concurrently against it
    fileParallelism: false,
    testTimeout: 20_000,
    hookTimeout: 30_000,
  },
});
