import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { getUserIdFromAccessToken } from "./api-auth";
import { login } from "./helpers";

const API_URL = process.env.E2E_API_URL ?? "http://127.0.0.1:3001/api";

// Dates used by the scenario: one lot bought before the sales invoice, one after it.
const EARLY_LOT_DATE = "2026-01-10"; // qa-static: not-ui
const LATE_LOT_DATE = "2026-06-01"; // qa-static: not-ui
const SALES_INVOICE_DATE = "2026-03-31"; // qa-static: not-ui

async function getAccessTokenFromPage(page: Page) {
  const accessToken = await page.evaluate(() => window.sessionStorage.getItem("ahso_access_token"));
  expect(accessToken).toBeTruthy();
  return accessToken as string;
}

function authHeaders(accessToken: string) {
  return { Authorization: `Bearer ${accessToken}` };
}

function unwrap<T>(payload: unknown): T {
  if (payload && typeof payload === "object" && "data" in payload) {
    return (payload as { data: T }).data;
  }
  return payload as T;
}

async function apiSend<T>(
  request: APIRequestContext,
  method: "post" | "put",
  path: string,
  headers: Record<string, string>,
  data: unknown
): Promise<T> {
  const response = await request[method](`${API_URL}${path}`, { headers, data });
  expect(response.ok(), `${method.toUpperCase()} ${path}: ${await response.text()}`).toBeTruthy(); // qa-static: not-ui
  return unwrap<T>(await response.json());
}

