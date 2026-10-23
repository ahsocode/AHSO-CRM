// Types for BOM, project costs and cost reports — see docs/BOM_SPEC.md.
// Shapes mirror the NestJS responses in backend/src/boms and backend/src/projects.

import type { MaterialKind } from "@/lib/types";

export type BomKind = "PROJECT" | "MODEL";
export type BomStatus = "DRAFT" | "APPROVED" | "ARCHIVED";
export type CostGroup =
  | "MECHANICAL"
  | "ELECTRICAL"
  | "VISION"
  | "SOFTWARE"
  | "LABOR"
  | "OUTSOURCE"
  | "SHIPPING"
  | "OTHER";

export interface BomTotalsByGroup {
  group: CostGroup;
  amount: number;
}

export interface BomTotals {
  total: number;
  byGroup: BomTotalsByGroup[];
}

export interface BomProductRef {
  id: string;
  code: string;
  name: string;
  unit: string;
}

export interface BomListItem {
  id: string;
  code: string;
  name: string;
  kind: BomKind;
  status: BomStatus;
  version: number;
  projectId: string | null;
  productId: string | null;
  product: BomProductRef | null;
  sourceBomId: string | null;
  notes: string | null;
  approvedAt: string | null;
  createdAt: string;
  updatedAt: string;
  createdBy: { id: string; name: string };
  lineCount: number;
  /** Estimated total (R7) */
  total: number;
}

export interface BomLineMaterial {
  id: string;
  code: string;
  name: string;
  unit: string;
  kind: MaterialKind;
}

export interface BomLineChildBom {
  id: string;
  code: string;
  name: string;
  version: number;
}

export interface BomLine {
  id: string;
  order: number;
  group: CostGroup;
  materialId: string | null;
  childBomId: string | null;
  name: string;
  specification: string | null;
  unit: string | null;
  quantity: number;
  estUnitCost: number;
  notes: string | null;
  material: BomLineMaterial | null;
  childBom: BomLineChildBom | null;
  /** Total of the child BOM (only for sub-assembly lines) */
  childTotal: number | null;
  /** quantity x (childTotal ?? estUnitCost) */
  amount: number;
}

export interface BomDetail {
  id: string;
  code: string;
  name: string;
  kind: BomKind;
  status: BomStatus;
  version: number;
  projectId: string | null;
  productId: string | null;
  sourceBomId: string | null;
  notes: string | null;
  approvedAt: string | null;
  createdAt: string;
  updatedAt: string;
  createdBy: { id: string; name: string };
  project: { id: string; code: string; name: string } | null;
  product: BomProductRef | null;
  sourceBom: { id: string; code: string; name: string; version: number } | null;
  lines: BomLine[];
  totals: BomTotals;
}

/** Line as sent to PUT /boms/:id/lines (id kept for existing lines so links survive). */
export interface BomLineInput {
  id?: string;
  group: CostGroup;
  materialId?: string | null;
  childBomId?: string | null;
  name: string;
  specification?: string | null;
  unit?: string | null;
  quantity: number;
  estUnitCost: number;
  notes?: string | null;
}

export interface BomCreateInput {
  name: string;
  notes?: string;
  /** Approved MODEL BOM or another BOM to copy lines from */
  sourceBomId?: string;
}

export interface BomUpdateInput {
  name?: string;
  notes?: string | null;
}

export interface BomModelFilters {
  search?: string;
  productId?: string;
  status?: BomStatus;
  latestOnly?: boolean;
  limit?: number;
}

export interface BomSaveAsModelInput {
  productId?: string;
  newProduct?: { code: string; name: string; unit: string };
  source: "ESTIMATE" | "ACTUAL";
}

export interface BomCreatedResult {
  id: string;
  code: string;
  version?: number;
  productId?: string | null;
}

// ─── Quote integration (R8) ───────────────────────────────────────────────────

export interface QuoteItemCostEstimate {
  cost: number;
  margin: number;
  marginPct: number | null;
}

export interface QuoteCostEstimateSummary {
  cost: number;
  /** Sum of line totals that have a BOM */
  revenue: number;
  margin: number;
  marginPct: number | null;
  coveredItemCount: number;
  itemCount: number;
  /** false when some quote lines have no BOM, so the margin covers only part of the quote */
  isComplete: boolean;
}

export interface QuoteItemBomRef {
  id: string;
  code: string;
  name: string;
  status: BomStatus;
  version: number;
}

// ─── Project costs ────────────────────────────────────────────────────────────

export interface ProjectCost {
  id: string;
  projectId: string;
  group: CostGroup;
  description: string;
  supplierId: string | null;
  supplier: { id: string; code: string; name: string } | null;
  invoiceNo: string | null;
  invoiceDate: string;
  amount: number;
  vatRate: number | null;
  bomLineId: string | null;
  bomLine: { id: string; name: string; bomId: string; bomCode: string } | null;
  allocationId: string | null;
  allocation: {
    id: string;
    salesInvoiceNo: string | null;
    salesInvoiceDate: string;
    status: "DRAFT" | "CONFIRMED" | "CANCELLED";
  } | null;
  notes: string | null;
  createdBy: { id: string; name: string };
  createdAt: string;
  updatedAt: string;
}

