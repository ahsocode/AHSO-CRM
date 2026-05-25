-- Allow payments to be recorded directly against a project, with optional contract or quote source.
ALTER TABLE "Payment" ADD COLUMN "projectId" TEXT;
ALTER TABLE "Payment" ADD COLUMN "quoteId" TEXT;

UPDATE "Payment" AS p
SET "projectId" = c."projectId"
FROM "Contract" AS c
WHERE p."contractId" = c."id"
  AND p."projectId" IS NULL;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "Payment" WHERE "projectId" IS NULL) THEN
    RAISE EXCEPTION 'Cannot migrate Payment rows without an owning project';
  END IF;
END $$;

ALTER TABLE "Payment" DROP CONSTRAINT IF EXISTS "Payment_contractId_fkey";
ALTER TABLE "Payment" ALTER COLUMN "projectId" SET NOT NULL;
ALTER TABLE "Payment" ALTER COLUMN "contractId" DROP NOT NULL;

ALTER TABLE "Payment"
ADD CONSTRAINT "Payment_projectId_fkey"
FOREIGN KEY ("projectId") REFERENCES "Project"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Payment"
ADD CONSTRAINT "Payment_contractId_fkey"
FOREIGN KEY ("contractId") REFERENCES "Contract"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Payment"
ADD CONSTRAINT "Payment_quoteId_fkey"
FOREIGN KEY ("quoteId") REFERENCES "Quote"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "Payment_projectId_idx" ON "Payment"("projectId");
CREATE INDEX "Payment_contractId_idx" ON "Payment"("contractId");
CREATE INDEX "Payment_quoteId_idx" ON "Payment"("quoteId");
CREATE INDEX "Payment_paidAt_idx" ON "Payment"("paidAt");
