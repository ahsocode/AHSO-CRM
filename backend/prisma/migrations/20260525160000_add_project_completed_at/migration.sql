ALTER TABLE "Project" ADD COLUMN "completedAt" TIMESTAMP(3);

-- Back-fill existing COMPLETED projects using updatedAt as approximation
UPDATE "Project" SET "completedAt" = "updatedAt" WHERE "status" = 'COMPLETED' AND "completedAt" IS NULL;
