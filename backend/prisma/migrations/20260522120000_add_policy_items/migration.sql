-- CreateEnum
CREATE TYPE "PolicyItemType" AS ENUM ('PAYMENT_TERMS', 'DELIVERY_TERMS');

-- CreateTable
CREATE TABLE "PolicyItem" (
    "id" TEXT NOT NULL,
    "type" "PolicyItemType" NOT NULL,
    "name" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PolicyItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PolicyItem_type_sortOrder_idx" ON "PolicyItem"("type", "sortOrder");
