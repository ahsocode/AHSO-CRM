import { Decimal } from "@prisma/client/runtime/library";

export type DecimalLike = Decimal.Value | null | undefined;

export function toDecimal(value: DecimalLike): Decimal {
  return new Decimal(value ?? 0);
}

export function sumDecimal(values: DecimalLike[]): Decimal {
  return values.reduce<Decimal>((sum, value) => sum.plus(toDecimal(value)), new Decimal(0));
}

export function decimalToNumber(value: DecimalLike): number {
  return toDecimal(value).toNumber();
}
