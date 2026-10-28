"use client";

import * as React from "react";
import { formatDecimal, parseDecimal } from "./money-format";
import { NumericTextInput, type NumericTextInputProps } from "./numeric-text-input";

export interface NumberInputProps
  extends Omit<NumericTextInputProps, "parse" | "format" | "inputMode" | "caretChars" | "transformPaste"> {
  /** Max digits after the decimal separator. 0 = integers only. Default: 2. */
  maxFractionDigits?: number;
  allowNegative?: boolean;
}

const CARET_CHARS = /[\d,.-]/;

/**
 * Decimal input (quantity, VAT %, ...). Accepts "2,5" or "2.5", stores `number | undefined`.
 * Empty is `undefined`. Range (min/max) is validated by Zod, not clamped here.
 */
export const NumberInput = React.forwardRef<HTMLInputElement, NumberInputProps>(function NumberInput(
  { maxFractionDigits = 2, allowNegative = false, ...props },
  ref
) {
  const parse = React.useCallback(
    (raw: string) => parseDecimal(raw, { maxFractionDigits, allowNegative }),
    [maxFractionDigits, allowNegative]
  );
  const format = React.useCallback(
    (v: number | undefined) => formatDecimal(v, maxFractionDigits),
    [maxFractionDigits]
  );
  return (
    <NumericTextInput
      {...props}
      ref={ref}
      inputMode={maxFractionDigits > 0 ? "decimal" : "numeric"}
      caretChars={CARET_CHARS}
      parse={parse}
      format={format}
    />
  );
});
