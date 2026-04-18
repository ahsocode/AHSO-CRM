import { AppIcon } from "./app-icon";

export function EmptyState({
  title,
  description
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="surface-card border border-dashed border-border/80 p-8 text-center">
      <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
        <AppIcon name="analytics" className="h-6 w-6" />
      </div>
      <h3 className="font-heading text-xl font-bold text-text-primary">{title}</h3>
      <p className="mx-auto mt-2 max-w-xl text-sm text-text-secondary">{description}</p>
    </div>
  );
}

