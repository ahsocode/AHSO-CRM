import { z } from "zod";

const emptyToUndefined = (value: unknown) => {
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

const optionalString = (maxLength: number) =>
  z.preprocess(emptyToUndefined, z.string().trim().max(maxLength).optional());

const nullishString = (maxLength: number) =>
  z.preprocess(emptyToUndefined, z.string().trim().max(maxLength).nullish());

const optionalId = z.preprocess(emptyToUndefined, z.string().trim().min(1).optional());

export const costGroupSchema = z.enum([
  "MECHANICAL",
  "ELECTRICAL",
  "VISION",
  "SOFTWARE",
  "LABOR",
  "OUTSOURCE",
  "SHIPPING",
  "OTHER"
]);

export const createProjectBomSchema = z.object({
  name: z.string().trim().min(2, "Tên BOM phải có ít nhất 2 ký tự").max(200),
  notes: optionalString(2000),
  sourceBomId: optionalId
});

export const updateBomSchema = z
  .object({
    name: z.string().trim().min(2, "Tên BOM phải có ít nhất 2 ký tự").max(200).optional(),
    notes: z.preprocess((v) => (typeof v === "string" && v.trim() === "" ? null : v), z.string().trim().max(2000).nullable().optional())
  })
  .refine((value) => value.name !== undefined || value.notes !== undefined, "Không có thông tin cần cập nhật");

export const bomLineInputSchema = z.object({
  id: optionalId,
  group: costGroupSchema.default("OTHER"),
  materialId: z.preprocess(emptyToUndefined, z.string().trim().min(1).nullish()),
  childBomId: z.preprocess(emptyToUndefined, z.string().trim().min(1).nullish()),
  name: z.string().trim().min(1, "Tên dòng là bắt buộc").max(300),
  specification: nullishString(1000),
  unit: nullishString(40),
  quantity: z.coerce.number().positive("Số lượng phải lớn hơn 0").max(1_000_000_000),
  estUnitCost: z.coerce.number().min(0, "Đơn giá không được âm").max(999_999_999_999).default(0),
  notes: nullishString(1000)
}).refine((line) => !(line.materialId && line.childBomId), {
  message: "Một dòng chỉ được gắn vật tư hoặc BOM con",
  path: ["childBomId"]
});

export const replaceBomLinesSchema = z.object({
  lines: z.array(bomLineInputSchema).max(1000, "Tối đa 1000 dòng")
});

export const bomModelFilterSchema = z.object({
  search: z.preprocess(emptyToUndefined, z.string().trim().max(160).optional()),
  productId: optionalId,
  status: z.preprocess(emptyToUndefined, z.enum(["DRAFT", "APPROVED", "ARCHIVED"]).optional()),
  latestOnly: z.preprocess((v) => (v === "true" ? true : v === "false" ? false : v), z.boolean().optional()),
  limit: z.coerce.number().int().min(1).max(200).default(100)
});

export const saveAsModelSchema = z
  .object({
    productId: optionalId,
    newProduct: z
      .object({
        code: z.string().trim().min(1, "Mã thành phẩm là bắt buộc").max(40),
        name: z.string().trim().min(2, "Tên thành phẩm phải có ít nhất 2 ký tự").max(200),
        unit: z.string().trim().min(1, "Đơn vị là bắt buộc").max(40)
      })
      .optional(),
    source: z.enum(["ESTIMATE", "ACTUAL"]).default("ESTIMATE")
  })
  .refine((value) => Boolean(value.productId) !== Boolean(value.newProduct), {
    message: "Chọn thành phẩm có sẵn hoặc nhập thông tin thành phẩm mới (chỉ một trong hai)"
  });

export const suggestAllocationSchema = z.object({
  bomId: z.string().trim().min(1, "Chọn BOM"),
  allocationId: optionalId,
  salesInvoiceDate: z.coerce.date(),
  quantityMultiplier: z.coerce.number().positive().max(100_000).default(1)
});

export type CreateProjectBomDto = z.infer<typeof createProjectBomSchema>;
export type UpdateBomDto = z.infer<typeof updateBomSchema>;
export type BomLineInputDto = z.infer<typeof bomLineInputSchema>;
export type ReplaceBomLinesDto = z.infer<typeof replaceBomLinesSchema>;
export type BomModelFilterDto = z.infer<typeof bomModelFilterSchema>;
export type SaveAsModelDto = z.infer<typeof saveAsModelSchema>;
export type SuggestAllocationDto = z.infer<typeof suggestAllocationSchema>;
