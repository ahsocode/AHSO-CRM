import { expect, test, type Page } from "@playwright/test";
import { login } from "./helpers";

const API_URL = process.env.E2E_API_URL ?? "http://127.0.0.1:3001/api";

test("inventory receipt confirmation increases warehouse stock", async ({ page, request }) => {
  await login(page);
  const accessToken = await getAccessTokenFromPage(page);
  const headers = authHeaders(accessToken);
  const suffix = Date.now();
  let warehouseId: string | null = null;
  let materialId: string | null = null;

  try {
    const warehouseListResponse = await request.get(`${API_URL}/warehouses`, { headers });
    expect(warehouseListResponse.ok()).toBeTruthy();
    const warehouseList = unwrap(await warehouseListResponse.json()) as { items: unknown[] };
    expect(Array.isArray(warehouseList.items)).toBe(true);

    const warehouseResponse = await request.post(`${API_URL}/warehouses`, {
      headers,
      data: {
        code: `E2E-WH-${suffix}`,
        name: `Kho E2E ${suffix}`,
        address: "AHSO Test Site",
        isActive: true
      }
    });
    expect(warehouseResponse.ok()).toBeTruthy();
    const warehouse = unwrap(await warehouseResponse.json()) as { id: string };
    warehouseId = warehouse.id;

    const materialsSelectResponse = await request.get(`${API_URL}/materials/select`, { headers });
    expect(materialsSelectResponse.ok()).toBeTruthy();
    const materialsSelect = unwrap(await materialsSelectResponse.json());
    expect(Array.isArray(materialsSelect)).toBe(true);

    const materialResponse = await request.post(`${API_URL}/materials`, {
      headers,
      data: {
        code: `E2E-MAT-${suffix}`,
        name: `Vật tư E2E ${suffix}`,
        unit: "Cái",
        salePrice: 120000,
        costPrice: 80000,
        minStock: 0,
        isActive: true
      }
    });
    expect(materialResponse.ok()).toBeTruthy();
    const material = unwrap(await materialResponse.json()) as { id: string };
    materialId = material.id;

    const receiptResponse = await request.post(`${API_URL}/stock-receipts`, {
      headers,
      data: {
        warehouseId,
        date: new Date().toISOString(),
        notes: "E2E nhập kho smoke test",
        items: [
          {
            materialId,
            quantity: 7,
            unitPrice: 80000
          }
        ]
      }
    });
    expect(receiptResponse.ok()).toBeTruthy();
    const receipt = unwrap(await receiptResponse.json()) as { id: string };

    const confirmResponse = await request.post(`${API_URL}/stock-receipts/${receipt.id}/confirm`, { headers });
    expect(confirmResponse.ok()).toBeTruthy();

    const balancesResponse = await request.get(`${API_URL}/inventory/balances`, {
      headers,
      params: {
        warehouseId,
        materialId
      }
    });
    expect(balancesResponse.ok()).toBeTruthy();
    const balances = unwrap(await balancesResponse.json()) as {
      items: Array<{ materialId: string; warehouseId: string; quantity: number }>;
    };
    expect(balances.items.some((item) =>
      item.materialId === materialId &&
      item.warehouseId === warehouseId &&
      item.quantity >= 7
    )).toBe(true);
  } finally {
    if (materialId) {
      await request.delete(`${API_URL}/materials/${materialId}`, { headers }).catch(() => undefined);
    }
    if (warehouseId) {
      await request.delete(`${API_URL}/warehouses/${warehouseId}`, { headers }).catch(() => undefined);
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
