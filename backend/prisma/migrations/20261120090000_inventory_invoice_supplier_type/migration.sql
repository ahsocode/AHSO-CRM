-- PR1 inventory costing: purchase invoice fields, supplier type, accounting class, project-tagged lots.
-- Additive only: new enums, nullable/defaulted columns, indexes. The single UPDATE assigns the default
-- accountingClass to existing materials (STOCK -> RAW_MATERIAL, PRODUCT -> FINISHED_GOOD, SERVICE -> NULL).

CREATE TYPE "InvoiceType" AS ENUM ('NORMAL', 'REPLACEMENT', 'ADJUSTMENT');
CREATE TYPE "SupplierType" AS ENUM ('GOODS', 'SERVICE', 'EXPENSE', 'OTHER');
CREATE TYPE "AccountingClass" AS ENUM ('RAW_MATERIAL', 'TOOL', 'MERCHANDISE', 'FINISHED_GOOD', 'CONSUMABLE_COMMON');

ALTER TABLE "StockReceipt"
  ADD COLUMN "invoiceSeries" TEXT,
  ADD COLUMN "invoiceNumber" TEXT,
  ADD COLUMN "invoiceDate" TIMESTAMP(3),
  ADD COLUMN "sellerTaxCode" TEXT,
  ADD COLUMN "invoiceFileRef" TEXT,
  ADD COLUMN "invoiceLookupCode" TEXT,
  ADD COLUMN "invoiceType" "InvoiceType" NOT NULL DEFAULT 'NORMAL',
  ADD COLUMN "relatedInvoiceRef" TEXT;

ALTER TABLE "StockReceiptItem" ADD COLUMN "projectId" TEXT;
ALTER TABLE "StockLot" ADD COLUMN "projectId" TEXT;
ALTER TABLE "Supplier" ADD COLUMN "supplierType" "SupplierType" NOT NULL DEFAULT 'GOODS';
ALTER TABLE "Material" ADD COLUMN "accountingClass" "AccountingClass";

CREATE INDEX "StockReceipt_invoiceNumber_idx" ON "StockReceipt"("invoiceNumber");
CREATE INDEX "StockReceiptItem_projectId_idx" ON "StockReceiptItem"("projectId");
CREATE INDEX "StockLot_projectId_idx" ON "StockLot"("projectId");
CREATE INDEX "Material_accountingClass_idx" ON "Material"("accountingClass");

ALTER TABLE "StockReceiptItem" ADD CONSTRAINT "StockReceiptItem_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "StockLot" ADD CONSTRAINT "StockLot_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Duplicate-invoice guard (Prisma cannot express partial unique indexes). A cancelled or soft-deleted
-- receipt frees its invoice number so it can be entered again.
CREATE UNIQUE INDEX "StockReceipt_invoice_active_key"
  ON "StockReceipt"("sellerTaxCode", "invoiceSeries", "invoiceNumber")
  WHERE "sellerTaxCode" IS NOT NULL
    AND "invoiceSeries" IS NOT NULL
    AND "invoiceNumber" IS NOT NULL
    AND "status" <> 'CANCELLED'
    AND "deletedAt" IS NULL;

-- Default accounting class for existing materials (SERVICE stays NULL).
UPDATE "Material" SET "accountingClass" = 'RAW_MATERIAL' WHERE "kind" = 'STOCK' AND "accountingClass" IS NULL;
UPDATE "Material" SET "accountingClass" = 'FINISHED_GOOD' WHERE "kind" = 'PRODUCT' AND "accountingClass" IS NULL;
