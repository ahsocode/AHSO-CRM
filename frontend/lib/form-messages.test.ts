import { describe, expect, it } from "vitest";
import { z } from "zod";
import { VN_PHONE_PATTERN, formMessages, zodErrorMap } from "./form-messages";

const firstMessage = (schema: z.ZodTypeAny, input: unknown) => {
  const r = schema.safeParse(input, { errorMap: zodErrorMap });
  return r.success ? null : r.error.issues[0].message;
};

describe("formMessages", () => {
  it("builds labelled and generic messages", () => {
    expect(formMessages.required("Tên")).toBe("Tên là bắt buộc");
    expect(formMessages.required()).toBe("Trường này là bắt buộc");
    expect(formMessages.minLength(8, "Mật khẩu")).toBe("Mật khẩu phải có ít nhất 8 ký tự");
    expect(formMessages.maxLength(1000)).toBe("Trường này tối đa 1.000 ký tự");
    expect(formMessages.min(0, "Số lượng")).toBe("Số lượng phải từ 0 trở lên");
    expect(formMessages.max(100, "VAT")).toBe("VAT không được vượt quá 100");
    expect(formMessages.mustBePositive("Số tiền")).toBe("Số tiền phải lớn hơn 0");
    expect(formMessages.invalidEmail).toBe("Email không hợp lệ");
  });
});

describe("zodErrorMap", () => {
  it("maps required / empty string / undefined", () => {
    expect(firstMessage(z.string(), undefined)).toBe("Trường này là bắt buộc");
    expect(firstMessage(z.string().min(1), "")).toBe("Trường này là bắt buộc");
  });
  it("maps length, email, number, date", () => {
    expect(firstMessage(z.string().min(8), "abc")).toBe("Trường này phải có ít nhất 8 ký tự");
    expect(firstMessage(z.string().max(3), "abcd")).toBe("Trường này tối đa 3 ký tự");
    expect(firstMessage(z.string().email(), "x")).toBe("Email không hợp lệ");
    expect(firstMessage(z.number(), "abc")).toBe("Vui lòng nhập một số hợp lệ");
    expect(firstMessage(z.number().min(5), 1)).toBe("Giá trị phải từ 5 trở lên");
    expect(firstMessage(z.number().max(5), 9)).toBe("Giá trị không được vượt quá 5");
    expect(firstMessage(z.number().positive(), 0)).toBe("Giá trị phải lớn hơn 0");
    expect(firstMessage(z.date(), new Date("x"))).toBe("Ngày không hợp lệ");
  });
  it("explicit schema messages win", () => {
    expect(firstMessage(z.string().min(1, "Nhập tên"), "")).toBe("Nhập tên");
  });
  it("is not applied globally", () => {
    const r = z.string().safeParse(undefined);
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues[0].message).toBe("Required");
  });
});

describe("VN_PHONE_PATTERN", () => {
  it.each(["0901951351", "+84901951351", "090 195 1351", "028-3822-1234"])("accepts %s", (v) => {
    expect(VN_PHONE_PATTERN.test(v)).toBe(true);
  });
  it.each(["12345", "abc", "09019513", ""])("rejects %s", (v) => {
    expect(VN_PHONE_PATTERN.test(v)).toBe(false);
  });
});
