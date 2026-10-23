import { z } from "zod";
import { costGroupSchema } from "./bom.dto";

const emptyToUndefined = (value: unknown) => {
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

const nullableId = z.preprocess(emptyToUndefined, z.string().trim().min(1).nullish());
const nullableString = (max: number) => z.preprocess(emptyToUndefined, z.string().trim().max(max).nullish());

export const createProjectCostSchema = z.object({
  group: costGroupSchema,
  description: z.string().trim().min(1, "Nội dung chi phí là bắt buộc").max(300),
  supplierId: nullableId,
  invoiceNo: nullableString(60),
  invoiceDate: z.coerce.date(),
  amount: z.coerce.number().min(0, "Số tiền không được âm").max(999_999_999_999),
  vatRate: z.preprocess((v) => (v === "" ? undefined : v), z.coerce.number().min(0).max(100).nullish()),
  bomLineId: nullableId,
  notes: nullableString(1000)
});

export const updateProjectCostSchema = createProjectCostSchema.partial();

export const projectCostFilterSchema = z.object({
  group: z.preprocess(emptyToUndefined, costGroupSchema.optional())
});

export type CreateProjectCostDto = z.infer<typeof createProjectCostSchema>;
export type UpdateProjectCostDto = z.infer<typeof updateProjectCostSchema>;
export type ProjectCostFilterDto = z.infer<typeof projectCostFilterSchema>;
