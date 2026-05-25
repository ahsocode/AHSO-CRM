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

export const createPaymentSchema = z.object({
  amount: z.coerce.number().positive("Giá trị thanh toán phải lớn hơn 0").max(999_999_999_999),
  paidAt: z.coerce.date(),
  method: optionalString(60),
  reference: optionalString(120),
  notes: optionalString(1000),
  contractId: optionalString(120),
  quoteId: optionalString(120)
});

export type CreatePaymentDto = z.infer<typeof createPaymentSchema>;
