import { z } from "zod";

const emptyToUndefined = (value: unknown) => {
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

const optionalString = (maxLength: number) =>
  z.preprocess(emptyToUndefined, z.string().trim().max(maxLength).optional());

export const createWarehouseSchema = z.object({
  code: z.string().trim().min(1, "Mã kho là bắt buộc").max(40),
  name: z.string().trim().min(2, "Tên kho phải có ít nhất 2 ký tự").max(200),
  address: optionalString(500),
  managerId: z.preprocess(emptyToUndefined, z.string().trim().min(1).optional()),
  isActive: z.boolean().default(true),
});

export type CreateWarehouseDto = z.infer<typeof createWarehouseSchema>;
