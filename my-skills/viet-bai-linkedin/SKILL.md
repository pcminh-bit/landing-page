---
name: viet-bai-linkedin
description: >-
  Viết bài đăng LinkedIn tiếng Việt theo brand_voice (brain.db tại root),
  khung Hook + Body + CTA. Mọi chủ đề LinkedIn. Bài upGrad: ngành + học bổng %
  + cashback từ prompt (không cố định); mốc thời gian cashback chỉ khi user nêu.
  Kích hoạt khi viết/đăng/soạn bài LinkedIn, MBA/DBA/cao học, học bổng, cashback, upGrad.
when_to_use: >-
  Trigger: "viết bài LinkedIn", "viết bài về chương trình cao học [ngành] với học
  bổng [%] kèm cashback [số triệu]" (có thể thêm "trước [ngày]"). Không dùng cho
  email/Zalo/review code nếu không nhắc LinkedIn.
---

# Viết bài LinkedIn (viet-bai-linkedin)

## Instructions

1. **Đọc brand voice** từ `brain.db` → `brand_voice`. Fallback: `context-files/SOUL.md`.

2. **Prompt mẫu:**

   ```text
   viết bài về chương trình cao học [NGÀNH] với học bổng [X%] kèm cashback lên tới [SỐ TIỀN]
   ```

   Có thể thêm mốc thời gian, ví dụ: *…cashback 20 triệu VND nếu hoàn tất thủ tục trước 01/06/2026*

3. **Số liệu — không cố định:** học bổng %, cashback (triệu VND) chỉ từ prompt. Thiếu thông tin → hỏi gọn.

4. **Mốc thời gian cashback:**
   - Chỉ ghi điều kiện *trước [mốc]* khi user **nêu cụ thể** (ngày/tháng/deadline trong prompt).
   - User chỉ nêu số tiền (vd. 20 triệu) **không** nêu ngày → **không** tự gắn deadline (kể cả 01/06/2026).
   - Ví dụ hợp lệ: *cashback 20 triệu, hoàn tất thủ tục trước 1/6/2026* → Body ghi đúng mốc user đưa.

5. **Template:** [assets/linkedin-post-template.md](assets/linkedin-post-template.md)

6. **CTA mặc định (bài upGrad — cả hai kênh):**

   ```text
   Nhận tư vấn học bổng: https://lnkd.in/gs3jbXgi
   Zalo: https://zalo.me/0917500437

   —

   Tuấn Anh - Đại lý Tuyển sinh Chiến lược upGrad
   Giúp học viên đạt học bổng tốt nhất cho các chương trình upGrad
   ```

7. **Output — plain text (copy-paste lên LinkedIn):**
   - **Không** dùng Markdown heading (`## HOOK`, `## BODY`, …), **không** dùng dòng `---`.
   - LinkedIn không render Markdown; output là **một khối plain text liền mạch**.
   - Cấu trúc nội bộ (agent tự giữ, **không** in nhãn ra bài): Hook → Body → CTA → Signature → p/s (tùy chọn).
   - Phân tách các phần bằng **một dòng trống** (line break), không bằng heading hay rule line.

## Rules (output)

**Banned phrases** — không dùng trong bài đăng:

- `Đơn giản thôi:`
- `Thật ra:`
- Mũi tên `→` ở đầu bullet (dùng dòng trống giữa ý, hoặc gạch đầu dòng `-` tự nhiên)
- Cụm `vừa làm vừa học` và `không cần bỏ việc` — **tối đa 1 lần** trên cả bài (chọn một cụm nếu cần, không lặp)

**RULE BODY — KHÔNG LẶP SỐ LIỆU:**

- Mỗi instrument (cashback, học bổng %, deadline) chỉ nêu **MỘT LẦN** trong toàn body.
- Câu giới thiệu chương trình đã nêu số liệu → các dòng sau **KHÔNG** được restate.
- Các dòng sau câu giới thiệu phải nói về context/value, không phải nhắc lại con số.

### Hook style

Hook là 1 câu hỏi định vị người viết như cố vấn tối ưu hồ sơ.

**QUY TẮC TỪ NGỮ TRONG HOOK:**

