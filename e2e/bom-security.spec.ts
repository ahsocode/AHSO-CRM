import { expect, test } from "@playwright/test";
import { getStoredAdminAccessToken, getUserIdFromAccessToken } from "./api-auth";

const API_URL = process.env.E2E_API_URL ?? "http://127.0.0.1:3001/api";

test.describe("BOM bảo mật", () => {
  test("các route BOM, chi phí và phân bổ yêu cầu token", async ({ request }) => {
    const routes = [
      ["GET", "/projects/missing/boms"], ["POST", "/projects/missing/boms"],
      ["GET", "/boms/models"], ["GET", "/boms/models/missing/versions"],
      ["GET", "/boms/missing"], ["PATCH", "/boms/missing"], ["PUT", "/boms/missing/lines"],
      ["POST", "/boms/missing/approve"], ["POST", "/boms/missing/new-version"],
      ["POST", "/boms/missing/archive"], ["POST", "/boms/missing/save-as-model"], ["DELETE", "/boms/missing"],
      ["GET", "/projects/missing/costs"], ["POST", "/projects/missing/costs"],
      ["PATCH", "/project-costs/missing"], ["DELETE", "/project-costs/missing"],
      ["GET", "/projects/missing/cost-summary"], ["GET", "/material-allocations/missing/cost-sheet"],
      ["GET", "/projects/missing/material-allocations"], ["POST", "/projects/missing/material-allocations"],
      ["POST", "/projects/missing/material-allocations/suggest"], ["GET", "/material-allocations/missing"],
      ["PUT", "/material-allocations/missing"], ["POST", "/material-allocations/missing/confirm"],
      ["POST", "/material-allocations/missing/cancel"]
    ];
    for (const [method, path] of routes) {
      const response = await request.fetch(`${API_URL}${path}`, { method, data: method === "GET" ? undefined : {} });
      expect(response.status(), `${method} ${path}`).toBe(401); // qa-static: not-ui
    }
  });

  test("STAFF không đọc hoặc sửa BOM và chi phí của dự án người khác", async ({ request }) => {
    const token = getStoredAdminAccessToken();
    const headers = { Authorization: `Bearer ${token}` };
    const stamp = Date.now();
    const login = await request.post(`${API_URL}/auth/login`, { data: { email: "staff@ahso.vn", password: "AHSO123!" } });
    expect(login.ok()).toBeTruthy();
    const staffHeaders = { Authorization: `Bearer ${(await login.json()).data.accessToken}` };
    const create = async (path: string, data: unknown): Promise<{ id: string }> => {
      const response = await request.post(`${API_URL}${path}`, { headers, data });
      expect(response.ok(), `${path}: ${await response.text()}`).toBeTruthy(); // qa-static: not-ui
      return (await response.json()).data;
    };
    let customerId: string | undefined;
    let projectId: string | undefined;
    let bomId: string | undefined;
    let costId: string | undefined;
    try {
      customerId = (await create("/customers", { name: `BOM Security ${stamp}`, assignedToId: getUserIdFromAccessToken(token) })).id; // qa-static: not-ui
      projectId = (await create("/projects", { customerId, name: `BOM Security ${stamp}` })).id; // qa-static: not-ui
      bomId = (await create(`/projects/${projectId}/boms`, { name: "Dự toán bảo mật" })).id; // qa-static: not-ui
      costId = (await create(`/projects/${projectId}/costs`, { group: "SOFTWARE", description: "Bản quyền", invoiceDate: "2026-01-01", amount: 1000 })).id; // qa-static: not-ui
      for (const path of [`/projects/${projectId}/boms`, `/boms/${bomId}`, `/projects/${projectId}/costs`, `/projects/${projectId}/cost-summary`, `/projects/${projectId}/material-allocations`]) {
        const response = await request.get(`${API_URL}${path}`, { headers: staffHeaders });
        expect([403, 404], path).toContain(response.status());
      }
      for (const [path, data] of [
        [`/boms/${bomId}`, { name: "Không được sửa" }], // qa-static: not-ui
        [`/project-costs/${costId}`, { amount: 2000 }]
      ] as const) {
        const response = await request.patch(`${API_URL}${path}`, { headers: staffHeaders, data });
        expect([403, 404], path).toContain(response.status());
      }
      const cost = await request.get(`${API_URL}/projects/${projectId}/costs`, { headers });
      expect((await cost.json()).data[0].amount).toBe(1000);
    } finally {
      for (const path of [costId && `/project-costs/${costId}`, bomId && `/boms/${bomId}`, projectId && `/projects/${projectId}`, customerId && `/customers/${customerId}`]) {
        if (path) {
          const response = await request.delete(`${API_URL}${path}`, { headers });
          expect(response.ok(), `Cleanup ${path}: ${await response.text()}`).toBeTruthy(); // qa-static: not-ui
        }
      }
    }
  });
});
