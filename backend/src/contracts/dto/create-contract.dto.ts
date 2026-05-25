import { z } from "zod";
import { customFieldValuesSchema } from "../../custom-fields/dto/custom-field.dto";

const emptyToUndefined = (value: unknown) => {
  if (typeof value !== "string") {
    return value;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

const optionalString = (maxLength: number) =>
  z.preprocess(emptyToUndefined, z.string().trim().max(maxLength).optional());
const optionalNullableString = (maxLength: number) =>
  z.preprocess(emptyToUndefined, z.string().trim().max(maxLength).nullable().optional());

const optionalDate = z.preprocess(emptyToUndefined, z.coerce.date().optional());

export const createContractSchema = z
  .object({
    projectId: z.string().trim().min(1, "Dự án là bắt buộc"),
    sourceQuoteId: z.string().trim().min(1, "Báo giá nguồn không hợp lệ").optional(),
    sourceQuoteItemIds: z.array(z.string().trim().min(1)).max(200).optional(),
    signDate: optionalDate,
    startDate: optionalDate,
    endDate: optionalDate,
    value: z.coerce.number().positive("Giá trị hợp đồng phải lớn hơn 0").max(999_999_999_999),
    status: z.enum(["ACTIVE", "SUSPENDED", "COMPLETED", "CANCELLED"]).default("ACTIVE"),
    fileUrl: optionalNullableString(1000),
    notes: optionalString(2000),
    customFieldValues: customFieldValuesSchema
  })
  .refine(
    (value) => !value.startDate || !value.endDate || value.endDate.getTime() >= value.startDate.getTime(),
    {
      message: "Ngày kết thúc phải sau hoặc bằng ngày bắt đầu",
      path: ["endDate"]
    }
  )
  .refine((value) => !value.sourceQuoteItemIds?.length || Boolean(value.sourceQuoteId), {
    message: "Chọn báo giá nguồn trước khi chọn hạng mục chốt hợp đồng",
    path: ["sourceQuoteId"]
  })
  .refine(
    (value) => !value.sourceQuoteItemIds || new Set(value.sourceQuoteItemIds).size === value.sourceQuoteItemIds.length,
    {
      message: "Danh sách hạng mục chốt hợp đồng bị trùng",
      path: ["sourceQuoteItemIds"]
    }
  );

export type CreateContractDto = z.infer<typeof createContractSchema>;
