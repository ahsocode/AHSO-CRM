import { expect, test } from "@playwright/test";
import { login } from "./helpers";

test("admin có thể mở admin panel và xem roles", async ({ page }) => {
  await login(page);
  await page.goto("/admin");
  await expect(page.getByRole("heading", { name: "Quản trị hệ thống" })).toBeVisible();

  await page.goto("/admin/roles");
  await expect(page.getByText("Hệ thống", { exact: false }).first()).toBeVisible();
});

test("admin thấy trạng thái Production/Beta trong document templates", async ({ page }) => {
  await login(page);
  await page.goto("/admin/document-templates");
  await expect(page.getByRole("heading", { name: /Trình biên tập mẫu tài liệu/i })).toBeVisible();
  await expect(page.getByText("Production").first()).toBeVisible();
  await expect(page.getByText("Beta").first()).toBeVisible();
});
