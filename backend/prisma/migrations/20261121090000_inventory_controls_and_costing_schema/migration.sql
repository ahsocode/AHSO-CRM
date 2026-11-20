-- Inventory controls, invoice intake and costing schema. See docs/INVENTORY_COSTING_SPEC.md.
-- ADDITIVE ONLY, with one relaxation: ProjectCost.projectId becomes nullable. No data is rewritten.

-- ── Enums ────────────────────────────────────────────────────────────────
CREATE TYPE "StockReceiptType" AS ENUM ('PURCHASE', 'RETURN_FROM_PROJECT', 'ADJUSTMENT');
CREATE TYPE "ReceiptSource" AS ENUM ('MANUAL', 'EMAIL_AUTO', 'IMPORT');
CREATE TYPE "ReceiptReviewStatus" AS ENUM ('PENDING_REVIEW', 'REVIEWED');
CREATE TYPE "PendingLineStatus" AS ENUM ('PENDING', 'RESOLVED', 'DISCARDED');
CREATE TYPE "IssueReasonType" AS ENUM ('PROJECT', 'INTERNAL_USE', 'WARRANTY', 'LOSS_DAMAGE', 'SAMPLE', 'OTHER');
CREATE TYPE "CostingMethod" AS ENUM ('AVERAGE', 'FIFO');
CREATE TYPE "SalesInvoiceStatus" AS ENUM ('ISSUED', 'CANCELLED', 'REPLACED');
CREATE TYPE "CostRecognitionStatus" AS ENUM ('IN_PROGRESS', 'DELIVERED');
ALTER TYPE "CostGroup" ADD VALUE IF NOT EXISTS 'TRAVEL';

-- ── Existing tables: new nullable / defaulted columns ────────────────────
ALTER TABLE "StockReceipt"
  ADD COLUMN "receiptType" "StockReceiptType" NOT NULL DEFAULT 'PURCHASE',
  ADD COLUMN "source" "ReceiptSource" NOT NULL DEFAULT 'MANUAL',
  ADD COLUMN "reviewStatus" "ReceiptReviewStatus",
  ADD COLUMN "reviewedById" TEXT,
  ADD COLUMN "reviewedAt" TIMESTAMP(3),
  ADD COLUMN "adjustsReceiptId" TEXT,
  ADD COLUMN "returnedFromIssueId" TEXT,
  ADD COLUMN "vatTotal" DECIMAL(15,0),
  ADD COLUMN "invoiceTotalDeclared" DECIMAL(15,0),
  ADD COLUMN "roundingDiff" DECIMAL(15,0) NOT NULL DEFAULT 0;

ALTER TABLE "StockReceiptItem"
  ADD COLUMN "vatRate" DECIMAL(5,2),
  ADD COLUMN "vatAmount" DECIMAL(15,0),
  ADD COLUMN "valueAdjustment" DECIMAL(15,0),
  ADD COLUMN "sourceLineNo" INTEGER;

ALTER TABLE "StockIssue"
  ADD COLUMN "reasonType" "IssueReasonType",
  ADD COLUMN "cancelledAt" TIMESTAMP(3),
  ADD COLUMN "cancelReason" TEXT,
  ADD COLUMN "cancelledById" TEXT;

ALTER TABLE "Project"
  ADD COLUMN "costRecognitionStatus" "CostRecognitionStatus" NOT NULL DEFAULT 'IN_PROGRESS',
  ADD COLUMN "costRecognizedAt" TIMESTAMP(3);

ALTER TABLE "ProjectCost" ALTER COLUMN "projectId" DROP NOT NULL;
ALTER TABLE "ProjectCost"
  ADD COLUMN "vatAmount" DECIMAL(15,0),
  ADD COLUMN "sellerTaxCode" TEXT,
  ADD COLUMN "invoiceSeries" TEXT,
  ADD COLUMN "invoiceNumber" TEXT,
  ADD COLUMN "lineNo" INTEGER,
  ADD COLUMN "source" "ReceiptSource",
  ADD COLUMN "reviewStatus" "ReceiptReviewStatus",
  ADD COLUMN "receiptId" TEXT;

