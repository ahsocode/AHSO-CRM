"use client";

import * as React from "react";
import { Loader2 } from "lucide-react";
import { SelectContent, SelectItem, SelectRoot, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface SelectFieldProps {
  options: SelectOption[];
  /** "" / undefined shows the placeholder. */
  value?: string | null;
  onValueChange?: (value: string) => void;
  onBlur?: React.FocusEventHandler<HTMLButtonElement>;
  placeholder?: string;
  /** Shows a loading row instead of options (no more `<option>Đang tải...</option>`). */
  loading?: boolean;
  disabled?: boolean;
  id?: string;
  name?: string;
  className?: string;
  "aria-invalid"?: boolean | "true" | "false";
  "aria-required"?: boolean | "true" | "false";
  "aria-describedby"?: string;
  "aria-label"?: string;
}

/** Radix select wrapper: placeholder, loading, error state (via aria-invalid from FormField). */
export const SelectField = React.forwardRef<HTMLButtonElement, SelectFieldProps>(function SelectField(
  { options, value, onValueChange, onBlur, placeholder = "Chọn…", loading, disabled, id, name, className, ...aria },
  ref
) {
  return (
    <SelectRoot value={value ?? ""} onValueChange={onValueChange} disabled={disabled || loading} name={name}>
      <SelectTrigger
        ref={ref}
        id={id}
        onBlur={onBlur}
        className={cn("aria-[invalid=true]:border-danger", className)}
        {...aria}
      >
        {loading ? (
          <span className="flex items-center gap-2 text-text-muted">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            Đang tải…
          </span>
        ) : (
          <SelectValue placeholder={<span className="text-text-muted">{placeholder}</span>} />
        )}
      </SelectTrigger>
      <SelectContent>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value} disabled={o.disabled}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </SelectRoot>
  );
});
