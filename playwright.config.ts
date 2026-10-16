import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  timeout: 90_000,
  fullyParallel: true,
  workers: 2,
  reporter: "list",
  use: {
    baseURL: "http://127.0.0.1:3107",
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "npx next dev --port=3107",
    url: "http://127.0.0.1:3107",
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      BUILDLOOP_BUILDER_MODE: "deterministic",
      BUILDLOOP_AUTH_MODE: "test",
      BUILDLOOP_TEST_AUTH_SECRET: process.env.BUILDLOOP_TEST_AUTH_SECRET ?? "buildloop-e2e-only-secret-rotate-before-sharing",
      DATABASE_URL: process.env.DATABASE_URL ?? "",
      BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET ?? "local-e2e-only-auth-secret-never-use-in-production",
      BETTER_AUTH_URL: "http://127.0.0.1:3107",
    },
  },
});
