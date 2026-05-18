---
name: linkedin-01-idea
description: >-
  Brainstorms 3 LinkedIn post angles for manager 30+ audiences (strategic
  positioning, anti-generic). Step 1 of LinkedIn Easy Posting Machine. Outputs
  angles only—no hooks or full posts. Use when user says linkedin idea,
  brainstorm linkedin, ý tưởng bài linkedin, post lab bước 1, or starts the
  5-step posting workflow.
disable-model-invocation: true
---

# LinkedIn 01 — Ý tưởng theo avatar

**Bước 1/5** · LinkedIn Easy Posting Machine · Chỉ brainstorm — **không** viết hook hay bài đăng.

## Instructions

1. **Đọc** [assets/banned-phrases.md](../assets/banned-phrases.md) và [assets/post-types.md](../assets/post-types.md).

2. **Input từ user** (thiếu thì hỏi gọn):
   - **Bắt buộc:** chủ đề hoặc tình huống (1–3 câu)
   - **Khuyến khích:** [WORKSHEET-brand-voice.md](../WORKSHEET-brand-voice.md) đã điền
   - **Tuỳ chọn:** dạng post (story / insight / contrarian / list / case / observation)

3. **Avatar mặc định** (nếu user không mô tả audience):
   - 28–45, đã ổn career, thấy ceiling, muốn được nhìn **strategic** hơn operational
   - Pain ngầm: profile chưa khớp năng lực; sợ junior vượt; muốn vào “decision table”

4. **Tạo đúng 3 góc (A, B, C)** — mỗi góc:
   - Tên góc ngắn (3–6 từ)
   - Dạng post (1 trong 6 loại)
   - Pain điểm chạm (1 câu, cụ thể)
   - Takeaway cho người đọc (1 câu — họ học/feel gì)
   - 1 dòng “vì sao đăng bây giờ” (timeliness)

5. **Đề xuất 1 góc** + lý do 2 câu (khớp worksheet / audience).

6. **Handoff block** — copy-paste sang `linkedin-02-hook`:

```text
=== SANG SKILL 02 ===
Góc chọn: [A|B|C] — [tên góc]
Dạng: [story|insight|...]
Pain: [1 câu]
Takeaway: [1 câu]
Chủ đề gốc: [tóm tắt 1 câu từ user]
Tone: [từ worksheet hoặc mặc định peer-advisor]
===
```

## Rules

- **Không** viết hook, body, CTA, hay bài mẫu dài.
- **Không** bịa số liệu, tên công ty khách, hay case “giả”.
- Mỗi góc phải **khác nhau rõ** (dạng post hoặc pain khác — không 3 biến thể cùng ý).
- Tránh góc chỉ “khen AI” hoặc “AI sẽ thay thế bạn” generic — gắn **situation manager** cụ thể.
- Tiếng **Việt** trừ khi user yêu cầu song ngữ.

## Output format (bắt buộc)

```text
LINKEDIN EASY POSTING — BƯỚC 1/5 · Ý TƯỞNG

GÓC A — [tên]
· Dạng: ...
· Pain: ...
· Takeaway: ...
· Vì sao đăng: ...

GÓC B — ...
GÓC C — ...

→ Đề xuất chọn: [A/B/C] — [2 câu lý do]

=== SANG SKILL 02 ===
...
===
```

## Examples

### Ví dụ 1 — Có worksheet

**Input:**

```text
Worksheet:
1. HR Business Partner, 10 năm
2. HRBP và manager line 30–40
3. Thẳng, không corporate
4. Không "synergy"
5. Comment "FRAME" lấy khung

Chủ đề: Sau khi lên manager, họp nhiều hơn làm — cảm giác mất tay nghề
```

**Output (rút gọn):**

```text
GÓC A — Operational trap
· Dạng: observation
· Pain: Lên manager nhưng KPI vẫn đo việc làm tay...
· Takeaway: Strategic = chọn việc không làm...
· Vì sao đăng: Đầu quý, nhiều người reset role

GÓC B — Meeting tax
· Dạng: contrarian
...

GÓC C — Profile vs title
· Dạng: insight
...

→ Đề xuất chọn: A — ...

=== SANG SKILL 02 ===
Góc chọn: A — Operational trap
...
===
```

### Ví dụ 2 — Thiếu audience

**Input:** `Ý tưởng bài về học MBA khi đã 35 tuổi`

**Agent:** Hỏi 1 câu: *"Bài hướng tới ai đọc — peer cùng cân MBA, hay team bạn lead?"* Sau khi user trả lời → output 3 góc (không nhắn “đại lý upGrad” trừ khi user tự nêu vai trò đó).

## Troubleshooting

| Vấn đề | Xử lý |
|--------|--------|
| Chủ đề quá rộng (“viết về leadership”) | Hỏi 1 tình huống cụ thể trong 7 ngày qua |
| User muốn viết luôn bài | Nhắc: bước 1 chỉ ý tưởng → gọi `linkedin-02-hook` |
| 3 góc giống nhau | Viết lại — đổi dạng post hoặc pain |

## Tài liệu

- [WORKSHEET-brand-voice.md](../WORKSHEET-brand-voice.md)
- [assets/post-types.md](../assets/post-types.md)
- [assets/banned-phrases.md](../assets/banned-phrases.md)
