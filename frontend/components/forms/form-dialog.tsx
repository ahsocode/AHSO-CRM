"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { FormActions } from "./form-actions";
import { FormError } from "./form-error";

export interface FormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  /** md = max-w-lg (<= 6 fields), lg = max-w-2xl (two columns). */
  size?: "md" | "lg";
  /** Pass `handleSubmit(onValid)` from RHF. */
  onSubmit: React.FormEventHandler<HTMLFormElement>;
  isSubmitting?: boolean;
  /** RHF `formState.isDirty`: closing asks for confirmation when true. */
  isDirty?: boolean;
  submitLabel?: string;
  submittingLabel?: string;
  cancelLabel?: string;
  /** Form-level error message. */
  error?: string | null;
  children: React.ReactNode;
}

/** Dialog + <form> + FormError + FormActions, with confirm-on-close when dirty and first-field autofocus. */
export function FormDialog({
  open,
  onOpenChange,
  title,
  description,
  size = "md",
  onSubmit,
  isSubmitting = false,
  isDirty = false,
  submitLabel,
  submittingLabel,
  cancelLabel,
  error,
  children,
}: FormDialogProps) {
  const [confirming, setConfirming] = React.useState(false);
  const formRef = React.useRef<HTMLFormElement>(null);
  const titleId = React.useId();

  React.useEffect(() => {
    if (!open) {
      setConfirming(false);
      return;
    }
    const frame = requestAnimationFrame(() => {
      formRef.current
        ?.querySelector<HTMLElement>(
          "input:not([type=hidden]):not([disabled]), textarea:not([disabled]), select:not([disabled]), button[role=combobox]:not([disabled])"
        )
        ?.focus();
    });
    return () => cancelAnimationFrame(frame);
  }, [open]);

  const requestClose = React.useCallback(
    (next: boolean) => {
      if (next) {
        onOpenChange(true);
        return;
      }
      if (isSubmitting) return;
      if (isDirty) setConfirming(true);
      else onOpenChange(false);
    },
    [isDirty, isSubmitting, onOpenChange]
  );

  return (
    <Dialog open={open} onOpenChange={requestClose}>
      <DialogContent
        aria-labelledby={titleId}
        className={cn("max-h-[90vh] overflow-y-auto", size === "lg" ? "max-w-2xl" : "max-w-lg")}
      >
        <DialogHeader>
          <DialogTitle id={titleId}>{title}</DialogTitle>
          {description ? <DialogDescription>{description}</DialogDescription> : null}
        </DialogHeader>
        <form ref={formRef} onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
          {children}
          <FormError message={error} />
          {confirming ? (
            <div role="alertdialog" aria-label="Xác nhận bỏ thay đổi" className="flex flex-col gap-3 rounded-md border border-border bg-bg-hover p-3">
              <p className="text-sm text-text-primary">Bạn có thay đổi chưa lưu. Bỏ thay đổi và đóng?</p>
              <div className="flex flex-wrap justify-end gap-2">
                <Button type="button" variant="outline" size="lg" className="min-h-[44px]" autoFocus onClick={() => setConfirming(false)}>
                  Tiếp tục chỉnh sửa
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  size="lg"
                  className="min-h-[44px]"
                  onClick={() => {
                    setConfirming(false);
                    onOpenChange(false);
                  }}
                >
                  Bỏ thay đổi
                </Button>
              </div>
            </div>
          ) : (
            <FormActions
              onCancel={() => requestClose(false)}
              isSubmitting={isSubmitting}
              submitLabel={submitLabel}
              submittingLabel={submittingLabel}
              cancelLabel={cancelLabel}
            />
          )}
        </form>
      </DialogContent>
    </Dialog>
  );
}