-- ── New tables ───────────────────────────────────────────────────────────
CREATE TABLE "ApiToken" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "tokenPrefix" TEXT NOT NULL,
  "scopes" TEXT[],
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdById" TEXT NOT NULL,
  "lastUsedAt" TIMESTAMP(3),
  "lastUsedIp" TEXT,
  "expiresAt" TIMESTAMP(3),
  "revokedAt" TIMESTAMP(3),
  "revokedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ApiToken_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PeriodLockHistory" (
  "id" TEXT NOT NULL,
  "previousLockedUntil" TIMESTAMP(3),
  "newLockedUntil" TIMESTAMP(3),
  "changedById" TEXT NOT NULL,
  "reason" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PeriodLockHistory_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "InventoryCostingConfig" (
  "id" TEXT NOT NULL,
  "method" "CostingMethod" NOT NULL,
  "effectiveFrom" TIMESTAMP(3) NOT NULL,
  "changedById" TEXT NOT NULL,
  "reason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "InventoryCostingConfig_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MaterialAlias" (
  "id" TEXT NOT NULL,
  "supplierId" TEXT NOT NULL,
  "supplierItemCode" TEXT,
  "supplierItemName" TEXT NOT NULL,
  "normalizedName" TEXT NOT NULL,
  "supplierUnit" TEXT,
  "materialId" TEXT NOT NULL,
  "unitConversion" DECIMAL(15,4),
  "createdById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MaterialAlias_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ReceiptPendingLine" (
  "id" TEXT NOT NULL,
  "receiptId" TEXT NOT NULL,
  "lineNo" INTEGER NOT NULL,
  "supplierItemCode" TEXT,
  "supplierItemName" TEXT NOT NULL,
  "supplierUnit" TEXT,
  "quantity" DECIMAL(15,3) NOT NULL,
  "unitPrice" DECIMAL(15,0) NOT NULL,
  "vatRate" DECIMAL(5,2),
  "vatAmount" DECIMAL(15,0),
  "projectId" TEXT,
  "status" "PendingLineStatus" NOT NULL DEFAULT 'PENDING',
  "resolvedMaterialId" TEXT,
  "resolvedAt" TIMESTAMP(3),
  "resolvedById" TEXT,
  "discardReason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ReceiptPendingLine_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "StockIssueLotConsumption" (
  "id" TEXT NOT NULL,
  "issueItemId" TEXT NOT NULL,
  "stockLotId" TEXT NOT NULL,
  "quantity" DECIMAL(15,3) NOT NULL,
  "lotUnitPrice" DECIMAL(15,0) NOT NULL,
  "invoiceDateWarning" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "StockIssueLotConsumption_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SalesInvoice" (
  "id" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "contractId" TEXT,
  "series" TEXT NOT NULL,
  "number" TEXT NOT NULL,
  "date" TIMESTAMP(3) NOT NULL,
  "buyerTaxCode" TEXT,
  "amountExVat" DECIMAL(15,0) NOT NULL,
  "vatAmount" DECIMAL(15,0) NOT NULL DEFAULT 0,
  "status" "SalesInvoiceStatus" NOT NULL DEFAULT 'ISSUED',
  "notes" TEXT,
  "createdById" TEXT NOT NULL,
  "deletedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SalesInvoice_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CommonCostAllocation" (
  "id" TEXT NOT NULL,
  "periodFrom" TIMESTAMP(3) NOT NULL,
  "periodTo" TIMESTAMP(3) NOT NULL,
  "method" TEXT NOT NULL,
  "totalAmount" DECIMAL(15,0) NOT NULL,
  "createdById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CommonCostAllocation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CommonCostAllocationLine" (
  "id" TEXT NOT NULL,
  "allocationId" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "amount" DECIMAL(15,0) NOT NULL,
  "basisValue" DECIMAL(15,0) NOT NULL,
  "share" DECIMAL(9,6) NOT NULL,
  "projectCostId" TEXT,
  CONSTRAINT "CommonCostAllocationLine_pkey" PRIMARY KEY ("id")
);

-- ── Indexes ──────────────────────────────────────────────────────────────
CREATE UNIQUE INDEX "ApiToken_tokenHash_key" ON "ApiToken"("tokenHash");
CREATE INDEX "ApiToken_isActive_idx" ON "ApiToken"("isActive");
CREATE INDEX "PeriodLockHistory_createdAt_idx" ON "PeriodLockHistory"("createdAt");
CREATE INDEX "InventoryCostingConfig_effectiveFrom_idx" ON "InventoryCostingConfig"("effectiveFrom");
CREATE UNIQUE INDEX "MaterialAlias_supplierId_supplierItemCode_key" ON "MaterialAlias"("supplierId", "supplierItemCode");
CREATE INDEX "MaterialAlias_supplierId_normalizedName_idx" ON "MaterialAlias"("supplierId", "normalizedName");
CREATE INDEX "MaterialAlias_materialId_idx" ON "MaterialAlias"("materialId");
CREATE INDEX "ReceiptPendingLine_receiptId_status_idx" ON "ReceiptPendingLine"("receiptId", "status");
CREATE INDEX "ReceiptPendingLine_status_idx" ON "ReceiptPendingLine"("status");
CREATE INDEX "ReceiptPendingLine_projectId_idx" ON "ReceiptPendingLine"("projectId");
CREATE INDEX "StockIssueLotConsumption_issueItemId_idx" ON "StockIssueLotConsumption"("issueItemId");
CREATE INDEX "StockIssueLotConsumption_stockLotId_idx" ON "StockIssueLotConsumption"("stockLotId");
CREATE INDEX "StockIssueLotConsumption_invoiceDateWarning_idx" ON "StockIssueLotConsumption"("invoiceDateWarning");
CREATE INDEX "SalesInvoice_projectId_deletedAt_idx" ON "SalesInvoice"("projectId", "deletedAt");
CREATE INDEX "SalesInvoice_contractId_idx" ON "SalesInvoice"("contractId");
CREATE INDEX "SalesInvoice_date_idx" ON "SalesInvoice"("date");
CREATE UNIQUE INDEX "CommonCostAllocation_periodFrom_periodTo_key" ON "CommonCostAllocation"("periodFrom", "periodTo");
CREATE INDEX "CommonCostAllocationLine_allocationId_idx" ON "CommonCostAllocationLine"("allocationId");
CREATE INDEX "CommonCostAllocationLine_projectId_idx" ON "CommonCostAllocationLine"("projectId");
CREATE INDEX "StockReceipt_reviewStatus_idx" ON "StockReceipt"("reviewStatus");
CREATE INDEX "StockReceipt_adjustsReceiptId_idx" ON "StockReceipt"("adjustsReceiptId");
CREATE INDEX "StockReceipt_returnedFromIssueId_idx" ON "StockReceipt"("returnedFromIssueId");
CREATE INDEX "ProjectCost_receiptId_idx" ON "ProjectCost"("receiptId");
CREATE INDEX "ProjectCost_invoiceNumber_idx" ON "ProjectCost"("invoiceNumber");

-- Partial unique indexes (not expressible in Prisma schema).
CREATE UNIQUE INDEX "MaterialAlias_supplier_name_nocode_key"
  ON "MaterialAlias"("supplierId", "normalizedName") WHERE "supplierItemCode" IS NULL;
CREATE UNIQUE INDEX "ProjectCost_invoice_line_active_key"
  ON "ProjectCost"("sellerTaxCode", "invoiceSeries", "invoiceNumber", "lineNo")
  WHERE "sellerTaxCode" IS NOT NULL AND "invoiceSeries" IS NOT NULL AND "invoiceNumber" IS NOT NULL
    AND "lineNo" IS NOT NULL AND "deletedAt" IS NULL;
CREATE UNIQUE INDEX "SalesInvoice_series_number_active_key"
  ON "SalesInvoice"("series", "number") WHERE "status" <> 'CANCELLED' AND "deletedAt" IS NULL;

-- ── Foreign keys ─────────────────────────────────────────────────────────
ALTER TABLE "StockReceipt" ADD CONSTRAINT "StockReceipt_adjustsReceiptId_fkey" FOREIGN KEY ("adjustsReceiptId") REFERENCES "StockReceipt"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "StockReceipt" ADD CONSTRAINT "StockReceipt_returnedFromIssueId_fkey" FOREIGN KEY ("returnedFromIssueId") REFERENCES "StockIssue"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ProjectCost" ADD CONSTRAINT "ProjectCost_receiptId_fkey" FOREIGN KEY ("receiptId") REFERENCES "StockReceipt"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ApiToken" ADD CONSTRAINT "ApiToken_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MaterialAlias" ADD CONSTRAINT "MaterialAlias_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MaterialAlias" ADD CONSTRAINT "MaterialAlias_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "Material"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ReceiptPendingLine" ADD CONSTRAINT "ReceiptPendingLine_receiptId_fkey" FOREIGN KEY ("receiptId") REFERENCES "StockReceipt"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ReceiptPendingLine" ADD CONSTRAINT "ReceiptPendingLine_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ReceiptPendingLine" ADD CONSTRAINT "ReceiptPendingLine_resolvedMaterialId_fkey" FOREIGN KEY ("resolvedMaterialId") REFERENCES "Material"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "StockIssueLotConsumption" ADD CONSTRAINT "StockIssueLotConsumption_issueItemId_fkey" FOREIGN KEY ("issueItemId") REFERENCES "StockIssueItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StockIssueLotConsumption" ADD CONSTRAINT "StockIssueLotConsumption_stockLotId_fkey" FOREIGN KEY ("stockLotId") REFERENCES "StockLot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SalesInvoice" ADD CONSTRAINT "SalesInvoice_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SalesInvoice" ADD CONSTRAINT "SalesInvoice_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "Contract"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CommonCostAllocationLine" ADD CONSTRAINT "CommonCostAllocationLine_allocationId_fkey" FOREIGN KEY ("allocationId") REFERENCES "CommonCostAllocation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ── Immutable audit log (spec §7.1) ──────────────────────────────────────
CREATE OR REPLACE FUNCTION ahso_audit_log_immutable() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'AuditLog is append-only (% not allowed)', TG_OP USING ERRCODE = 'integrity_constraint_violation';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "AuditLog_no_update_delete"
  BEFORE UPDATE OR DELETE ON "AuditLog"
  FOR EACH ROW EXECUTE FUNCTION ahso_audit_log_immutable();

CREATE TRIGGER "AuditLog_no_truncate"
  BEFORE TRUNCATE ON "AuditLog"
  FOR EACH STATEMENT EXECUTE FUNCTION ahso_audit_log_immutable();

-- ── Permissions: inventory.approve / inventory.view_cost (ADMIN only by default) ──
INSERT INTO "Permission" ("id", "resource", "action", "createdAt")
VALUES
  ('perm_inventory_approve', 'inventory', 'approve', CURRENT_TIMESTAMP),
  ('perm_inventory_view_cost', 'inventory', 'view_cost', CURRENT_TIMESTAMP)
ON CONFLICT ("resource", "action") DO NOTHING;

INSERT INTO "_PermissionToUserRole" ("A", "B")
SELECT "id", 'role_admin'
FROM "Permission"
WHERE "resource" = 'inventory' AND "action" IN ('approve', 'view_cost')
ON CONFLICT ("A", "B") DO NOTHING;
