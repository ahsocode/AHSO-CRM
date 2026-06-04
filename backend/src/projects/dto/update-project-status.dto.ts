import { z } from "zod";

const emptyToUndefined = (value: unknown) => {
  if (typeof value !== "string") {
    return value;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

export const updateProjectStatusSchema = z.object({
  status: z.enum(["SURVEY", "QUOTING", "NEGOTIATING", "WON", "LOST", "DELIVERING", "COMPLETED"]),
  completedAt: z.preprocess(emptyToUndefined, z.coerce.date().optional()),
  salesInvoiceDate: z.preprocess(emptyToUndefined, z.coerce.date().optional())
}).refine((value) => value.status === "COMPLETED" || !value.completedAt, {
  message: "Chỉ nhập ngày hoàn thành khi dự án ở trạng thái Hoàn thành",
  path: ["completedAt"]
}).refine((value) => value.status === "COMPLETED" || !value.salesInvoiceDate, {
  message: "Chỉ nhập ngày hóa đơn bán ra khi dự án ở trạng thái Hoàn thành",
  path: ["salesInvoiceDate"]
}).refine((value) => value.status !== "COMPLETED" || Boolean(value.salesInvoiceDate), {
  message: "Ngày hóa đơn bán ra là bắt buộc khi hoàn thành dự án",
  path: ["salesInvoiceDate"]
});

export type UpdateProjectStatusDto = z.infer<typeof updateProjectStatusSchema>;
