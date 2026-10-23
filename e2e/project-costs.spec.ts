import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import ExcelJS from "../frontend/node_modules/exceljs";
import { getUserIdFromAccessToken } from "./api-auth";
import { login } from "./helpers";

const API_URL = process.env.E2E_API_URL ?? "http://127.0.0.1:3001/api";
const EARLY_LOT_DATE = "2026-01-10"; // qa-static: not-ui
const LATE_LOT_DATE = "2026-06-01"; // qa-static: not-ui
const SALES_INVOICE_DATE = "2026-03-31"; // qa-static: not-ui
const SECOND_SALES_DATE = "2026-07-31"; // qa-static: not-ui

function unwrap<T>(payload: unknown): T {
  return payload && typeof payload === "object" && "data" in payload
    ? (payload as { data: T }).data
    : payload as T;
}

async function apiSend<T>(
  request: APIRequestContext,
  method: "post" | "put" | "get",
  path: string,
  headers: Record<string, string>,
  data?: unknown
): Promise<T> {
  const response = await request[method](`${API_URL}${path}`, { headers, data });
  expect(response.ok(), `${method.toUpperCase()} ${path}: ${await response.text()}`).toBeTruthy(); // qa-static: not-ui
  return unwrap<T>(await response.json());
}

async function captureSaved(page: Page, method: "POST" | "PUT", path: string, action: () => Promise<void>) {
  const responsePromise = page.waitForResponse((response) =>
    response.request().method() === method && new URL(response.url()).pathname === `/api${path}` && response.ok()
  );
  await action();
  return unwrap<{ id: string }>(await (await responsePromise).json());
}

