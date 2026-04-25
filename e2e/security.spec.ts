import { expect, test, type APIRequestContext } from "@playwright/test";

const apiBaseUrl = process.env.E2E_API_URL ?? "http://127.0.0.1:3001/api";

async function loginForToken(request: APIRequestContext, email: string) {
  const response = await request.post(`${apiBaseUrl}/auth/login`, {
    data: {
      email,
      password: "AHSO123!"
    }
  });

  expect(response.ok()).toBeTruthy();
  const payload = await response.json();
  return payload.data.accessToken as string;
}

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

test("permission catalog yêu cầu đăng nhập và quyền roles.view", async ({ request }) => {
  const unauthenticatedResponse = await request.get(`${apiBaseUrl}/permissions`);
  expect(unauthenticatedResponse.status()).toBe(401);

  const adminToken = await loginForToken(request, "admin@ahso.vn");
  const adminResponse = await request.get(`${apiBaseUrl}/permissions`, {
    headers: {
      Authorization: `Bearer ${adminToken}`
    }
  });

  expect(adminResponse.ok()).toBeTruthy();
});

test("RBAC áp dụng cho documents, dashboard, reports và notifications", async ({ request }) => {
  const staffToken = await loginForToken(request, "staff@ahso.vn");
  const headers = {
    Authorization: `Bearer ${staffToken}`
  };

  const createDocumentResponse = await request.post(`${apiBaseUrl}/business-documents`, {
    headers,
    data: {}
  });
  expect(createDocumentResponse.status()).toBe(403);

  const dashboardResponse = await request.get(`${apiBaseUrl}/dashboard/kpis`, {
    headers
  });
  expect(dashboardResponse.ok()).toBeTruthy();

  const reportsResponse = await request.get(`${apiBaseUrl}/reports/overview`, {
    headers
  });
  expect(reportsResponse.ok()).toBeTruthy();

  const notificationReadAllResponse = await request.patch(`${apiBaseUrl}/notifications/read-all`, {
    headers
  });
  expect(notificationReadAllResponse.ok()).toBeTruthy();
});
