# MCP server (GoClaw ↔ landing website)

Streamable HTTP MCP theo [GoClaw MCP Integration](https://docs.goclaw.sh/advanced/mcp-integration.md): `transport: "streamable-http"`, URL ví dụ `http://127.0.0.1:3001/mcp`.

## Chạy

Từ thư mục repo (cùng cấp `brain.db`):

```bash
node mcp/server.js
```

Biến môi trường (tuỳ chọn):

| Biến | Mặc định | Ý nghĩa |
|------|----------|---------|
| `MCP_HOST` | `127.0.0.1` | Chỉ lắng nghe loopback |
| `MCP_PORT` | `3001` | Cổng HTTP |
| `LANDING_BRAIN_DB` | `<repo>/brain.db` | Đường dẫn SQLite giống website |

## GoClaw `config.json` (ví dụ)

```json
{
  "tools": {
    "mcp_servers": {
      "landing_page": {
        "transport": "streamable-http",
        "url": "http://127.0.0.1:3001/mcp",
        "tool_prefix": "landing_",
        "timeout_sec": 30
      }
    }
  }
}
```

Tool names phía agent: `landing_waitlist_leads_recent`, `landing_orders_pending_summary`, `landing_order_confirm_payment` (nếu dùng prefix `landing_`).

## Tools

Đúng 3 function trong `mcp_functions_draft.md`: `waitlist_leads_recent`, `orders_pending_summary`, `order_confirm_payment`.

## Kiểm tra nhanh (curl)

Tạo file JSON tạm (tránh escape phức tạp trên Windows), ví dụ `init.json`:

```json
{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-03-26","capabilities":{},"clientInfo":{"name":"curl","version":"0"}}}
```

Chạy:

```bash
curl.exe -sS -X POST http://127.0.0.1:3001/mcp -H "Content-Type: application/json" -H "Accept: application/json, text/event-stream" --data-binary "@init.json"
```

Tương tự `tools/list` (`method":"tools/list","params":{}`) và `tools/call` với `params.name` / `params.arguments`.
