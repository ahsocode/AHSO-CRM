import { BadRequestException } from "@nestjs/common";
import type { MilestoneStatus, Prisma } from "@prisma/client";
import { decimalToNumber, sumDecimal } from "../common/utils/decimal";

export function formatNumber(value: number) {
    return new Intl.NumberFormat("vi-VN", {
      maximumFractionDigits: 0
    }).format(value);
  }

export function resolveMilestoneCompletedAt(
  status: MilestoneStatus,
  currentCompletedAt?: Date | null,
  explicitCompletedAt?: Date
) {
  if (explicitCompletedAt) {
    return explicitCompletedAt;
  }

  if (status === "DONE" || status === "ACCEPTED") {
    return currentCompletedAt ?? new Date();
  }

  return null;
}

export function mapMilestone(milestone: {
  id: string;
  name: string;
  description: string | null;
  dueDate: Date | null;
  completedAt: Date | null;
  status: MilestoneStatus;
  paymentAmount: Prisma.Decimal | null;
  notes: string | null;
}) {
  return {
    id: milestone.id,
    name: milestone.name,
    description: milestone.description,
    dueDate: milestone.dueDate,
    completedAt: milestone.completedAt,
    status: milestone.status,
    paymentAmount: Number(milestone.paymentAmount ?? 0),
    notes: milestone.notes
  };
}

export function resolveSelectedQuoteItems(
  quoteItems: Array<{
    id: string;
    order: number;
    name: string;
    description: string | null;
    unit: string | null;
    quantity: Prisma.Decimal;
    unitPrice: Prisma.Decimal;
    total: Prisma.Decimal;
  }>,
  selectedItemIds?: string[]
) {
  if (quoteItems.length === 0) {
    throw new BadRequestException("Báo giá nguồn chưa có hạng mục để chốt hợp đồng");
  }

  if (!selectedItemIds || selectedItemIds.length === 0) {
    return quoteItems;
  }

  const availableIds = new Set(quoteItems.map((item) => item.id));
  const invalidIds = selectedItemIds.filter((itemId) => !availableIds.has(itemId));

  if (invalidIds.length > 0) {
    throw new BadRequestException("Một số hạng mục được chọn không thuộc báo giá nguồn");
  }

  const selectedIds = new Set(selectedItemIds);
  const selectedItems = quoteItems.filter((item) => selectedIds.has(item.id));

  if (selectedItems.length === 0) {
    throw new BadRequestException("Cần chọn ít nhất một hạng mục để chốt hợp đồng");
  }

  return selectedItems;
}

export function calculateContractValueFromQuoteItems(
  quoteItems: Array<{
    total: Prisma.Decimal;
  }>,
  taxRate: Prisma.Decimal
) {
  const subtotal = sumDecimal(quoteItems.map((item) => item.total));
  const taxAmount = subtotal.mul(taxRate).div(100).round();

  return decimalToNumber(subtotal.plus(taxAmount));
}

export function mapContractItem(item: {
  id: string;
  order: number;
  name: string;
  description: string | null;
  unit: string | null;
  quantity: Prisma.Decimal;
  unitPrice: Prisma.Decimal;
  total: Prisma.Decimal;
  quoteItemId: string | null;
}) {
  return {
    id: item.id,
    order: item.order,
    name: item.name,
    description: item.description,
    unit: item.unit,
    quantity: Number(item.quantity),
    unitPrice: Number(item.unitPrice),
    total: Number(item.total),
    quoteItemId: item.quoteItemId
  };
}
