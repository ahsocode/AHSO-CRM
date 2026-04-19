import { z } from "zod";

const emptyToUndefined = (value: unknown) =>
  typeof value === "string" && value.trim().length === 0 ? undefined : value;

export const customFieldResourceSchema = z.enum(["customer", "project", "contract"]);
export const customFieldTypeSchema = z.enum([
  "text",
  "number",
  "date",
  "select",
  "multiselect",
  "boolean"
]);

export const customFieldSchema = z.object({
  resource: customFieldResourceSchema,
  name: z
    .string()
    .trim()
    .min(1, "Tên key là bắt buộc")
    .regex(/^[a-z][a-z0-9_]*$/, "Tên key chỉ dùng chữ thường, số và dấu gạch dưới"),
  label: z.string().trim().min(1, "Nhãn hiển thị là bắt buộc"),
  type: customFieldTypeSchema,
  options: z
    .preprocess((value) => {
      if (value === "" || value === null) {
        return undefined;
      }

      return value;
    }, z.array(z.string().trim().min(1)).optional()),
  required: z.boolean().optional().default(false),
  order: z.coerce.number().int().min(0).optional().default(0)
});

export const updateCustomFieldSchema = customFieldSchema.partial().extend({
  resource: customFieldResourceSchema.optional(),
  name: z
    .string()
    .trim()
    .regex(/^[a-z][a-z0-9_]*$/, "Tên key chỉ dùng chữ thường, số và dấu gạch dưới")
    .optional()
});

export const customFieldFilterSchema = z.object({
  resource: z.preprocess(emptyToUndefined, customFieldResourceSchema.optional())
});

export const customFieldValuesSchema = z.record(z.string(), z.unknown()).optional().default({});

export type CustomFieldDto = z.infer<typeof customFieldSchema>;
export type UpdateCustomFieldDto = z.infer<typeof updateCustomFieldSchema>;
export type CustomFieldFilterDto = z.infer<typeof customFieldFilterSchema>;
export type CustomFieldValuesDto = z.infer<typeof customFieldValuesSchema>;
