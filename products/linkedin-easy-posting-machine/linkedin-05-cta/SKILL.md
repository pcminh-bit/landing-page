---
name: linkedin-05-cta
description: >-
  Adds a soft CTA, signature, and optional p/s to a polished LinkedIn post (step
  5, optional). Step 5 of LinkedIn Easy Posting Machine. Does not rewrite body.
  Use when user says linkedin cta, thêm cta linkedin, post lab bước 5, or pastes
  SANG SKILL 05 from linkedin-04-punch-line.
disable-model-invocation: true
---

# LinkedIn 05 — CTA nhẹ (tuỳ chọn)

**Bước 5/5** · LinkedIn Easy Posting Machine · Gắn CTA + signature — **không** viết lại body.

## Instructions

1. **Đọc** [assets/banned-phrases.md](../assets/banned-phrases.md) và [assets/cta-modes.md](../assets/cta-modes.md).

2. **Input:**
   - Block `=== SANG SKILL 05 ===` từ `linkedin-04-punch-line`
   - [WORKSHEET-brand-voice.md](../WORKSHEET-brand-voice.md) dòng 5 (CTA mặc định) nếu có

3. **Xác định mode** (nếu chưa rõ → hỏi 1 câu: comment keyword / link / chỉ p/s):
   - **comment** — CTA 1 dòng + `p/s` với keyword
   - **link** — URL user cung cấp (không tự bịa link)
   - **question-only** — không link; `p/s` câu hỏi mở

4. **Ghép output** (plain text, copy-paste LinkedIn):
   - Toàn bộ bài từ skill 04 (**giữ nguyên** 300–400 từ body, không sửa ý)
   - 1 dòng trống
   - CTA (theo mode), không dùng em dash `—`
   - 1 dòng trống
   - Signature (không dòng chỉ có gạch ngang trang trí)
   - Signature 1–2 dòng (tên + chức danh từ user/worksheet)
   - Tuỳ chọn: `p/s:` + 1 câu hỏi ngắn

5. **Bỏ qua bước 5:** Nếu user nói “không CTA” → output bài skill 04 + signature tối thiểu (tên 1 dòng).

6. **Kết workflow:**

```text
LINKEDIN EASY POSTING — HOÀN TẤT · Copy bài dưới lên LinkedIn

[Bài full plain text]

(Số từ: [n])
```

## Rules

- **Không** viết lại hook/body; **không** thêm đoạn mới.
- **Không** em dash `—` trong toàn bài output (quét và thay nếu bài skill 04 còn sót).
- **Không** `##`, không `---` rule line trong bài đăng.
- **Không** CTA salesy, % giả, “inbox ngay” trừ khi user yêu cầu.
- Tiếng **Việt** trừ khi user yêu cầu song ngữ.

## Output format (bắt buộc)

```text
LINKEDIN EASY POSTING — BƯỚC 5/5 · CTA

Mode: [comment|link|question-only]

[Bài hoàn chỉnh — plain text]

(Số từ: [n])
```

## Examples

### Ví dụ 1 — Comment keyword

**Input:** Bài polish skill 04 + worksheet CTA: `Comment "FRAME"`

**Output (cấu trúc):**

```text
[body skill 04]

Nếu bạn đang ở giai đoạn tương tự, comment "FRAME". Tôi gửi checklist 1 trang tự dùng.

[Tên · chức danh]

p/s: Tuần này bạn đo manager bằng số họp hay số quyết định bỏ?
```

(Không có ký tự `—` trong ví dụ thật khi agent generate.)

### Ví dụ 2 — Link

**Input:** Meta CTA: link `https://example.com/guide`

**Output:** Body + 1 dòng link + signature. Không thêm tracking tự bịa.

### Ví dụ 3 — Bỏ CTA

**Input:** `Không CTA, chỉ thêm tên: Tuấn Anh, HRBP`

**Output:** Body + `Tuấn Anh · HRBP` (không block quảng cáo).

## Troubleshooting

| Vấn đề | Xử lý |
|--------|--------|
| User chưa có keyword/link | Hỏi 1 câu trước khi gắn |
| Bài skill 04 còn `—` | Thay hết rồi mới gắn CTA |
| User muốn sửa body | Quay skill 03 hoặc 04 |

## Tài liệu

- [assets/cta-modes.md](../assets/cta-modes.md)
- [WORKSHEET-brand-voice.md](../WORKSHEET-brand-voice.md)
- Bước trước: [linkedin-04-punch-line/SKILL.md](../linkedin-04-punch-line/SKILL.md)
