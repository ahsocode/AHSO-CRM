-- Add fast lookup hash for refresh sessions. Existing sessions cannot be backfilled
-- because refreshToken stores a bcrypt hash of the raw token.
ALTER TABLE "UserSession" ADD COLUMN "tokenHash" TEXT;
CREATE UNIQUE INDEX "UserSession_tokenHash_key" ON "UserSession"("tokenHash");
