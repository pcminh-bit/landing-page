# HEARTBEAT — Chu kỳ “tim đập” (quan trọng nhất)

File này **gắn trực tiếp** với hai MCP function đã thêm ở Phần 1:

- **`waitlist_signal_02_pending`** — đọc lead waitlist **chưa** được nhắn Telegram (`goclaw_signal_02_notified = 0`).
- **`waitlist_signal_02_mark_sent`** — đánh dấu **đã nhắn** cho các `customer_ids` tương ứng (tránh nhắn trùng).

Trên GoClaw, tên tool thực tế có thể có **prefix** (ví dụ `ten_du_an_waitlist_signal_02_pending`). Luôn dùng đúng tên trong danh sách tool đã kết nối.

---

# Every Heartbeat Check

Bạn là **cộng sự** của chủ. Mỗi lần tim đập (mỗi vòng schedule / heartbeat được cấu hình):

1. **Gọi** `waitlist_signal_02_pending` với tham số **`limit: 10`** (hoặc tên đầy đủ có prefix, cùng arguments).

2. **Nếu có lead mới** (`count > 0` trong kết quả, hoặc mảng `leads` không rỗng):
   - **Nhắn chủ trên Telegram** một tin gọn, có giá trị, kèm ít nhất:
     - **Tên** (lead),
     - **SĐT / Zalo** (trường nào có trong bản ghi thì đưa vào; không bịa),
     - **Thứ tự hôm nay** — cách hiển thị rõ ràng (ví dụ: “Lead 1/3 trong batch này” hoặc “STT theo id tăng dần …”) miễn **nhất quán và dễ hiểu trên điện thoại**.
   - **Giọng** toàn bộ tin nhắn: theo **`SOUL.md`** (gần gũi, ngắn, không jargon).

3. **Nếu không có gì mới** (`count === 0` hoặc `leads` rỗng):
   - **Im lặng.** Không gửi tin kiểu “hôm nay không có lead” — tránh spam.

---

# Quy tắc vàng

- **Chỉ nhắn khi có việc giá trị** — ở đây, việc giá trị = có ít nhất một lead trong danh sách pending của bước (1).

- **Không nhắn cùng một lead hai lần** cho cùng luồng Tín hiệu 02: sau khi **đã gửi** tin Telegram thành công cho (các) lead đó, **gọi ngay** `waitlist_signal_02_mark_sent` với **`customer_ids`** đúng các `id` vừa báo (lấy từ phản hồi `waitlist_signal_02_pending`). Như vậy vòng sau lead đó không còn trong pending.

- **Tone luôn theo `SOUL.md`** — kể cả khi tin có nhiều lead: vẫn ngắn gọn, có thể bullet hoặc ↳ từng người.

---

# Gợi ý thứ tự (không được đảo ngược ý nghĩa)

```
waitlist_signal_02_pending(limit: 10)
  → có lead? → gửi Telegram (SOUL.md) → waitlist_signal_02_mark_sent({ customer_ids: [...] })
  → không có lead? → không làm gì thêm
```

Nếu gửi Telegram **lỗi**, **chưa** gọi `mark_sent` cho các id chưa báo thành công — để vòng sau hoặc retry hợp lệ vẫn còn cơ hội báo chủ.

---

# Payload gợi ý (JSON arguments)

Gọi tool theo đúng schema MCP (tên có thể có prefix):

- `waitlist_signal_02_pending`: `{"limit": 10}`  
- `waitlist_signal_02_mark_sent`: `{"customer_ids": [1, 2, 3]}` — chỉ các id **vừa nhắn xong** trong tin Telegram đó.

---

# “Thứ tự hôm nay” — cách làm rõ mà không rườm rà

- Nếu một batch có nhiều lead: ghi **“Lead k/N trong lượt này”** (N = `leads.length` từ pending) hoặc đánh số 1, 2, 3 trong cùng một tin.  
- Có thể kèm `id` nội bộ (customers.id) **ngắn** để chủ tra admin nếu cần — không bắt buộc nếu làm tin dài.

---

# Không làm gì thêm trong cùng vòng heartbeat

Sau khi xử lý xong nhánh pending (có hoặc không có lead), **không** bắt buộc phải gọi thêm tool khác cho “đủ việc”. Tránh biến mỗi vòng tim đập thành báo cáo tổng hợp dài — chủ đã chọn **Tín hiệu 02** là trọng tâm của vòng này.

---

# Đồng bộ với `AGENTS.md` và `SOUL.md`

- **AGENTS:** cấm nhắn trùng → bắt buộc `mark_sent` sau tin thành công.  
- **SOUL:** một tin nhiều lead vẫn là tiếng **bạn đồng nghiệp**, không bảng Excel khô.

---

# Một dòng để agent tự nhắc

**Mỗi heartbeat: pending(10) → (có lead?) Telegram theo SOUL → mark_sent(ids) — không lead thì im.**
