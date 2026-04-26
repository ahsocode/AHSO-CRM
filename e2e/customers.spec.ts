import { expect, test, type Page } from "@playwright/test";
import { getUserIdFromAccessToken } from "./api-auth";
import { login } from "./helpers";

const API_URL = process.env.E2E_API_URL ?? "http://127.0.0.1:3001/api";

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

test("UI thùng rác khôi phục khách hàng đã xóa mềm", async ({ page, request }) => {
  await login(page);
  const accessToken = await getAccessTokenFromPage(page);
  const userId = getUserIdFromAccessToken(accessToken);
  const customerName = `E2E Restore UI ${Date.now()}`;
  let customerId: string | null = null;

  try {
    const createResponse = await request.post(`${API_URL}/customers`, {
      headers: {
        Authorization: `Bearer ${accessToken}`
      },
      data: {
        name: customerName,
        status: "LEAD",
        isVip: false,
        assignedToId: userId
      }
    });
    expect(createResponse.ok()).toBeTruthy();
    const createPayload = await createResponse.json();
    customerId = createPayload.data.id as string;

    const deleteResponse = await request.delete(`${API_URL}/customers/${customerId}`, {
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    });
    expect(deleteResponse.ok()).toBeTruthy();

    await page.goto("/customers");
    await page.getByLabel("Tìm kiếm khách hàng").fill(customerName);
    await page.getByRole("button", { name: "Thùng rác" }).click();

    await expect(page.getByRole("heading", { name: "Khách hàng đã xóa mềm" })).toBeVisible();
    await expect(page.getByText(customerName)).toBeVisible();
    await page.getByRole("button", { name: "Khôi phục" }).click();
    await expect
      .poll(async () => {
        const activeListResponse = await request.get(`${API_URL}/customers`, {
          headers: {
            Authorization: `Bearer ${accessToken}`
          },
          params: {
            search: customerName
          }
        });
        expect(activeListResponse.ok()).toBeTruthy();
        const activeListPayload = await activeListResponse.json();
        return activeListPayload.data.some((customer: { id: string }) => customer.id === customerId);
      })
      .toBe(true);
  } finally {
    if (customerId) {
      await request.delete(`${API_URL}/customers/${customerId}`, {
        headers: {
          Authorization: `Bearer ${accessToken}`
        }
      });
    }
  }
});

async function getAccessTokenFromPage(page: Page) {
  const accessToken = await page.evaluate(() => window.sessionStorage.getItem("ahso_access_token"));
  expect(accessToken).toBeTruthy();
  return accessToken as string;
}
