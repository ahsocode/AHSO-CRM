import { expect, test } from "@playwright/test";
import { login } from "./helpers";

test("dashboard hiển thị KPI và biểu đồ", async ({ page }) => {
  await login(page);
  await page.goto("/dashboard");
  await expect(page.getByText("Dashboard điều phối")).toBeVisible();
  await expect(page.getByLabel("Khoảng thời gian")).toHaveValue("current-year");
  await expect(page.getByLabel("Từ ngày")).toBeVisible();
  await expect(page.getByLabel("Đến ngày")).toBeVisible();
});
