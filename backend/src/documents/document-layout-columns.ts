import { getByPath, normalizeText, type LineItemColumnRole } from "./document-layout-helpers";
import type { TemplateBox } from "./document-template.types";

type LineItemsTableBox = Extract<TemplateBox, { type: "line_items_table" }>;

export function getLineItemColumnPercents(
  box: LineItemsTableBox,
  context?: Record<string, unknown>
) {
  const roles = box.content.columns.map((column) => getLineItemColumnRole(column));
  const roleSet = new Set(roles);
  const isStandardCommercialTable =
    roleSet.has("index") &&
    roleSet.has("name") &&
    roleSet.has("quantity") &&
    roleSet.has("unitPrice") &&
    roleSet.has("total");

  const weightsWithDescription: Record<LineItemColumnRole, number> = {
    index: 6,
    name: 41,
    description: 23,
    quantity: 6,
    unitPrice: 12,
    total: 12,
    other: 8
  };
  const weightsWithoutDescription: Record<LineItemColumnRole, number> = {
    index: 6,
    name: 50,
    description: 0,
    quantity: 7,
    unitPrice: 18,
    total: 19,
    other: 8
  };
  const weights = roleSet.has("description") ? weightsWithDescription : weightsWithoutDescription;
  const quoteOverrides = getQuoteTableColumnWidthOverrides(context);
  if (!isStandardCommercialTable && !quoteOverrides) {
    return normalizeRawColumnPercents(box);
  }

  const raw = roles.map((role, index) => {
    const column = box.content.columns[index];
    const exactOverride = column ? quoteOverrides?.[column.id] : undefined;
    const roleOverride = quoteOverrides?.[role];
    return exactOverride ?? roleOverride ?? weights[role] ?? weights.other;
  });
  const total = raw.reduce((sum, value) => sum + value, 0) || 1;

  return raw.map((value) => (value / total) * 100);
}

export function getQuoteTableColumnWidthOverrides(context?: Record<string, unknown>) {
  const raw = (
    context
      ? getByPath(context, "quote.tableColumnWidths") ?? getByPath(context, "tableColumnWidths")
      : undefined
  );

  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return undefined;
  }

  return Object.entries(raw as Record<string, unknown>).reduce<Record<string, number>>((result, [key, value]) => {
    const numericValue = Number(value);
    if (Number.isFinite(numericValue) && numericValue > 0) {
      result[key] = numericValue;
    }
    return result;
  }, {});
}

export function normalizeRawColumnPercents(box: LineItemsTableBox) {
  const raw = box.content.columns.map((column) => Math.max(1, column.width ?? 1));
  const total = raw.reduce((sum, value) => sum + value, 0) || 1;

  return raw.map((value) => (value / total) * 100);
}

export function getLineItemColumnRole(column: LineItemsTableBox["content"]["columns"][number]): LineItemColumnRole {
  const label = `${column.label.vi} ${column.label.viEn ?? ""}`;
  const text = normalizeText(`${column.id} ${column.value} ${label}`);

  if (text.includes("index") || text.includes("stt") || text.includes("no.") || text.includes("{{index")) {
    return "index";
  }
  if (text.includes("unitprice") || text.includes("unit-price") || text.includes("don gia") || text.includes("price")) {
    return "unitPrice";
  }
  if (text.includes("total") || text.includes("amount") || text.includes("thanh tien")) {
    return "total";
  }
  if (text.includes("quantity") || text.includes("qty") || text.includes(" so luong") || text.includes(" sl")) {
    return "quantity";
  }
  if (text.includes("description") || text.includes("mo ta") || text.includes("desc")) {
    return "description";
  }
  if (text.includes("name") || text.includes("hang muc") || text.includes("item")) {
    return "name";
  }

  return "other";
}
