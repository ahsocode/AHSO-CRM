import { expect, test } from "@playwright/test";
import { login } from "./helpers";

test("mở danh sách khách hàng và dùng tìm kiếm cơ bản", async ({ page }) => {
  await login(page);
  await page.goto("/customers");
  await expect(page.getByText("Khách hàng", { exact: false }).first()).toBeVisible();

  const searchInput = page.locator('input[placeholder*="Tìm"]').first();
  if (await searchInput.count()) {
    await searchInput.fill("AHSO");
  }

  await expect(page).toHaveURL(/\/customers/);
});
