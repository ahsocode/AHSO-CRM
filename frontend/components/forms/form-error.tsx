import * as React from "react";
import { AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export interface FormErrorProps {
  /** Form-level message. Renders nothing when empty. */
  message?: string | null;
  /** Optional per-field messages shown as a list. */
  details?: string[];
  className?: string;
}

/** Form-level error summary (role="alert"). Put it directly above FormActions. */
export function FormError({ message, details, className }: FormErrorProps) {
  if (!message && !(details && details.length)) return null;
  return (
    <div
      role="alert"
      className={cn(
        "flex items-start gap-2 rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger",
        className
      )}
    >
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      <div className="flex flex-col gap-1">
        {message ? <p className="font-medium">{message}</p> : null}
        {details && details.length ? (
          <ul className="list-disc pl-4">
            {details.map((d) => (
              <li key={d}>{d}</li>
            ))}
          </ul>
        ) : null}
      </div>
    </div>
  );
}
