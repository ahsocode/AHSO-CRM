import { expect, Page } from "@playwright/test";

export async function login(
  page: Page,
  email = process.env.E2E_ADMIN_EMAIL ?? "admin@ahso.vn",
  password = process.env.E2E_ADMIN_PASSWORD ?? "AHSO123!",
) {
  const baseURL = process.env.E2E_BASE_URL ?? "http://localhost:3000";
  const apiURL = resolveApiBaseUrl(baseURL);

  // Restore access token before the app boots. Doing this via addInitScript
  // avoids a race where middleware/dashboard navigation destroys the page
  // context between goto() and evaluate().
  await page.addInitScript(() => {
    const e2eToken = window.localStorage.getItem("ahso_e2e_access_token");
    if (e2eToken && !window.sessionStorage.getItem("ahso_access_token")) {
      window.sessionStorage.setItem("ahso_access_token", e2eToken);
    }
  });

  // Navigate to dashboard. With storageState, the ahso_refresh_token cookie and
  // the ahso_e2e_access_token localStorage entry should already be present.
  await page.goto("/dashboard", { waitUntil: "domcontentloaded" });

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

  const body = await loginRes.json() as { data: { accessToken: string; user: Record<string, unknown> } };
  const accessToken = body.data.accessToken;
  const user = body.data.user;

  await page.evaluate(({ token, userData }: { token: string; userData: Record<string, unknown> }) => {
    window.sessionStorage.setItem("ahso_access_token", token);
    window.localStorage.setItem("ahso_e2e_access_token", token);
    window.localStorage.setItem("ahso_auth_user", JSON.stringify(userData));
  }, { token: accessToken, userData: user });

  // Cookie is now in the browser context — navigate to dashboard.
  await page.goto("/dashboard");
  await expect(page.getByText("Dashboard điều phối")).toBeVisible({ timeout: 15_000 });
}

function resolveApiBaseUrl(baseURL: string) {
  const configuredApiUrl = process.env.E2E_API_URL;
  if (configuredApiUrl) {
    return configuredApiUrl.replace(/\/+$/, "").replace(/\/api$/i, "");
  }

  return baseURL.replace(":3000", ":3001").replace(/\/+$/, "");
}
