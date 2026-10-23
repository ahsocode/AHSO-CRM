import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import ExcelJS from "../frontend/node_modules/exceljs";
import { getUserIdFromAccessToken } from "./api-auth";
import { login } from "./helpers";

const API_URL = process.env.E2E_API_URL ?? "http://127.0.0.1:3001/api";

function unwrap<T>(payload: unknown): T {
  return payload && typeof payload === "object" && "data" in payload
    ? (payload as { data: T }).data
    : payload as T;
}

async function setupScenario(page: Page, request: APIRequestContext) {
  await login(page);
  const token = await page.evaluate(() => window.sessionStorage.getItem("ahso_access_token"));
  expect(token).toBeTruthy();
  const headers = { Authorization: `Bearer ${token}` };
  const cleanup: string[] = [];
  const stamp = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
  const send = async <T>(method: "post" | "put" | "patch" | "get", path: string, data?: unknown): Promise<T> => {
    const response = await request[method](`${API_URL}${path}`, { headers, data });
    expect(response.ok(), `${method} ${path}: ${await response.text()}`).toBeTruthy(); // qa-static: not-ui
    return unwrap<T>(await response.json());
  };
  const track = (path: string) => cleanup.push(path);
  const create = async (path: string, data: unknown, deletePath = path) => {
    const result = await send<{ id: string; code: string }>("post", path, data);
    track(`${deletePath}/${result.id}`);
    return result;
  };
  const dispose = async () => {
    const failures: string[] = [];
    const priority = (path: string) => path.startsWith("/quotes/") ? 0 : path.startsWith("/boms/") ? 1 : 2;
    for (const path of cleanup.reverse().sort((a, b) => priority(a) - priority(b))) {
      const response = await request.delete(`${API_URL}${path}`, { headers });
      if (!response.ok() && response.status() !== 404) failures.push(`${path}: ${await response.text()}`);
    }
    expect(failures, "Scenario cleanup").toEqual([]); // qa-static: not-ui
  };
  return { stamp, headers, send, create, track, dispose, userId: getUserIdFromAccessToken(token!) };
}

async function createProject(scenario: Awaited<ReturnType<typeof setupScenario>>) {
  const customer = await scenario.create("/customers", {
    name: `Khách BOM ${scenario.stamp}`, status: "LEAD", assignedToId: scenario.userId // qa-static: not-ui
  });
  return scenario.create("/projects", { customerId: customer.id, name: `Dự án BOM ${scenario.stamp}` }); // qa-static: not-ui
}

async function captureCreated(page: Page, path: string, action: () => Promise<void>) {
  const responsePromise = page.waitForResponse((response) =>
    response.request().method() === "POST" && new URL(response.url()).pathname === `/api${path}` && response.ok()
  );
  await action();
  return unwrap<{ id: string; productId?: string }>(await (await responsePromise).json());
}

