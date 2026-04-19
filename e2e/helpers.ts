import { expect, Page } from "@playwright/test";

export async function login(page: Page, email = process.env.E2E_ADMIN_EMAIL ?? "admin@ahso.vn", password = process.env.E2E_ADMIN_PASSWORD ?? "AHSO123!") {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Mật khẩu").fill(password);
  await page.getByRole("button", { name: /vào dashboard/i }).click();
  await expect(page).toHaveURL(/\/dashboard/);
}
