"use client";

import * as React from "react";
import { formatMoney, parseMoney } from "./money-format";
import { NumericTextInput, type NumericTextInputProps } from "./numeric-text-input";

export interface MoneyInputProps
  extends Omit<NumericTextInputProps, "parse" | "format" | "inputMode" | "caretChars" | "transformPaste"> {
  /** Allow a leading "-" (refunds, adjustments). Default: false. */
  allowNegative?: boolean;
}

const CARET_CHARS = /[\d-]/;

/**
 * VND integer input. Shows "1.234.567", stores `number | undefined`.
 * Empty is `undefined` (never 0 unless the user typed 0). Values above Number.MAX_SAFE_INTEGER are rejected.
 * Works with RHF `Controller`: `<MoneyInput {...field} />` (field.ref, onBlur, name are forwarded).
 */
export const MoneyInput = React.forwardRef<HTMLInputElement, MoneyInputProps>(function MoneyInput(
  { allowNegative = false, suffix = "₫", ...props },
  ref
) {
  const parse = React.useCallback((raw: string) => parseMoney(raw, { allowNegative }), [allowNegative]);
  const transformPaste = React.useCallback(
    (pasted: string) => {
      const r = parseMoney(pasted, { allowNegative, dropFraction: true });
      if (!r.ok || r.value === undefined) return null;
      return String(r.value);
    },
    [allowNegative]
  );
  return (
    <NumericTextInput
      {...props}
      ref={ref}
      suffix={suffix}
      inputMode="numeric"
      caretChars={CARET_CHARS}
      parse={parse}
      format={formatMoney}
      transformPaste={transformPaste}
    />
  );
});
