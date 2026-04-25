import { expect, test } from "@playwright/test";
import { login } from "./helpers";

test("login, logout và mở trang quên mật khẩu", async ({ page }) => {
  await page.goto("/forgot-password");
  await expect(page.getByRole("button", { name: /gửi.*khôi phục|gửi.*yêu cầu/i })).toBeVisible();

  await login(page, "manager@ahso.vn");
  await expect(page.getByText("Tổng quan", { exact: false }).first()).toBeVisible();

  await page.goto("/login");
  await expect(page).toHaveURL(/\/dashboard/);
});

test("cookie refresh cũ không làm kẹt dashboard ở màn loading", async ({ page, context }) => {
  await context.addCookies([
    {
      name: "ahso_refresh_token",
      value: "stale-refresh-token",
      domain: "127.0.0.1",
      path: "/",
      httpOnly: true,
      sameSite: "Strict"
    }
  ]);

  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login/, { timeout: 15_000 });
  await expect(page.getByRole("button", { name: /vào dashboard/i })).toBeVisible();
});
