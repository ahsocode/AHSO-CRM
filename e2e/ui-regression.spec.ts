import { expect, test, type APIRequestContext, type Page, type Request } from "@playwright/test";
import { getUserIdFromAccessToken } from "./api-auth";
import { login } from "./helpers";

const API_URL = process.env.E2E_API_URL ?? "http://127.0.0.1:3001/api";

// Mirrors CHART_COLORS in frontend/lib/constants.ts (computed style is compared as rgb()).
const COLOR_SUCCESS = "#1e8449";
const COLOR_DANGER = "#c0392b";

function hexToRgb(hex: string) {
  const value = hex.replace("#", "");
  const r = parseInt(value.slice(0, 2), 16);
  const g = parseInt(value.slice(2, 4), 16);
  const b = parseInt(value.slice(4, 6), 16);
  return `rgb(${r}, ${g}, ${b})`;
}

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

// ─── 1. Dashboard ────────────────────────────────────────────────────────────

test.describe("Dashboard", () => {
  test("[Dashboard] pipeline colors follow status", async ({ page }) => {
    await login(page);
    await page.goto("/dashboard");

    const completed = page.locator('[data-testid="pipeline-stage"][data-status="COMPLETED"]');
    const lost = page.locator('[data-testid="pipeline-stage"][data-status="LOST"]');

    await expect(completed).toBeVisible();
    await expect(lost).toBeVisible();
    await expect(completed).toContainText("Hoàn thành");
    await expect(lost).toContainText("Không thành");

    await expect(completed.getByTestId("pipeline-stage-dot")).toHaveCSS(
      "background-color",
      hexToRgb(COLOR_SUCCESS)
    );
    await expect(lost.getByTestId("pipeline-stage-dot")).toHaveCSS(
      "background-color",
      hexToRgb(COLOR_DANGER)
    );

    // The proportional bar only renders segments with >= 0.5% share; check them when present.
    const completedSegment = page.locator('[data-testid="pipeline-segment"][data-status="COMPLETED"]');
    if ((await completedSegment.count()) > 0) {
      await expect(completedSegment).toHaveCSS("background-color", hexToRgb(COLOR_SUCCESS));
    }
    const lostSegment = page.locator('[data-testid="pipeline-segment"][data-status="LOST"]');
    if ((await lostSegment.count()) > 0) {
      await expect(lostSegment).toHaveCSS("background-color", hexToRgb(COLOR_DANGER));
    }
  });

  test("[Dashboard] stage link opens filtered kanban", async ({ page }) => {
    await login(page);
    await page.goto("/dashboard");

    const quotingStage = page.locator('[data-testid="pipeline-stage"][data-status="QUOTING"]');
    await expect(quotingStage).toBeVisible();
    await expect(quotingStage).toContainText("Báo giá");
    await quotingStage.click();

    await expect(page).toHaveURL(/view=kanban/);
    await expect(page).toHaveURL(/status=QUOTING/);
    await expect(page.getByRole("combobox", { name: /Trạng thái/ })).toHaveValue("QUOTING");
  });
});

// ─── 2. Breadcrumb ───────────────────────────────────────────────────────────

test.describe("Breadcrumb", () => {
  const crumbs: Array<{ path: string; label: string }> = [
    { path: "/suppliers", label: "Nhà cung cấp" },
    { path: "/materials", label: "Vật tư" },
    { path: "/inventory", label: "Kho hàng" },
    { path: "/activities", label: "Hoạt động" }
  ];

  test("[Breadcrumb] module pages show their own crumb", async ({ page }) => {
    await login(page);

    for (const { path, label } of crumbs) {
      await page.goto(path);
      const crumb = page.getByTestId("topbar-crumb");
      // Exact match: also guarantees the crumb is not the old fake "Dashboard".
      await expect(crumb, `crumb for ${path}`).toHaveText(label);
      await expect(crumb, `no Dashboard crumb on ${path}`).not.toHaveText("Dashboard");
    }
  });
});

// ─── 3. Kanban ───────────────────────────────────────────────────────────────

