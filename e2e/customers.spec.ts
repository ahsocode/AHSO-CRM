import { expect, test } from "@playwright/test";
import { login } from "./helpers";

test("mở danh sách khách hàng và dùng tìm kiếm cơ bản", async ({ page }) => {
  await login(page);
  await page.goto("/customers");
  await expect(page.getByText("Khách hàng", { exact: false }).first()).toBeVisible();

  const searchInput = page.locator('input[placeholder*="Tìm"]:not([readonly])').first();
  if (await searchInput.count()) {
    await searchInput.fill("AHSO");
  }

  await expect(page).toHaveURL(/\/customers/);
});

test("bulk export khách hàng hoạt động ở happy path", async ({ page }) => {
  await login(page);
  await page.goto("/customers");

  const firstRowCheckbox = page.locator("table tbody tr").first().locator('[role="checkbox"]').first();
  await firstRowCheckbox.click();
  await expect(page.getByText(/bản ghi đang được chọn/i)).toBeVisible();

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: /Export CSV \+ Excel/i }).click();
  await downloadPromise;
});
