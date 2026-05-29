import { config } from "dotenv";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createServer } from "./server.js";

// Load .env nếu có (development) — quiet để không in ra stdout làm lỗi MCP stdio
config({ quiet: true } as Parameters<typeof config>[0]);

// Validate required env vars
const required = ["CRM_EMAIL", "CRM_PASSWORD"];
const missing = required.filter((key) => !process.env[key]);
if (missing.length > 0) {
  process.stderr.write(
    `[ahso-crm] ❌ Thiếu biến môi trường: ${missing.join(", ")}\n` +
      `Hãy tạo file .env theo mẫu .env.example\n`
  );
  process.exit(1);
}

const baseUrl = process.env["CRM_BASE_URL"] ?? "https://crm.ahso.vn";
process.stderr.write(`[ahso-crm] Khởi động MCP Server — CRM: ${baseUrl}\n`);

async function main() {
  const server = createServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  process.stderr.write(`[ahso-crm] ✅ MCP Server đang chạy (stdio)\n`);
}

main().catch((err: unknown) => {
  const message = err instanceof Error ? err.message : String(err);
  process.stderr.write(`[ahso-crm] ❌ Lỗi khởi động: ${message}\n`);
  process.exit(1);
});
