-- Add stageChangedAt for Kanban deal-rotting indicator.
-- Backfill: use updatedAt as the best available approximation for existing rows.
ALTER TABLE "Project" ADD COLUMN "stageChangedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
UPDATE "Project" SET "stageChangedAt" = "updatedAt";
