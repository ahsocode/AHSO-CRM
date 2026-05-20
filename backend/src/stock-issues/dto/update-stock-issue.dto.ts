import { createStockIssueSchema } from "./create-stock-issue.dto";
import type { CreateStockIssueDto } from "./create-stock-issue.dto";

export const updateStockIssueSchema = createStockIssueSchema;

export type UpdateStockIssueDto = CreateStockIssueDto;
