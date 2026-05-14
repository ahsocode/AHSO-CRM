import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function V2SectionCard({
  eyebrow,
  title,
  description,
  action,
  children,
  className,
  contentClassName
}: {
  eyebrow?: string;
  title?: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  contentClassName?: string;
}) {
  return (
    <section className={cn("v2-shell-card overflow-hidden", className)}>
      {(eyebrow || title || description || action) && (
        <header className="flex flex-col gap-3 border-b border-border-light/80 px-5 py-4 md:flex-row md:items-start md:justify-between">
          <div>
            {eyebrow ? <p className="v2-label">{eyebrow}</p> : null}
            {title ? <h2 className="mt-1 font-heading text-lg font-extrabold tracking-[-0.02em] text-text-primary">{title}</h2> : null}
            {description ? <p className="mt-1 text-sm text-text-secondary">{description}</p> : null}
          </div>
          {action ? <div className="shrink-0">{action}</div> : null}
        </header>
      )}
      <div className={cn("p-5", contentClassName)}>{children}</div>
    </section>
  );
}

export function V2MetricCard({
  label,
  value,
  hint,
  tone = "primary",
  className
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  tone?: "primary" | "info" | "accent" | "success" | "danger" | "warning";
  className?: string;
}) {
  const toneClass = {
    primary: "border-primary text-primary",
    info: "border-primary-light text-primary-light",
    accent: "border-accent text-accent",
    success: "border-success text-success",
    danger: "border-danger text-danger",
    warning: "border-warning text-warning"
  }[tone];

  return (
    <article className={cn("v2-shell-card v2-card-hover border-l-4 p-5", toneClass, className)}>
      <p className="v2-label">{label}</p>
      <div className="mt-3 font-heading text-[26px] font-extrabold leading-none tracking-[-0.03em]">{value}</div>
      {hint ? <p className="mt-3 text-sm leading-6 text-text-secondary">{hint}</p> : null}
    </article>
  );
}

export function V2Toolbar({
  children,
  className
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap items-center gap-2 rounded-[18px] bg-white px-3 py-2 shadow-sm ring-1 ring-border-light", className)}>
      {children}
    </div>
  );
}

export function V2StatusPill({
  children,
  tone = "neutral",
  className
}: {
  children: ReactNode;
  tone?: "neutral" | "primary" | "accent" | "success" | "danger" | "warning";
  className?: string;
}) {
  const toneClass = {
    neutral: "bg-bg-hover text-text-secondary",
    primary: "bg-primary-bg text-primary",
    accent: "bg-accent-bg text-accent",
    success: "bg-success-bg text-success",
    danger: "bg-danger-bg text-danger",
    warning: "bg-warning-bg text-warning"
  }[tone];

  return (
    <span className={cn("inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-bold leading-none", toneClass, className)}>
      {children}
    </span>
  );
}
