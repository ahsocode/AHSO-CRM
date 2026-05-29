# AHSO CRM MCP Server

MCP Server (Model Context Protocol) cho phép Claude/Cowork tương tác với **AHSO CRM** qua ngôn ngữ tự nhiên tiếng Việt — tìm kiếm khách hàng, xem pipeline, ghi chú hoạt động, xem báo cáo và nhiều hơn nữa.

## Yêu cầu

- Node.js 20+
- Tài khoản service account trong AHSO CRM (xem mục "Tạo service account" bên dưới)

## Cài đặt

```bash
cd mcp-server
npm install
npm run build
```

## Cấu hình

Tạo file `.env` từ `.env.example`:

```bash
cp .env.example .env
```

Chỉnh sửa `.env`:

```env
CRM_BASE_URL=https://crm.ahso.vn
CRM_EMAIL=mcp-agent@ahso.vn
CRM_PASSWORD=your_secure_password
```

## Chạy thử

```bash
# Development (không cần build)
npm run dev

# Production (sau khi build)
npm start

# Kiểm tra tools/list
echo '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' | node dist/index.js
```

## Cài vào Claude Desktop / Cowork

Thêm vào file config MCP (thường ở `~/.config/claude/mcp.json` hoặc tương đương):

```json
{
  "mcpServers": {
    "ahso-crm": {
      "command": "node",
      "args": ["/đường/dẫn/đến/AHSO-CRM/mcp-server/dist/index.js"],
      "env": {
        "CRM_BASE_URL": "https://crm.ahso.vn",
        "CRM_EMAIL": "mcp-agent@ahso.vn",
        "CRM_PASSWORD": "your_secure_password"
      }
    }
  }
}
```

Hoặc dùng `npm run dev` để test với stdio transport:

```json
{
  "mcpServers": {
    "ahso-crm": {
      "command": "npx",
      "args": ["tsx", "/đường/dẫn/đến/AHSO-CRM/mcp-server/src/index.ts"],
      "env": {
        "CRM_BASE_URL": "https://crm.ahso.vn",
        "CRM_EMAIL": "mcp-agent@ahso.vn",
        "CRM_PASSWORD": "mật_khẩu_của_bạn"
      }
    }
  }
}
```

## Danh sách Tools (20 tools)

### Khách hàng

| Tool | Mô tả | Ví dụ câu lệnh |
|------|--------|----------------|
| `search_customers` | Tìm kiếm khách hàng theo tên/ngành | "Tìm khách Vinamilk", "Khách ngành thực phẩm" |
| `get_customer_detail` | Chi tiết khách hàng: liên hệ, dự án, thống kê | "Thông tin Thaco Auto" |
| `create_customer` | Tạo khách hàng mới | "Tạo KH: Công ty ABC, ngành thép, 0901234567" |
| `add_activity_note` | Ghi chú cuộc gọi/gặp/email | "Log cuộc gọi với Sabeco, đã báo giá xong" |

### Pipeline & Dự án

| Tool | Mô tả | Ví dụ câu lệnh |
|------|--------|----------------|
| `get_pipeline_overview` | Tổng quan pipeline theo giai đoạn | "Pipeline hiện tại?", "Deal đang đàm phán?" |
| `get_project_detail` | Chi tiết dự án: báo giá, HĐ, hoạt động | "Dự án Thaco đang đến đâu?" |
| `create_project` | Tạo deal/dự án mới | "Tạo deal Sabeco, khảo sát, 2 tỷ" |
| `update_project_stage` | Chuyển giai đoạn pipeline | "Chuyển Hòa Phát sang Đàm phán" |

### Công việc & Lịch

| Tool | Mô tả | Ví dụ câu lệnh |
|------|--------|----------------|
| `get_my_tasks` | Danh sách task hôm nay/tuần/quá hạn | "Hôm nay cần làm gì?", "Task quá hạn?" |
| `create_task` | Tạo task hoặc lịch hẹn | "Nhắc gọi Sabeco thứ 6 lúc 9h" |
| `complete_task` | Đánh dấu task hoàn thành | "Xong rồi task [ID]" |

### Báo giá

| Tool | Mô tả | Ví dụ câu lệnh |
|------|--------|----------------|
| `list_quotes` | Danh sách báo giá theo trạng thái | "Báo giá nào đang chờ phản hồi?" |
| `get_quote_detail` | Chi tiết báo giá và hạng mục | "Chi tiết BG-2026-001" |

### Hợp đồng

| Tool | Mô tả | Ví dụ câu lệnh |
|------|--------|----------------|
| `list_contracts` | Danh sách hợp đồng | "HĐ đang hiệu lực của Sabeco?" |
| `get_contract_detail` | Chi tiết HĐ: milestones, thanh toán | "Tiến độ HĐ Thaco?" |

### Báo cáo

| Tool | Mô tả | Ví dụ câu lệnh |
|------|--------|----------------|
| `get_revenue_summary` | Doanh thu theo tháng/quý/năm | "Doanh thu tháng này?" |
| `get_pipeline_stats` | Tỷ lệ thắng, giá trị pipeline | "Tỷ lệ thắng quý này?" |
| `get_overdue_followups` | Khách chưa liên hệ N ngày | "Khách nào chưa liên hệ 30 ngày?" |
| `get_outstanding_debt` | Công nợ chưa thu | "Tổng công nợ quá hạn?" |

### Hoạt động

| Tool | Mô tả | Ví dụ câu lệnh |
|------|--------|----------------|
| `list_activities` | Lịch sử hoạt động | "Cuộc gọi tuần này", "Lịch sử Sabeco" |

## Tạo service account trong CRM

1. Đăng nhập CRM với quyền ADMIN
2. Vào **Admin → Người dùng → Tạo mới**
3. Tạo tài khoản với:
   - Email: `mcp-agent@ahso.vn` (hoặc email tuỳ ý)
   - Vai trò: **MANAGER** (để xem data toàn team)
4. Permissions tối thiểu cần có:
   ```
   customers.view, customers.create, customers.edit
   projects.view, projects.create, projects.edit
   calendar.view, calendar.create
   activities.view, activities.create
   quotes.view
   contracts.view
   ai.use
   ```

## Chạy bằng Docker

```bash
# Build image
docker build -t ahso-crm-mcp .

# Chạy (truyền env qua Docker)
docker run -i --rm \
  -e CRM_BASE_URL=https://crm.ahso.vn \
  -e CRM_EMAIL=mcp-agent@ahso.vn \
  -e CRM_PASSWORD=your_password \
  ahso-crm-mcp
```

## Kiến trúc

```
src/
├── index.ts              # Entry point, load .env, khởi động server
├── server.ts             # MCP Server + đăng ký tools/prompts handlers
├── auth/
│   ├── token-manager.ts  # JWT auto-refresh, không login lại mỗi request
│   └── api-client.ts     # Axios instance + 401→refresh interceptor
├── tools/
│   ├── customer.tools.ts
│   ├── pipeline.tools.ts
│   ├── task.tools.ts
│   ├── report.tools.ts
│   ├── quote.tools.ts
│   ├── contract.tools.ts
│   ├── activity.tools.ts
│   └── index.ts
├── formatters/
│   └── common.formatter.ts  # formatVND, formatDate, ...
└── prompts/
    └── system.prompt.ts     # Ngữ cảnh nghiệp vụ AHSO cho AI
```
