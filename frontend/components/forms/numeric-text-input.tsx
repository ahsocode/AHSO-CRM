"use client";

import * as React from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { ParseResult } from "./money-format";

type NativeInputProps = Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  "value" | "defaultValue" | "onChange" | "type" | "inputMode" | "min" | "max" | "step"
>;

export interface NumericTextInputProps extends NativeInputProps {
  /** Controlled value. `undefined`/`null` = empty. */
  value?: number | null;
  onChange?: (value: number | undefined) => void;
  parse: (raw: string) => ParseResult;
  format: (value: number | undefined) => string;
  inputMode: "numeric" | "decimal";
  /** Characters counted when restoring the caret after reformatting. */
  caretChars: RegExp;
  /** Return the text to insert for a pasted string, or null to reject the paste. */
  transformPaste?: (pasted: string) => string | null;
  suffix?: string | null;
}

/** Internal engine shared by MoneyInput and NumberInput (text input + number|undefined model). */
export const NumericTextInput = React.forwardRef<HTMLInputElement, NumericTextInputProps>(function NumericTextInput(
  { value, onChange, onBlur, parse, format, inputMode, caretChars, transformPaste, suffix, className, ...rest },
  ref
) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  React.useImperativeHandle(ref, () => inputRef.current as HTMLInputElement);

  const normalized = value ?? undefined;
  const [text, setText] = React.useState(() => format(normalized));
  const lastEmitted = React.useRef<number | undefined>(normalized);
  const pendingCaret = React.useRef<number | null>(null);

  // External changes (form.reset, setValue, server data) -> re-render text.
  React.useEffect(() => {
    if (normalized !== lastEmitted.current) {
      lastEmitted.current = normalized;
      setText(format(normalized));
    }
  }, [normalized, format]);

  React.useLayoutEffect(() => {
    const el = inputRef.current;
    const target = pendingCaret.current;
    pendingCaret.current = null;
    if (!el || target === null || document.activeElement !== el) return;
    let seen = 0;
    let pos = el.value.length;
    if (target === 0) pos = 0;
    else {
      for (let i = 0; i < el.value.length; i += 1) {
        if (caretChars.test(el.value[i])) seen += 1;
        if (seen === target) {
          pos = i + 1;
          break;
        }
      }
    }
    el.setSelectionRange(pos, pos);
  }, [text, caretChars]);

  const apply = (raw: string, caret: number) => {
    const result = parse(raw);
    if (!result.ok) return; // reject keystroke: controlled input snaps back to previous text
    pendingCaret.current = raw.slice(0, caret).split("").filter((ch) => caretChars.test(ch)).length;
    lastEmitted.current = result.value;
    setText(result.text);
    onChange?.(result.value);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    apply(e.target.value, e.target.selectionStart ?? e.target.value.length);
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    if (!transformPaste) return;
    e.preventDefault();
    const insert = transformPaste(e.clipboardData.getData("text"));
    if (insert === null) return;
    const el = e.currentTarget;
    const start = el.selectionStart ?? el.value.length;
    const end = el.selectionEnd ?? start;
    apply(el.value.slice(0, start) + insert + el.value.slice(end), start + insert.length);
  };

  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    // Drop dangling in-progress text ("-", "1,") -> canonical text of the current value.
    setText(format(lastEmitted.current));
    onBlur?.(e);
  };

  return (
    <div className="relative">
      <Input
        {...rest}
        ref={inputRef}
        type="text"
        inputMode={inputMode}
        autoComplete={rest.autoComplete ?? "off"}
        value={text}
        onChange={handleChange}
        onPaste={handlePaste}
        onBlur={handleBlur}
        className={cn(
          "tabular-nums aria-[invalid=true]:border-danger aria-[invalid=true]:focus:ring-danger/20",
          suffix ? "pr-10" : undefined,
          className
        )}
      />
      {suffix ? (
        <span aria-hidden="true" className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-text-muted">
          {suffix}
        </span>
      ) : null}
    </div>
  );
});
