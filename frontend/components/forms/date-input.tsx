"use client";

import * as React from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { isoToVi } from "./date-format";

export interface DateInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "defaultValue" | "onChange" | "type"> {
  /** ISO "yyyy-mm-dd" or empty. */
  value?: string | null;
  /** ISO "yyyy-mm-dd" or `undefined` when cleared. */
  onChange?: (value: string | undefined) => void;
  /** ISO min/max. */
  min?: string;
  max?: string;
}

/** Native date picker. Value is always ISO; the dd/mm/yyyy reading is exposed through aria-label. */
export const DateInput = React.forwardRef<HTMLInputElement, DateInputProps>(function DateInput(
  { value, onChange, className, "aria-label": ariaLabel, ...rest },
  ref
) {
  const vi = isoToVi(value);
  const label = ariaLabel ? (vi ? `${ariaLabel}, ${vi}` : ariaLabel) : undefined;
  return (
    <Input
      {...rest}
      ref={ref}
      type="date"
      value={value ?? ""}
      aria-label={label}
      onChange={(e) => onChange?.(e.target.value === "" ? undefined : e.target.value)}
      className={cn("aria-[invalid=true]:border-danger aria-[invalid=true]:focus:ring-danger/20", className)}
    />
  );
});
