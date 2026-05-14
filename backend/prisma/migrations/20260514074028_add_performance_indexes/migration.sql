-- CreateIndex
CREATE INDEX "Contract_projectId_deletedAt_idx" ON "Contract"("projectId", "deletedAt");

-- CreateIndex
CREATE INDEX "Contract_status_deletedAt_idx" ON "Contract"("status", "deletedAt");

-- CreateIndex
CREATE INDEX "Customer_deletedAt_idx" ON "Customer"("deletedAt");

-- CreateIndex
CREATE INDEX "Customer_assignedToId_deletedAt_idx" ON "Customer"("assignedToId", "deletedAt");

-- CreateIndex
CREATE INDEX "Customer_status_deletedAt_idx" ON "Customer"("status", "deletedAt");

-- CreateIndex
CREATE INDEX "Project_customerId_deletedAt_idx" ON "Project"("customerId", "deletedAt");

-- CreateIndex
CREATE INDEX "Project_status_deletedAt_idx" ON "Project"("status", "deletedAt");

-- CreateIndex
CREATE INDEX "Quote_projectId_deletedAt_idx" ON "Quote"("projectId", "deletedAt");

-- CreateIndex
CREATE INDEX "Quote_status_deletedAt_idx" ON "Quote"("status", "deletedAt");

-- CreateIndex
CREATE INDEX "Quote_createdById_deletedAt_idx" ON "Quote"("createdById", "deletedAt");
