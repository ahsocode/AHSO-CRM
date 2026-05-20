import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  globalSetup: "./e2e/global.setup.ts",
  workers: 1,
  expect: {
    timeout: 10_000
  },
  projects: [
    {
      name: "auth-guest",
      testMatch: /(auth|security)\.spec\.ts/,
      use: {
        baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3000",
        headless: true,
        trace: "retain-on-failure"
      }
    },
    {
      name: "authenticated-smoke",
      testIgnore: /(auth|security)\.spec\.ts/,
      use: {
        baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3000",
        headless: true,
        trace: "retain-on-failure",
        storageState: "e2e/.auth/admin.json"
      }
    }
  ]
});
