import { z } from "zod";

export const updateQuoteStatusSchema = z
  .object({
    status: z.enum(["DRAFT", "SENT", "ACCEPTED", "REJECTED", "EXPIRED"]),
    acceptedItemIds: z.array(z.string().cuid()).max(500).optional()
  })
  .refine((value) => !value.acceptedItemIds?.length || value.status === "ACCEPTED", {
    message: "acceptedItemIds chỉ được truyền khi status là ACCEPTED",
    path: ["acceptedItemIds"]
  });

export type UpdateQuoteStatusDto = z.infer<typeof updateQuoteStatusSchema>;
