import { z } from "zod";
import { createQuoteSchema } from "./create-quote.dto";

export const updateQuoteSchema = createQuoteSchema;

export type UpdateQuoteDto = z.infer<typeof updateQuoteSchema>;
