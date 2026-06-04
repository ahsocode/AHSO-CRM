-- Add project completion sales invoice date.
ALTER TABLE "Project" ADD COLUMN "salesInvoiceDate" TIMESTAMP(3);

-- Treat StockReceipt.date as the purchase invoice/import date and store the invoice number.
ALTER TABLE "StockReceipt" ADD COLUMN "purchaseInvoiceNo" TEXT;

CREATE TYPE "ProjectMaterialAllocationStatus" AS ENUM ('DRAFT', 'CONFIRMED', 'CANCELLED');

CREATE TABLE "StockLot" (
  "id" TEXT NOT NULL,
  "stockReceiptItemId" TEXT,
  "warehouseId" TEXT NOT NULL,
  "materialId" TEXT NOT NULL,
  "purchaseInvoiceDate" TIMESTAMP(3) NOT NULL,
  "purchaseInvoiceNo" TEXT,
  "receivedQuantity" DECIMAL(15,3) NOT NULL,
  "remainingQuantity" DECIMAL(15,3) NOT NULL,
  "unitPrice" DECIMAL(15,0) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "StockLot_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ProjectMaterialAllocation" (
  "id" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "salesInvoiceDate" TIMESTAMP(3) NOT NULL,
  "status" "ProjectMaterialAllocationStatus" NOT NULL DEFAULT 'DRAFT',
  "notes" TEXT,
  "confirmedAt" TIMESTAMP(3),
  "cancelledAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ProjectMaterialAllocation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ProjectMaterialAllocationItem" (
  "id" TEXT NOT NULL,
  "allocationId" TEXT NOT NULL,
  "stockLotId" TEXT NOT NULL,
  "warehouseId" TEXT NOT NULL,
  "materialId" TEXT NOT NULL,
  "quantity" DECIMAL(15,3) NOT NULL,
  "unitPrice" DECIMAL(15,0) NOT NULL,
  "total" DECIMAL(15,0) NOT NULL,

  CONSTRAINT "ProjectMaterialAllocationItem_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "StockIssue" ADD COLUMN "allocationId" TEXT;

CREATE INDEX "StockLot_stockReceiptItemId_idx" ON "StockLot"("stockReceiptItemId");
CREATE INDEX "StockLot_warehouseId_idx" ON "StockLot"("warehouseId");
CREATE INDEX "StockLot_materialId_idx" ON "StockLot"("materialId");
CREATE INDEX "StockLot_purchaseInvoiceDate_idx" ON "StockLot"("purchaseInvoiceDate");
CREATE INDEX "ProjectMaterialAllocation_projectId_idx" ON "ProjectMaterialAllocation"("projectId");
CREATE INDEX "ProjectMaterialAllocation_status_idx" ON "ProjectMaterialAllocation"("status");
CREATE UNIQUE INDEX "ProjectMaterialAllocation_projectId_active_key" ON "ProjectMaterialAllocation"("projectId") WHERE "status" IN ('DRAFT', 'CONFIRMED');
CREATE UNIQUE INDEX "ProjectMaterialAllocationItem_allocationId_stockLotId_key" ON "ProjectMaterialAllocationItem"("allocationId", "stockLotId");
CREATE INDEX "ProjectMaterialAllocationItem_stockLotId_idx" ON "ProjectMaterialAllocationItem"("stockLotId");
CREATE INDEX "ProjectMaterialAllocationItem_warehouseId_idx" ON "ProjectMaterialAllocationItem"("warehouseId");
CREATE INDEX "ProjectMaterialAllocationItem_materialId_idx" ON "ProjectMaterialAllocationItem"("materialId");
CREATE INDEX "StockIssue_allocationId_idx" ON "StockIssue"("allocationId");

ALTER TABLE "StockLot" ADD CONSTRAINT "StockLot_stockReceiptItemId_fkey" FOREIGN KEY ("stockReceiptItemId") REFERENCES "StockReceiptItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "StockLot" ADD CONSTRAINT "StockLot_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StockLot" ADD CONSTRAINT "StockLot_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "Material"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ProjectMaterialAllocation" ADD CONSTRAINT "ProjectMaterialAllocation_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProjectMaterialAllocationItem" ADD CONSTRAINT "ProjectMaterialAllocationItem_allocationId_fkey" FOREIGN KEY ("allocationId") REFERENCES "ProjectMaterialAllocation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProjectMaterialAllocationItem" ADD CONSTRAINT "ProjectMaterialAllocationItem_stockLotId_fkey" FOREIGN KEY ("stockLotId") REFERENCES "StockLot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ProjectMaterialAllocationItem" ADD CONSTRAINT "ProjectMaterialAllocationItem_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ProjectMaterialAllocationItem" ADD CONSTRAINT "ProjectMaterialAllocationItem_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "Material"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StockIssue" ADD CONSTRAINT "StockIssue_allocationId_fkey" FOREIGN KEY ("allocationId") REFERENCES "ProjectMaterialAllocation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Backfill stock lots for confirmed historical receipts. Remaining quantity is capped by current StockBalance
-- per warehouse/material so legacy lots never exceed current physical stock. Because regular stock issues consume
-- oldest lots first, the remaining historical quantity is assigned to the newest confirmed receipts first.
INSERT INTO "StockLot" (
  "id",
  "stockReceiptItemId",
  "warehouseId",
  "materialId",
  "purchaseInvoiceDate",
  "purchaseInvoiceNo",
  "receivedQuantity",
  "remainingQuantity",
  "unitPrice",
  "createdAt",
  "updatedAt"
)
SELECT
  'clot_' || md5(receipt_item_id),
  receipt_item_id,
  warehouse_id,
  material_id,
  purchase_invoice_date,
  purchase_invoice_no,
  quantity,
  GREATEST(LEAST(cumulative_qty, balance_qty) - previous_cumulative_qty, 0),
  unit_price,
  NOW(),
  NOW()
FROM (
  SELECT
    sri."id" AS receipt_item_id,
    sr."warehouseId" AS warehouse_id,
    sri."materialId" AS material_id,
    sr."date" AS purchase_invoice_date,
    sr."purchaseInvoiceNo" AS purchase_invoice_no,
    sri."quantity" AS quantity,
    sri."unitPrice" AS unit_price,
    COALESCE(sb."quantity", 0) AS balance_qty,
    COALESCE(
      SUM(sri."quantity") OVER (
        PARTITION BY sr."warehouseId", sri."materialId"
        ORDER BY sr."date" DESC, sr."createdAt" DESC, sri."id" DESC
        ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING
      ),
      0
    ) AS previous_cumulative_qty,
    SUM(sri."quantity") OVER (
      PARTITION BY sr."warehouseId", sri."materialId"
      ORDER BY sr."date" DESC, sr."createdAt" DESC, sri."id" DESC
      ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
    ) AS cumulative_qty
  FROM "StockReceiptItem" sri
  JOIN "StockReceipt" sr ON sr."id" = sri."receiptId"
  LEFT JOIN "StockBalance" sb
    ON sb."warehouseId" = sr."warehouseId"
   AND sb."materialId" = sri."materialId"
  WHERE sr."status" = 'CONFIRMED'
    AND sr."deletedAt" IS NULL
) lot_source
WHERE GREATEST(LEAST(cumulative_qty, balance_qty) - previous_cumulative_qty, 0) > 0;
