"use client";

import * as React from "react";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export interface FormFieldControlProps {
  id: string;
  "aria-invalid"?: true;
  "aria-required"?: true;
  "aria-describedby"?: string;
}

export interface FormFieldProps {
  label: React.ReactNode;
  /** Override the generated control id. */
  htmlFor?: string;
  required?: boolean;
  hint?: React.ReactNode;
  error?: string | null;
  className?: string;
  /** A single control (props are injected via cloneElement) or a render function. */
  children: React.ReactElement<Partial<FormFieldControlProps>> | ((props: FormFieldControlProps) => React.ReactNode);
}

/**
 * Label + control + hint + error, wired with aria-describedby / aria-invalid / aria-required.
 * RHF-free: pass `error={errors.x?.message}`.
 */
export function FormField({ label, htmlFor, required, hint, error, className, children }: FormFieldProps) {
  const reactId = React.useId();
  const existingId = React.isValidElement(children) ? children.props.id : undefined;
  const id = htmlFor ?? existingId ?? `field-${reactId}`;
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(" ") || undefined;

  const controlProps: FormFieldControlProps = {
    id,
    ...(error ? { "aria-invalid": true as const } : {}),
    ...(required ? { "aria-required": true as const } : {}),
    ...(describedBy ? { "aria-describedby": describedBy } : {}),
  };

  let control: React.ReactNode;
  if (typeof children === "function") {
    control = children(controlProps);
  } else {
    const existing = children.props["aria-describedby"];
    control = React.cloneElement(children, {
      ...controlProps,
      "aria-describedby": [existing, describedBy].filter(Boolean).join(" ") || undefined,
    });
  }

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <Label htmlFor={id} className="text-text-primary">
        {label}
        {required ? (
          <>
            <span aria-hidden="true" className="text-danger">
              {" *"}
            </span>
            <span className="sr-only"> (bắt buộc)</span>
          </>
        ) : null}
      </Label>
      {control}
      {hint ? (
        <p id={hintId} className="text-xs text-text-muted">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} role="alert" className="text-xs text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}
