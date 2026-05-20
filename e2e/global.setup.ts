import { chromium, type FullConfig } from "@playwright/test";
import { mkdirSync } from "fs";
import { dirname, resolve } from "path";

const STORAGE_STATE_PATH = resolve(__dirname, ".auth", "admin.json");

export default async function globalSetup(config: FullConfig) {
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();

  const baseURL =
    process.env.E2E_BASE_URL ??
    config.projects.find((project) => project.name === "authenticated-smoke")?.use?.baseURL?.toString() ??
    "http://localhost:3000";

  // API lives at a different port in local/CI — derive from base URL or env
  const apiURL = process.env.E2E_API_URL ?? baseURL.replace(":3000", ":3001");

  mkdirSync(dirname(STORAGE_STATE_PATH), { recursive: true });

  const email = process.env.E2E_ADMIN_EMAIL ?? "admin@ahso.vn";
  const password = process.env.E2E_ADMIN_PASSWORD ?? "AHSO123!";

  // Use page.request (shares the browser context's cookie jar) so the
  // Set-Cookie response from the API is stored in the browser context.
  // This is more reliable than filling a form: no middleware redirect races,
  // no cross-port cookie-sharing ambiguity.
  const loginRes = await page.request.post(`${apiURL}/api/auth/login`, {
    data: { email, password },
  });

  if (!loginRes.ok()) {
    throw new Error(`Login API failed (${loginRes.status()}): ${await loginRes.text()}`);
  }

  const body = await loginRes.json() as { data: { accessToken: string } };
  const accessToken = body.data.accessToken;

  // The ahso_refresh_token cookie is now in the browser context (set by the
  // API response above). Navigate to the dashboard so the middleware allows it.
  await page.goto(`${baseURL}/dashboard`);
  await page.waitForURL(/\/dashboard/, { timeout: 15_000 });

  // Persist the access token in both sessionStorage and localStorage so tests
  // can restore it without triggering a refresh round-trip.
  await page.evaluate((token: string) => {
    window.sessionStorage.setItem("ahso_access_token", token);
    window.localStorage.setItem("ahso_e2e_access_token", token);
  }, accessToken);

  await page.context().storageState({ path: STORAGE_STATE_PATH });

  await browser.close();
}