test.describe("Kanban", () => {
  test("[Kanban] at most one risk signal per card", async ({ page }) => {
    await login(page);
    await page.goto("/projects?view=kanban");

    const cards = page.getByTestId("kanban-card");
    await expect(cards.first()).toBeVisible();

    const total = await cards.count();
    expect(total).toBeGreaterThan(0);

    const offenders: string[] = [];
    for (let index = 0; index < total; index += 1) {
      const card = cards.nth(index);
      const dots = await card.getByTestId("risk-dot").count();
      const labelled = await card
        .locator('[aria-label^="Trễ hạn"], [aria-label^="Ứ đọng"], [aria-label^="Chưa có việc"]')
        .count();
      if (dots > 1 || labelled > 1) {
        const name = (await card.innerText()).split("\n")[0];
        offenders.push(`${name} (dots=${dots}, labelled=${labelled})`);
      }
    }
    expect(offenders, `cards with more than one risk signal:\n${offenders.join("\n")}`).toEqual([]);
  });

  test("[Kanban] lost column collapsed by default", async ({ page }) => {
    await login(page);
    await page.goto("/projects?view=kanban");

    const lostColumn = page.locator('[data-testid="kanban-column"][data-column="LOST"]');
    await expect(lostColumn).toBeVisible();
    await expect(lostColumn).toHaveAttribute("data-collapsed", "true");
    await expect(lostColumn.getByTestId("kanban-card")).toHaveCount(0);

    // Other columns stay expanded.
    await expect(
      page.locator('[data-testid="kanban-column"][data-column="QUOTING"]')
    ).toHaveAttribute("data-collapsed", "false");

    // The collapsed rail can be opened.
    await lostColumn.getByRole("button", { name: /^Mở cột/ }).click();
    await expect(lostColumn).toHaveAttribute("data-collapsed", "false");
  });

  test("[Kanban] toolbar shows open pipeline summary", async ({ page }) => {
    await login(page);
    await page.goto("/projects?view=kanban");

    await expect(page.getByText(/\d+ dự án đang mở · /)).toBeVisible();
  });
});

// ─── 4. Khách hàng ───────────────────────────────────────────────────────────

async function createTempCustomer(page: Page, request: APIRequestContext, name: string) {
  const accessToken = await getAccessTokenFromPage(page);
  const userId = getUserIdFromAccessToken(accessToken);
  const response = await request.post(`${API_URL}/customers`, {
    headers: authHeaders(accessToken),
    data: { name, status: "LEAD", isVip: false, assignedToId: userId }
  });
  expect(response.ok(), `create customer: ${await response.text()}`).toBeTruthy();
  const created = unwrap<{ id: string }>(await response.json());
  return { id: created.id, accessToken };
}

test.describe("Khách hàng", () => {
  test("[Khách hàng] avatar strips legal prefix", async ({ page, request }) => {
    await login(page);
    const name = `CÔNG TY TNHH NA TÂY TECH QA ${Date.now()}`;
    let customerId: string | null = null;
    let accessToken = "";

    try {
      const created = await createTempCustomer(page, request, name);
      customerId = created.id;
      accessToken = created.accessToken;

      await page.goto("/customers");
      await page.getByLabel("Tìm kiếm khách hàng").fill(name);

      const row = page.locator("tbody tr").filter({ hasText: name });
      await expect(row).toBeVisible();

      // Second cell = "Khách hàng" column (first is the checkbox).
      const customerCell = row.locator("td").nth(1);
      await expect(customerCell.getByText("NT", { exact: true })).toBeVisible();
      await expect(customerCell.getByText("CT", { exact: true })).toHaveCount(0);
    } finally {
      if (customerId) {
        await request
          .delete(`${API_URL}/customers/${customerId}`, { headers: authHeaders(accessToken) })
          .catch(() => undefined);
      }
    }
  });

  test("[Khách hàng] inline status change persists", async ({ page, request }) => {
    await login(page);
    const name = `CÔNG TY TNHH NA TÂY TECH QA ${Date.now()}`;
    let customerId: string | null = null;
    let accessToken = "";

    try {
      const created = await createTempCustomer(page, request, name);
      customerId = created.id;
      accessToken = created.accessToken;

      await page.goto("/customers");
      await page.getByLabel("Tìm kiếm khách hàng").fill(name);

      const row = page.locator("tbody tr").filter({ hasText: name });
      const statusSelect = row.getByRole("combobox", { name: "Đổi trạng thái khách hàng" });
      await expect(statusSelect).toHaveValue("LEAD");

      const patchDone = page.waitForResponse(
        (response) =>
          response.request().method() === "PATCH" &&
          response.url().includes(`/customers/${customerId}`) &&
          response.ok()
      );
      await statusSelect.selectOption("ACTIVE");
      await patchDone;

      // Persisted server-side.
      await expect
        .poll(async () => {
          const detail = await request.get(`${API_URL}/customers/${customerId}`, {
            headers: authHeaders(accessToken)
          });
          return unwrap<{ status: string }>(await detail.json()).status;
        })
        .toBe("ACTIVE");

      // And after a reload the UI shows the new value.
      await page.reload();
      await page.getByLabel("Tìm kiếm khách hàng").fill(name);
      await expect(
        page
          .locator("tbody tr")
          .filter({ hasText: name })
          .getByRole("combobox", { name: "Đổi trạng thái khách hàng" })
      ).toHaveValue("ACTIVE");
    } finally {
      if (customerId) {
        await request
          .delete(`${API_URL}/customers/${customerId}`, { headers: authHeaders(accessToken) })
          .catch(() => undefined);
      }
    }
  });

  test("[Khách hàng] list shows up to 20 rows per page", async ({ page }) => {
    await login(page);
    await page.goto("/customers");

    const rows = page.locator("tbody tr");
    await expect(rows.first()).toBeVisible();
    const count = await rows.count();
    expect(count).toBeGreaterThan(0);
    expect(count).toBeLessThanOrEqual(20);
  });
});

