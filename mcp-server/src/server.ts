import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  GetPromptRequestSchema,
  ListPromptsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import {
  type McpTool,
  customerTools,
  pipelineTools,
  taskTools,
  reportTools,
  quoteTools,
  contractTools,
  activityTools,
  searchTools,
  calendarTools,
  notificationTools,
  userTools,
  surveyTools,
} from "./tools/index.js";
import { SYSTEM_PROMPT } from "./prompts/system.prompt.js";

const ALL_TOOLS: McpTool[] = [
  ...customerTools,
  ...pipelineTools,
  ...taskTools,
  ...reportTools,
  ...quoteTools,
  ...contractTools,
  ...activityTools,
  ...searchTools,
  ...calendarTools,
  ...notificationTools,
  ...userTools,
  ...surveyTools,
];

const TOOL_MAP = new Map<string, McpTool>(ALL_TOOLS.map((t) => [t.name, t]));

export function createServer(): Server {
  const server = new Server(
    { name: "ahso-crm", version: "1.0.0" },
    {
      capabilities: {
        tools: {},
        prompts: {},
      },
    }
  );

  // Danh sách tất cả tools
  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: ALL_TOOLS.map((t) => ({
      name: t.name,
      description: t.description,
      inputSchema: t.inputSchema,
    })),
  }));

  // Xử lý gọi tool
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args = {} } = request.params;
    const tool = TOOL_MAP.get(name);

    if (!tool) {
      return {
        content: [
          {
            type: "text",
            text: `❌ Tool không tồn tại: "${name}". Dùng tools/list để xem danh sách.`,
          },
        ],
        isError: true,
      };
    }

    try {
      const result = await tool.handler(args as Record<string, unknown>);
      return {
        content: [{ type: "text", text: result }],
      };
    } catch (error: unknown) {
      const message = formatToolError(name, error);
      process.stderr.write(`[ahso-crm] Tool error (${name}): ${message}\n`);
      return {
        content: [{ type: "text", text: message }],
        isError: true,
      };
    }
  });

  // System prompt
  server.setRequestHandler(ListPromptsRequestSchema, async () => ({
    prompts: [
      {
        name: "ahso-crm-context",
        description: "Ngữ cảnh nghiệp vụ AHSO CRM cho AI assistant",
      },
    ],
  }));

  server.setRequestHandler(GetPromptRequestSchema, async (request) => {
    if (request.params.name !== "ahso-crm-context") {
      throw new Error(`Prompt không tồn tại: ${request.params.name}`);
    }
    return {
      messages: [
        {
          role: "user",
          content: { type: "text", text: SYSTEM_PROMPT },
        },
      ],
    };
  });

  return server;
}

function formatToolError(toolName: string, error: unknown): string {
  if (error instanceof Error) {
    const axiosError = error as {
      response?: { status?: number; data?: { message?: string; statusCode?: number } };
      code?: string;
    };

    if (axiosError.response) {
      const status = axiosError.response.status;
      const msg = axiosError.response.data?.message ?? error.message;

      if (status === 401) return `🔐 Lỗi xác thực: Vui lòng kiểm tra CRM_EMAIL và CRM_PASSWORD trong .env`;
      if (status === 403) return `🚫 Không có quyền thực hiện thao tác này. Service account cần permission phù hợp.`;
      if (status === 404) return `❌ Không tìm thấy dữ liệu. Vui lòng kiểm tra lại ID.`;
      if (status === 422 || status === 400) return `⚠️ Dữ liệu không hợp lệ: ${msg}`;
      if (status && status >= 500) return `🔥 Lỗi server CRM (${status}). Vui lòng thử lại sau.`;
      return `❌ Lỗi API [${status}]: ${msg}`;
    }

    if (axiosError.code === "ECONNREFUSED" || axiosError.code === "ENOTFOUND") {
      return `🌐 Không thể kết nối đến CRM server. Kiểm tra CRM_BASE_URL và kết nối mạng.`;
    }

    if (axiosError.code === "ETIMEDOUT" || axiosError.code === "ECONNABORTED") {
      return `⏱️ Hết thời gian chờ kết nối CRM. Server có thể đang bận, thử lại sau ít phút.`;
    }

    return `❌ Lỗi khi gọi tool "${toolName}": ${error.message}`;
  }

  return `❌ Lỗi không xác định khi gọi tool "${toolName}".`;
}
