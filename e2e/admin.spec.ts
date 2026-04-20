import { expect, test } from "@playwright/test";
import { login } from "./helpers";

test("admin có thể mở admin panel và xem roles", async ({ page }) => {
  await login(page);
  await page.goto("/admin");
  await expect(page.getByRole("heading", { name: "Quản trị hệ thống" })).toBeVisible();

  await page.goto("/admin/roles");
  await expect(page.getByText("Hệ thống", { exact: false }).first()).toBeVisible();
});
