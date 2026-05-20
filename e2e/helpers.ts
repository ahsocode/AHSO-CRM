import { expect, Page } from "@playwright/test";

export async function login(
  page: Page,
  email = process.env.E2E_ADMIN_EMAIL ?? "admin@ahso.vn",
  password = process.env.E2E_ADMIN_PASSWORD ?? "AHSO123!",
) {
  const baseURL = (page.context() as any)._options?.baseURL ?? "http://localhost:3000";
  const apiURL = process.env.E2E_API_URL ?? baseURL.replace(":3000", ":3001");

  // Navigate to dashboard. With storageState, the ahso_refresh_token cookie and
  // the ahso_e2e_access_token localStorage entry should already be present.
  await page.goto("/dashboard");

  // Restore access token to sessionStorage from localStorage backup (storageState
  // does not always persist sessionStorage across worker restarts).
  await page.evaluate(() => {
    const e2eToken = window.localStorage.getItem("ahso_e2e_access_token");
    if (e2eToken && !window.sessionStorage.getItem("ahso_access_token")) {
      window.sessionStorage.setItem("ahso_access_token", e2eToken);
    }
  });

  const isReady = await page
    .getByText("Dashboard điều phối")
    .waitFor({ state: "visible", timeout: 8_000 })
    .then(() => true)
    .catch(() => false);

  if (isReady) return;

  // Fast path failed. Use page.request (shares the browser context cookie jar) so
  // Set-Cookie from the login response lands in the browser — same technique used
  // in global.setup.ts.  No form fill, no middleware redirect race.
  const loginRes = await page.request.post(`${apiURL}/api/auth/login`, {
    data: { email, password },
  });

  if (!loginRes.ok()) {
    throw new Error(`Login API failed (${loginRes.status()}): ${await loginRes.text()}`);
  }

  const body = await loginRes.json() as { data: { accessToken: string } };
  const accessToken = body.data.accessToken;

  await page.evaluate((token: string) => {
    window.sessionStorage.setItem("ahso_access_token", token);
    window.localStorage.setItem("ahso_e2e_access_token", token);
  }, accessToken);

  // Cookie is now in the browser context — navigate to dashboard.
  await page.goto("/dashboard");
  await expect(page.getByText("Dashboard điều phối")).toBeVisible({ timeout: 15_000 });
}
