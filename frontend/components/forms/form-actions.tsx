"use client";

import * as React from "react";
import Link from "next/link";
import type { Route } from "next";
import { Loader2 } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface FormActionsProps {
  /** Cancel handler (dialog close / router.back()). Ignored when `cancelHref` is set. */
  onCancel?: () => void;
  cancelHref?: string;
  cancelLabel?: string;
  submitLabel?: string;
  submittingLabel?: string;
  isSubmitting?: boolean;
  disabled?: boolean;
  /** Sticky bottom bar for long pages. */
  sticky?: boolean;
  /** Extra controls placed next to Cancel (left group). */
  extra?: React.ReactNode;
  /** Use "button" when the primary action is not a form submit. */
  submitType?: "submit" | "button";
  onSubmitClick?: () => void;
  className?: string;
}

const TOUCH = "min-h-[44px] min-w-[44px]";

/** Cancel (secondary, left) ... Primary (right). Spinner + disabled while submitting. */
export function FormActions({
  onCancel,
  cancelHref,
  cancelLabel = "Hủy",
  submitLabel = "Lưu",
  submittingLabel = "Đang lưu…",
  isSubmitting = false,
  disabled = false,
  sticky = false,
  extra,
  submitType = "submit",
  onSubmitClick,
  className,
}: FormActionsProps) {
  const hasCancel = Boolean(cancelHref || onCancel);
  return (
    <div
      className={cn(
        "flex flex-wrap items-center justify-between gap-3",
        sticky && "sticky bottom-0 z-10 border-t border-border bg-bg-card py-3",
        className
      )}
    >
      <div className="flex flex-wrap items-center gap-2">
        {cancelHref ? (
          <Link href={cancelHref as Route} className={cn(buttonVariants({ variant: "outline", size: "lg" }), TOUCH)}>
            {cancelLabel}
          </Link>
        ) : hasCancel ? (
          <Button type="button" variant="outline" size="lg" className={TOUCH} onClick={onCancel} disabled={isSubmitting}>
            {cancelLabel}
          </Button>
        ) : null}
        {extra}
      </div>
      <Button
        type={submitType}
        size="lg"
        className={TOUCH}
        disabled={disabled || isSubmitting}
        aria-busy={isSubmitting || undefined}
        onClick={onSubmitClick}
      >
        {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
        {isSubmitting ? submittingLabel : submitLabel}
      </Button>
    </div>
  );
}
