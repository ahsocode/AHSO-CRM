import Link from "next/link";

export function EmptyWarehouseNotice({ documentLabel }: { documentLabel: string }) {
  return (
    <div
      role="status"
      data-testid="empty-warehouse-notice"
      className="rounded-lg bg-warning-bg px-4 py-3 text-sm text-warning md:col-span-2"
    >
      <p>Chưa có kho nào. Tạo kho trước khi lập {documentLabel}.</p>
      <Link
        href="/inventory/warehouses/new"
        className="mt-1 inline-block font-semibold text-primary-mid underline underline-offset-2"
      >
        Tạo kho
      </Link>
    </div>
  );
}
