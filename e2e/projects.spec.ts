import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { login } from "./helpers";

const API_URL = process.env.E2E_API_URL ?? "http://127.0.0.1:3001/api";

test("mở projects và thao tác drag-drop kanban nếu có card", async ({ page }) => {
  await login(page);
  await page.goto("/projects?view=kanban");
  await expect(page.getByRole("heading", { name: "Pipeline Dự án", level: 1 })).toBeVisible();

  const draggableCard = page.locator('article[draggable="true"]').first();
  if ((await draggableCard.count()) > 0) {
    const targetColumn = page.getByRole("heading", { name: "Đàm phán", exact: true });
    await draggableCard.dragTo(targetColumn);
  }

  await expect(page).toHaveURL(/\/projects/);
});

test("bulk export dự án hoạt động ở list view", async ({ page }) => {
  await login(page);
  await page.goto("/projects?view=list");

  const firstRowCheckbox = page.locator("table tbody tr").first().locator('[role="checkbox"]').first();
  await firstRowCheckbox.click();
  await expect(page.getByText(/bản ghi đang được chọn/i)).toBeVisible();

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: /Export CSV \+ Excel/i }).click();
  await downloadPromise;
});

test("search mở đúng hồ sơ dự án từ command palette", async ({ page, request }) => {
  await login(page);

  const accessToken = await getAccessTokenFromPage(page);
  const project = await getFirstProject(request, accessToken);
  const searchTerm = project.code || project.name;

  await page.goto("/dashboard");
  await page.getByPlaceholder(/Tìm kiếm khách hàng, dự án, báo giá/i).click();
  await page.getByPlaceholder(/Tìm khách hàng, dự án, báo giá/i).fill(searchTerm);

  const projectResult = page.getByRole("button", { name: new RegExp(escapeRegExp(project.name), "i") }).first();
  await expect(projectResult).toBeVisible();
  await projectResult.click();

  await expect(page).toHaveURL(new RegExp(`/projects/${escapeRegExp(project.id)}`));
  await expect(page.getByRole("heading", { name: "Hồ sơ dự án 360" })).toBeVisible();
  await expect(page.getByText(/Application error/i)).toHaveCount(0);
  await expect(page.getByText(/Không thể mở hồ sơ dự án/i)).toHaveCount(0);
});

test("Project 360 hiển thị lifecycle, tài liệu và action xem/tải file", async ({ page, request }) => {
  await login(page);

  const accessToken = await getAccessTokenFromPage(page);
  const project = await getFirstProject(request, accessToken);
  const documentTitle = `E2E Project 360 PO ${Date.now()}`;
  let businessDocumentId: string | null = null;

  try {
    const businessDocument = await createProjectBusinessDocument(request, accessToken, {
      projectId: project.id,
      customerId: project.customer.id,
      title: documentTitle
    });
    businessDocumentId = businessDocument.id;

    await uploadSmallPdf(request, accessToken, businessDocument.id);

    await page.goto(`/projects/${project.id}`);

    await expect(page.getByRole("heading", { name: "Hồ sơ dự án 360" })).toBeVisible();
    await expect(page.getByText("Lifecycle")).toBeVisible();
    await expect(page.getByText("Việc tiếp theo")).toBeVisible();
    await expect(page.getByText("Tài liệu quan trọng", { exact: true })).toBeVisible();

    await page.getByRole("tab", { name: /^Tài liệu/ }).click();
    await expect(page.getByText("Document Registry")).toBeVisible();
    await expect(page.getByRole("button", { name: /Thêm tài liệu/i })).toBeVisible();

    await page.getByRole("button", { name: /Thêm tài liệu/i }).click();
    await expect(page.getByRole("heading", { name: "Thêm tài liệu nghiệp vụ" })).toBeVisible();

    await page.getByPlaceholder("Tìm theo tên, số chứng từ, ghi chú...").fill(documentTitle);
    await expect(page.getByText(documentTitle)).toBeVisible();
    await expect(page.getByRole("button", { name: /Xem file/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /Tải file/i })).toBeVisible();
    await expect(page.getByText(/PDF rất nhỏ/i)).toBeVisible();
  } finally {
    if (businessDocumentId) {
      await deleteProjectBusinessDocument(request, accessToken, businessDocumentId);
    }
  }
});

async function getAccessTokenFromPage(page: Page) {
  const accessToken = await page.evaluate(() => {
    return (
      window.sessionStorage.getItem("ahso_access_token") ??
      window.localStorage.getItem("ahso_access_token")
    );
  });

  expect(accessToken).toBeTruthy();
  return accessToken as string;
}

async function getFirstProject(
  request: APIRequestContext,
  accessToken: string
) {
  const response = await request.get(`${API_URL}/projects?view=list&page=1&limit=1`, {
    headers: {
      Authorization: `Bearer ${accessToken}`
    }
  });

  expect(response.ok()).toBeTruthy();
  const body = await response.json();
  const project = body.data?.[0];
  expect(project?.id).toBeTruthy();
  expect(project?.customer?.id).toBeTruthy();

  return project as { id: string; code: string; name: string; customer: { id: string } };
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function createProjectBusinessDocument(
  request: APIRequestContext,
  accessToken: string,
  input: {
    projectId: string;
    customerId: string;
    title: string;
  }
) {
  const response = await request.post(`${API_URL}/business-documents`, {
    headers: {
      Authorization: `Bearer ${accessToken}`
    },
    data: {
      type: "CUSTOMER_PO",
      source: "RECEIVED",
      status: "SIGNED",
      title: input.title,
      documentNo: `E2E-PO-${Date.now()}`,
      documentDate: new Date().toISOString(),
      notes: "Tài liệu tự động tạo bởi Playwright để kiểm tra UX Project 360.",
      projectId: input.projectId,
      customerId: input.customerId
    }
  });

  expect(response.ok()).toBeTruthy();
  const body = await response.json();
  expect(body.data?.id).toBeTruthy();

  return body.data as { id: string };
}

async function uploadSmallPdf(
  request: APIRequestContext,
  accessToken: string,
  documentId: string
) {
  const response = await request.post(`${API_URL}/business-documents/${documentId}/file`, {
    headers: {
      Authorization: `Bearer ${accessToken}`
    },
    multipart: {
      file: {
        name: "e2e-project-360.pdf",
        mimeType: "application/pdf",
        buffer: Buffer.from("%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Count 0>>endobj\n%%EOF")
      }
    }
  });

  expect(response.ok()).toBeTruthy();
}

async function deleteProjectBusinessDocument(
  request: APIRequestContext,
  accessToken: string,
  documentId: string
) {
  await request.delete(`${API_URL}/business-documents/${documentId}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`
    }
  });
}