// ─── 5. Báo giá ──────────────────────────────────────────────────────────────


// Row controls carry dynamic aria-labels ("Tên hạng mục 1", "Đơn giá 2", "Thao tác dòng 1"...).
const ROW_LABELS = { name: "Tên hạng mục", price: "Đơn giá" } as const;

function rowInput(page: Page, field: keyof typeof ROW_LABELS, row: number) {
  return page.getByLabel(new RegExp(`^${ROW_LABELS[field]} ${row}$`));
}

function rowMenuButton(page: Page, row: number) {
  return page.getByRole("button", { name: new RegExp(`^Thao tác dòng ${row}$`) });
}

test.describe("Báo giá", () => {
  test("[Báo giá] line items table", async ({ page }) => {
    await login(page);

    const quotePosts: string[] = [];
    page.on("request", (request: Request) => {
      if (request.method() === "POST" && /\/api\/quotes\/?(\?|$)/.test(request.url())) {
        quotePosts.push(request.url());
      }
    });

    await page.goto("/quotes/new");
    await expect(rowInput(page, "name", 1)).toBeVisible();

    const nameInputs = page.locator('input[aria-label^="Tên hạng mục"]');
    await expect(nameInputs).toHaveCount(1);

    // Print customisation is an advanced, collapsed section.
    const printDetails = page.locator("details").filter({ hasText: "Tùy chỉnh bản in (nâng cao)" });
    await expect(printDetails).toHaveCount(1);
    expect(await printDetails.evaluate((el) => (el as HTMLDetailsElement).open)).toBe(false);

    // With a single row the delete action is disabled.
    await rowMenuButton(page, 1).click();
    await expect(page.getByRole("menuitem", { name: "Xóa dòng" })).toHaveAttribute("aria-disabled", "true");
    await page.keyboard.press("Escape");
    await expect(page.getByRole("menuitem", { name: "Xóa dòng" })).toHaveCount(0);

    // Row 1: name + unit price 1.250.000 (quantity defaults to 1).
    await rowInput(page, "name", 1).fill("Hạng mục kiểm thử QA");
    const price1 = rowInput(page, "price", 1);
    await price1.fill("1250000");

    // 1.250.000 + 8% VAT (default since 2026) = 1.350.000, shown in full (no "tr" abbreviation).
    const summary = page.getByTestId("quote-summary");
    await expect(summary).toContainText("1.350.000");
    await expect(summary).not.toContainText(/\d\s?tr\b/);

    // Enter in the last row's unit price appends a row and focuses its name input.
    await price1.press("Enter");
    await expect(nameInputs).toHaveCount(2);
    await expect(rowInput(page, "name", 2)).toBeFocused();
    await expect(page).toHaveURL(/\/quotes\/new/);
    expect(quotePosts, "Enter must not submit the quote").toEqual([]);

    // Duplicate row 1 through the row menu.
    await rowMenuButton(page, 1).click();
    await page.getByRole("menuitem", { name: "Nhân bản dòng" }).click();
    await expect(nameInputs).toHaveCount(3);
    await expect(rowInput(page, "name", 2)).toHaveValue("Hạng mục kiểm thử QA");

    // With several rows the delete action is enabled again.
    await rowMenuButton(page, 1).click();
    await expect(page.getByRole("menuitem", { name: "Xóa dòng" })).not.toHaveAttribute("aria-disabled", "true");
    await page.keyboard.press("Escape");

    await expect(page).toHaveURL(/\/quotes\/new/);
    expect(quotePosts, "no quote may be created by this test").toEqual([]);
  });
});

