import { expect, test } from "@playwright/test";
import { login } from "./helpers";

test("mở contracts và xác nhận giao diện contract workflow", async ({ page }) => {
  await login(page);
  await page.goto("/contracts");
  await expect(page.getByText("Hợp đồng", { exact: false }).first()).toBeVisible();
});
