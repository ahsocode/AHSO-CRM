-- Project 360 knowledge hub: surveys, business document registry and handover notes.

CREATE TYPE "SurveyMediaKind" AS ENUM ('IMAGE', 'VIDEO', 'FILE');
CREATE TYPE "SurveyNoteType" AS ENUM (
  'GENERAL',
  'TECHNICAL_REQUIREMENT',
  'COMMERCIAL_REQUIREMENT',
  'SITE_CONSTRAINT',
  'RISK',
  'DECISION',
  'OPEN_QUESTION'
);
CREATE TYPE "BusinessDocumentType" AS ENUM (
  'RFQ',
  'CUSTOMER_PO',
  'QUOTATION',
  'SIGNED_QUOTATION',
  'PROPOSAL',
  'CONTRACT',
  'SIGNED_CONTRACT',
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
  'INVOICE',
  'AR_RECONCILIATION',
  'OTHER'
);
CREATE TYPE "BusinessDocumentSource" AS ENUM ('GENERATED', 'UPLOADED', 'RECEIVED', 'SIGNED_UPLOAD');
CREATE TYPE "BusinessDocumentStatus" AS ENUM (
  'DRAFT',
  'ISSUED',
  'RECEIVED',
  'SIGNED',
  'ACCEPTED',
  'REJECTED',
  'SUPERSEDED',
  'CANCELLED',
  'ARCHIVED'
);

CREATE TABLE "Survey" (
  "id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "surveyedAt" TIMESTAMP(3),
  "location" TEXT,
  "customerParticipants" TEXT,
  "objectives" TEXT,
  "summary" TEXT,
  "nextStep" TEXT,
  "customerId" TEXT NOT NULL,
  "projectId" TEXT,
  "createdById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Survey_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SurveyMedia" (
  "id" TEXT NOT NULL,
  "surveyId" TEXT NOT NULL,
  "kind" "SurveyMediaKind" NOT NULL,
  "url" TEXT NOT NULL,
  "filename" TEXT NOT NULL,
  "mimeType" TEXT NOT NULL,
  "size" INTEGER NOT NULL,
  "caption" TEXT,
  "area" TEXT,
  "isImportant" BOOLEAN NOT NULL DEFAULT false,
  "uploadedById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SurveyMedia_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SurveyNote" (
  "id" TEXT NOT NULL,
  "surveyId" TEXT NOT NULL,
  "type" "SurveyNoteType" NOT NULL DEFAULT 'GENERAL',
  "content" TEXT NOT NULL,
  "isImportant" BOOLEAN NOT NULL DEFAULT false,
  "createdById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SurveyNote_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "BusinessDocument" (
  "id" TEXT NOT NULL,
  "type" "BusinessDocumentType" NOT NULL,
  "source" "BusinessDocumentSource" NOT NULL,
  "status" "BusinessDocumentStatus" NOT NULL DEFAULT 'RECEIVED',
  "title" TEXT NOT NULL,
  "documentNo" TEXT,
  "documentDate" TIMESTAMP(3),
  "fileUrl" TEXT,
  "filename" TEXT,
  "mimeType" TEXT,
  "size" INTEGER,
  "notes" TEXT,
  "customerId" TEXT,
  "projectId" TEXT,
  "quoteId" TEXT,
  "contractId" TEXT,
  "paymentId" TEXT,
  "generatedDocumentId" TEXT,
  "parentId" TEXT,
  "createdById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "BusinessDocument_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ProjectHandover" (
  "id" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "summary" TEXT,
  "customerRequirements" TEXT,
  "risks" TEXT,
  "decisions" TEXT,
  "openTasks" TEXT,
  "importantDocumentIds" TEXT[] NOT NULL,
  "fromUserId" TEXT,
  "toUserId" TEXT,
  "createdById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProjectHandover_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Survey_projectId_surveyedAt_idx" ON "Survey"("projectId", "surveyedAt");
CREATE INDEX "Survey_customerId_surveyedAt_idx" ON "Survey"("customerId", "surveyedAt");
CREATE INDEX "Survey_createdById_createdAt_idx" ON "Survey"("createdById", "createdAt");
CREATE INDEX "SurveyMedia_surveyId_createdAt_idx" ON "SurveyMedia"("surveyId", "createdAt");
CREATE INDEX "SurveyMedia_uploadedById_createdAt_idx" ON "SurveyMedia"("uploadedById", "createdAt");
CREATE INDEX "SurveyNote_surveyId_createdAt_idx" ON "SurveyNote"("surveyId", "createdAt");
CREATE INDEX "SurveyNote_createdById_createdAt_idx" ON "SurveyNote"("createdById", "createdAt");
CREATE INDEX "BusinessDocument_projectId_type_createdAt_idx" ON "BusinessDocument"("projectId", "type", "createdAt");
CREATE INDEX "BusinessDocument_customerId_createdAt_idx" ON "BusinessDocument"("customerId", "createdAt");
CREATE INDEX "BusinessDocument_quoteId_idx" ON "BusinessDocument"("quoteId");
CREATE INDEX "BusinessDocument_contractId_idx" ON "BusinessDocument"("contractId");
CREATE INDEX "BusinessDocument_paymentId_idx" ON "BusinessDocument"("paymentId");
CREATE INDEX "BusinessDocument_parentId_idx" ON "BusinessDocument"("parentId");
CREATE INDEX "BusinessDocument_createdById_createdAt_idx" ON "BusinessDocument"("createdById", "createdAt");
CREATE INDEX "ProjectHandover_projectId_createdAt_idx" ON "ProjectHandover"("projectId", "createdAt");
CREATE INDEX "ProjectHandover_createdById_createdAt_idx" ON "ProjectHandover"("createdById", "createdAt");

ALTER TABLE "Survey" ADD CONSTRAINT "Survey_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Survey" ADD CONSTRAINT "Survey_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Survey" ADD CONSTRAINT "Survey_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SurveyMedia" ADD CONSTRAINT "SurveyMedia_surveyId_fkey" FOREIGN KEY ("surveyId") REFERENCES "Survey"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SurveyMedia" ADD CONSTRAINT "SurveyMedia_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SurveyNote" ADD CONSTRAINT "SurveyNote_surveyId_fkey" FOREIGN KEY ("surveyId") REFERENCES "Survey"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SurveyNote" ADD CONSTRAINT "SurveyNote_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "BusinessDocument" ADD CONSTRAINT "BusinessDocument_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "BusinessDocument" ADD CONSTRAINT "BusinessDocument_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "BusinessDocument" ADD CONSTRAINT "BusinessDocument_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "Quote"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "BusinessDocument" ADD CONSTRAINT "BusinessDocument_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "Contract"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "BusinessDocument" ADD CONSTRAINT "BusinessDocument_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "BusinessDocument" ADD CONSTRAINT "BusinessDocument_generatedDocumentId_fkey" FOREIGN KEY ("generatedDocumentId") REFERENCES "Document"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "BusinessDocument" ADD CONSTRAINT "BusinessDocument_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "BusinessDocument"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "BusinessDocument" ADD CONSTRAINT "BusinessDocument_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ProjectHandover" ADD CONSTRAINT "ProjectHandover_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProjectHandover" ADD CONSTRAINT "ProjectHandover_fromUserId_fkey" FOREIGN KEY ("fromUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ProjectHandover" ADD CONSTRAINT "ProjectHandover_toUserId_fkey" FOREIGN KEY ("toUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ProjectHandover" ADD CONSTRAINT "ProjectHandover_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
