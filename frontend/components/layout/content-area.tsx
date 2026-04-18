import { cn } from "@/lib/utils";

export function ContentArea({
  children,
  className
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <main className={cn("flex-1 px-4 py-6 print:px-0 print:py-0 md:px-8 md:py-8", className)}>{children}</main>;
}
