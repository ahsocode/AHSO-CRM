import { cn } from "@/lib/utils";

export function ContentArea({
  children,
  className
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <main
      className={cn(
        "flex-1 px-3 py-4 pb-20 print:px-0 print:py-0 md:px-6 md:py-6 md:pb-6",
        className
      )}
    >
      {children}
    </main>
  );
}
