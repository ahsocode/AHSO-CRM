import { expect, test } from "@playwright/test";
import { login } from "./helpers";

test("login, logout và mở trang quên mật khẩu", async ({ page }) => {
  await page.goto("/forgot-password");
  await expect(page.getByRole("button", { name: /gửi.*khôi phục|gửi.*yêu cầu/i })).toBeVisible();

  await login(page);
  await expect(page.getByText("Tổng quan", { exact: false }).first()).toBeVisible();

  await page.goto("/login");
  await expect(page).toHaveURL(/\/dashboard/);
});
