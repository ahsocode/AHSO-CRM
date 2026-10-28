-- Per-line VAT. NULL = KCT (không chịu thuế), 0 = thuế suất 0%.
ALTER TABLE "QuoteItem" ADD COLUMN "taxRate" DECIMAL(5,2);

-- Existing quotes used one rate for all lines: copy it onto each line so totals stay identical.
UPDATE "QuoteItem" AS qi
SET "taxRate" = q."taxRate"
FROM "Quote" AS q
WHERE q."id" = qi."quoteId";

-- Safety net for lines written by an old backend after the backfill (NULL would read as KCT).
-- New code cannot produce "taxAmount > 0 while every line is KCT", so this only repairs old writes.
UPDATE "QuoteItem" AS qi
SET "taxRate" = q."taxRate"
FROM "Quote" AS q
WHERE q."id" = qi."quoteId"
  AND q."taxAmount" > 0
  AND NOT EXISTS (
    SELECT 1 FROM "QuoteItem" AS x WHERE x."quoteId" = q."id" AND x."taxRate" IS NOT NULL
  );
