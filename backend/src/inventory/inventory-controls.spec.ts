import { BadRequestException, ForbiddenException } from "@nestjs/common";
import {
  assertCanApprove, assertPeriodOpen, canViewCost, getCostingMethod, getManualIssuePriceMode, maskCosts
} from "./inventory-controls";

const user = (permissions: string[], role: "ADMIN" | "MANAGER" | "STAFF" = "STAFF") => ({ sub: "u", email: "e", name: "n", role, permissions });

describe("inventory-controls", () => {
  it("admin always has approve/view_cost; staff only when granted", () => {
    expect(canViewCost(user([], "ADMIN"))).toBe(true);
    expect(canViewCost(user([]))).toBe(false);
    expect(canViewCost(user(["inventory.view_cost"]))).toBe(true);
    expect(() => assertCanApprove(user(["inventory.edit"], "MANAGER"))).toThrow(ForbiddenException);
    expect(() => assertCanApprove(user(["inventory.approve"], "MANAGER"))).not.toThrow();
  });

  it("assertPeriodOpen blocks dates on or before the lock", async () => {
    const db = { setting: { findUnique: jest.fn().mockResolvedValue({ value: JSON.stringify("2026-10-31") }) } } as never;
    await expect(assertPeriodOpen(db, new Date("2026-10-31"))).rejects.toThrow(BadRequestException);
    await expect(assertPeriodOpen(db, new Date("2026-11-01"))).resolves.toBeUndefined();
  });

  it("assertPeriodOpen allows everything when no lock is set", async () => {
    const db = { setting: { findUnique: jest.fn().mockResolvedValue(null) } } as never;
    await expect(assertPeriodOpen(db, new Date("2000-01-01"))).resolves.toBeUndefined();
  });

  it("getCostingMethod defaults to AVERAGE and honours config", async () => {
    const none = { inventoryCostingConfig: { findFirst: jest.fn().mockResolvedValue(null) } } as never;
    expect(await getCostingMethod(none)).toBe("AVERAGE");
    const fifo = { inventoryCostingConfig: { findFirst: jest.fn().mockResolvedValue({ method: "FIFO" }) } } as never;
    expect(await getCostingMethod(fifo)).toBe("FIFO");
  });

  it("getManualIssuePriceMode defaults to IGNORE_WARN", async () => {
    const db = { setting: { findUnique: jest.fn().mockResolvedValue(null) } } as never;
    expect(await getManualIssuePriceMode(db)).toBe("IGNORE_WARN");
    const block = { setting: { findUnique: jest.fn().mockResolvedValue({ value: '"BLOCK"' }) } } as never;
    expect(await getManualIssuePriceMode(block)).toBe("BLOCK");
  });

  it("maskCosts nulls price keys only when not visible", () => {
    const data = { id: "a", items: [{ unitPrice: 5, quantity: 2 }], costPrice: 9 };
    expect(maskCosts(data, true)).toEqual(data);
    expect(maskCosts(data, false)).toEqual({ id: "a", items: [{ unitPrice: null, quantity: 2 }], costPrice: null });
  });
});
