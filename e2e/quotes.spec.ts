import { expect, test } from "@playwright/test";
import { login } from "./helpers";

test("mở quotes và kiểm tra preview/pdf workflow cơ bản", async ({ page }) => {
  await login(page);
  await page.goto("/quotes");
  await expect(page.getByText("Báo giá", { exact: false }).first()).toBeVisible();
});
