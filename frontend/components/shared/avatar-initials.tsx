import { cn } from "@/lib/utils";

export function AvatarInitials({
  name,
  className
}: {
  name: string;
  className?: string;
}) {
  const initials = name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");

  return (
    <div
      className={cn(
        "flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 font-heading text-sm font-bold text-primary",
        className
      )}
    >
      {initials}
    </div>
  );
}

