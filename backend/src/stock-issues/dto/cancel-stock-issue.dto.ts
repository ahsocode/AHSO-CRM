import { z } from "zod";

// Body is optional so the legacy "cancel a DRAFT" call (no body) keeps working.
// A reason of at least 5 characters is enforced in the service for CONFIRMED issues.
export const cancelStockIssueSchema = z.preprocess(
  (value) => value ?? {},
  z.object({
    reason: z.preprocess(
      (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
      z.string().trim().max(500).optional()
    ),
  })
);

export type CancelStockIssueDto = { reason?: string };
