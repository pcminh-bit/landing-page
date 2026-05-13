# MCP functions draft — Telegram / daily ops

Dựa trên codebase hiện tại: landing + form waitlist (`POST /api/customers`), admin CRUD (`/api/customers`, `/api/orders`), thanh toán + SePay. Chỉ giữ **3 function** đã chọn.

Các function giả định MCP gọi được backend (HTTP nội bộ hoặc wrapper có auth), không expose secret ra Telegram.

---

## 1. `waitlist_leads_recent`

| Trường | Nội dung |
|--------|----------|
| **Input** | `since_hours` (int, mặc định 24), `limit` (int, mặc định 20) |
| **Output** | `{ "leads": [ { "id", "name", "email", "phone", "zalo", "registered_at" } ], "count" }` |
| **Tình huống hàng ngày** | Sáng hoặc giữa ngày mở Telegram: xem lead mới từ form landing, gọi lại Zalo/email nhanh không cần mở `/admin`. |
| **Ưu tiên** | **5** |

### Ví dụ câu nhắn Telegram (trigger ý định này)

- “Cho mình danh sách lead mới hôm nay.”
- “Có ai đăng ký form waitlist 24h qua không?”
- “Gửi 10 lead gần nhất từ landing.”
- “Lead nào mới sau 6h tối qua?”

---

## 2. `orders_pending_summary`

| Trường | Nội dung |
|--------|----------|
| **Input** | `limit` (int, mặc định 30) |
| **Output** | `{ "orders": [ { "id", "order_code", "customer_name", "product_name", "amount", "status", "purchased_at" } ], "pending_count" }` — chỉ lọc `status === "pending"`. |
| **Tình huống hàng ngày** | Theo dõi đơn chờ thanh toán, đối chiếu với bank/SePay, nhắc follow-up học viên. |
| **Ưu tiên** | **5** |

### Ví dụ câu nhắn Telegram (trigger ý định này)

- “Đơn nào đang pending?”
- “Liệt kê đơn chờ thanh toán.”
- “Còn bao nhiêu đơn chưa paid?”
- “Cho xem 20 đơn pending mới nhất.”

---

## 3. `order_confirm_payment`

| Trường | Nội dung |
|--------|----------|
| **Input** | `order_id` (int, bắt buộc) |
| **Output** | `{ "ok": bool, "order_id"?, "status"?, "error"? }` — map với `PUT /api/orders/{id}/confirm`. |
| **Tình huống hàng ngày** | Đã nhận tiền nhưng webhook chưa khớp; xác nhận thủ công giống nút Admin mà không cần mở trình duyệt. |
| **Ưu tiên** | **4** |

### Ví dụ câu nhắn Telegram (trigger ý định này)

- “Xác nhận đã nhận tiền đơn id 42.”
- “Đơn 15 đã chuyển khoản rồi, chốt success giúp.”
- “Confirm payment order_id=88”
- “Đánh dấu đơn số 7 là đã thanh toán.”

*(Bot/MCP cần parse `order_id` từ câu; có thể thêm flow hỏi lại nếu thiếu số.)*

---

## Thứ tự gợi ý triển khai

1. `waitlist_leads_recent`  
2. `orders_pending_summary`  
3. `order_confirm_payment`  

---

## Ghi chú an toàn

- MCP nên gọi API qua URL nội bộ (`http://127.0.0.1:3000`) hoặc layer có **API key riêng cho bot**.
- `order_confirm_payment` nên giới hạn theo Telegram user ID allowlist để tránh người lạ đóng đơn.
