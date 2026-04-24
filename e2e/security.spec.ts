import { expect, test } from "@playwright/test";

const apiBaseUrl = process.env.E2E_API_URL ?? "http://127.0.0.1:3001/api";

test("health endpoint và settings public/private hoạt động đúng", async ({ request }) => {
  const healthResponse = await request.get(`${apiBaseUrl}/health`);
  expect(healthResponse.ok()).toBeTruthy();

  const healthPayload = await healthResponse.json();
  expect(healthPayload.data.status).toBe("up");
  expect(healthPayload.data.services.database.status).toBe("up");
  expect(healthPayload.data.services.redis.status).toBe("up");

  const settingsResponse = await request.get(`${apiBaseUrl}/settings`);
  expect(settingsResponse.status()).toBe(401);

  const policiesResponse = await request.get(`${apiBaseUrl}/settings/policies`);
  expect(policiesResponse.status()).toBe(401);

  const publicCompanyResponse = await request.get(`${apiBaseUrl}/settings/company`);
  expect(publicCompanyResponse.ok()).toBeTruthy();

  const companyPayload = await publicCompanyResponse.json();
  expect(companyPayload.data.name).toBeTruthy();
  expect(companyPayload.data).not.toHaveProperty("bankName");
  expect(companyPayload.data).not.toHaveProperty("bankAccount");
  expect(companyPayload.data).not.toHaveProperty("bankBranch");
  expect(companyPayload.data).not.toHaveProperty("bankAccountName");
});
