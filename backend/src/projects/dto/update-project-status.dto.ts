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
  completedAt: z.preprocess(emptyToUndefined, z.coerce.date().optional())
}).refine((value) => value.status === "COMPLETED" || !value.completedAt, {
  message: "Chỉ nhập ngày hoàn thành khi dự án ở trạng thái Hoàn thành",
  path: ["completedAt"]
});

export type UpdateProjectStatusDto = z.infer<typeof updateProjectStatusSchema>;