test.describe("BOM", () => {
  test("tạo dự toán, duyệt khóa dòng và tạo phiên bản mới", async ({ page, request }) => {
    const scenario = await setupScenario(page, request);
    try {
      const project = await createProject(scenario);
      const material = await scenario.create("/materials", {
        code: `BOM-VT-${scenario.stamp}`, name: `Động cơ ${scenario.stamp}`, unit: "Cái", kind: "STOCK" // qa-static: not-ui
      });
      await page.goto(`/projects/${project.id}?tab=boms`);
      await expect(page.getByRole("tab", { name: "BOM / Dự toán" })).toHaveAttribute("aria-selected", "true");
      await page.getByRole("button", { name: "Tạo BOM", exact: true }).click(); // qa-static: not-ui — role/scoped selector; dialog heading repeats this label.
      const dialog = page.getByRole("dialog");
      await dialog.getByLabel("Tên BOM").fill(`BOM thử nghiệm ${scenario.stamp}`); // qa-static: not-ui
      const bom = await captureCreated(page, `/projects/${project.id}/boms`, () => dialog.getByRole("button", { name: "Tạo BOM", exact: true }).click()); // qa-static: not-ui — role/scoped selector; dialog heading repeats this label.
      scenario.track(`/boms/${bom.id}`);
      await expect(page).toHaveURL(new RegExp(`/projects/${project.id}/boms/${bom.id}$`));
      await page.getByRole("button", { name: "Thêm dòng", exact: true }).click();
      await page.locator('[aria-label="Tên 1"]').fill("Động cơ chính"); // qa-static: not-ui
      await expect(page.getByTestId("bom-line-row")).toHaveAttribute("data-unlinked", "true");
      await page.getByRole("button", { name: "Chọn mã vật tư" }).click();
      const picker = page.getByRole("dialog", { name: "Chọn vật tư hoặc cụm" });
      await picker.getByLabel("Tìm vật tư").fill(material.code);
      await picker.getByRole("button").filter({ hasText: material.code }).click();
      await expect(page.getByTestId("bom-line-row")).toHaveAttribute("data-unlinked", "false");
      await page.locator('[aria-label="Số lượng 1"]').fill("3");
      await page.locator('[aria-label="Đơn giá dự kiến 1"]').fill("125000");
      await expect(page.getByTestId("bom-total")).toContainText("375.000");
      await page.getByRole("button", { name: "Lưu", exact: true }).click();
      await expect(page.getByRole("button", { name: "Lưu", exact: true })).toBeDisabled();
      await page.getByRole("button", { name: "Duyệt", exact: true }).click();
      await page.getByRole("button", { name: "Xác nhận duyệt", exact: true }).click();
      await expect(page.locator('[aria-label="Tên 1"]')).toHaveAttribute("readonly", "");
      await expect(page.locator('[aria-label="Nhóm 1"]')).toBeDisabled();
      await expect(page.getByRole("button", { name: "Thêm dòng", exact: true })).toHaveCount(0);
      const rejected = await request.put(`${API_URL}/boms/${bom.id}/lines`, { headers: scenario.headers, data: { lines: [] } });
      expect(rejected.status()).toBe(400);
      const next = await captureCreated(page, `/boms/${bom.id}/new-version`, () => page.getByRole("button", { name: "Tạo phiên bản mới", exact: true }).click());
      scenario.track(`/boms/${next.id}`);
      await expect(page).toHaveURL(new RegExp(`/boms/${next.id}$`));
      await expect(page.locator('[aria-label="Tên 1"]')).not.toHaveAttribute("readonly");
      await expect(page.getByTestId("bom-total")).toContainText("375.000");
    } finally {
      await scenario.dispose();
    }
  });

  test("gắn BOM vào báo giá, tính giá vốn nội bộ và giữ bản in riêng", async ({ page, request }) => {
    const scenario = await setupScenario(page, request);
    try {
      const project = await createProject(scenario);
      const bom = await scenario.create(`/projects/${project.id}/boms`, { name: `Dự toán báo giá ${scenario.stamp}` }, "/boms"); // qa-static: not-ui
      await scenario.send("put", `/boms/${bom.id}/lines`, { lines: [
        { group: "SOFTWARE", name: "Lập trình điều khiển", quantity: 4, estUnitCost: 100000 } // qa-static: not-ui
      ] });
      await page.goto(`/quotes/new?projectId=${project.id}`);
      await page.getByLabel("Tên hạng mục 1").fill("Máy kiểm tra tự động"); // qa-static: not-ui
      await page.locator('[aria-label="Số lượng 1"]').fill("2");
      await page.locator('[aria-label="Đơn giá 1"]').fill("1000000");
      await page.locator('button[aria-label="Thao tác dòng 1"]').click();
      await page.getByRole("menuitem", { name: "Gắn BOM", exact: true }).click();
      await page.getByLabel("BOM dự án").selectOption(bom.id);
      await page.getByRole("button", { name: "Xong", exact: true }).click();
      const quote = await captureCreated(page, "/quotes", () => page.getByRole("button", { name: "Tạo báo giá", exact: true }).click());
      scenario.track(`/quotes/${quote.id}`);
      await expect(page).toHaveURL(new RegExp(`/quotes/${quote.id}$`));
      const costBlock = page.getByTestId("quote-cost-estimate");
      await expect(costBlock).toContainText("Nội bộ — không in ra báo giá");
      await expect(costBlock).toContainText("800.000");
      await expect(costBlock).toContainText("1.200.000");
      await expect(costBlock).toContainText("60%");
      const detail = await scenario.send<{ items: Array<{ bomId: string }> }>("get", `/quotes/${quote.id}`);
      expect(detail.items[0].bomId).toBe(bom.id);

      // Editing a quote must preserve the internal BOM link.
      await page.goto(`/quotes/${quote.id}/edit`);
      await expect(page.getByLabel("Tên hạng mục 1")).toHaveValue("Máy kiểm tra tự động"); // qa-static: not-ui
      await page.getByRole("button", { name: "Lưu thay đổi", exact: true }).click();
      await expect(page).toHaveURL(new RegExp(`/quotes/${quote.id}$`));
      await expect(page.getByTestId("quote-cost-estimate")).toContainText("800.000");
      const printResponse = await request.get(`${API_URL}/documents/QUOTATION/${quote.id}/preview?lang=vi`, { headers: scenario.headers });
      expect(printResponse.ok(), await printResponse.text()).toBeTruthy();
      const html = await printResponse.text();
      expect(html).toContain("Máy kiểm tra tự động"); // qa-static: not-ui
      expect(html).not.toMatch(/Giá vốn|Lãi gộp|costEstimate|bomId/i); // qa-static: not-ui
      expect(html).not.toContain(bom.id);
      const pdf = await request.get(`${API_URL}/quotes/${quote.id}/pdf`, { headers: scenario.headers });
      expect(pdf.ok(), `PDF: ${pdf.status()}`).toBeTruthy(); // qa-static: not-ui
      expect((await pdf.body()).subarray(0, 4).toString()).toBe("%PDF");
    } finally {
      await scenario.dispose();
    }
  });

  test("lưu thành mẫu máy và tạo BOM dự án mới từ mẫu đã duyệt", async ({ page, request }) => {
    const scenario = await setupScenario(page, request);
    try {
      const project = await createProject(scenario);
      const source = await scenario.create(`/projects/${project.id}/boms`, { name: `Mẫu máy ${scenario.stamp}` }, "/boms"); // qa-static: not-ui
      const material = await scenario.create("/materials", {
        code: `BOM-KH-${scenario.stamp}`, name: "Khung máy kiểm tra", unit: "Bộ", kind: "STOCK" // qa-static: not-ui
      });
      await scenario.send("put", `/boms/${source.id}/lines`, { lines: [
        { group: "MECHANICAL", materialId: material.id, name: "Khung máy kiểm tra", quantity: 1, estUnitCost: 500000 } // qa-static: not-ui
      ] });
      await page.goto(`/projects/${project.id}/boms/${source.id}`);
      await page.getByRole("button", { name: "Lưu thành mẫu máy", exact: true }).click(); // qa-static: not-ui — role/scoped selector; dialog heading repeats this label.
      const dialog = page.getByRole("dialog", { name: "Lưu thành mẫu máy" }); // qa-static: not-ui — role/scoped selector; dialog heading repeats this label.
      await dialog.getByLabel("Tạo thành phẩm mới", { exact: true }).check();
      await dialog.getByLabel("Mã thành phẩm", { exact: true }).fill(`MAY-${scenario.stamp}`); // qa-static: not-ui
      const model = await captureCreated(page, `/boms/${source.id}/save-as-model`, () => dialog.getByRole("button", { name: "Lưu thành mẫu máy", exact: true }).click()); // qa-static: not-ui — role/scoped selector; dialog heading repeats this label.
      const modelDetail = await scenario.send<{ productId: string }>("get", `/boms/${model.id}`);
      scenario.track(`/materials/${modelDetail.productId}`);
      scenario.track(`/boms/${model.id}`);
      await expect(page).toHaveURL(new RegExp(`/inventory/models/${model.id}$`));
      await page.getByRole("button", { name: "Duyệt", exact: true }).click();
      await page.getByRole("button", { name: "Xác nhận duyệt", exact: true }).click();
      await expect(page.getByRole("button", { name: "Tạo phiên bản mới", exact: true })).toBeVisible();
      await page.goto("/inventory/models");
      await page.getByLabel("Tìm mẫu máy").fill(scenario.stamp);
      await expect(page.getByTestId("model-row")).toContainText("500.000");
      const secondProject = await scenario.create("/projects", {
        customerId: (await scenario.send<{ customer: { id: string } }>("get", `/projects/${project.id}`)).customer.id,
        name: `Dự án dùng mẫu ${scenario.stamp}` // qa-static: not-ui
      });
      await page.goto(`/projects/${secondProject.id}?tab=boms`);
      await page.getByRole("button", { name: "Tạo BOM", exact: true }).click(); // qa-static: not-ui — role/scoped selector; dialog heading repeats this label.
      const createDialog = page.getByRole("dialog", { name: "Tạo BOM" }); // qa-static: not-ui — role/scoped selector; dialog heading repeats this label.
      await createDialog.getByLabel("Tên BOM", { exact: true }).fill("BOM từ mẫu máy"); // qa-static: not-ui
      await createDialog.getByLabel("Từ mẫu máy", { exact: true }).check();
      await createDialog.getByLabel("Mẫu máy (đã duyệt)", { exact: true }).selectOption(model.id);
      const copied = await captureCreated(page, `/projects/${secondProject.id}/boms`, () => createDialog.getByRole("button", { name: "Tạo BOM", exact: true }).click()); // qa-static: not-ui — role/scoped selector; dialog heading repeats this label.
      scenario.track(`/boms/${copied.id}`);
      await expect(page).toHaveURL(new RegExp(`/boms/${copied.id}$`));
      await expect(page.locator('[aria-label="Tên 1"]')).toHaveValue("Khung máy kiểm tra"); // qa-static: not-ui
      await expect(page.getByTestId("bom-total")).toContainText("500.000");
      const copyDetail = await scenario.send<{ sourceBomId: string; projectId: string }>("get", `/boms/${copied.id}`);
      expect(copyDetail.sourceBomId).toBe(model.id);
      expect(copyDetail.projectId).toBe(secondProject.id);
    } finally {
      await scenario.dispose();
    }
  });

  test("nhập Excel ghép cột, khớp mã, nối thêm và thay thế rồi xuất Excel", async ({ page, request }) => {
    test.setTimeout(90_000);
    const scenario = await setupScenario(page, request);
    try {
      const project = await createProject(scenario);
      const material = await scenario.create("/materials", {
        code: `BOM-EX-${scenario.stamp}`, name: "Camera kiểm tra", unit: "Cái", kind: "STOCK" // qa-static: not-ui
      });
      const bom = await scenario.create(`/projects/${project.id}/boms`, { name: "BOM nhập Excel" }, "/boms"); // qa-static: not-ui
      const workbook = new ExcelJS.Workbook();
      workbook.addWorksheet("Bìa").addRow(["Bảng định mức vật tư"]); // qa-static: not-ui
      const sheet = workbook.addWorksheet("Định mức"); // qa-static: not-ui
      sheet.addRow(["STT", "Part No", "Description", "Unit", "Qty", "Unit price", "Group"]); // qa-static: not-ui
      sheet.addRow([1, material.code, "Camera kiểm tra", "Cái", 2, 100000, "Vision – camera"]); // qa-static: not-ui
      sheet.addRow([]);
      sheet.addRow([2, "KHONG-KHOP", "Lập trình phần mềm", "Gói", 1, 250000, "Phần mềm"]); // qa-static: not-ui
      sheet.addRow(["", "", "Tổng cộng", "", "", 450000]); // qa-static: not-ui
      const buffer = Buffer.from(await workbook.xlsx.writeBuffer());
      await page.goto(`/projects/${project.id}/boms/${bom.id}`);
      async function importWorkbook(replace: boolean) {
        await page.getByRole("button", { name: "Nhập Excel", exact: true }).click();
        const dialog = page.getByRole("dialog", { name: "Nhập BOM từ Excel" });
        await dialog.getByLabel("Tệp Excel (.xlsx)").setInputFiles({ name: "bom.xlsx", mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", buffer }); // qa-static: not-ui
        await dialog.getByLabel("Trang tính", { exact: true }).selectOption({ label: "Định mức (5 dòng)" }); // qa-static: not-ui
        await expect(dialog.locator("#bom-map-name")).toHaveValue("2");
        await expect(dialog.locator("p").filter({ hasText: "Xem trước (2/2 dòng" })).toBeVisible();
        await expect(dialog.getByText("Đã gắn mã", { exact: true })).toBeVisible();
        if (replace) await dialog.getByLabel(/Thay thế/).check();
        await dialog.getByRole("button", { name: /^Thêm vào BOM \(/ }).click();
      }
      await importWorkbook(false);
      await expect(page.getByTestId("bom-line-row")).toHaveCount(2);
      await expect(page.getByTestId("bom-line-row").first()).toHaveAttribute("data-unlinked", "false");
      await expect(page.getByTestId("bom-line-row").last()).toHaveAttribute("data-unlinked", "true");
      await expect(page.getByTestId("bom-total")).toContainText("450.000");
      await importWorkbook(false);
      await expect(page.getByTestId("bom-line-row")).toHaveCount(4);
      await importWorkbook(true);
      await expect(page.getByTestId("bom-line-row")).toHaveCount(2);
      await page.getByRole("button", { name: "Lưu", exact: true }).click();
      await expect(page.getByRole("button", { name: "Lưu", exact: true })).toBeDisabled();
      const [download] = await Promise.all([
        page.waitForEvent("download"),
        page.getByRole("button", { name: "Xuất Excel", exact: true }).click()
      ]);
      expect(download.suggestedFilename()).toMatch(/\.xlsx$/);
      const exported = new ExcelJS.Workbook();
      await exported.xlsx.readFile((await download.path())!);
      expect(exported.worksheets[0].getCell("C2").value).toBe(material.code);
      expect(exported.worksheets[0].getCell("G2").value).toBe(2);
      expect(exported.worksheets[0].lastRow?.getCell(9).value).toBe(450000);
    } finally {
      await scenario.dispose();
    }
  });
});
