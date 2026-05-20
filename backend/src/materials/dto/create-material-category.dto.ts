import { z } from "zod";

const emptyToUndefined = (value: unknown) => {
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

export const createMaterialCategorySchema = z.object({
  code: z.string().trim().min(1, "Mã danh mục là bắt buộc").max(40),
  name: z.string().trim().min(2, "Tên danh mục phải có ít nhất 2 ký tự").max(100),
  parentId: z.preprocess(emptyToUndefined, z.string().trim().min(1).optional()),
});

export type CreateMaterialCategoryDto = z.infer<typeof createMaterialCategorySchema>;

export const updateMaterialCategorySchema = createMaterialCategorySchema.partial();
export type UpdateMaterialCategoryDto = z.infer<typeof updateMaterialCategorySchema>;
