---
name: linkedin-02-hook
description: >-
  Writes 3 LinkedIn hooks (question, observation, contrarian) in plain Vietnamese—
  easy to read once, no IC jargon. Step 2 of LinkedIn Easy Posting Machine. Hooks
  only. Use when user says linkedin hook, viết hook linkedin, post lab bước 2,
  or pastes the SANG SKILL 02 block from linkedin-01-idea.
disable-model-invocation: true
---

# LinkedIn 02 — Hook

**Bước 2/5** · LinkedIn Easy Posting Machine · Chỉ hook — **không** viết body hay CTA.

## Instructions

1. **Đọc** [assets/banned-phrases.md](../assets/banned-phrases.md) và [assets/hook-formulas.md](../assets/hook-formulas.md).

2. **Input** (một trong hai):
   - Block `=== SANG SKILL 02 ===` từ `linkedin-01-idea` (**ưu tiên**)
   - Hoặc tay: góc + pain + takeaway + tone (tối thiểu 3 dòng)

   Thiếu pain/takeaway → hỏi **1 câu**, không tự bịa case.

3. **Viết đúng 3 hook** — mỗi hook **một kiểu khác nhau**:
   - HOOK 1 → **question**
   - HOOK 2 → **observation** (có thể kết bằng 1 câu hỏi ngắn — xem mẫu chuẩn)
   - HOOK 3 → **contrarian**

4. **Ràng buộc mỗi hook:**
   - Tối đa **2 dòng** (xuống dòng 1 lần giữa 2 câu)
   - Tiếng Việt đời thường — **đọc 1 lần là hiểu**, không cần đọc lại
   - Khớp pain/takeaway từ bước 1 — không lệch chủ đề
   - Không salesy; không CTA trong hook

5. **Đề xuất 1 hook** + lý do 1–2 câu (dễ hiểu + đúng pain).

6. **Handoff** — copy sang bước draft:

```text
=== SANG SKILL 03 ===
Hook chọn: HOOK [1|2|3]
Nội dung hook (nguyên văn):
[hook đã chọn — giữ đúng từ user chọn nếu họ đã sửa]

Góc: [tên góc]
Dạng: [story|insight|...]
Pain: [1 câu — từ đời thường, không IC/ship]
Takeaway: [1 câu — từ đời thường]
Tone: peer-advisor, câu ngắn, dễ hiểu
===
```

## Ngôn ngữ (bắt buộc)

**Ưu tiên từ người Việt hay nói khi nói chuyện peer:**

| Dùng | Không dùng (trừ user tự nêu) |
|------|------------------------------|
| nhân viên | IC, individual contributor |
| quản lý | manager (title), PM khi không rõ nghĩa |
| việc mình tự làm xong | ship, deliver, output cá nhân |
| tuần đó / cuối tuần | calendar, KPI (nếu user không nêu) |
| không làm được gì / không ra gì | vô giá trị, không tạo giá trị thực (văn) |

**Tránh:**

- Câu “triết lý” hoặc ẩn dụ khó: *Title đã đổi*, *não chờ tiếng vỗ tay*, *đo bằng thước IC*
- Thuật ngữ corporate / tiếng Anh rải rác khi có từ Việt tương đương
- Câu phải suy nghĩ lại lần 2 mới hiểu

**Được:**

- `mindset` nếu câu vẫn dễ hiểu trong ngữ cảnh
- Nối ý bằng `—`, `thì`, hoặc `->` (ưu tiên `—` / `thì` nếu không user chỉ định)

## Rules

- **Không** viết body, bullet dài, link, signature, p/s.
- **Không** 3 hook cùng kiểu câu hỏi.
- **Không** mở bằng `Đơn giản thôi:` / `Thật ra:` / `Trong thế giới ngày nay`.
- **Không** % giả trong hook.
- Bài sẽ dài 300–400 từ ở bước 3 — hook chỉ **mở**, không kể hết story.

## Output format (bắt buộc)

```text
LINKEDIN EASY POSTING — BƯỚC 2/5 · HOOK

HOOK 1 (question):
[dòng 1: tình huống cụ thể]
[dòng 2: câu hỏi — gợi cảm giác pain]

HOOK 2 (observation):
[dòng 1: trước đây / khi còn nhân viên — 1 truth ngắn]
[dòng 2: sau promote + hệ quả — có thể hỏi “có đúng không?”]

HOOK 3 (contrarian):
[dòng 1: Nhiều người + hành vi phổ biến]
[dòng 2: hệ quả ngược — vì sao càng làm càng thấy “không ra gì”]

→ Đề xuất chọn: HOOK [n] — [lý do: dễ hiểu / khớp pain]

=== SANG SKILL 03 ===
...
===
```

