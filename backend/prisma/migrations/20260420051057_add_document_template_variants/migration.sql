-- CreateEnum
CREATE TYPE "DocumentTemplateStatus" AS ENUM ('DRAFT', 'PENDING_APPROVAL', 'PUBLISHED', 'ARCHIVED');

-- CreateTable
CREATE TABLE "DocumentTemplateVariant" (
    "id" TEXT NOT NULL,
    "type" "DocumentType" NOT NULL,
    "name" TEXT NOT NULL,
    "status" "DocumentTemplateStatus" NOT NULL DEFAULT 'DRAFT',
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "layoutJson" JSONB NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdById" TEXT NOT NULL,
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "basedOnVariantId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DocumentTemplateVariant_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DocumentTemplateVariant_type_status_createdAt_idx" ON "DocumentTemplateVariant"("type", "status", "createdAt");

-- CreateIndex
CREATE INDEX "DocumentTemplateVariant_type_isActive_idx" ON "DocumentTemplateVariant"("type", "isActive");

-- CreateIndex
CREATE INDEX "DocumentTemplateVariant_createdById_createdAt_idx" ON "DocumentTemplateVariant"("createdById", "createdAt");

-- AddForeignKey
ALTER TABLE "DocumentTemplateVariant" ADD CONSTRAINT "DocumentTemplateVariant_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentTemplateVariant" ADD CONSTRAINT "DocumentTemplateVariant_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentTemplateVariant" ADD CONSTRAINT "DocumentTemplateVariant_basedOnVariantId_fkey" FOREIGN KEY ("basedOnVariantId") REFERENCES "DocumentTemplateVariant"("id") ON DELETE SET NULL ON UPDATE CASCADE;
