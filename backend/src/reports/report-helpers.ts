import type { Prisma } from "@prisma/client";

export function buildStatusBuckets<
  T extends { status: string; [key: string]: Prisma.Decimal | string | null }
>(items: T[], labels: Record<string, string>, valueKey: keyof T) {
  return Object.entries(labels).map(([status, label]) => ({
    key: status,
    label,
    count: items.filter((item) => item.status === status).length,
    totalValue: items
      .filter((item) => item.status === status)
      .reduce((sum, item) => sum + Number(item[valueKey] ?? 0), 0)
  }));
}

export function resolvePaymentSourceLabel(payment: {
  contract?: { contractNo: string } | null;
  quote?: { quoteNo: string } | null;
  project?: { code?: string | null } | null;
}) {
  return payment.contract?.contractNo ?? payment.quote?.quoteNo ?? payment.project?.code ?? "Dự án";
}

export function resolveMonthsRange(months: number) {
  const now = new Date();
  const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const nextMonthStart = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const start = new Date(currentMonthStart.getFullYear(), currentMonthStart.getMonth() - (months - 1), 1);

  return {
    start,
    nextMonthStart,
    months
  };
}

export function createCustomerSet(customerIds: Array<string | null | undefined>) {
  return new Set(customerIds.filter((customerId): customerId is string => Boolean(customerId)));
}

export function countSetIntersection(left: Set<string>, right: Set<string>) {
  const [smaller, larger] = left.size <= right.size ? [left, right] : [right, left];
  let count = 0;

  for (const customerId of smaller) {
    if (larger.has(customerId)) {
      count += 1;
    }
  }

  return count;
}

export function matchesFilters(
  row: Record<string, unknown>,
  filters: Array<{ field: string; operator: string; value: unknown }>
) {
  return filters.every((filter) => {
    const currentValue = row[filter.field];

    switch (filter.operator) {
      case "eq":
        return currentValue === filter.value;
      case "neq":
        return currentValue !== filter.value;
      case "contains":
        return String(currentValue ?? "")
          .toLowerCase()
          .includes(String(filter.value ?? "").toLowerCase());
      case "gte":
        return Number(currentValue ?? 0) >= Number(filter.value ?? 0);
      case "lte":
        return Number(currentValue ?? 0) <= Number(filter.value ?? 0);
      case "in":
        return Array.isArray(filter.value) ? filter.value.includes(currentValue as never) : false;
      default:
        return true;
    }
  });
}

export function aggregateRows(
  rows: Record<string, unknown>[],
  dimensions: string[],
  measures: Array<{ field: string; label: string; aggregator: "count" | "sum" }>
) {
  if (dimensions.length === 0) {
    return [
      measures.reduce<Record<string, unknown>>((acc, measure) => {
        acc[measure.label] =
          measure.aggregator === "count"
            ? rows.length
            : rows.reduce((sum, row) => sum + Number(row[measure.field] ?? 0), 0);
        return acc;
      }, {})
    ];
  }

  const groups = new Map<string, Record<string, unknown>>();

  for (const row of rows) {
    const groupKey = dimensions.map((dimension) => String(row[dimension] ?? "Chưa gán")).join(" / ");
    const current = groups.get(groupKey) ?? dimensions.reduce<Record<string, unknown>>((acc, dimension) => {
      acc[dimension] = row[dimension] ?? "Chưa gán";
      return acc;
    }, {});

    for (const measure of measures) {
      const currentValue = Number(current[measure.label] ?? 0);
      current[measure.label] =
        measure.aggregator === "count"
          ? currentValue + 1
          : currentValue + Number(row[measure.field] ?? 0);
    }

    groups.set(groupKey, current);
  }

  return Array.from(groups.values());
}
