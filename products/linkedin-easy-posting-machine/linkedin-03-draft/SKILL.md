---
name: linkedin-03-draft
description: >-
  Drafts a full LinkedIn post (300–400 words, plain text) from a chosen hook
  and angle. Step 3 of LinkedIn Easy Posting Machine. Hook + body only—CTA in
  step 5. Use when user says linkedin draft, viết nháp linkedin, post lab bước
  3, or pastes the SANG SKILL 03 block from linkedin-02-hook.
disable-model-invocation: true
---

# LinkedIn 03 — Draft post

**Bước 3/5** · LinkedIn Easy Posting Machine · Draft **300–400 từ** — **không** polish punchy (bước 4), **không** CTA final (bước 5).

## Instructions

1. **Đọc** [assets/banned-phrases.md](../assets/banned-phrases.md) và [assets/body-structure.md](../assets/body-structure.md).

2. **Input:**
   - Block `=== SANG SKILL 03 ===` từ `linkedin-02-hook` (**ưu tiên**)
   - Hoặc: hook + góc + pain + takeaway + tone

3. **Viết 1 bài plain text** (copy-paste LinkedIn):
   - Mở bằng **hook nguyên văn** (sửa tối đa ~10 từ nếu cần nối mạch)
   - Body theo [assets/body-structure.md](../assets/body-structure.md) và **dạng post** từ handoff
   - **300–400 từ** (cả hook) — báo số từ ở cuối output nội bộ, không in vào bài đăng

4. **Giọng:** peer-advisor, manager **30+**, khớp `Tone` trong handoff / worksheet.

5. **Kết bài:** insight đóng — **không** link, **không** signature dài. Tuỳ chọn 1 dòng `[CTA — bước 5]` nếu user sẽ gọi skill 05.

6. **Handoff** — copy sang `linkedin-04-punch-line`:

```text
=== SANG SKILL 04 ===
[Bài draft nguyên văn — plain text, 300–400 từ]

Meta:
· Số từ: [n]
· Dạng: [...]
· Tone: [...]
===
```

## Rules

- **Plain text only** — không `##`, không `---`, không bullet `→` đầu dòng.
- Mỗi ý lớn = 1 đoạn; cách đoạn bằng **1 dòng trống**.
- **Không** lặp cùng một ý (pain nói 1 lần, lesson 1 lần).
- **Không** em dash `—` (dùng phẩy, chấm, hoặc tách câu).
- **Không** bịa %, số liệu, tên khách — user cung cấp mới dùng.
- **Không** rút gọn / “punchy hóa” — để skill 04.
- Tiếng **Việt** trừ khi user yêu cầu song ngữ.

## Output format (bắt buộc)

```text
LINKEDIN EASY POSTING — BƯỚC 3/5 · DRAFT

[Bài plain text — hook + body — 300–400 từ]

(Số từ: [n] — chỉ dòng này cho agent, user có thể xóa khi copy)

=== SANG SKILL 04 ===
[Bài draft nguyên văn lặp lại]
Meta: ...
===
```

## Examples

### Ví dụ 1 — Từ handoff skill 02

**Input:**

```text
=== SANG SKILL 03 ===
Hook chọn: HOOK 1
Nội dung hook (nguyên văn):
Lên manager mà lịch họp chiếm 60% tuần — bạn đang lead hay đang “làm việc” bằng cách họp?

Góc: Operational trap
Dạng: observation
Pain: KPI vẫn đo output cá nhân
Takeaway: Strategic = chọn việc không làm
Tone: thẳng, peer-advisor
===
```

**Output:** Bài ~320–380 từ: hook + 3–4 đoạn (situation manager → meeting tax → reframe strategic → câu đóng). Không CTA link. Có `=== SANG SKILL 04 ===` + bài nguyên văn.

### Ví dụ 2 — User nhảy thẳng bước 3

**Input:** Hook + `Viết draft 350 từ về ceiling career lúc 38`

**Agent:** Nếu thiếu pain/takeaway → hỏi 1 câu. Sau đó draft đủ 300–400 từ.

## Cập nhật ví dụ theo giọng tác giả

User có bài thật đã chỉnh → paste **Input + Output chuẩn** và bảo agent thay mục **Examples** trên (hoặc thêm [assets/author-examples.md](../assets/author-examples.md)).

## Troubleshooting

| Vấn đề | Xử lý |
|--------|--------|
| < 300 từ | Thêm 1 đoạn ví dụ/situation cụ thể |
| > 400 từ | Cắt câu filler — **không** cắt xuống < 300 (skill 04 polish, không rút độ dài) |
| User muốn CTA ngay | Nhắc bước 5 — hoặc gọi `linkedin-05-cta` |

## Tài liệu

- [assets/body-structure.md](../assets/body-structure.md)
- [assets/banned-phrases.md](../assets/banned-phrases.md)
- Bước trước: [linkedin-02-hook/SKILL.md](../linkedin-02-hook/SKILL.md)
