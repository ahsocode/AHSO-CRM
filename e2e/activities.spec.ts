import { expect, test } from "@playwright/test";
import { login } from "./helpers";

const apiBaseURL = process.env.E2E_API_BASE_URL ?? "http://127.0.0.1:3001/api";

test("form hoạt động giữ đúng giờ local khi mở lại bản ghi đã lưu", async ({ page, request }) => {
  await login(page);
  const accessToken = await page.evaluate(() => window.sessionStorage.getItem("ahso_access_token"));
  expect(accessToken).toBeTruthy();

  const createResponse = await request.post(`${apiBaseURL}/activities`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    data: {
      type: "NOTE",
      title: `E2E timezone ${Date.now()}`,
      scheduledAt: "2026-04-20T20:00:00.000Z",
    },
  });

  expect(createResponse.ok()).toBeTruthy();

  const createdActivity = await createResponse.json();
  const activityId = createdActivity.data.id as string;

  try {
    await page.goto(`/activities/${activityId}/edit`);
    await page.waitForLoadState("networkidle");

    await expect(page.locator('input[type="datetime-local"]')).toHaveValue("2026-04-21T03:00");
  } finally {
    await request.delete(`${apiBaseURL}/activities/${activityId}`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });
  }
});
