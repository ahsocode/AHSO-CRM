import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { login } from "./helpers";
import { getUserIdFromAccessToken } from "./api-auth";

const API_URL = process.env.E2E_API_URL ?? "http://localhost:3001/api";

async function scenario(page: Page, request: APIRequestContext) {
  await login(page);
  const token = await page.evaluate(() => sessionStorage.getItem("ahso_access_token"));
  expect(token).toBeTruthy();
  const headers = { Authorization: `Bearer ${token}` };
  const stamp = Date.now().toString();
  const cleanup: string[] = [];
  const create = async <T extends { id: string }>(route: string, data: unknown, deleteRoute = route): Promise<T> => {
    const response = await request.post(`${API_URL}${route}`, { headers, data });
    expect(response.ok(), `${route}: ${await response.text()}`).toBeTruthy(); // qa-static: not-ui
    const value = (await response.json()).data as T;
    cleanup.unshift(`${deleteRoute}/${value.id}`);
    return value;
  };
  return {
    headers, stamp, create, track: (route: string) => cleanup.unshift(route),
    userId: getUserIdFromAccessToken(token!),
    async dispose() {
      for (const route of cleanup) {
        const response = await request.delete(`${API_URL}${route}`, { headers });
        expect(response.ok(), `Cleanup ${route}: ${await response.text()}`).toBeTruthy(); // qa-static: not-ui
      }
    }
  };
}

async function choose(page: Page, id: string, name: string) {
  const input = page.locator(`#${id}`);
  await input.fill(name);
  await page.getByRole("option").filter({ hasText: name }).click();
  await expect(input).toHaveValue(name);
}

