import { expect, test, type Page } from "@playwright/test";
import { login } from "./helpers";

const API_URL = process.env.E2E_API_URL ?? "http://localhost:3001/api";

test("inventory receipt confirmation increases warehouse stock", async ({ page, request }) => {
  await login(page);
  const accessToken = await getAccessTokenFromPage(page);
  const headers = authHeaders(accessToken);
  const suffix = Date.now();
  let warehouseId: string | null = null;
  let materialId: string | null = null;
  let supplierId: string | null = null;

  try {
    const warehouseListResponse = await request.get(`${API_URL}/warehouses`, { headers });
    await expectOk(warehouseListResponse, "list warehouses");
    const warehouseList = unwrap(await warehouseListResponse.json());
    expect(Array.isArray(warehouseList)).toBe(true);

    const warehouseResponse = await request.post(`${API_URL}/warehouses`, {
      headers,
      data: {
        code: `E2E-WH-${suffix}`,
        name: `Kho E2E ${suffix}`,
        address: "AHSO Test Site",
        isActive: true
      }
    });
    await expectOk(warehouseResponse, "create warehouse");
    const warehouse = unwrap(await warehouseResponse.json()) as { id: string };
    warehouseId = warehouse.id;

    const materialsSelectResponse = await request.get(`${API_URL}/materials/select`, { headers });
    await expectOk(materialsSelectResponse, "list material select options");
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
    await expectOk(materialResponse, "create material");
    const material = unwrap(await materialResponse.json()) as { id: string };
    materialId = material.id;

    const supplierResponse = await request.post(`${API_URL}/suppliers`, {
      headers,
      data: {
        code: `E2E-INV-SUP-${suffix}`,
        name: `NCC tồn kho E2E ${suffix}`,
        phone: "0909000000",
        isActive: true
      }
    });
    await expectOk(supplierResponse, "create inventory supplier");
    const supplier = unwrap(await supplierResponse.json()) as { id: string };
    supplierId = supplier.id;

    const receiptResponse = await request.post(`${API_URL}/stock-receipts`, {
      headers,
      data: {
        warehouseId,
        supplierId,
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
    await expectOk(receiptResponse, "create stock receipt");
    const receipt = unwrap(await receiptResponse.json()) as { id: string };

    const confirmResponse = await request.post(`${API_URL}/stock-receipts/${receipt.id}/confirm`, { headers });
    await expectOk(confirmResponse, "confirm stock receipt");

    const balancesResponse = await request.get(`${API_URL}/inventory/balances`, {
      headers,
      params: {
        warehouseId,
        materialId
      }
    });
    await expectOk(balancesResponse, "get inventory balances");
    const balances = unwrap(await balancesResponse.json()) as Array<{ materialId: string; warehouseId: string; quantity: number }>;
    expect(balances.some((item) =>
      item.materialId === materialId &&
      item.warehouseId === warehouseId &&
      item.quantity >= 7
    )).toBe(true);
  } finally {
    if (materialId) {
      await request.delete(`${API_URL}/materials/${materialId}`, { headers }).catch(() => undefined);
    }
    if (supplierId) {
      await request.delete(`${API_URL}/suppliers/${supplierId}`, { headers }).catch(() => undefined);
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

async function expectOk(response: { ok(): boolean; status(): number; text(): Promise<string> }, label: string) {
  if (response.ok()) {
    return;
  }

  const body = await response.text();
  throw new Error(`${label} failed (${response.status()}): ${body}`);
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
