-- CreateTable
CREATE TABLE "ProjectDocumentRequirement" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "type" "DocumentType" NOT NULL,
    "isRequired" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectDocumentRequirement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ProjectDocumentRequirement_projectId_type_key" ON "ProjectDocumentRequirement"("projectId", "type");

-- CreateIndex
CREATE INDEX "ProjectDocumentRequirement_projectId_isRequired_idx" ON "ProjectDocumentRequirement"("projectId", "isRequired");

-- CreateIndex
CREATE INDEX "ProjectDocumentRequirement_type_idx" ON "ProjectDocumentRequirement"("type");

-- AddForeignKey
ALTER TABLE "ProjectDocumentRequirement"
ADD CONSTRAINT "ProjectDocumentRequirement_projectId_fkey"
FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
