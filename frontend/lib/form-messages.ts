import type { ZodErrorMap } from "zod";
import { formatMoney } from "@/components/forms/money-format";

/** Vietnamese mobile/landline: 0xxxxxxxxx (9-10 digits after 0) or +84xxxxxxxxx; spaces, dots and dashes allowed. */
export const VN_PHONE_PATTERN = /^(?:\+84|0)[\s.-]?\d(?:[\s.-]?\d){7,9}$/;

const n = (v: number) => formatMoney(v);

/** Standard validation messages. `label` is optional; without it the message is generic. */
export const formMessages = {
  required: (label?: string) => (label ? `${label} là bắt buộc` : "Trường này là bắt buộc"),
  minLength: (min: number, label?: string) => `${label ?? "Trường này"} phải có ít nhất ${n(min)} ký tự`,
  maxLength: (max: number, label?: string) => `${label ?? "Trường này"} tối đa ${n(max)} ký tự`,
  invalidEmail: "Email không hợp lệ",
  invalidPhone: "Số điện thoại không hợp lệ",
  invalidNumber: "Vui lòng nhập một số hợp lệ",
  min: (min: number, label?: string) => `${label ?? "Giá trị"} phải từ ${n(min)} trở lên`,
  max: (max: number, label?: string) => `${label ?? "Giá trị"} không được vượt quá ${n(max)}`,
  invalidDate: "Ngày không hợp lệ",
  mustBePositive: (label?: string) => `${label ?? "Giá trị"} phải lớn hơn 0`,
} as const;

/**
 * Zod error map using the standard messages. NOT applied globally.
 * Per schema:   schema.parse(data, { errorMap: zodErrorMap })
 * With RHF:     zodResolver(schema, { errorMap: zodErrorMap })
 * Opt-in global: z.setErrorMap(zodErrorMap) (do this only in a deliberate migration step).
 * Explicit messages in the schema (`.min(1, "...")`) always win over the map.
 */
export const zodErrorMap: ZodErrorMap = (issue, ctx) => {
  switch (issue.code) {
    case "invalid_type":
      if (issue.received === "undefined" || issue.received === "null") return { message: formMessages.required() };
      if (issue.expected === "number" || issue.expected === "integer" || issue.expected === "bigint")
        return { message: formMessages.invalidNumber };
      if (issue.expected === "date") return { message: formMessages.invalidDate };
      return { message: ctx.defaultError };
    case "invalid_date":
      return { message: formMessages.invalidDate };
    case "invalid_string":
      if (issue.validation === "email") return { message: formMessages.invalidEmail };
      return { message: ctx.defaultError };
    case "too_small":
      if (issue.type === "string") {
        return { message: issue.minimum <= 1 ? formMessages.required() : formMessages.minLength(Number(issue.minimum)) };
      }
      if (issue.type === "number") {
        const min = Number(issue.minimum);
        if (min === 0 && !issue.inclusive) return { message: formMessages.mustBePositive() };
        return { message: formMessages.min(min) };
      }
      if (issue.type === "array" && issue.minimum <= 1) return { message: formMessages.required() };
      return { message: ctx.defaultError };
    case "too_big":
      if (issue.type === "string") return { message: formMessages.maxLength(Number(issue.maximum)) };
      if (issue.type === "number") return { message: formMessages.max(Number(issue.maximum)) };
      return { message: ctx.defaultError };
    default:
      return { message: ctx.defaultError };
  }
};
