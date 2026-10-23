-- BOM (định mức vật tư), material kinds and direct project costs. See docs/BOM_SPEC.md.

CREATE TYPE "MaterialKind" AS ENUM ('STOCK', 'SERVICE', 'PRODUCT');
CREATE TYPE "BomKind" AS ENUM ('PROJECT', 'MODEL');
CREATE TYPE "BomStatus" AS ENUM ('DRAFT', 'APPROVED', 'ARCHIVED');
CREATE TYPE "CostGroup" AS ENUM ('MECHANICAL', 'ELECTRICAL', 'VISION', 'SOFTWARE', 'LABOR', 'OUTSOURCE', 'SHIPPING', 'OTHER');

ALTER TABLE "Material" ADD COLUMN "kind" "MaterialKind" NOT NULL DEFAULT 'STOCK';
CREATE INDEX "Material_kind_idx" ON "Material"("kind");

-- A project may now have several allocations, one per sales invoice (spec §5).
DROP INDEX IF EXISTS "ProjectMaterialAllocation_projectId_active_key";
ALTER TABLE "ProjectMaterialAllocation" ADD COLUMN "salesInvoiceNo" TEXT;

CREATE TABLE "Bom" (
  "id" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "kind" "BomKind" NOT NULL,
  "status" "BomStatus" NOT NULL DEFAULT 'DRAFT',
  "version" INTEGER NOT NULL DEFAULT 1,
  "projectId" TEXT,
  "productId" TEXT,
  "sourceBomId" TEXT,
  "notes" TEXT,
  "approvedAt" TIMESTAMP(3),
  "createdById" TEXT NOT NULL,
  "deletedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "Bom_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "BomLine" (
  "id" TEXT NOT NULL,
  "bomId" TEXT NOT NULL,
  "order" INTEGER NOT NULL,
  "group" "CostGroup" NOT NULL DEFAULT 'OTHER',
  "materialId" TEXT,
  "childBomId" TEXT,
  "name" TEXT NOT NULL,
  "specification" TEXT,
  "unit" TEXT,
  "quantity" DECIMAL(15,3) NOT NULL,
  "estUnitCost" DECIMAL(15,0) NOT NULL DEFAULT 0,
  "notes" TEXT,

  CONSTRAINT "BomLine_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ProjectCost" (
  "id" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "group" "CostGroup" NOT NULL,
  "description" TEXT NOT NULL,
  "supplierId" TEXT,
  "invoiceNo" TEXT,
  "invoiceDate" TIMESTAMP(3) NOT NULL,
  "amount" DECIMAL(15,0) NOT NULL,
  "vatRate" DECIMAL(5,2),
  "bomLineId" TEXT,
  "allocationId" TEXT,
  "notes" TEXT,
  "createdById" TEXT NOT NULL,
  "deletedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ProjectCost_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "QuoteItem" ADD COLUMN "bomId" TEXT;
ALTER TABLE "ProjectMaterialAllocationItem" ADD COLUMN "bomLineId" TEXT;

CREATE UNIQUE INDEX "Bom_code_key" ON "Bom"("code");
CREATE UNIQUE INDEX "Bom_productId_version_key" ON "Bom"("productId", "version");
CREATE INDEX "Bom_projectId_idx" ON "Bom"("projectId");
CREATE INDEX "Bom_kind_status_idx" ON "Bom"("kind", "status");
CREATE INDEX "Bom_deletedAt_idx" ON "Bom"("deletedAt");
CREATE INDEX "BomLine_bomId_order_idx" ON "BomLine"("bomId", "order");
CREATE INDEX "BomLine_materialId_idx" ON "BomLine"("materialId");
CREATE INDEX "BomLine_childBomId_idx" ON "BomLine"("childBomId");
CREATE INDEX "ProjectCost_projectId_deletedAt_idx" ON "ProjectCost"("projectId", "deletedAt");
CREATE INDEX "ProjectCost_bomLineId_idx" ON "ProjectCost"("bomLineId");
CREATE INDEX "ProjectCost_allocationId_idx" ON "ProjectCost"("allocationId");
CREATE INDEX "ProjectCost_supplierId_idx" ON "ProjectCost"("supplierId");
CREATE INDEX "QuoteItem_bomId_idx" ON "QuoteItem"("bomId");
CREATE INDEX "ProjectMaterialAllocationItem_bomLineId_idx" ON "ProjectMaterialAllocationItem"("bomLineId");

ALTER TABLE "Bom" ADD CONSTRAINT "Bom_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Bom" ADD CONSTRAINT "Bom_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Material"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Bom" ADD CONSTRAINT "Bom_sourceBomId_fkey" FOREIGN KEY ("sourceBomId") REFERENCES "Bom"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Bom" ADD CONSTRAINT "Bom_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "BomLine" ADD CONSTRAINT "BomLine_bomId_fkey" FOREIGN KEY ("bomId") REFERENCES "Bom"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BomLine" ADD CONSTRAINT "BomLine_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "Material"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "BomLine" ADD CONSTRAINT "BomLine_childBomId_fkey" FOREIGN KEY ("childBomId") REFERENCES "Bom"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ProjectCost" ADD CONSTRAINT "ProjectCost_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProjectCost" ADD CONSTRAINT "ProjectCost_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ProjectCost" ADD CONSTRAINT "ProjectCost_bomLineId_fkey" FOREIGN KEY ("bomLineId") REFERENCES "BomLine"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ProjectCost" ADD CONSTRAINT "ProjectCost_allocationId_fkey" FOREIGN KEY ("allocationId") REFERENCES "ProjectMaterialAllocation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ProjectCost" ADD CONSTRAINT "ProjectCost_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "QuoteItem" ADD CONSTRAINT "QuoteItem_bomId_fkey" FOREIGN KEY ("bomId") REFERENCES "Bom"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ProjectMaterialAllocationItem" ADD CONSTRAINT "ProjectMaterialAllocationItem_bomLineId_fkey" FOREIGN KEY ("bomLineId") REFERENCES "BomLine"("id") ON DELETE SET NULL ON UPDATE CASCADE;
