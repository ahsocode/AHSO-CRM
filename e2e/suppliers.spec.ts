import { expect, test, type Page } from "@playwright/test";
import { login } from "./helpers";

const API_URL = process.env.E2E_API_URL ?? "http://127.0.0.1:3001/api";

test("supplier CRUD API smoke flow", async ({ page, request }) => {
  await login(page);
  const accessToken = await getAccessTokenFromPage(page);
  const headers = authHeaders(accessToken);
  const suffix = Date.now();
  let supplierId: string | null = null;

  try {
    const createResponse = await request.post(`${API_URL}/suppliers`, {
      headers,
      data: {
        code: `E2E-SUP-${suffix}`,
        name: `Nhà cung cấp E2E ${suffix}`,
        taxCode: `TAX${suffix}`,
        phone: "0909000000",
        email: `supplier-${suffix}@example.com`,
        contactName: "Nguyễn Kiểm Thử",
        isActive: true
      }
    });
    expect(createResponse.ok()).toBeTruthy();
    const created = unwrap(await createResponse.json()) as { id: string; name: string };
    supplierId = created.id;
    expect(created.name).toBe(`Nhà cung cấp E2E ${suffix}`);

    const listResponse = await request.get(`${API_URL}/suppliers`, {
      headers,
      params: { search: `E2E-SUP-${suffix}` }
    });
    expect(listResponse.ok()).toBeTruthy();
    const list = unwrap(await listResponse.json()) as { items: Array<{ id: string }> };
    expect(list.items.some((supplier) => supplier.id === supplierId)).toBe(true);

    const detailResponse = await request.get(`${API_URL}/suppliers/${supplierId}`, { headers });
    expect(detailResponse.ok()).toBeTruthy();
    const detail = unwrap(await detailResponse.json()) as { id: string; code: string };
    expect(detail).toMatchObject({
      id: supplierId,
      code: `E2E-SUP-${suffix}`
    });

    const updateResponse = await request.patch(`${API_URL}/suppliers/${supplierId}`, {
      headers,
      data: {
        name: `Nhà cung cấp E2E Updated ${suffix}`
      }
    });
    expect(updateResponse.ok()).toBeTruthy();
    const updated = unwrap(await updateResponse.json()) as { name: string };
    expect(updated.name).toBe(`Nhà cung cấp E2E Updated ${suffix}`);

    const deleteResponse = await request.delete(`${API_URL}/suppliers/${supplierId}`, { headers });
    expect(deleteResponse.ok()).toBeTruthy();

    const deletedDetailResponse = await request.get(`${API_URL}/suppliers/${supplierId}`, { headers });
    expect(deletedDetailResponse.status()).toBe(404);
    supplierId = null;
  } finally {
    if (supplierId) {
      await request.delete(`${API_URL}/suppliers/${supplierId}`, { headers }).catch(() => undefined);
    }
  }
});

async function getAccessTokenFromPage(page: Page) {
  const accessToken = await page.evaluate(() => window.sessionStorage.getItem("ahso_access_token"));
  expect(accessToken).toBeTruthy();
  return accessToken as string;
}

function authHeaders(accessToken: string) {
  return {
    Authorization: `Bearer ${accessToken}`
  };
}

function unwrap(payload: unknown) {
  if (
    payload &&
    typeof payload === "object" &&
    "data" in payload
  ) {
    return (payload as { data: unknown }).data;
  }

  return payload;
}