## Examples

### Ví dụ chuẩn — Góc C · Chuẩn “có giá trị” cũ

**Input:**

```text
=== SANG SKILL 02 ===
Góc chọn: C — Chuẩn “có giá trị” cũ
Dạng: insight
Pain: Vẫn đo bản thân bằng chuẩn nhân viên nên khi chỉ điều phối, cảm giác không tạo ra gì thực
Takeaway: Giá trị quản lý = chọn không làm + gỡ nút cho team — cần cách đo mới
Tone: peer-advisor, câu ngắn, dễ hiểu
===
```

**Output (mẫu vàng — bám sát cấu trúc này):**

```text
LINKEDIN EASY POSTING — BƯỚC 2/5 · HOOK

HOOK 1 (question):
Cuối tuần, không có việc nào do chính mình làm xong hết.
Bạn có nghĩ tuần đó mình “không làm được gì” không?

HOOK 2 (observation):
Khi còn là nhân viên, giỏi vì việc mình tự làm xong.
Lên quản lý mà vẫn giữ mindset đó — tự cho mình chẳng làm được gì, có đúng không?

HOOK 3 (contrarian):
Nhiều người lên quản lý xong vẫn tự làm cho chắc.
Càng làm vậy, càng dễ thấy mình “không ra gì” — vì việc đó không còn là việc chính.

→ Đề xuất chọn: HOOK 2 — Nói thẳng đổi chuẩn trước/sau, pain rõ, không cần thuật ngữ.

=== SANG SKILL 03 ===
Hook chọn: HOOK 2
Nội dung hook (nguyên văn):
Khi còn là nhân viên, giỏi vì việc mình tự làm xong.
Lên quản lý mà vẫn giữ mindset đó — tự cho mình chẳng làm được gì, có đúng không?

Góc: Chuẩn “có giá trị” cũ
Dạng: insight
Pain: Vẫn đo bản thân như nhân viên → cảm giác không tạo ra gì thực
Takeaway: Đổi cách đo — team xong việc, gỡ nút, chọn không làm
Tone: peer-advisor, câu ngắn, dễ hiểu
===
```

### Ví dụ ✗ — Không làm kiểu này

```text
HOOK 2 (observation):
IC được khen vì thứ nằm trên bàn mình.
Manager được đo bằng thứ trên bàn người khác — mà não vẫn chờ tiếng vỗ tay cho mình.
```

Lý do từ chối: IC/Manager, ẩn dụ “vỗ tay”, phải đọc lại mới hiểu.

```text
HOOK 2 (observation):
Title đã đổi. Cách não bạn chấm một ngày “có giá trị” thì chưa.
```

Lý do từ chối: mẫu câu cliché, “não chấm giá trị” trừu tượng.

### Ví dụ 2 — User bỏ qua skill 01

**Input:** `Viết hook bài LinkedIn: career ceiling lúc 38, muốn MBA nhưng sợ không kịp`

**Agent:** Tạo 3 hook (question / observation / contrarian), **câu đời thường**; không % giả; không đại lý / học bổng trừ khi user nêu.

## Troubleshooting

| Vấn đề | Xử lý |
|--------|--------|
| Hook quá dài (>2 dòng) | Cắt — giữ 1 tình huống + 1 câu hỏi/hệ quả |
| User nói “dở” / khó hiểu | Viết lại — thay IC→nhân viên, bỏ ẩn dụ, dùng mẫu vàng trên |
| Hook văn / triết lý | Đổi sang tình huống cụ thể: cuối tuần, việc tự làm xong, promote |
| User muốn full post | Viết draft (bước 3) — giữ nguyên hook user đã chốt |
| Hook salesy | Viết lại — peer-advisor |

## Tài liệu

- [assets/hook-formulas.md](../assets/hook-formulas.md)
- [assets/banned-phrases.md](../assets/banned-phrases.md)
- Bước trước: [linkedin-01-idea/SKILL.md](../linkedin-01-idea/SKILL.md)