test.describe("Chi phí và lãi gộp dự án", () => {
  test("[Chi phí] gợi ý theo BOM bỏ lô mua sau hóa đơn bán, báo thiếu hàng và tính lãi gộp", async ({ page, request }) => {
    test.setTimeout(120_000);
    await login(page);
    const accessToken = await getAccessTokenFromPage(page);
    const headers = authHeaders(accessToken);
    const userId = getUserIdFromAccessToken(accessToken);
    const stamp = Date.now();
    const invoiceNo = `HD-E2E-${stamp}`; // qa-static: not-ui

    let customerId: string | null = null;
    let projectId: string | null = null;
    let contractId: string | null = null;
    let materialId: string | null = null;
    let warehouseId: string | null = null;

    try {
      const warehouse = await apiSend<{ id: string }>(request, "post", "/warehouses", headers, {
        code: `E2E-WH-${stamp}`, // qa-static: not-ui
        name: `Kho chi phí ${stamp}`, // qa-static: not-ui
        isActive: true
      });
      warehouseId = warehouse.id;

      const material = await apiSend<{ id: string }>(request, "post", "/materials", headers, {
        code: `E2E-CP-${stamp}`, // qa-static: not-ui
        name: `Vật tư chi phí ${stamp}`, // qa-static: not-ui
        unit: "Cái",
        kind: "STOCK",
        minStock: 0,
        isActive: true
      });
      materialId = material.id;

      // Lot A: bought before the sales invoice (3 pcs). Lot B: bought after it (10 pcs) and must not be used.
      for (const [date, quantity, unitPrice] of [
        [EARLY_LOT_DATE, 3, 100000],
        [LATE_LOT_DATE, 10, 200000]
      ] as const) {
        const receipt = await apiSend<{ id: string }>(request, "post", "/stock-receipts", headers, {
          warehouseId,
          date: new Date(`${date}T03:00:00.000Z`).toISOString(),
          items: [{ materialId, quantity, unitPrice }]
        });
        await apiSend(request, "post", `/stock-receipts/${receipt.id}/confirm`, headers, {});
      }

      const customerResponse = await request.post(`${API_URL}/customers`, {
        headers,
        data: { name: `Khách chi phí QA ${stamp}`, status: "LEAD", isVip: false, assignedToId: userId } // qa-static: not-ui
      });
      expect(customerResponse.ok(), await customerResponse.text()).toBeTruthy(); // qa-static: not-ui
      customerId = unwrap<{ id: string }>(await customerResponse.json()).id;

      const project = await apiSend<{ id: string }>(request, "post", "/projects", headers, {
        customerId,
        name: `Dự án chi phí QA ${stamp}`, // qa-static: not-ui
        status: "DELIVERING"
      });
      projectId = project.id;

      const contract = await apiSend<{ id: string }>(request, "post", "/contracts", headers, {
        projectId,
        value: 10000000,
        signDate: "2026-02-01"
      });
      contractId = contract.id;

      const bom = await apiSend<{ id: string }>(request, "post", `/projects/${projectId}/boms`, headers, {
        name: `BOM chi phí ${stamp}` // qa-static: not-ui
      });
      await apiSend(request, "put", `/boms/${bom.id}/lines`, headers, {
        lines: [
          { group: "MECHANICAL", materialId, name: "Khung máy", quantity: 5, estUnitCost: 100000 },
          { group: "SOFTWARE", name: "Phần mềm điều khiển", quantity: 1, estUnitCost: 5000000 } // qa-static: not-ui
        ]
      });

      // --- Tab Vật tư: create a batch from the BOM suggestion ---
      await page.goto(`/projects/${projectId}?tab=materials`);
      await page.getByRole("button", { name: "Tạo đợt phân bổ" }).click();
      await page.getByLabel("Ngày hóa đơn bán").fill(SALES_INVOICE_DATE);
      await page.getByLabel("Số hóa đơn bán").fill(invoiceNo);
      await page.getByLabel("BOM dự án").selectOption(bom.id);
      await page.getByRole("button", { name: "Gợi ý theo BOM" }).click();

      // Only the early lot is used (3 of 5), so 2 pcs are short; the later lot is ignored.
      const shortages = page.getByTestId("allocation-shortages");
      await expect(shortages).toBeVisible();
      await expect(shortages).toContainText("thiếu 2");
      await expect(page.getByTestId("allocation-service-lines")).toContainText("Phần mềm điều khiển");
      const rows = page.getByTestId("allocation-row");
      await expect(rows).toHaveCount(1);
      await expect(rows.first().locator("input[type=number]")).toHaveValue("3");

      await page.getByRole("button", { name: "Lưu đợt nháp" }).click();
      const batch = page.getByTestId("allocation-batch");
      await expect(batch).toHaveCount(1);
      await expect(batch).toHaveAttribute("data-status", "DRAFT");

      // --- Direct cost via the cost tab ---
      await page.getByRole("tab", { name: /Chi phí & lãi gộp/ }).click();
      await page.getByRole("button", { name: "Thêm chi phí" }).click();
      await page.getByLabel("Mô tả").fill(`Lập trình PLC ${stamp}`); // qa-static: not-ui
      await page.getByLabel("Ngày hóa đơn").fill("2026-02-15");
      await page.getByLabel(/Số tiền trước VAT/).fill("2000000");
      await page.getByRole("button", { name: "Lưu chi phí" }).click();
      await expect(page.getByTestId("project-cost-row")).toHaveCount(1);

      // --- Confirm the batch and export the cost sheet ---
      await page.getByRole("tab", { name: "Vật tư" }).click();
      await page.getByRole("button", { name: "Xác nhận xuất kho" }).click();
      await expect(page.getByTestId("allocation-batch")).toHaveAttribute("data-status", "CONFIRMED");
      const [download] = await Promise.all([
        page.waitForEvent("download"),
        page.getByRole("button", { name: "Xuất bảng kê giá vốn" }).click()
      ]);
      expect(download.suggestedFilename()).toMatch(/\.xlsx$/);

      // --- Gross margin: 10.000.000 - 3 x 100.000 - 2.000.000 = 7.700.000 (77%) ---
      await page.getByRole("tab", { name: /Chi phí & lãi gộp/ }).click();
      await expect(page.getByTestId("summary-revenue")).toContainText("10.000.000");
      await expect(page.getByTestId("summary-material-cost")).toContainText("300.000");
      await expect(page.getByTestId("summary-direct-cost")).toContainText("2.000.000");
      await expect(page.getByTestId("summary-gross-profit")).toContainText("7.700.000");
      await expect(page.getByTestId("summary-gross-margin")).toContainText("77%");
    } finally {
      if (contractId) {
        await request.delete(`${API_URL}/contracts/${contractId}`, { headers }).catch(() => undefined);
      }
      if (projectId) {
        await request.delete(`${API_URL}/projects/${projectId}`, { headers }).catch(() => undefined);
      }
      if (customerId) {
        await request.delete(`${API_URL}/customers/${customerId}`, { headers }).catch(() => undefined);
      }
      // Confirmed allocations keep stock history, so these may be refused by the API; best effort only.
      if (materialId) {
        await request.delete(`${API_URL}/materials/${materialId}`, { headers }).catch(() => undefined);
      }
      if (warehouseId) {
        await request.delete(`${API_URL}/warehouses/${warehouseId}`, { headers }).catch(() => undefined);
      }
    }
  });
});