test.describe("Giá vốn dự án", () => {
  test("gợi ý FIFO đúng ngày, nhiều đợt, khóa chi phí, xuất bảng kê và tính lãi gộp trước VAT", async ({ page, request }) => {
    test.setTimeout(180_000);
    await login(page);
    const accessToken = await page.evaluate(() => window.sessionStorage.getItem("ahso_access_token"));
    expect(accessToken).toBeTruthy();
    const headers = { Authorization: `Bearer ${accessToken}` };
    const userId = getUserIdFromAccessToken(accessToken!);
    const stamp = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
    const invoiceNo = `HD-E2E-${stamp}`; // qa-static: not-ui
    const costDescription = `Lập trình PLC ${stamp}`; // qa-static: not-ui
    const lateDescription = `Chi phí sau ngày bán ${stamp}`; // qa-static: not-ui
    const cleanup: string[] = [];
    const send = <T>(method: "post" | "put" | "get", path: string, data?: unknown) =>
      apiSend<T>(request, method, path, headers, data);
    const create = async (path: string, data: unknown, deletePath = path) => {
      const result = await send<{ id: string; code: string }>("post", path, data);
      cleanup.unshift(`${deletePath}/${result.id}`);
      return result;
    };

    try {
      const warehouse = await create("/warehouses", {
        code: `E2E-WH-${stamp}`, name: `Kho chi phí ${stamp}`, isActive: true // qa-static: not-ui
      });
      const material = await create("/materials", {
        code: `E2E-CP-${stamp}`, name: `Vật tư chi phí ${stamp}`, unit: "Cái", kind: "STOCK" // qa-static: not-ui
      });
      for (const [date, quantity, unitPrice] of [
        [EARLY_LOT_DATE, 3, 100000], [LATE_LOT_DATE, 10, 200000]
      ] as const) {
        const receipt = await send<{ id: string }>("post", "/stock-receipts", {
          warehouseId: warehouse.id, date, purchaseInvoiceNo: `MUA-${date}-${stamp}`, // qa-static: not-ui
          items: [{ materialId: material.id, quantity, unitPrice }]
        });
        await send("post", `/stock-receipts/${receipt.id}/confirm`, {});
      }
      const customer = await create("/customers", {
        name: `Khách chi phí QA ${stamp}`, status: "LEAD", assignedToId: userId // qa-static: not-ui
      });
      const project = await create("/projects", {
        customerId: customer.id, name: `Dự án chi phí QA ${stamp}`, status: "DELIVERING" // qa-static: not-ui
      });
      const quote = await create("/quotes", {
        projectId: project.id, taxRate: 10, status: "ACCEPTED",
        items: [{ name: "Máy kiểm tra", quantity: 1, unitPrice: 10000000 }] // qa-static: not-ui
      });
      await create("/contracts", {
        projectId: project.id, sourceQuoteId: quote.id, value: 11000000, signDate: "2026-02-01" // qa-static: not-ui
      });
      const bom = await send<{ id: string }>("post", `/projects/${project.id}/boms`, {
        name: `BOM chi phí ${stamp}` // qa-static: not-ui
      });
      await send("put", `/boms/${bom.id}/lines`, { lines: [
        { group: "MECHANICAL", materialId: material.id, name: "Khung máy", quantity: 5, estUnitCost: 100000 }, // qa-static: not-ui
        { group: "SOFTWARE", name: "Phần mềm điều khiển", quantity: 1, estUnitCost: 1000000 } // qa-static: not-ui
      ] });
      const detail = await send<{ lines: Array<{ id: string; group: string }> }>("get", `/boms/${bom.id}`);
      const softwareLine = detail.lines.find((line) => line.group === "SOFTWARE")!;

      // Existing projects using the old singular endpoint still render in the batch list.
      const legacyProject = await create("/projects", {
        customerId: customer.id, name: `Dự án phân bổ cũ ${stamp}`, status: "COMPLETED", salesInvoiceDate: SALES_INVOICE_DATE // qa-static: not-ui
      });
      const eligible = await send<Array<{ id: string; materialId: string }>>(
        "get", `/projects/${legacyProject.id}/eligible-stock-lots?salesInvoiceDate=${SALES_INVOICE_DATE}`
      );
      const legacyLot = eligible.find((lot) => lot.materialId === material.id)!;
      await send("post", `/projects/${legacyProject.id}/material-allocation`, {
        salesInvoiceDate: SALES_INVOICE_DATE, items: [{ stockLotId: legacyLot.id, quantity: 1 }]
      });
      await page.goto(`/projects/${legacyProject.id}?tab=materials`);
      const legacyBatch = page.getByTestId("allocation-batch");
      await expect(legacyBatch).toHaveCount(1);
      await expect(legacyBatch).toHaveAttribute("data-status", "DRAFT");
      await expect(legacyBatch).toContainText("100.000");
      await legacyBatch.getByRole("button", { name: "Hủy đợt", exact: true }).click();
      await page.getByRole("dialog").getByRole("button", { name: "Xác nhận hủy", exact: true }).click();
      await expect(legacyBatch).toHaveCount(0);

      await page.goto(`/projects/${project.id}?tab=materials`);
      await page.getByRole("button", { name: "Tạo đợt phân bổ", exact: true }).click();
      const editor = page.getByTestId("allocation-editor");
      await editor.getByLabel("Ngày hóa đơn bán", { exact: true }).fill(SALES_INVOICE_DATE);
      await editor.getByLabel("Số hóa đơn bán", { exact: true }).fill(invoiceNo);
      await editor.getByLabel("BOM dự án", { exact: true }).selectOption(bom.id);
      await editor.getByRole("button", { name: "Gợi ý theo BOM", exact: true }).click();
      await expect(page.getByTestId("allocation-shortages")).toContainText("thiếu 2");
      await expect(page.getByTestId("allocation-service-lines")).toContainText("Phần mềm điều khiển"); // qa-static: not-ui
      await expect(page.getByTestId("allocation-row")).toHaveCount(1);
      await expect(editor.getByLabel("Số lượng", { exact: true })).toHaveValue("3");
      const lotId = await editor.getByLabel("Lô nhập", { exact: true }).inputValue();
      await editor.getByLabel("Lô nhập", { exact: true }).selectOption(lotId);
      await editor.getByLabel("Số lượng", { exact: true }).fill("2");
      await editor.getByLabel("Số lượng", { exact: true }).fill("3");
      const earlyOptions = await editor.getByLabel("Lô nhập", { exact: true }).locator("option").allTextContents();
      expect(earlyOptions.join(" ")).not.toContain("01/06/2026");
      const allocation = await captureSaved(page, "POST", `/projects/${project.id}/material-allocations`, () =>
        editor.getByRole("button", { name: "Lưu đợt nháp", exact: true }).click()
      );
      const batch = page.getByTestId("allocation-batch").filter({ hasText: invoiceNo });
      await expect(batch).toHaveAttribute("data-status", "DRAFT");

      await page.getByRole("tab", { name: "Chi phí & lãi gộp", exact: true }).click(); // qa-static: not-ui — label comes from the project tab configuration.
      await page.getByRole("button", { name: "Thêm chi phí", exact: true }).click();
      const dialog = page.getByRole("dialog");
      await dialog.getByLabel("Nhóm", { exact: true }).selectOption("SOFTWARE");
      await dialog.getByLabel("Mô tả", { exact: true }).fill(costDescription);
      await dialog.getByLabel("Ngày hóa đơn", { exact: true }).fill("2026-02-15"); // qa-static: not-ui
      await dialog.getByLabel("Số tiền trước VAT (₫)", { exact: true }).fill("1900000");
      await dialog.getByLabel("Dòng BOM liên quan", { exact: true }).selectOption(softwareLine.id);
      const cost = await captureSaved(page, "POST", `/projects/${project.id}/costs`, () =>
        dialog.getByRole("button", { name: "Lưu chi phí", exact: true }).click()
      );
      await expect(dialog).toHaveCount(0);
      const costRow = page.getByTestId("project-cost-row").filter({ hasText: costDescription });
      await expect(costRow.locator("td").first()).toHaveText("Phần mềm"); // qa-static: not-ui — dynamic cost-group label.
      await costRow.getByRole("button", { name: "Sửa", exact: true }).click();
      await expect(dialog.getByLabel("Số tiền trước VAT (₫)", { exact: true })).toHaveValue("1900000");
      await dialog.getByLabel("Số tiền trước VAT (₫)", { exact: true }).fill("2000000");
      await dialog.getByRole("button", { name: "Lưu chi phí", exact: true }).click();
      await expect(dialog).toHaveCount(0);
      await expect(costRow).toContainText("2.000.000");
      const savedCosts = await send<Array<{ id: string; group: string; amount: number }>>("get", `/projects/${project.id}/costs`);
      expect(savedCosts.find((item) => item.id === cost.id)).toMatchObject({ group: "SOFTWARE", amount: 2000000 });

      await page.getByRole("tab", { name: "Vật tư", exact: true }).click();
      await batch.getByRole("button", { name: "Sửa đợt nháp", exact: true }).click();
      await editor.getByLabel("BOM dự án", { exact: true }).selectOption(bom.id);
      await editor.getByRole("button", { name: "Gợi ý theo BOM", exact: true }).click();
      // Refreshing a draft must reuse its own reserved 3 pieces.
      await expect(editor.getByLabel("Số lượng", { exact: true })).toHaveValue("3");
      await expect(page.getByTestId("allocation-shortages")).toContainText("thiếu 2");
      await expect(page.getByTestId("allocation-service-lines")).toHaveCount(0);
      await editor.getByRole("checkbox", { name: new RegExp(costDescription) }).check();
      await editor.getByRole("button", { name: "Lưu đợt nháp", exact: true }).click();
      await expect(editor).toHaveCount(0);

      const lateCost = await send<{ id: string }>("post", `/projects/${project.id}/costs`, {
        group: "OTHER", description: lateDescription, invoiceDate: LATE_LOT_DATE, amount: 50000
      });
      const rejected = await request.put(`${API_URL}/material-allocations/${allocation.id}`, {
        headers, data: { salesInvoiceDate: SALES_INVOICE_DATE, items: [{ stockLotId: lotId, quantity: 3 }], costIds: [cost.id, lateCost.id] }
      });
      expect(rejected.status()).toBe(400);
      expect(await rejected.text()).toContain("có ngày hóa đơn sau ngày hóa đơn bán ra");

      await page.goto(`/projects/${project.id}?tab=costs`);
      await costRow.getByRole("button", { name: "Sửa", exact: true }).click();
      await dialog.getByLabel("Ngày hóa đơn", { exact: true }).fill(LATE_LOT_DATE);
      const invalidDateResponse = page.waitForResponse((response) =>
        response.request().method() === "PATCH" && new URL(response.url()).pathname === `/api/project-costs/${cost.id}`
      );
      await dialog.getByRole("button", { name: "Lưu chi phí", exact: true }).click();
      expect((await invalidDateResponse).status()).toBe(400);
      await expect(page.getByText("Không thể lưu chi phí: Ngày hóa đơn chi phí không được sau ngày hóa đơn bán ra của đợt phân bổ", { exact: true })).toBeVisible(); // qa-static: not-ui — the toast wrapper combines its title with the API validation message.
      await dialog.getByRole("button", { name: "Đóng", exact: true }).click();
      await page.getByTestId("project-cost-row").filter({ hasText: lateDescription }).getByRole("button", { name: "Xóa", exact: true }).click();
      await dialog.getByRole("button", { name: "Xác nhận xóa", exact: true }).click();
      await expect(page.getByTestId("project-cost-row")).toHaveCount(1);

      await page.getByRole("tab", { name: "Vật tư", exact: true }).click();
      await batch.getByRole("button", { name: "Xác nhận xuất kho", exact: true }).click();
      await expect(batch).toHaveAttribute("data-status", "CONFIRMED");
      await expect(batch.getByRole("button", { name: "Sửa đợt nháp", exact: true })).toHaveCount(0);
      await expect(batch.getByRole("button", { name: "Hủy đợt", exact: true })).toHaveCount(0);
      const [download] = await Promise.all([
        page.waitForEvent("download"),
        batch.getByRole("button", { name: "Xuất bảng kê giá vốn", exact: true }).click()
      ]);
      expect(download.suggestedFilename()).toMatch(/\.xlsx$/);
      const exported = new ExcelJS.Workbook();
      await exported.xlsx.readFile((await download.path())!);
      const sheet = exported.worksheets[0];
      expect(sheet.getCell("A1").value).toBe(`Bảng kê giá vốn hóa đơn bán số ${invoiceNo}`);
      expect(sheet.getCell("B7").value).toBe(material.code);
      expect(sheet.getCell("E7").value).toBe(3);
      expect(sheet.getCell("G7").value).toBe(300000);
      const costSheetRows = sheet.getSheetValues().flatMap((row) => Array.isArray(row) ? [row] : []);
      expect(costSheetRows.some((row) => row[3] === costDescription && row[7] === 2000000)).toBeTruthy();
      expect(sheet.lastRow?.getCell(7).value).toBe(2300000);

      await page.getByRole("tab", { name: "Chi phí & lãi gộp", exact: true }).click(); // qa-static: not-ui — label comes from the project tab configuration.
      await expect(costRow).toContainText("Đã khóa theo đợt phân bổ đã xác nhận");
      await expect(costRow.getByRole("button")).toHaveCount(0);
      for (const method of ["patch", "delete"] as const) {
        const response = await request[method](`${API_URL}/project-costs/${cost.id}`, { headers, data: method === "patch" ? { amount: 1 } : undefined });
        expect(response.status()).toBe(400);
        expect(await response.text()).toContain("Chi phí đã gắn vào đợt phân bổ đã xác nhận");
      }
      await expect(page.getByTestId("summary-revenue")).toContainText("10.000.000");
      await expect(page.getByTestId("summary-material-cost")).toContainText("300.000");
      await expect(page.getByTestId("summary-direct-cost")).toContainText("2.000.000");
      await expect(page.getByTestId("summary-gross-profit")).toContainText("7.700.000");
      await expect(page.getByTestId("summary-gross-margin")).toContainText("77%");
      const softwareGroup = page.getByTestId("variance-group-SOFTWARE");
      await expect(softwareGroup.locator("td").last()).toHaveClass(/text-danger/);
      await softwareGroup.getByRole("button").click();
      await expect(page.getByTestId("variance-line").filter({ hasText: "Phần mềm điều khiển" })).toContainText("2.000.000"); // qa-static: not-ui

      // The second sales invoice uses only the remaining BOM demand: 5 - 3 = 2.
      await page.getByRole("tab", { name: "Vật tư", exact: true }).click();
      await page.getByRole("button", { name: "Tạo đợt phân bổ", exact: true }).click();
      await editor.getByLabel("Ngày hóa đơn bán", { exact: true }).fill(SECOND_SALES_DATE);
      await editor.getByLabel("Số hóa đơn bán", { exact: true }).fill(`${invoiceNo}-2`);
      await editor.getByLabel("BOM dự án", { exact: true }).selectOption(bom.id);
      await editor.getByRole("button", { name: "Gợi ý theo BOM", exact: true }).click();
      await expect(editor.getByLabel("Số lượng", { exact: true })).toHaveValue("2");
      await expect(page.getByTestId("allocation-shortages")).toHaveCount(0);
      await editor.getByRole("button", { name: "Lưu đợt nháp", exact: true }).click();
      await expect(page.getByTestId("allocation-batch")).toHaveCount(2);
      const secondBatch = page.getByTestId("allocation-batch").filter({ hasText: `${invoiceNo}-2` });
      await secondBatch.getByRole("button", { name: "Xác nhận xuất kho", exact: true }).click();
      await expect(secondBatch).toHaveAttribute("data-status", "CONFIRMED");
      await page.getByRole("tab", { name: "Chi phí & lãi gộp", exact: true }).click(); // qa-static: not-ui — label comes from the project tab configuration.
      await expect(page.getByTestId("summary-material-cost")).toContainText("700.000");
      await expect(page.getByTestId("summary-gross-profit")).toContainText("7.300.000");
      await expect(page.getByTestId("summary-gross-margin")).toContainText("73%");
    } finally {
      // Confirmed inventory movements remain as audit history; remove the CRM fixtures first.
      for (const path of cleanup) {
        await request.delete(`${API_URL}${path}`, { headers }).catch(() => undefined);
      }
    }
  });
});
