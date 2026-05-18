-- Add signature to EmailAccount
ALTER TABLE "EmailAccount" ADD COLUMN IF NOT EXISTS "signature" TEXT NOT NULL DEFAULT '';

-- Add draftId for draft tracking
ALTER TABLE "EmailMessage" ADD COLUMN IF NOT EXISTS "draftId" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "EmailMessage_draftId_key" ON "EmailMessage"("draftId") WHERE "draftId" IS NOT NULL;
