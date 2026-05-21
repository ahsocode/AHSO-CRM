import { expect, test } from "@playwright/test";
import { login } from "./helpers";

test("mở quotes và kiểm tra preview/pdf workflow cơ bản", async ({ page }) => {
  // PDF generation involves Chromium cold-start inside Docker — needs extra time in CI
  test.setTimeout(120_000);
  await login(page);
  await page.goto("/quotes");
  await expect(page.getByText("Báo giá", { exact: false }).first()).toBeVisible();

  const quoteLink = page.locator('table tbody tr a[href^="/quotes/"]').first();
  await quoteLink.click();

  await expect(page.getByRole("button", { name: /Tạo tài liệu/i })).toBeVisible();
  await page.getByRole("button", { name: /Tạo tài liệu/i }).click();
  await page.getByRole("menuitem", { name: /Báo giá/i }).click();

  // Preview now opens inline (same tab overlay) instead of a new popup tab
  await page.getByRole("button", { name: /Xem trước \(HTML\)/i }).click();
  await expect(page.locator('iframe[title="document-preview"]')).toBeVisible();
  await page.getByRole("button", { name: /Đóng/i }).click();
  await expect(page.locator('iframe[title="document-preview"]')).not.toBeVisible();

  // Preview closes the document modal — re-open it to access PDF download
  await page.getByRole("button", { name: /Tạo tài liệu/i }).click();
  await page.getByRole("menuitem", { name: /Báo giá/i }).click();

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: /Tải xuống PDF/i }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/\.pdf$/i);
});

test("bulk export báo giá hoạt động ở happy path", async ({ page }) => {
  await login(page);
  await page.goto("/quotes");

  const firstRowCheckbox = page.locator("table tbody tr").first().locator('[role="checkbox"]').first();
  await firstRowCheckbox.click();
  await expect(page.getByText(/bản ghi đang được chọn/i)).toBeVisible();

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: /Export CSV \+ Excel/i }).click();
  await downloadPromise;
});
