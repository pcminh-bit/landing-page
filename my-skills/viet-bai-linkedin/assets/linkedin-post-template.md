# Template bài LinkedIn — plain text (copy-paste)

**Biến từ prompt user (bài upGrad):**

- `[NGÀNH]`, `[HỌC BỔNG %]`, `[CASHBACK]` — chỉ lấy từ prompt, không mặc định.
- `[MỐC THỜI GIAN]`: deadline cashback — **chỉ** khi user nêu cụ thể (vd. trước 01/06/2026).

**Cấu trúc output:** Hook → Body → CTA → Signature → p/s (tùy chọn). Phân tách bằng dòng trống. Không heading, không `---` trong bài đăng.

**Banned phrases (xem SKILL.md → Rules):** không dùng `Đơn giản thôi:`, `Thật ra:`, `→` đầu dòng; `vừa làm vừa học` / `không cần bỏ việc` tối đa 1 lần/bài.

**Khối template (điền placeholder, xuất plain text):**

```text
[HOOK]

[BODY]

[CTA]

[SIGNATURE]

[p/s]
```

**Gợi ý điền từng placeholder:**

`[HOOK]` — 1–2 câu mở (câu hỏi hoặc observation gọn).

`[BODY]` — Nội dung chính; mỗi ý một đoạn, cách nhau bằng dòng trống (không dùng `→` đầu dòng):

- Chương trình / ngành: `[NGÀNH]` (tên chương trình từ prompt).
- Học bổng `[HỌC BỔNG %]` — chỉ khi user nêu trong prompt.
- Cashback `[CASHBACK]` — chỉ khi user nêu; nếu có `[MỐC THỜI GIAN]`: ghi *áp dụng khi … trước [MỐC THỜI GIAN]*.
- Không tự thêm mốc thời gian nếu user chỉ nêu số tiền cashback.

`[CTA]` — Liên kết cố định:

```text
Nhận tư vấn học bổng: https://lnkd.in/gs3jbXgi
Zalo: https://zalo.me/0917500437
```

`[SIGNATURE]` — Chữ ký cố định:

```text
—

Tuấn Anh - Đại lý Tuyển sinh Chiến lược upGrad
Giúp học viên đạt học bổng tốt nhất cho các chương trình upGrad
```

`[p/s]` — Tùy chọn; một dòng tương tác ngắn (comment / inbox).

**Checklist trước khi gửi:**

- [ ] `brand_voice` từ `brain.db` (fallback `SOUL.md`)
- [ ] % và cashback đúng prompt
- [ ] Mốc thời gian cashback **chỉ khi user nêu**
- [ ] Output plain text: không `##`, không `---` trong bài
- [ ] CTA: LinkedIn + Zalo
- [ ] Không vi phạm banned phrases (SKILL.md)
