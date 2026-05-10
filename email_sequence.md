# Chuỗi email (theo `brand_voice` + `products` trong `brain.db`)

**Nguồn giọng:** bảng `brand_voice` — gần gũi, thẳng thắn, câu ngắn, không vòng vo; hay dùng *thật ra / đơn giản thôi / thử xem / không cần phức tạp / làm được mà*; có thể mở bằng câu hỏi và kết bằng **p/s**; tránh jargon kiểu synergy, leverage, “tối ưu trải nghiệm”, v.v.  
**Đối tượng (trong DB):** người đi làm bận rộn, ~30+, senior–manager — cần đọc nhanh, hiểu nhanh.  
**Sản phẩm (bảng `products`):** **Test Product** — **100.000 VNĐ** — mô tả: *demo*.

> *Gợi ý:* Khi bạn đổi tên/mô tả sản phẩm trong Admin, chỉnh lại Email 3 cho khớp. Nếu muốn chốt học bổng / cao học, cập nhật luôn record trong `products` cho đồng bộ với landing.

---

## Email 1 — Chào mừng

**Gửi:** ngay khi khách gửi form (0h sau đăng ký)  
**Tiêu đề gợi ý:** Cảm ơn bạn đã để lại thông tin  

Chào [Tên],

Mình là **Trần Tuấn Anh**, đại lý tuyển sinh của upGrad — làm việc với người đi làm bận, muốn nâng bằng cấp mà không thích vòng vo.

Thật ra, chỉ muốn nói nhanh: **bạn đã làm đúng bước đầu**. Mình nhận được form của bạn rồi.

Trong vài ngày tới, mình hoặc team sẽ liên hệ để không lãng phí thời gian của bạn — chỉ đúng việc, đúng hướng.

**p/s:** Bạn đang ưu tiên nhất lúc này là **thời gian**, **chi phí**, hay **bằng cấp**? Trả lời một chữ thôi cũng được, mình chỉnh tư vấn cho khớp.

— Tuấn Anh

---

## Email 2 — Nurture (+2 ngày sau Email 1)

**Gửi:** 2 ngày sau Email 1  
**Tiêu đề gợi ý:** 80% việc quan trọng nằm ở 20% này thôi

Bạn có cảm giác làm một lúc… quá nhiều thứ không?

Đơn giản thôi: **80% kết quả thường đến từ một nhóm nhỏ việc.** Không nhất thiết “làm thêm”. Mà là **làm đúng**.

Với người đi làm bận (như mình hay gặp), thử xem 3 câu này:

→ Việc nào nếu bỏ thì gần như không sao?  
→ Việc nào nếu làm sẽ kéo theo cả chuỗi lợi ích?  
→ Việc nào **chỉ bạn** quyết được trong 7 ngày tới?

Không bán gì ở đây. Chỉ muốn bạn **bớt dàn trải**, tập trung đúng chỗ.

**p/s:** Trong 7 ngày tới, bạn chọn được **một** việc ưu tiên chưa? Trả lời mình một dòng cũng được.

— Tuấn Anh

---

## Email 3 — Chốt (+1 ngày sau Email 2, tức +3 ngày sau Email 1)

**Gửi:** 1 ngày sau Email 2  
**Tiêu đề gợi ý:** Nếu bạn đã sẵn sàng — bước tiếp theo rất rõ

Chào [Tên],

Mình nói thẳng.

Trong hệ thống hiện có sản phẩm **Test Product** — **100.000 VNĐ** (mô tả trong kho: *demo*). Đây là bước **xác nhận quan tâm / giữ hành động** nếu bạn muốn đi tiếp, không cần phức tạp.

**Bạn nhận được gì (thật, không vẽ thêm):**

→ Một bước rõ ràng trên hệ thống thanh toán (có mã đơn, dễ đối chiếu).  
→ Team biết bạn **serious** — ưu tiên hỗ trợ cho đúng người.  
→ Không vòng vo: làm xong là xong, để mình lo phần tiếp theo với bạn.

**CTA — Thanh toán ngay:**  
https://hocbong-upgrad.com/payment  

Vào trang → điền form → chuyển khoản đúng **mã đơn** hiện trên màn hình.

Nếu chưa muốn bước này — không sao. Cứ trả lời mình một dòng, mình dừng nhắc.

**p/s:** Bạn muốn mình gọi **sáng** hay **chiều** tuần này?

— Tuấn Anh

---

### Ghi chú vận hành

| Email | Độ trễ (so với form / email trước) |
|-------|-------------------------------------|
| 1 | Ngay khi submit form |
| 2 | +2 ngày sau Email 1 |
| 3 | +1 ngày sau Email 2 |

Có thể map biến `[Tên]` từ CRM / bảng `customers.name` khi gửi tự động (Resend / automation).
