import { chromium, type FullConfig } from "@playwright/test";
import { mkdirSync } from "fs";
import { dirname, resolve } from "path";

const STORAGE_STATE_PATH = resolve(__dirname, ".auth", "admin.json");

export default async function globalSetup(config: FullConfig) {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const baseURL =
    process.env.E2E_BASE_URL ??
    config.projects.find((project) => project.name === "authenticated-smoke")?.use?.baseURL?.toString() ??
    "http://localhost:3000";

  mkdirSync(dirname(STORAGE_STATE_PATH), { recursive: true });

  await page.goto(`${baseURL}/login`);
  await page.getByLabel("Email").fill(process.env.E2E_ADMIN_EMAIL ?? "admin@ahso.vn");
  await page.getByLabel("Mật khẩu").fill(process.env.E2E_ADMIN_PASSWORD ?? "AHSO123!");
  await page.getByRole("button", { name: /vào dashboard/i }).click();
  await page.waitForURL(/\/dashboard/, { timeout: 15_000 });
  await page.evaluate(() => {
    const accessToken = window.sessionStorage.getItem("ahso_access_token");

    if (accessToken) {
      window.localStorage.setItem("ahso_e2e_access_token", accessToken);
    }
  });
  await page.context().storageState({ path: STORAGE_STATE_PATH });

  await browser.close();
}
