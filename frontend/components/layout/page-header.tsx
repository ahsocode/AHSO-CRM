import { cn } from "@/lib/utils";

export function PageHeader({
  title,
  description,
  action,
  className
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-4 md:flex-row md:items-end md:justify-between", className)}>
      <div>
        <p className="industrial-chip bg-primary/10 text-primary">Automation Hub</p>
        <h1 className="mt-4 text-3xl font-extrabold tracking-tight text-text-primary">{title}</h1>
        {description ? <p className="mt-2 text-sm text-text-secondary">{description}</p> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

