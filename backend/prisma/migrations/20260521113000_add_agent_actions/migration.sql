-- Add action-based CRM Copilot foundation.

CREATE TYPE "AgentActionStatus" AS ENUM (
  'PENDING_REVIEW',
  'APPROVED',
  'REJECTED',
  'EXECUTED',
  'FAILED'
);

CREATE TYPE "ActionRiskLevel" AS ENUM (
  'LOW',
  'MEDIUM',
  'HIGH'
);

ALTER TABLE "AgentRun" ADD COLUMN "contextEntityType" TEXT;
ALTER TABLE "AgentRun" ADD COLUMN "contextEntityId" TEXT;

CREATE TABLE "AgentAction" (
  "id" TEXT NOT NULL,
  "agentRunId" TEXT NOT NULL,
  "actionType" TEXT NOT NULL,
  "contextEntityType" TEXT,
  "contextEntityId" TEXT,
  "targetEntityType" TEXT,
  "targetEntityId" TEXT,
  "proposedPayload" JSONB NOT NULL,
  "finalPayload" JSONB,
  "validationErrors" JSONB,
  "status" "AgentActionStatus" NOT NULL DEFAULT 'PENDING_REVIEW',
  "riskLevel" "ActionRiskLevel" NOT NULL DEFAULT 'MEDIUM',
  "requestedById" TEXT NOT NULL,
  "reviewedById" TEXT,
  "reviewedAt" TIMESTAMP(3),
  "reviewNote" TEXT,
  "executedAt" TIMESTAMP(3),
  "executionError" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "AgentAction_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AgentRun_contextEntityType_contextEntityId_idx"
  ON "AgentRun"("contextEntityType", "contextEntityId");

CREATE INDEX "AgentAction_agentRunId_idx"
  ON "AgentAction"("agentRunId");

CREATE INDEX "AgentAction_contextEntityType_contextEntityId_idx"
  ON "AgentAction"("contextEntityType", "contextEntityId");

CREATE INDEX "AgentAction_requestedById_status_idx"
  ON "AgentAction"("requestedById", "status");

CREATE INDEX "AgentAction_status_createdAt_idx"
  ON "AgentAction"("status", "createdAt");

ALTER TABLE "AgentAction"
  ADD CONSTRAINT "AgentAction_agentRunId_fkey"
  FOREIGN KEY ("agentRunId") REFERENCES "AgentRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AgentAction"
  ADD CONSTRAINT "AgentAction_requestedById_fkey"
  FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "AgentAction"
  ADD CONSTRAINT "AgentAction_reviewedById_fkey"
  FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
