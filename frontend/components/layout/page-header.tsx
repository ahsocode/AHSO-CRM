import { cn } from "@/lib/utils";

export function PageHeader({
  title,
  description,
  action,
  className,
  eyebrow = "Automation Hub"
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
  eyebrow?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-3 md:gap-4 md:flex-row md:items-center md:justify-between", className)}>
      <div>
        {eyebrow ? <p className="v2-label text-primary hidden md:block">{eyebrow}</p> : null}
        <h1 className="v2-page-title md:mt-2">{title}</h1>
        {description ? (
          <p className="mt-1 max-w-3xl text-sm leading-6 text-text-secondary hidden md:block">{description}</p>
        ) : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}
