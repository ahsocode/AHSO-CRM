import { z } from "zod";

const emptyToUndefined = (value: unknown) => {
  if (typeof value !== "string") {
    return value;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

const optionalString = (maxLength: number) =>
  z.preprocess(emptyToUndefined, z.string().trim().max(maxLength).optional());

const optionalDate = z.preprocess(emptyToUndefined, z.coerce.date().optional());

export const updateContractSchema = z
  .object({
    signDate: optionalDate,
    startDate: optionalDate,
    endDate: optionalDate,
    value: z.coerce.number().positive("Giá trị hợp đồng phải lớn hơn 0").max(999_999_999_999).optional(),
    status: z.enum(["ACTIVE", "SUSPENDED", "COMPLETED", "CANCELLED"]).optional(),
    fileUrl: optionalString(1000),
    notes: optionalString(2000)
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "Cần cung cấp ít nhất một trường để cập nhật"
  })
  .refine(
    (value) => !value.startDate || !value.endDate || value.endDate.getTime() >= value.startDate.getTime(),
    {
      message: "Ngày kết thúc phải sau hoặc bằng ngày bắt đầu",
      path: ["endDate"]
    }
  );

export type UpdateContractDto = z.infer<typeof updateContractSchema>;
