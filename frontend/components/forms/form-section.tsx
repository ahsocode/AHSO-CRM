import * as React from "react";
import { cn } from "@/lib/utils";

export interface FormSectionProps {
  title: string;
  description?: string;
  /** Grid columns on >= md screens. Use `md:col-span-2` on long fields. Default: 2. */
  columns?: 1 | 2;
  className?: string;
  children: React.ReactNode;
}

/** Heading + short description + field grid. */
export function FormSection({ title, description, columns = 2, className, children }: FormSectionProps) {
  const headingId = React.useId();
  return (
    <section aria-labelledby={headingId} className={cn("flex flex-col gap-4", className)}>
      <header className="flex flex-col gap-1">
        <h2 id={headingId} className="text-base font-semibold text-text-primary">
          {title}
        </h2>
        {description ? <p className="text-sm text-text-secondary">{description}</p> : null}
      </header>
      <div className={cn("grid gap-4", columns === 2 ? "md:grid-cols-2" : "grid-cols-1")}>{children}</div>
    </section>
  );
}
