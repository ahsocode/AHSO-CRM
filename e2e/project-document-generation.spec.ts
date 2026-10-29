import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { login } from "./helpers";
import { getUserIdFromAccessToken } from "./api-auth";

const DEVICE_NAME = "Thiết bị thực tế"; // qa-static: not-ui — API fixture, rendered inside generated HTML
const API = process.env.E2E_API_URL ?? "http://localhost:3001/api";
async function auth(page: Page) {
  await login(page);
  const token = await page.evaluate(() => sessionStorage.getItem("ahso_access_token"));
  return { Authorization: `Bearer ${token}` };
}
async function createFixture(request: APIRequestContext, headers: Record<string,string>, owner: string) {
  const post = async (path: string, data: unknown) => {
    const res = await request.post(`${API}${path}`, {headers, data});
    expect(res.ok(), `${path}: ${await res.text()}`).toBeTruthy();
    return (await res.json()).data;
  };
  const stamp = Date.now();
  const customer = await post("/customers", {name:`Khách hồ sơ ${stamp}`, assignedToId:owner});
  const project = await post("/projects", {name:`Dự án hồ sơ ${stamp}`, customerId:customer.id, description:"Phạm vi đã ghi nhận"});
  const quote = await post("/quotes", {projectId:project.id, status:"DRAFT", items:[{name:DEVICE_NAME, quantity:1, unitPrice:100000, unit:"bộ"}]});
  return {customer, project, quote, post};
}

