import { BadRequestException } from "@nestjs/common";

export const ACCOUNTING_CLASSES = [
  "RAW_MATERIAL",
  "TOOL",
  "MERCHANDISE",
  "FINISHED_GOOD",
  "CONSUMABLE_COMMON",
] as const;

export type AccountingClassValue = (typeof ACCOUNTING_CLASSES)[number];
export type MaterialKindValue = "STOCK" | "SERVICE" | "PRODUCT";

/**
 * `kind` = does the item pass through the warehouse; `accountingClass` = which account it is booked to.
 * Rules: SERVICE -> always null; PRODUCT -> default FINISHED_GOOD; STOCK -> default RAW_MATERIAL.
 *
 * @param requested undefined = not provided (use default / keep current), null = explicitly clear.
 * @param current   stored value, used when only `kind` changes.
 */
export function resolveAccountingClass(
  kind: MaterialKindValue,
  requested: AccountingClassValue | null | undefined,
  current?: AccountingClassValue | null
): AccountingClassValue | null {
  if (kind === "SERVICE") {
    if (requested) {
      throw new BadRequestException(
        "Vật tư loại Dịch vụ không qua kho nên không có nhóm hạch toán (accountingClass phải để trống)"
      );
    }
    return null;
  }
  if (requested !== undefined) return requested;
  if (current) return current;
  return kind === "PRODUCT" ? "FINISHED_GOOD" : "RAW_MATERIAL";
}