// ─── 6. Nhà cung cấp ─────────────────────────────────────────────────────────

async function createTempSupplier(
  page: Page,
  request: APIRequestContext,
  extra: Record<string, unknown> = {}
) {
  const accessToken = await getAccessTokenFromPage(page);
  const suffix = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
  const code = `E2E-UI-${suffix}`;
  const name = `Nhà cung cấp UI QA ${suffix}`;
  const response = await request.post(`${API_URL}/suppliers`, {
    headers: authHeaders(accessToken),
    data: { code, name, isActive: true, ...extra }
  });
  expect(response.ok(), `create supplier: ${await response.text()}`).toBeTruthy();
  const created = unwrap<{ id: string }>(await response.json());
  return { id: created.id, code, name, accessToken };
}

async function removeSupplier(request: APIRequestContext, accessToken: string, id: string | null) {
  if (!id) return;
  await request.delete(`${API_URL}/suppliers/${id}`, { headers: authHeaders(accessToken) }).catch(() => undefined);
}

test.describe("Nhà cung cấp", () => {
  test("[Nhà cung cấp] detail page renders full contract", async ({ page, request }) => {
    await login(page);
    let supplierId: string | null = null;
    let accessToken = "";

    try {
      const supplier = await createTempSupplier(page, request);
      supplierId = supplier.id;
      accessToken = supplier.accessToken;

      await page.goto(`/suppliers/${supplier.id}`);
      const main = page.locator("main");

      await expect(main.getByText(supplier.name).first()).toBeVisible();
      await expect(main.getByText(`Mã NCC: ${supplier.code}`)).toBeVisible();

      // Three stat cards.
      // Match each stat card by its exact label: a substring filter on "Phiếu nhập"
      // also hit the "Tổng giá trị nhập" card ("Phiếu nhập đã xác nhận") → strict mode.
      const statCard = (label: string) =>
        main.locator("article").filter({ has: page.getByText(label, { exact: true }) });
      await expect(statCard("Vật tư cung cấp")).toContainText("0");
      await expect(statCard("Tổng giá trị nhập")).toContainText("0");
      await expect(statCard("Phiếu nhập")).toContainText("Chưa có lần nhập nào");
      await expect(main.getByText("Vật tư cung cấp", { exact: true })).toBeVisible();
      await expect(main.getByText("Tổng giá trị nhập", { exact: true })).toBeVisible();
      await expect(main.getByText("Phiếu nhập", { exact: true })).toBeVisible();

      // Empty states.
      await expect(main.getByText(/Chưa gắn vật tư nào/)).toBeVisible();
      await expect(main.getByText("Chưa có phiếu nhập nào từ nhà cung cấp này.")).toBeVisible();

      // The page used to crash on render.
      await expect(page.getByText(/Application error/i)).toHaveCount(0);
      await expect(page.getByText("Không thể tải thông tin nhà cung cấp")).toHaveCount(0);
    } finally {
      await removeSupplier(request, accessToken, supplierId);
    }
  });

  test("[Nhà cung cấp] duplicate code returns readable 409", async ({ page, request }) => {
    await login(page);
    let supplierId: string | null = null;
    let accessToken = "";

    try {
      const supplier = await createTempSupplier(page, request);
      supplierId = supplier.id;
      accessToken = supplier.accessToken;

      const duplicate = await request.post(`${API_URL}/suppliers`, {
        headers: authHeaders(accessToken),
        data: { code: supplier.code, name: `${supplier.name} (trùng mã)`, isActive: true }
      });
      expect(duplicate.status()).toBe(409);
      const body = (await duplicate.json()) as { message?: unknown };
      expect(JSON.stringify(body.message ?? body)).toContain("đã tồn tại");
    } finally {
      await removeSupplier(request, accessToken, supplierId);
    }
  });

  test("[Nhà cung cấp] clearing a field persists", async ({ page, request }) => {
    await login(page);
    let supplierId: string | null = null;
    let accessToken = "";

    try {
      const supplier = await createTempSupplier(page, request, { phone: "0909000111" });
      supplierId = supplier.id;
      accessToken = supplier.accessToken;

      const before = await request.get(`${API_URL}/suppliers/${supplier.id}`, {
        headers: authHeaders(accessToken)
      });
      expect(unwrap<{ phone: string | null }>(await before.json()).phone).toBe("0909000111");

      const patch = await request.patch(`${API_URL}/suppliers/${supplier.id}`, {
        headers: authHeaders(accessToken),
        data: { phone: "" }
      });
      expect(patch.ok(), `patch supplier: ${await patch.text()}`).toBeTruthy();

      const after = await request.get(`${API_URL}/suppliers/${supplier.id}`, {
        headers: authHeaders(accessToken)
      });
      expect(after.ok()).toBeTruthy();
      expect(unwrap<{ phone: string | null }>(await after.json()).phone).toBeNull();
    } finally {
      await removeSupplier(request, accessToken, supplierId);
    }
  });

  test("[Nhà cung cấp] export endpoint", async ({ page, request }) => {
    await login(page);
    let supplierId: string | null = null;
    let accessToken = "";

    try {
      const supplier = await createTempSupplier(page, request);
      supplierId = supplier.id;
      accessToken = supplier.accessToken;

      const response = await request.get(`${API_URL}/suppliers/export`, {
        headers: authHeaders(accessToken),
        params: { search: supplier.code }
      });
      expect(response.ok(), `export: ${await response.text()}`).toBeTruthy();

      const payload = unwrap<{ items: Array<Record<string, unknown>> }>(await response.json());
      expect(Array.isArray(payload.items)).toBe(true);
      expect(payload.items.length).toBeGreaterThan(0);
      expect(Object.keys(payload.items[0])).toContain("Mã NCC");
      expect(payload.items.some((item) => item["Mã NCC"] === supplier.code)).toBe(true);
    } finally {
      await removeSupplier(request, accessToken, supplierId);
    }
  });
});

