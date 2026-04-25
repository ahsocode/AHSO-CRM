import { expect, Page } from "@playwright/test";

export async function login(page: Page, email = process.env.E2E_ADMIN_EMAIL ?? "admin@ahso.vn", password = process.env.E2E_ADMIN_PASSWORD ?? "AHSO123!") {
  await page.goto("/");
  await page.evaluate(() => {
    const e2eAccessToken = window.localStorage.getItem("ahso_e2e_access_token");

    if (e2eAccessToken) {
      window.sessionStorage.setItem("ahso_access_token", e2eAccessToken);
    }
  });
  await page.goto("/dashboard");

  if (/\/dashboard(?:\/|$)/.test(page.url())) {
    await expect(page.getByText("Tổng quan hoạt động")).toBeVisible({ timeout: 15_000 });
    return;
  }

  await page.goto("/login");

  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Mật khẩu").fill(password);
  await page.getByRole("button", { name: /vào dashboard/i }).click();
  await expect(page).toHaveURL(/\/dashboard/);
  await expect(page.getByText("Tổng quan hoạt động")).toBeVisible({ timeout: 15_000 });
}
