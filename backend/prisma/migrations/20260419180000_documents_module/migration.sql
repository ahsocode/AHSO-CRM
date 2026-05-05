-- CreateEnum
CREATE TYPE "DocumentType" AS ENUM (
  'QUOTATION',
  'PROPOSAL',
  'SURVEY_REPORT',
  'CONTRACT',
  'CONTRACT_ADDENDUM',
  'NDA',
  'DELIVERY_NOTE',
  'DOC_HANDOVER',
  'INSTALLATION_REPORT',
  'ACCEPTANCE_REPORT',
  'PARTIAL_ACCEPTANCE',
  'WARRANTY_CERT',
  'MAINTENANCE_RECORD',
  'PAYMENT_REQUEST',
  'PAYMENT_RECEIPT',
  'AR_RECONCILIATION'
);

-- AlterTable
ALTER TABLE "Customer" ADD COLUMN "code" TEXT;
ALTER TABLE "Customer" ADD COLUMN "language" TEXT NOT NULL DEFAULT 'vi';

-- CreateIndex
CREATE UNIQUE INDEX "Customer_code_key" ON "Customer"("code");

-- CreateTable
CREATE TABLE "Document" (
    "id" TEXT NOT NULL,
    "type" "DocumentType" NOT NULL,
    "number" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "language" TEXT NOT NULL DEFAULT 'vi',
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "customerId" TEXT,
    "pdfPath" TEXT,
    "renderedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT NOT NULL,

    CONSTRAINT "Document_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Document_number_key" ON "Document"("number");

-- CreateIndex
CREATE INDEX "Document_entityType_entityId_idx" ON "Document"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "Document_customerId_idx" ON "Document"("customerId");

-- CreateIndex
CREATE INDEX "Document_type_createdAt_idx" ON "Document"("type", "createdAt");

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