// ─── 7. Phiên đăng nhập ──────────────────────────────────────────────────────

test.describe("Phiên", () => {
  test("[phiên] opening a new tab keeps the session", async ({ page, context }) => {
    // login() injects the access token into page 1 only (page-level init script),
    // so a second page in the same context starts with an empty sessionStorage —
    // exactly like "open link in new tab".
    await login(page);
    await expect(page).toHaveURL(/\/dashboard/);
    await getAccessTokenFromPage(page);

    const logoutRequests: string[] = [];
    context.on("request", (request) => {
      if (request.url().includes("/auth/logout")) {
        logoutRequests.push(`${request.method()} ${request.url()}`);
      }
    });

    const page2 = await context.newPage();
    // Defensive: guarantee a token-less sessionStorage even if a context-level
    // init script is ever added to the setup.
    await page2.addInitScript(() => window.sessionStorage.clear());

    await page2.goto("/customers");

    // Must adopt the session from page 1 via BroadcastChannel and stay on /customers.
    await expect(page2.getByText("Danh sách khách hàng").first()).toBeVisible({ timeout: 15_000 });
    await expect(page2).toHaveURL(/\/customers/);
    await expect(page2).not.toHaveURL(/\/login/);
    expect(
      await page2.evaluate(() => window.sessionStorage.getItem("ahso_access_token")),
      "page 2 must have adopted the access token from page 1"
    ).toBeTruthy();

    // Page 1 is still logged in.
    await page.reload();
    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page.getByText("Dashboard điều phối")).toBeVisible();
    expect(await page.evaluate(() => window.sessionStorage.getItem("ahso_access_token"))).toBeTruthy();

    expect(logoutRequests, "no logout request may be sent by either tab").toEqual([]);

    await page2.close();
  });
});

// ─── 8. Việt hóa ─────────────────────────────────────────────────────────────

