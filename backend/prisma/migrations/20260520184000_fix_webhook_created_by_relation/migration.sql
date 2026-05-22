-- Convert Webhook.createdBy into a nullable FK relation to User.
DROP INDEX IF EXISTS "Webhook_createdBy_createdAt_idx";
ALTER TABLE "Webhook" RENAME COLUMN "createdBy" TO "createdById";
ALTER TABLE "Webhook" ALTER COLUMN "createdById" DROP NOT NULL;
UPDATE "Webhook"
SET "createdById" = NULL
WHERE "createdById" IS NOT NULL
  AND "createdById" NOT IN (SELECT id FROM "User");
CREATE INDEX "Webhook_createdById_createdAt_idx" ON "Webhook"("createdById", "createdAt");
ALTER TABLE "Webhook"
ADD CONSTRAINT "Webhook_createdById_fkey"
FOREIGN KEY ("createdById") REFERENCES "User"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