test.describe("Ô chọn có tìm kiếm", () => {
  test("tìm khách hàng ngoài kết quả đầu, chọn bằng phím và không gửi biểu mẫu khi Enter", async ({ page, request }) => {
    const s = await scenario(page, request);
    const customerName = `ZXQ${s.stamp} Khách chọn tìm kiếm`; // qa-static: not-ui
    const searchPrefix = customerName.slice(0, 3);
    try {
      const customer = await s.create("/customers", { name: customerName, assignedToId: s.userId });
      await page.route("**/api/customers?*", async (route) => {
        const url = new URL(route.request().url());
        if (url.pathname !== "/api/customers" || url.searchParams.get("search")) return route.continue();
        const response = await route.fetch();
        const payload = await response.json();
        payload.data = payload.data.filter((item: { id: string }) => item.id !== customer.id);
        await route.fulfill({ response, json: payload });
      });
      const projectPosts: string[] = [];
      page.on("request", (req) => { if (req.method() === "POST" && new URL(req.url()).pathname === "/api/projects") projectPosts.push(req.url()); });
      await page.goto("/projects/new");
      const nameInput = page.getByPlaceholder("Ví dụ: Nâng cấp hệ thống PLC trạm bơm");
      await nameInput.fill(`Dự án combobox ${s.stamp}`); // qa-static: not-ui
      const customerInput = page.getByRole("combobox", { name: "Khách hàng", exact: true });
      const searchRequest = page.waitForRequest((req) => new URL(req.url()).pathname === "/api/customers" && new URL(req.url()).searchParams.get("search") === searchPrefix);
      await customerInput.fill(searchPrefix);
      expect(new URL((await searchRequest).url()).searchParams.get("limit")).toBe("20");
      await expect(page.getByRole("option").filter({ hasText: customerName })).toBeVisible();
      await customerInput.press("ArrowDown");
      await expect(customerInput).toHaveAttribute("aria-activedescendant", /.+/);
      await customerInput.press("Enter");
      await expect(customerInput).toHaveValue(customerName);
      expect(projectPosts).toEqual([]);
      await customerInput.click();
      await expect(customerInput).toHaveAttribute("aria-expanded", "true");
      await customerInput.press("Escape");
      await expect(customerInput).toHaveValue(customerName);
      await page.getByRole("button", { name: "Xóa khách hàng đã chọn", exact: true }).click();
      await customerInput.press("Escape");
      await expect(customerInput).toHaveValue("");
      await customerInput.fill(customerName);
      await expect(page.getByRole("option").filter({ hasText: customerName })).toBeVisible();
      await customerInput.press("ArrowUp");
      await customerInput.press("Enter");
      expect(projectPosts).toEqual([]);
      const saved = page.waitForResponse((response) => response.request().method() === "POST" && new URL(response.url()).pathname === "/api/projects");
      await page.getByRole("button", { name: "Tạo dự án", exact: true }).click();
      const response = await saved;
      expect(response.ok(), await response.text()).toBeTruthy();
      expect(response.request().postDataJSON().customerId).toBe(customer.id);
      s.track(`/projects/${(await response.json()).data.id}`);
    } finally { await s.dispose(); }
  });

  test("giá trị chọn sẵn và form sửa giữ nhãn khi dự án không có trong trang kết quả", async ({ page, request }) => {
    const s = await scenario(page, request);
    const customerName = `Khách ngoài trang ${s.stamp}`; // qa-static: not-ui
    const projectName = `Dự án ngoài trang ${s.stamp}`; // qa-static: not-ui
    try {
      const customer = await s.create("/customers", { name: customerName, assignedToId: s.userId });
      const project = await s.create("/projects", { customerId: customer.id, name: projectName });
      const quote = await s.create("/quotes", { projectId: project.id, items: [{ name: "Hạng mục tìm kiếm", quantity: 1, unitPrice: 100000 }] }); // qa-static: not-ui
      await page.route("**/api/projects?*", async (route) => {
        const response = await route.fetch();
        const payload = await response.json();
        payload.data = payload.data.filter((item: { id: string }) => item.id !== project.id);
        await route.fulfill({ response, json: payload });
      });
      await page.goto(`/quotes/new?projectId=${project.id}`);
      await expect(page.getByLabel("Dự án", { exact: true })).toHaveValue(projectName);
      await page.goto(`/contracts/new?projectId=${project.id}`);
      await expect(page.getByLabel("Dự án", { exact: true })).toHaveValue(projectName);
      await page.goto(`/quotes/${quote.id}/edit`);
      await expect(page.getByLabel("Dự án", { exact: true })).toHaveValue(projectName);
      await expect(page.getByLabel("Dự án", { exact: true })).toBeDisabled();
      await page.goto(`/projects/${project.id}/edit`);
      await expect(page.getByLabel("Khách hàng", { exact: true })).toHaveValue(customerName);
    } finally { await s.dispose(); }
  });

  test("ô chọn hoạt động và khảo sát có nhãn truy cập, dự án được lọc theo khách hàng", async ({ page, request }) => {
    const s = await scenario(page, request);
    const customerName = `Khách lọc ${s.stamp}`; // qa-static: not-ui
    const ownName = `PF${s.stamp} Dự án đúng khách`; // qa-static: not-ui
    const otherName = `PF${s.stamp} Dự án khác khách`; // qa-static: not-ui
    try {
      const customer = await s.create("/customers", { name: customerName, assignedToId: s.userId });
      const other = await s.create("/customers", { name: `Khách khác ${s.stamp}`, assignedToId: s.userId }); // qa-static: not-ui
      await s.create("/projects", { customerId: customer.id, name: ownName });
      await s.create("/projects", { customerId: other.id, name: otherName });
      for (const path of ["/activities/new", "/surveys/new"]) {
        await page.goto(path);
        await expect(page.getByLabel(/Khách hàng/)).toHaveAttribute("role", "combobox");
        await choose(page, "customerId", customerName);
        const projectInput = page.getByLabel("Dự án", { exact: true });
        const requestPromise = page.waitForRequest((req) => new URL(req.url()).pathname === "/api/projects" && new URL(req.url()).searchParams.get("search") === `PF${s.stamp}`);
        await projectInput.fill(`PF${s.stamp}`);
        expect(new URL((await requestPromise).url()).searchParams.get("customerId")).toBe(customer.id);
        await expect(page.getByRole("option").filter({ hasText: ownName })).toBeVisible();
        await expect(page.getByRole("option").filter({ hasText: otherName })).toHaveCount(0);
        await page.getByRole("option").filter({ hasText: ownName }).click();
        await page.getByRole("button", { name: "Xóa khách hàng đã chọn", exact: true }).click();
        await expect(projectInput).toBeDisabled();
        await expect(projectInput).toHaveValue("");
      }
    } finally { await s.dispose(); }
  });

  test("bộ lọc báo giá và hợp đồng tìm dự án bằng popup không bị cắt", async ({ page, request }) => {
    const s = await scenario(page, request);
    const projectName = `Bộ lọc dự án ${s.stamp}`; // qa-static: not-ui
    try {
      const customer = await s.create("/customers", { name: `Khách lọc danh sách ${s.stamp}`, assignedToId: s.userId }); // qa-static: not-ui
      const project = await s.create("/projects", { customerId: customer.id, name: projectName });
      const quote = await s.create<{ id: string; quoteNo: string }>("/quotes", { projectId: project.id, items: [{ name: "Hạng mục bộ lọc", quantity: 1, unitPrice: 1000 }] }); // qa-static: not-ui
      for (const [pagePath, inputId, apiPath] of [["/quotes", "quote-project", "/api/quotes"], ["/contracts", "contract-project", "/api/contracts"]]) {
        await page.goto(pagePath);
        const changed = page.waitForResponse((response) => new URL(response.url()).pathname === apiPath && new URL(response.url()).searchParams.get("projectId") === project.id);
        await choose(page, inputId, projectName);
        expect((await changed).ok()).toBeTruthy();
        if (pagePath === "/quotes") await expect(page.getByRole("link", { name: quote.quoteNo })).toBeVisible();
      }
    } finally { await s.dispose(); }
  });

  test("STAFF chỉ thấy khách hàng và dự án của mình trong gợi ý", async ({ browser, page, request }) => {
    const s = await scenario(page, request);
    const context = await browser.newContext();
    const prefix = `RBAC${s.stamp}`;
    const ownCustomer = `${prefix} Khách của nhân viên`; // qa-static: not-ui
    const otherCustomer = `${prefix} Khách của người khác`; // qa-static: not-ui
    const ownProject = `${prefix} Dự án của nhân viên`; // qa-static: not-ui
    const otherProject = `${prefix} Dự án của người khác`; // qa-static: not-ui
    try {
      const loginResponse = await context.request.post(`${API_URL}/auth/login`, { data: { email: "staff@ahso.vn", password: "AHSO123!" } });
      expect(loginResponse.ok()).toBeTruthy();
      const staff = (await loginResponse.json()).data as { accessToken: string; user: { id: string } };
      const own = await s.create("/customers", { name: ownCustomer, assignedToId: staff.user.id });
      const other = await s.create("/customers", { name: otherCustomer, assignedToId: s.userId });
      await s.create("/projects", { customerId: own.id, name: ownProject });
      await s.create("/projects", { customerId: other.id, name: otherProject });
      await context.addInitScript(({ token, user }) => {
        sessionStorage.setItem("ahso_access_token", token);
        localStorage.setItem("ahso_auth_user", JSON.stringify(user));
      }, { token: staff.accessToken, user: staff.user });
      const staffPage = await context.newPage();
      const baseURL = process.env.E2E_BASE_URL ?? "http://localhost:3000";
      for (const [route, id, visibleName, hiddenName] of [["/projects/new", "customerId", ownCustomer, otherCustomer], ["/quotes/new", "projectId", ownProject, otherProject]]) {
        await staffPage.goto(`${baseURL}${route}`);
        await staffPage.locator(`#${id}`).fill(prefix);
        await expect(staffPage.getByRole("option").filter({ hasText: visibleName })).toBeVisible();
        await expect(staffPage.getByRole("option").filter({ hasText: hiddenName })).toHaveCount(0);
      }
    } finally {
      await context.close();
      await s.dispose();
    }
  });


  test("chính sách tải chậm không xóa hạng mục hoặc điền lại điều khoản người dùng đã xóa", async ({ page, request }) => {
    const s = await scenario(page, request);
    let releasePolicies: () => void = () => undefined;
    const policiesGate = new Promise<void>((resolve) => { releasePolicies = resolve; });
    try {
      const customer = await s.create("/customers", { name: `Khách chính sách ${s.stamp}`, assignedToId: s.userId }); // qa-static: not-ui
      const project = await s.create("/projects", { customerId: customer.id, name: `Dự án chính sách ${s.stamp}` }); // qa-static: not-ui
      await page.route("**/api/settings/policies", async (route) => {
        await policiesGate;
        await route.fulfill({ json: { data: { paymentTerms: "Điều khoản mặc định kiểm tra", deliveryTerms: "Giao hàng mặc định kiểm tra" }, meta: null } }); // qa-static: not-ui
      });
      await page.goto(`/quotes/new?projectId=${project.id}`);
      await page.getByLabel("Tên hạng mục 1").fill("Hạng mục giữ nguyên"); // qa-static: not-ui
      const paymentTerms = page.getByLabel("Điều khoản thanh toán", { exact: true });
      await paymentTerms.fill("Điều khoản tự nhập"); // qa-static: not-ui
      await paymentTerms.fill("");
      releasePolicies();
      await expect(page.getByLabel("Điều khoản giao hàng / triển khai", { exact: true })).toHaveValue("Giao hàng mặc định kiểm tra"); // qa-static: not-ui
      await expect(page.getByLabel("Tên hạng mục 1")).toHaveValue("Hạng mục giữ nguyên"); // qa-static: not-ui
      await expect(paymentTerms).toHaveValue("");
      await expect(page.getByLabel("Dự án", { exact: true })).not.toHaveValue("");
    } finally {
      releasePolicies();
      await s.dispose();
    }
  });

});