test.describe("Tiếng Anh", () => {
  const ENGLISH_PATTERN =
    /\b(ledger|desk|snapshot|activity|timeline|milestone|quote|pipeline filter|import|upload|preview|template|owner|stage|workspace|summary)\b/i;
  const ALLOW_LIST = ["AI Agents", "Kanban", "Dashboard", "Email", "Mailbox", "CSV", "VAT", "PDF"];
  const ROUTES = [
    "/dashboard",
    "/customers",
    "/projects?view=kanban",
    "/quotes/new",
    "/suppliers",
    "/contracts",
    "/activities",
    "/inventory"
  ];

  function escapeRegExp(value: string) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  test("[tiếng Anh] main pages have no leftover English", async ({ page }) => {
    await login(page);

    const offenders: string[] = [];

    for (const route of ROUTES) {
      await page.goto(route);
      await expect(page.locator("main")).toBeVisible();
      // Let data-driven content render; polling/websocket must not block the test.
      await page.waitForLoadState("networkidle", { timeout: 8_000 }).catch(() => undefined);
      await page.waitForTimeout(300);

      const texts = await page.evaluate(() => {
        const main = document.querySelector("main");
        if (!main) return [] as string[];
        const skipTags = new Set(["SCRIPT", "STYLE", "NOSCRIPT", "SVG", "PATH"]);
        const result: string[] = [];
        main.querySelectorAll("*").forEach((element) => {
          if (skipTags.has(element.tagName.toUpperCase())) return;
          if (element.closest("svg")) return;
          if (element.children.length > 0) return;
          const text = (element.textContent ?? "").replace(/\s+/g, " ").trim();
          if (text) result.push(text);
        });
        return result;
      });

      for (const text of new Set(texts)) {
        let candidate = text;
        for (const allowed of ALLOW_LIST) {
          candidate = candidate.replace(new RegExp(escapeRegExp(allowed), "gi"), " ");
        }
        const match = candidate.match(ENGLISH_PATTERN);
        if (match) {
          offenders.push(`${route}  ->  "${text}"  (matched: ${match[0]})`);
        }
      }
    }

    expect(offenders, `English leftovers found:\n${offenders.join("\n")}`).toEqual([]);
  });
});

// ─── Regressions found by manual QA on the local stack (22/10/2026) ──────────

async function firstProjectId(page: Page, request: APIRequestContext) {
  const accessToken = await getAccessTokenFromPage(page);
  const response = await request.get(`${API_URL}/projects?page=1&limit=1`, { headers: authHeaders(accessToken) });
  expect(response.ok()).toBeTruthy();
  const items = unwrap<Array<{ id: string; name: string }> | { items: Array<{ id: string; name: string }> }>(await response.json());
  const list = Array.isArray(items) ? items : items.items;
  expect(list.length, "seed must contain at least one project").toBeGreaterThan(0);
  return { id: list[0].id, name: list[0].name, accessToken };
}