- LUÔN dùng cụm `chính sách học bổng` làm umbrella term — kể cả khi prompt chỉ có cashback, hoặc có cả % và cashback.
- KHÔNG dùng `cashback`, `ưu đãi`, `tiền hoàn lại` trong hook — những từ này tạo cảm giác sale, làm mất tone advisory.
- `Cashback X triệu`, `%` học bổng, deadline cụ thể chỉ xuất hiện ở Body, không ở Hook.

**Công thức:** [audience qualifier] + [tình huống/mong muốn] + `nhưng chưa biết chính sách học bổng tốt nhất trước khi [đăng ký/nộp hồ sơ]?`

✓ **ĐÚNG:**

- `Đang cân MBA Golden Gate, nhưng chưa biết chính sách học bổng tốt nhất trước khi nộp hồ sơ?`
- `Làm trong giáo dục, muốn lên thạc sĩ nhưng chưa biết chính sách học bổng tốt nhất trước khi đăng ký?`
- `30+, đang cân cao học upGrad nhưng chưa biết chính sách học bổng đang có là gì?`

✗ **TRÁNH** (lý do: tone salesy, định vị người viết là người báo giá):

- `Bạn đang cân MBA và muốn chốt ưu đãi cashback trước khi nộp hồ sơ?`
- `...nhưng chưa rõ cashback khi đăng ký?`
- `...muốn lên cao học, có cashback 20 triệu không?`

**Nguyên tắc:** hook = umbrella (`chính sách học bổng`). Body mới đi vào instrument cụ thể (cashback X triệu, học bổng Y%, deadline). Khách 30+ phản ứng tốt với positioning `tối ưu hồ sơ` hơn là `ưu đãi tài chính trước mắt`.

## Examples

### Ví dụ 1 — Có số + mốc thời gian

**Input:**  
viết bài về chương trình cao học MBA với học bổng 70% kèm cashback lên tới 20 triệu VND nếu hoàn tất thủ tục trước 01/06/2026

**Output:**

```text
Đang cân MBA trong khi vẫn full-time, nhưng chưa biết chính sách học bổng tốt nhất trước khi nộp hồ sơ?

Chương trình cao học MBA có học bổng 70% và cashback 20 triệu VND khi hoàn tất thủ tục trước 01/06/2026.

Mức học bổng và cashback áp dụng theo hồ sơ và đợt tuyển sinh — nộp sớm để tránh hết slot ưu đãi.

Lịch học linh hoạt, phù hợp người đi làm 30+ đang giữ việc hiện tại.

Nhận tư vấn học bổng: https://lnkd.in/gs3jbXgi
Zalo: https://zalo.me/0917500437

—

Tuấn Anh - Đại lý Tuyển sinh Chiến lược upGrad
Giúp học viên đạt học bổng tốt nhất cho các chương trình upGrad

p/s: Bạn đã chốt hồ sơ MBA chưa? Comment "MBA" — mình gửi checklist thủ tục trước 01/06.
```

### Ví dụ 2 — Chỉ số, không mốc

**Input:**  
viết bài cao học MBA học bổng 70% cashback 20 triệu VND

**Output:**

```text
30+, bận việc, vẫn muốn lên MBA — nhưng chưa biết chính sách học bổng tốt nhất trước khi đăng ký?

Chương trình cao học MBA: học bổng 70%, cashback 20 triệu VND theo điều kiện đăng ký.

Mức học bổng và cashback áp dụng theo hồ sơ và đợt tuyển sinh — rà soát sớm để biết bạn đủ điều kiện mức nào.

Học trực tuyến, sắp xếp buổi học quanh lịch làm — phù hợp người đi làm 30+ đang giữ việc hiện tại.

Nhận tư vấn học bổng: https://lnkd.in/gs3jbXgi
Zalo: https://zalo.me/0917500437

—

Tuấn Anh - Đại lý Tuyển sinh Chiến lược upGrad
Giúp học viên đạt học bổng tốt nhất cho các chương trình upGrad

p/s: Inbox "MBA" nếu bạn muốn biết mức áp dụng thế nào với hồ sơ của mình.
```

### Ví dụ 3 — Không kích hoạt

review file server.js

## Troubleshooting

| Vấn đề | Xử lý |
|--------|--------|
| Thiếu ngành / % / cashback | Hỏi một câu. |
| Có cashback, không có mốc thời gian | Không tự thêm deadline. |
| User nêu mốc tùy chọn | Copy đúng ngày user viết. |

## Tài liệu

- `brain.db` → `brand_voice`, `business`
- `context-files/USER.md`, `SOUL.md`