export interface ProjectCostInput {
  group: CostGroup;
  description: string;
  supplierId?: string | null;
  invoiceNo?: string | null;
  invoiceDate: string;
  amount: number;
  vatRate?: number | null;
  bomLineId?: string | null;
  notes?: string | null;
}

export type ProjectCostUpdateInput = Partial<ProjectCostInput>;

// ─── Allocation suggestion (FIFO, spec §4) ────────────────────────────────────

export interface AllocationSuggestInput {
  bomId: string;
  salesInvoiceDate: string;
  quantityMultiplier?: number;
  /** Exclude this draft's reservations when refreshing its suggestion. */
  allocationId?: string;
}

export interface SuggestedAllocationItem {
  stockLotId: string;
  warehouseId: string;
  warehouse: { id: string; code: string; name: string } | null;
  materialId: string;
  material: { id: string; code: string | null; name: string; unit: string | null } | null;
  /** Top-level BOM line this item is booked against */
  bomLineId: string;
  quantity: number;
  unitPrice: number;
  total: number;
  purchaseInvoiceDate: string | null;
  purchaseInvoiceNo: string | null;
  /** Split when one lot serves several BOM lines (the allocation keeps one row per lot) */
  breakdown: Array<{ bomLineId: string; quantity: number }>;
}

export interface AllocationShortage {
  materialId: string;
  bomLineId: string;
  code: string | null;
  name: string;
  unit: string | null;
  requiredQty: number;
  allocatedQty: number;
  missingQty: number;
}

export interface AllocationServiceLine {
  bomLineId: string;
  group: CostGroup;
  name: string;
  quantity: number;
  estimatedAmount: number;
}

export interface AllocationSuggestResult {
  bomId: string;
  bomCode: string;
  salesInvoiceDate: string;
  quantityMultiplier: number;
  items: SuggestedAllocationItem[];
  shortages: AllocationShortage[];
  /** Service lines that still have no ProjectCost — suggest adding one */
  serviceLines: AllocationServiceLine[];
  totalAmount: number;
}

// ─── Allocations (multi) ──────────────────────────────────────────────────────

export interface MaterialAllocationItemInput {
  stockLotId: string;
  quantity: number;
  bomLineId?: string | null;
}

export interface MaterialAllocationInput {
  salesInvoiceDate: string;
  salesInvoiceNo?: string;
  notes?: string;
  items: MaterialAllocationItemInput[];
  /** Direct costs to attach (invoice date must not be after salesInvoiceDate). Omit to keep as is. */
  costIds?: string[];
}

// ─── Reports ──────────────────────────────────────────────────────────────────

export interface CostSummaryGroupRow {
  group: CostGroup;
  estimated: number;
  actual: number;
  /** actual - estimated; > 0 means over budget */
  variance: number;
}

export interface CostSummaryLineRow {
  bomId: string;
  bomCode: string;
  bomLineId: string;
  order: number;
  group: CostGroup;
  name: string;
  estimated: number;
  actual: number;
  variance: number;
}

export interface ProjectCostSummary {
  projectId: string;
  /** Revenue before VAT */
  revenue: number;
  revenueSource: "CONTRACT" | "QUOTE" | "NONE";
  revenueRef: { id: string; no: string } | null;
  materialCost: number;
  directCost: number;
  totalCost: number;
  grossProfit: number;
  grossMarginPct: number | null;
  estimatedCost: number;
  estimatedProfit: number;
  estimatedMarginPct: number | null;
  estimateBasis: "APPROVED" | "DRAFT" | "NONE";
  boms: Array<{ id: string; code: string; name: string; status: BomStatus }>;
  byGroup: CostSummaryGroupRow[];
  byLine: CostSummaryLineRow[];
  unassigned: { materialCost: number; directCost: number };
  allocations: Array<{
    id: string;
    salesInvoiceNo: string | null;
    salesInvoiceDate: string;
    materialCost: number;
  }>;
}

export interface CostSheetMaterialRow {
  stt: number;
  materialCode: string;
  materialName: string;
  unit: string;
  quantity: number;
  unitPrice: number;
  total: number;
  warehouse: string;
  bomLine: { id: string; name: string; group: CostGroup } | null;
  purchaseInvoiceNo: string | null;
  purchaseInvoiceDate: string;
  receiptNo: string | null;
}

export interface CostSheetCostRow {
  stt: number;
  group: CostGroup;
  description: string;
  supplier: string | null;
  invoiceNo: string | null;
  invoiceDate: string;
  amount: number;
  vatRate: number | null;
}

export interface AllocationCostSheet {
  allocation: {
    id: string;
    salesInvoiceNo: string | null;
    salesInvoiceDate: string;
    status: "DRAFT" | "CONFIRMED" | "CANCELLED";
    notes: string | null;
    confirmedAt: string | null;
  };
  project: { id: string; code: string; name: string };
  customer: { id: string; name: string };
  materials: CostSheetMaterialRow[];
  costs: CostSheetCostRow[];
  totals: { materialTotal: number; costTotal: number; grandTotal: number };
}
