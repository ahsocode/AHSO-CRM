export interface McpTool {
  name: string;
  description: string;
  inputSchema: object;
  handler: (args: Record<string, unknown>) => Promise<string>;
}

export { customerTools } from "./customer.tools.js";
export { pipelineTools } from "./pipeline.tools.js";
export { taskTools } from "./task.tools.js";
export { reportTools } from "./report.tools.js";
export { quoteTools } from "./quote.tools.js";
export { contractTools } from "./contract.tools.js";
export { activityTools } from "./activity.tools.js";
