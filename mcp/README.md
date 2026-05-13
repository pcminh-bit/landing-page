# MCP server (GoClaw ↔ landing website)

Streamable HTTP MCP theo [GoClaw MCP Integration](https://docs.goclaw.sh/advanced/mcp-integration.md): `transport: "streamable-http"`, endpoint **`POST /mcp`**.

## Chạy

Từ thư mục repo (cùng cấp `brain.db`):

```bash
node mcp/server.js
```

Biến môi trường (tuỳ chọn):

| Biến | Mặc định (code) | Ý nghĩa |
|------|------------------|---------|
| `MCP_HOST` | `127.0.0.1` | Địa chỉ bind. **`0.0.0.0`** = mọi interface (cần khi GoClaw trong Docker gọi qua `172.17.0.1`). |
| `MCP_PORT` | `3001` | Cổng HTTP |
| `LANDING_BRAIN_DB` | `<repo>/brain.db` | SQLite giống website |
| `MCP_EXTRA_ORIGINS` | *(trống)* | Danh sách origin thêm (phân tách dấu phẩy), nếu Dashboard gửi `Origin` lạ. |

## GoClaw trong Docker (VPS)

- MCP chạy **trên host** (systemd): container không thấy `127.0.0.1` của host.
- URL trong GoClaw: **`http://172.17.0.1:3001/mcp`** (Docker bridge → host; gateway thường là `172.17.0.1`).
- Unit `deploy/systemd/mcp-server.service` đặt **`MCP_HOST=0.0.0.0`** để socket lắng nghe trên host (container mới kết nối được qua bridge IP).

**Bảo mật:** cổng 3001 không nên mở ra internet. Nên dùng firewall chỉ cho phép nguồn từ mạng Docker, ví dụ:

```bash
sudo ufw status
# Ví dụ: chỉ cho 172.17.0.0/16 vào 3001 (điều chỉnh theo mạng Docker thực tế)
sudo ufw allow from 172.17.0.0/16 to any port 3001 proto tcp comment mcp-docker-bridge
```

## GoClaw Dashboard

- Transport: **Streamable HTTP**
- URL: **`http://172.17.0.1:3001/mcp`**
- Tool prefix (tuỳ chọn): `landing_`

## GoClaw `config.json` (ví dụ, container → host)

```json
{
  "tools": {
    "mcp_servers": {
      "landing_page": {
        "transport": "streamable-http",
        "url": "http://172.17.0.1:3001/mcp",
        "tool_prefix": "landing_",
        "timeout_sec": 30
      }
    }
  }
}
```

## Tools

Đúng 3 function trong `mcp_functions_draft.md`: `waitlist_leads_recent`, `orders_pending_summary`, `order_confirm_payment`.

## Kiểm tra nhanh (curl)

Trên **host** VPS (sau khi bind `0.0.0.0`):

```bash
curl -sS -X POST http://127.0.0.1:3001/mcp -H "Content-Type: application/json" -H "Accept: application/json, text/event-stream" --data-binary '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-03-26","capabilities":{},"clientInfo":{"name":"curl","version":"0"}}}'
```

Từ **trong container** (tùy image có `curl`):

```bash
curl -sS -X POST http://172.17.0.1:3001/mcp ...
```

## Triển khai systemd (VPS)

```bash
cd /opt/my-website
git pull origin main
sudo cp /opt/my-website/deploy/systemd/mcp-server.service /etc/systemd/system/mcp-server.service
sudo systemctl daemon-reload
sudo systemctl restart mcp-server
sudo systemctl status mcp-server --no-pager -l
```
