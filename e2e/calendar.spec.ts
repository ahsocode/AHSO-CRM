import { expect, test } from "@playwright/test";
import { login } from "./helpers";

test("calendar giữ đúng from/to khi đổi range và chuyển view", async ({ page }) => {
  await login(page);
  await page.goto("/calendar");

  const dateFrom = page.locator("#calendar-date-from");
  const dateTo = page.locator("#calendar-date-to");

  await dateFrom.fill("2026-03-30");
  await dateTo.fill("2026-05-03");
  await page.getByRole("button", { name: "Tháng", exact: true }).click();

  await expect(dateFrom).toHaveValue("2026-03-30");
  await expect(dateTo).toHaveValue("2026-05-03");
});
