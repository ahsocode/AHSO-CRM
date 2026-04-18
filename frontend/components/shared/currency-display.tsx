import { formatVND, formatVNDShort } from "@/lib/format";

export function CurrencyDisplay({
  amount,
  short = false,
  className
}: {
  amount: number;
  short?: boolean;
  className?: string;
}) {
  return <span className={className}>{short ? formatVNDShort(amount) : formatVND(amount)}</span>;
}

