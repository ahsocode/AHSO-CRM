-- Nullable key preserves existing rows; generated business documents use one key per entity/type/language.
ALTER TABLE "BusinessDocument" ADD COLUMN "generationKey" TEXT;
CREATE UNIQUE INDEX "BusinessDocument_generationKey_key" ON "BusinessDocument"("generationKey");
CREATE TABLE "DocumentSourceData" (
    "id" TEXT NOT NULL,
    "type" "DocumentType" NOT NULL,
    "entityId" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "recordedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "DocumentSourceData_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "DocumentSourceData_type_entityId_key" ON "DocumentSourceData"("type", "entityId");