test.describe("Sinh tài liệu dự án an toàn", () => {
  test("thiếu dữ liệu bị khóa; báo giá nháp xem trước, tạo và xuất hiện trong danh sách", async ({page, request}) => {
    test.setTimeout(180000);
    const headers = await auth(page);
    const owner = getUserIdFromAccessToken(headers.Authorization.slice(7));
    const {customer, project, quote, post} = await createFixture(request, headers, owner);
    try {
      await page.goto(`/projects/${project.id}?tab=documents`);
      const table = page.getByRole("region", {name:"Sinh tài liệu theo loại"});
      const missing = table.locator('[data-document-type="DOC_HANDOVER"]');
      await expect(missing).toContainText("Thiếu:");
      await expect(missing.getByRole("button", {name:"Tạo", exact:true})).toBeDisabled();
      await expect(missing).toContainText("hợp đồng thực tế");
      const ready = table.locator('[data-document-type="QUOTATION"]');
      await expect(ready).toContainText("Đủ dữ liệu");
      await ready.getByRole("button", {name:"Xem trước", exact:true}).click();
      await expect(page.frameLocator('iframe[title="Nội dung tài liệu xem trước"]').getByText(DEVICE_NAME, {exact:true})).toBeVisible();
      await page.keyboard.press("Escape");
      const rendered = page.waitForResponse(res => res.url().endsWith(`/documents/QUOTATION/${quote.id}/render`) && res.request().method()==="POST");
      await ready.getByRole("button", {name:"Tạo", exact:true}).click();
      const renderResponse = await rendered;
      expect(renderResponse.ok(), await renderResponse.text()).toBeTruthy();
      const generated = (await renderResponse.json()).data;
      await expect(ready.getByRole("button", {name:"Tải bản đã tạo"})).toBeEnabled();
      const rerender = await request.post(`${API}/documents/QUOTATION/${quote.id}/render`, {headers, data:{language:"vi", projectId:project.id}});
      expect(rerender.ok(), await rerender.text()).toBeTruthy();
      const current = (await rerender.json()).data;
      const docs = (await (await request.get(`${API}/projects/${project.id}/documents`, {headers})).json()).data;
      const linked = docs.businessDocuments.filter((doc: {type:string}) => doc.type==="QUOTATION");
      expect(linked).toHaveLength(1);
      expect(linked[0]).toMatchObject({projectId:project.id, customerId:customer.id, quoteId:quote.id, generatedDocumentId:current.documentId});
      for (const path of [`/documents/${generated.documentId}/download`, `/documents/QUOTATION/${quote.id}/download`]) {
        const file = await request.get(`${API}${path}`, {headers});
        expect(file.ok()).toBeTruthy();
        expect(file.headers()["content-type"]).toContain("application/pdf");
      }
      await page.goto("/documents");
      await page.getByRole("searchbox").fill(current.number);
      await expect(page.getByRole("table").getByText(current.number, {exact:true})).toBeVisible();
      // Missing operational evidence is a structured 422, never a sample PDF.
      const contract = await post("/contracts", {projectId:project.id, value:108000, signDate:new Date().toISOString()});
      for (const type of ["DOC_HANDOVER","MAINTENANCE_RECORD","CONTRACT_ADDENDUM","INSTALLATION_REPORT","ACCEPTANCE_REPORT","PARTIAL_ACCEPTANCE","PAYMENT_REQUEST","PAYMENT_RECEIPT"]) {
        const res = await request.post(`${API}/documents/${type}/${contract.id}/render`, {headers, data:{language:"vi"}});
        expect(res.status(), `${type}: ${await res.text()}`).toBe(422);
        expect((await res.json()).errors).toEqual(expect.arrayContaining([expect.objectContaining({field:expect.any(String), message:expect.any(String)})]));
      }
      // Explicitly supplied operational data makes the same readiness check pass.
      const source = await request.post(`${API}/documents/DOC_HANDOVER/${contract.id}/source-data`, {headers, data:{data:{handedOverDocs:[{name:"Hướng dẫn thiết bị đã giao", format:"PDF"}], handoverDate:new Date().toISOString()}}}); // qa-static: not-ui — recorded evidence via API
      expect(source.ok(), await source.text()).toBeTruthy();
      const handover = await request.post(`${API}/documents/DOC_HANDOVER/${contract.id}/render`, {headers, data:{language:"vi", projectId:project.id}});
      expect(handover.ok(), await handover.text()).toBeTruthy();
    } finally {
      await request.delete(`${API}/projects/${project.id}`, {headers});
      await request.delete(`${API}/customers/${customer.id}`, {headers});
    }
  });

  test("STAFF chỉ xem phạm vi phụ trách, không có nút tạo và không tải tài liệu ngoài phạm vi", async ({page, request, browser}) => {
    test.setTimeout(120000);
    const headers = await auth(page);
    const owner = getUserIdFromAccessToken(headers.Authorization.slice(7));
    const users = (await (await request.get(`${API}/users`, {headers})).json()).data as Array<{id:string; email:string}>;
    const staff = users.find(user => user.email==="staff@ahso.vn");
    expect(staff).toBeDefined();
    const foreign = await createFixture(request, headers, owner);
    const own = await createFixture(request, headers, staff!.id);
    const context = await browser.newContext();
    try {
      const generatedResponse = await request.post(`${API}/documents/QUOTATION/${foreign.quote.id}/render`, {headers, data:{language:"vi", projectId:foreign.project.id}});
      expect(generatedResponse.ok()).toBeTruthy();
      const generated = (await generatedResponse.json()).data;
      const loginRes = await context.request.post(`${API}/auth/login`, {data:{email:"staff@ahso.vn", password:"AHSO123!"}});
      expect(loginRes.ok()).toBeTruthy();
      const session = (await loginRes.json()).data;
      const staffHeaders = {Authorization:`Bearer ${session.accessToken}`};
      for (const path of [`/documents/QUOTATION/${foreign.quote.id}/preview`, `/documents/${generated.documentId}/download`, `/documents/QUOTATION/${foreign.quote.id}/download`]) {
        expect((await context.request.get(`${API}${path}`, {headers:staffHeaders})).status(), path).toBe(404);
      }
      const forbidden = await context.request.post(`${API}/documents/QUOTATION/${own.quote.id}/render`, {headers:staffHeaders, data:{language:"vi"}});
      expect(forbidden.status()).toBe(403);
      const staffPage = await context.newPage();
      await staffPage.addInitScript(({accessToken,user}) => {
        sessionStorage.setItem("ahso_access_token", accessToken);
        localStorage.setItem("ahso_auth_user", JSON.stringify(user));
      }, session);
      await staffPage.goto(`${process.env.E2E_BASE_URL ?? "http://localhost:3000"}/projects/${own.project.id}?tab=documents`);
      const table = staffPage.getByRole("region", {name:"Sinh tài liệu theo loại"});
      await expect(table).toContainText("cần quyền tạo tài liệu");
      await expect(table.getByRole("button", {name:"Tạo", exact:true})).toHaveCount(0);
      await expect(table.getByRole("button", {name:"Nhập dữ liệu", exact:true})).toHaveCount(0);
      await expect(staffPage.getByRole("button", {name:"Sinh tài liệu còn thiếu", exact:true})).toHaveCount(0);
      await table.locator('[data-document-type="QUOTATION"]').getByRole("button", {name:"Xem trước", exact:true}).click();
      await expect(staffPage.getByRole("dialog")).toBeVisible();
    } finally {
      await context.close();
      for (const fixture of [foreign,own]) {
        await request.delete(`${API}/projects/${fixture.project.id}`, {headers});
        await request.delete(`${API}/customers/${fixture.customer.id}`, {headers});
      }
    }
  });
  test("nhập dữ liệu thực tế cho bảy loại, sửa lỗi 422 từng trường rồi tạo PDF", async ({page, request}) => {
    test.setTimeout(240000);
    const headers = await auth(page);
    const owner = getUserIdFromAccessToken(headers.Authorization.slice(7));
    const {customer, project, post} = await createFixture(request, headers, owner);
    const contract = await post("/contracts", {projectId:project.id, value:108000, signDate:new Date().toISOString()});
    const date = "2026-09-16"; // qa-static: not-ui — actual-evidence fixture date
    try {
      await page.goto(`/projects/${project.id}?tab=documents`);
      const table = page.getByRole("region", {name:"Sinh tài liệu theo loại"});
      const types = ["CONTRACT_ADDENDUM", "DOC_HANDOVER", "INSTALLATION_REPORT", "ACCEPTANCE_REPORT", "MAINTENANCE_RECORD", "DELIVERY_NOTE", "AR_RECONCILIATION"];
      for (const type of types) {
        const row = table.locator(`[data-document-type="${type}"]`);
        await expect(row.getByRole("button", {name:"Tạo", exact:true})).toBeDisabled();
        await row.getByRole("button", {name:"Nhập dữ liệu", exact:true}).click();
        const dialog = page.getByRole("dialog", {name:"Nhập dữ liệu thực tế"});
        const fill = (label: string, value: string) => dialog.getByLabel(label, {exact:false}).fill(value);
        const choose = async (label: string, value: string) => {
          await dialog.getByLabel(label, {exact:false}).click();
          await page.getByRole("option", {name:value, exact:true}).click();
        };
        if (type === "DOC_HANDOVER") {
          await expect(dialog.getByLabel("Ngày bàn giao thực tế")).toBeVisible();
          const invalid = page.waitForResponse(res => res.url().endsWith(`/documents/${type}/${contract.id}/source-data`) && res.request().method()==="POST");
          await dialog.getByRole("button", {name:"Lưu dữ liệu", exact:true}).click();
          const response = await invalid;
          expect(response.status()).toBe(422);
          const error = (await response.json()).errors.find((item: {field: string}) => item.field === "handedOverDocs.0.name");
          const name = dialog.getByLabel("Tên tài liệu");
          await expect(name).toHaveAttribute("aria-invalid", "true");
          await expect(name.locator("..").getByRole("alert")).toHaveText(error.message);
        }
        if (type === "CONTRACT_ADDENDUM") {
          await fill("Ngày phụ lục", date);
          await fill("Nội dung sửa đổi", "Nội dung bổ sung đã được hai bên ghi nhận");
        } else if (type === "DOC_HANDOVER") {
          await fill("Ngày bàn giao thực tế", date);
          await fill("Tên tài liệu", "Hướng dẫn vận hành đã bàn giao");
          await fill("Định dạng tài liệu", "PDF");
          await dialog.getByRole("button", {name:"Thêm dòng", exact:true}).click();
          await expect(dialog.getByLabel("Tên tài liệu")).toHaveCount(2);
          await dialog.getByRole("button", {name:/^Xóa dòng /}).nth(1).click();
        } else if (type === "INSTALLATION_REPORT") {
          await fill("Ngày lắp đặt thực tế", date);
          await fill("Tên hạng mục", "Thiết bị đã lắp đặt thực tế");
          await choose("Kết quả lắp đặt", "Hoàn thành");
        } else if (type === "ACCEPTANCE_REPORT") {
          await fill("Ngày nghiệm thu thực tế", date);
          await fill("Tên hạng mục", "Kiểm tra thiết bị tại hiện trường");
          await choose("Kết quả kiểm tra", "Đạt");
          await dialog.getByLabel("Xác nhận kết luận nghiệm thu đạt").check();
        } else if (type === "MAINTENANCE_RECORD") {
          await fill("Ngày bảo trì thực tế", date);
          await fill("Kỹ thuật viên", "Kỹ thuật viên thực hiện");
          await fill("Tên hạng mục", "Vệ sinh thiết bị thực tế");
          await fill("Kết quả bảo trì", "Đã kiểm tra hoạt động ổn định");
        } else if (type === "DELIVERY_NOTE") {
          await fill("Ngày giao hàng thực tế", date);
          await fill("Tên hạng mục", "Thiết bị đã giao thực tế");
          await fill("Số lượng", "2");
          await fill("Đơn vị", "bộ");
          await dialog.getByLabel("Xác nhận tình trạng hàng hóa đúng như nội dung biên bản").check();
        } else {
          await choose("Hợp đồng", contract.contractNo);
          await fill("Số tiền hóa đơn", "100000");
          await fill("Số chứng từ", "HDDT-THUC-TE");
        }
        const entityId = type === "AR_RECONCILIATION" ? customer.id : contract.id;
        const saved = page.waitForResponse(res => res.url().endsWith(`/documents/${type}/${entityId}/source-data`) && res.request().method()==="POST");
        await dialog.getByRole("button", {name:"Lưu dữ liệu", exact:true}).click();
        const savedResponse = await saved;
        expect(savedResponse.ok(), await savedResponse.text()).toBeTruthy();
        if (type === "DOC_HANDOVER") expect(savedResponse.request().postDataJSON().data.handoverDate).toBe(`${date}T00:00:00+07:00`);
        await expect(dialog).toHaveCount(0);
        await expect(row).toContainText("Đủ dữ liệu");
        const rendered = page.waitForResponse(res => res.url().endsWith(`/documents/${type}/${entityId}/render`) && res.request().method()==="POST");
        await row.getByRole("button", {name:"Tạo", exact:true}).click();
        const renderedResponse = await rendered;
        expect(renderedResponse.ok(), await renderedResponse.text()).toBeTruthy();
        await expect(row.getByRole("button", {name:"Tải bản đã tạo"})).toBeEnabled();
      }
      await table.locator('[data-document-type="DOC_HANDOVER"]').getByRole("button", {name:"Nhập dữ liệu", exact:true}).click();
      const reopened = page.getByRole("dialog", {name:"Nhập dữ liệu thực tế"});
      await expect(reopened.getByLabel("Ngày bàn giao thực tế")).toHaveValue(date);
      await expect(reopened.getByLabel("Tên tài liệu")).toHaveValue("Hướng dẫn vận hành đã bàn giao");
      await page.keyboard.press("Escape");
      await expect(reopened).toHaveCount(0);
    } finally {
      await request.delete(`${API}/projects/${project.id}`, {headers});
      await request.delete(`${API}/customers/${customer.id}`, {headers});
    }
  });

});