test.describe("QA thủ công — hồi quy", () => {
  test("[Khách hàng] quick-create keeps the project form the user is filling", async ({ page, request }) => {
    // Bug: react-hook-form reset() inside the portal-less dialog called the native
    // form.reset() of the PARENT project form → typed project name was wiped.
    await login(page);
    const projectName = `QA giữ dữ liệu form ${Date.now()}`;
    const customerName = `CÔNG TY QA TẠO NHANH ${Date.now()}`;
    let customerId: string | null = null;
    const projectPosts: string[] = [];
    page.on("request", (req) => {
      if (req.method() === "POST" && /\/api\/projects$/.test(req.url())) projectPosts.push(req.url());
    });

    try {
      await page.goto("/projects/new");
      await page.getByPlaceholder("Ví dụ: Nâng cấp hệ thống PLC trạm bơm").fill(projectName);
      await page.getByRole("button", { name: "+ Tạo khách hàng mới" }).click();
      const dialog = page.getByRole("dialog");
      await dialog.getByPlaceholder("Công ty TNHH ABC").fill(customerName);
      // Enter inside the dialog must not submit the project form behind it.
      await dialog.getByPlaceholder("Công ty TNHH ABC").press("Enter");

      const created = page.waitForResponse((r) => r.request().method() === "POST" && /\/api\/customers$/.test(r.url()));
      await dialog.getByRole("button", { name: "Tạo khách hàng" }).click();
      customerId = unwrap<{ id: string }>(await (await created).json()).id;

      await expect(dialog).toBeHidden();
      await expect(page.getByPlaceholder("Ví dụ: Nâng cấp hệ thống PLC trạm bơm")).toHaveValue(projectName);
      await expect(page.locator("#customerId")).toHaveValue(customerName);
      expect(projectPosts, "project form must not be submitted").toEqual([]);
    } finally {
      if (customerId) {
        const accessToken = await getAccessTokenFromPage(page);
        await request.delete(`${API_URL}/customers/${customerId}`, { headers: authHeaders(accessToken) }).catch(() => undefined);
      }
    }
  });

  test("[Báo giá] ?projectId preselects the project in the quote form", async ({ page, request }) => {
    // Bug: value set before the project list loaded → native select looked empty.
    await login(page);
    const { id, name } = await firstProjectId(page, request);
    await page.goto(`/quotes/new?projectId=${id}`);
    await expect(page.locator("#projectId")).toHaveValue(name);
  });

  test("[Hợp đồng] ?projectId preselects the project in the contract form", async ({ page, request }) => {
    await login(page);
    const { id, name } = await firstProjectId(page, request);
    await page.goto(`/contracts/new?projectId=${id}`);
    await expect(page.locator("#projectId")).toHaveValue(name);
  });

  test("[Báo giá] quote detail shows exact totals, not abbreviated", async ({ page, request }) => {
    await login(page);
    const { id: projectId, accessToken } = await firstProjectId(page, request);
    const response = await request.post(`${API_URL}/quotes`, {
      headers: authHeaders(accessToken),
      data: { projectId, taxRate: 10, status: "DRAFT", items: [{ name: "Hạng mục QA tổng tiền", quantity: 1, unitPrice: 1_250_000 }] } // qa-static: not-ui
    });
    expect(response.ok(), await response.text()).toBeTruthy();
    const quoteId = unwrap<{ id: string }>(await response.json()).id;
    try {
      await page.goto(`/quotes/${quoteId}`);
      const main = page.locator("main");
      await expect(main).toContainText("1.375.000");
      await expect(main).toContainText("125.000");
      await expect(main).not.toContainText("1,4 tr");
    } finally {
      await request.delete(`${API_URL}/quotes/${quoteId}`, { headers: authHeaders(accessToken) }).catch(() => undefined);
    }
  });

  test("[Kho] over-stock confirmation explains the real reason", async ({ page, request }) => {
    // Bug: toast only said "Không thể xác nhận phiếu." although the API explains the shortage.
    await login(page);
    const accessToken = await getAccessTokenFromPage(page);
    const h = authHeaders(accessToken);
    const stamp = Date.now();
    const post = async (path: string, data: unknown) => {
      const r = await request.post(`${API_URL}${path}`, { headers: h, data });
      expect(r.ok(), `${path}: ${await r.text()}`).toBeTruthy();
      return unwrap<{ id: string }>(await r.json());
    };
    const warehouse = await post("/warehouses", { code: `KHO-QA-${stamp}`, name: `Kho QA ${stamp}` });
    const material = await post("/materials", { code: `VT-QA-${stamp}`, name: `Vật tư QA ${stamp}`, unit: "Cái" });
    const receipt = await post("/stock-receipts", {
      warehouseId: warehouse.id, date: new Date().toISOString(),
      items: [{ materialId: material.id, quantity: 2, unitPrice: 1000 }]
    });
    await post(`/stock-receipts/${receipt.id}/confirm`, {});
    const issue = await post("/stock-issues", {
      warehouseId: warehouse.id, date: new Date().toISOString(),
      items: [{ materialId: material.id, quantity: 5, unitPrice: 1000 }]
    });

    await page.goto(`/inventory/issues/${issue.id}`);
    await page.getByRole("button", { name: "Xác nhận", exact: true }).click();
    await expect(page.getByText(/Không đủ tồn kho/)).toBeVisible(); // qa-static: not-ui (backend message)
  });

  test("[Bảo mật] roles endpoints require ADMIN or MANAGER", async ({ request }) => {
    // Bug: GET /roles and /roles/:id had no guard — anyone could read roles and the staff email directory.
    const anonymous = await request.get(`${API_URL}/roles`);
    expect(anonymous.status()).toBe(401);

    const staffLogin = await request.post(`${API_URL}/auth/login`, {
      data: { email: process.env.E2E_STAFF_EMAIL ?? "staff@ahso.vn", password: process.env.E2E_STAFF_PASSWORD ?? process.env.E2E_ADMIN_PASSWORD ?? "AHSO123!" }
    });
    expect(staffLogin.ok(), await staffLogin.text()).toBeTruthy();
    const staffToken = unwrap<{ accessToken: string }>(await staffLogin.json()).accessToken;
    const asStaff = await request.get(`${API_URL}/roles`, { headers: authHeaders(staffToken) });
    expect(asStaff.status()).toBe(403);
    const detailAsStaff = await request.get(`${API_URL}/roles/role_admin`, { headers: authHeaders(staffToken) });
    expect(detailAsStaff.status()).toBe(403);
  });
});
