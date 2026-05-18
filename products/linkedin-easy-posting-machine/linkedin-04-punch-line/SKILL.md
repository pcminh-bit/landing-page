---
name: linkedin-04-punch-line
description: >-
  Polishes a LinkedIn draft to punchier prose while keeping 300–400 words—same
  ideas, stronger sentences. Step 4 of LinkedIn Easy Posting Machine. No new
  arguments or CTA. Use when user says linkedin punchy, rút gọn bài linkedin
  (polish only), post lab bước 4, or pastes SANG SKILL 04 from linkedin-03-draft.
disable-model-invocation: true
---

# LinkedIn 04 — Punch-line (polish)

**Bước 4/5** · LinkedIn Easy Posting Machine · **Polish punchy — giữ 300–400 từ** (không rút bài ngắn).

## Instructions

1. **Đọc** [assets/banned-phrases.md](../assets/banned-phrases.md) và [assets/punchy-rules.md](../assets/punchy-rules.md).

2. **Input:**
   - Block `=== SANG SKILL 04 ===` từ `linkedin-03-draft` (**ưu tiên**)
   - Hoặc: bài draft plain text (user phải có ≥ ~280 từ)

3. **Polish toàn bài:**
   - Giữ **cùng ý, cùng thứ tự đoạn**, cùng dạng post
   - **300–400 từ** sau polish (mục tiêu ±30 từ so với draft)
   - Hook: chỉnh tối đa **~15 từ**, không đổi góc
   - Câu ngắn, bỏ filler, động từ cụ thể — theo [assets/punchy-rules.md](../assets/punchy-rules.md)

4. **Không thêm:** CTA, link, signature, p/s, số liệu mới, đoạn mới.

5. **Handoff** — copy sang `linkedin-05-cta`:

```text
=== SANG SKILL 05 ===
[Bài polish nguyên văn — plain text, 300–400 từ]

Meta:
· Số từ: [n]
· CTA worksheet (nếu user đã cung cấp): [comment keyword / link / none]
· Tone: [...]
===
```

## Rules

- **Không dùng em dash `—`** trong bài (hook, body, mọi chỗ). Nếu draft có `—` → thay bằng dấu phẩy, chấm, hoặc tách thành 2 câu / 2 đoạn.
- **Plain text** — không heading, không `---` (ba gạch ngang).
- **Không** viết lại từ đầu với outline khác.
- Nếu draft < 280 từ → báo user quay `linkedin-03-draft` mở rộng; **không** tự thêm ý lớn.
- Tiếng **Việt** trừ khi user yêu cầu song ngữ.

## Output format (bắt buộc)

```text
LINKEDIN EASY POSTING — BƯỚC 4/5 · PUNCH-LINE

[Bài plain text đã polish — 300–400 từ]

(Số từ: [n])

Thay đổi chính (cho user, 2–3 bullet ngắn):
· ...

=== SANG SKILL 05 ===
[Bài polish nguyên văn lặp lại]
Meta: ...
===
```

## Examples

### Ví dụ 1 — Draft 340 từ

**Input:** `=== SANG SKILL 04 ===` + bài draft (hook meeting 60% tuần…)

**Output:** Bài ~320–360 từ — cùng 4 ý, câu gọn hơn; 2–3 bullet “Thay đổi chính”; handoff skill 05.

### Ví dụ 2 — User nói “rút gọn bài”

**Agent:** Giải thích bước 4 = **punchy, không cắt độ dài**; nếu muốn bài ngắn → quay skill 3 với target thấp hơn (không khuyến nghị trong bundle 300–400).

## Cập nhật ví dụ theo giọng tác giả

Paste draft + bản polish bạn đã sửa → cập nhật **Examples** hoặc `assets/author-examples.md`.

## Troubleshooting

| Vấn đề | Xử lý |
|--------|--------|
| Polish xuống < 300 từ | Thêm lại 1 câu cụ thể từ draft gốc |
| > 400 từ | Cắt filler, giữ lesson |
| User muốn CTA | `linkedin-05-cta` |

## Tài liệu

- [assets/punchy-rules.md](../assets/punchy-rules.md)
- [assets/banned-phrases.md](../assets/banned-phrases.md)
- Bước trước: [linkedin-03-draft/SKILL.md](../linkedin-03-draft/SKILL.md)
