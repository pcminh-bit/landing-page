# Hướng dẫn sử dụng — LinkedIn Easy Posting Machine

**Phiên bản:** 1.0 · **2026**

In file này thành PDF: mở bằng trình duyệt hoặc VS Code → Print → Save as PDF.

---

## 1. Giới thiệu

Bộ **5 skills** giúp bạn viết bài LinkedIn tiếng Việt theo workflow:

**Ý tưởng → Hook → Draft (300–400 từ) → Punchy → CTA**

Phù hợp người **30+**, giọng cố vấn, hạn chế dấu hiệu AI (không dùng em dash `—`).

---

## 2. Chuẩn bị

1. Giải nén file `linkedin-easy-posting-machine.zip`  
2. Mở `WORKSHEET-brand-voice.md`, điền 5 dòng  
3. Chọn 1 công cụ: **Cursor**, **Claude.ai**, hoặc agent khác

---

## 3. Cài đặt trên Cursor

**Cách 1 — Gọi trong project (nhanh nhất)**

Giữ folder `linkedin-easy-posting-machine` trong repo. Trong chat:

```text
@products/linkedin-easy-posting-machine/linkedin-01-idea/SKILL.md
```

**Cách 2 — Skills toàn máy**

Copy từng folder `linkedin-0X-...` vào:

`C:\Users\[TênBạn]\.cursor\skills\`

Mỗi folder phải có `SKILL.md` bên trong. Khởi động lại Cursor nếu skill không hiện.

---

## 4. Cài đặt trên Claude.ai

1. Tạo **Project** mới  
2. **Add knowledge** → upload 5 file `SKILL.md` + `WORKSHEET-brand-voice.md`  
3. Trong chat: *"Làm theo skill linkedin-01-idea, bước 1 workflow"*

---

## 5. Dùng từng skill

| # | Tên | Khi nào gọi |
|---|-----|-------------|
| 1 | linkedin-01-idea | Có chủ đề, chưa có góc bài |
| 2 | linkedin-02-hook | Đã có block `SANG SKILL 02` |
| 3 | linkedin-03-draft | Đã chọn hook |
| 4 | linkedin-04-punch-line | Có draft 300–400 từ |
| 5 | linkedin-05-cta | Muốn CTA + chữ ký |

**Quan trọng:** Luôn **copy block handoff** từ output bước trước. Không nhảy bước nếu chưa hài lòng output hiện tại.

---

## 6. Trigger phrase

- `post lab bước 1` … `post lab bước 5`  
- `brainstorm linkedin` · `linkedin hook` · `linkedin draft`  
- `linkedin punchy` · `linkedin cta`

---

## 7. Ví dụ một vòng (rút gọn)

**Bước 1 — Input:** Chủ đề: Lên manager, họp nhiều, mất tay nghề  

**Bước 1 — Output:** 3 góc A/B/C + `=== SANG SKILL 02 ===`

**Bước 2 — Output:** 3 hook + `=== SANG SKILL 03 ===`

**Bước 3 — Output:** Bài ~350 từ + `=== SANG SKILL 04 ===`

**Bước 4 — Output:** Bài polish, không `—` + `=== SANG SKILL 05 ===`

**Bước 5 — Output:** Bài + CTA comment "FRAME" + p/s (tuỳ chọn)

---

## 8. Tùy chỉnh giọng của bạn

Paste **bài LinkedIn thật** đã đăng vào chat:

```text
Đây là bài mẫu giọng tôi. Lần sau skill 02–03 bám giọng này:
[paste bài]
```

Hoặc cập nhật worksheet dòng 3–4.

---

## 9. Troubleshooting

| Triệu chứng | Xử lý |
|-------------|--------|
| Skill không load | Kiểm tra đường dẫn `SKILL.md`, frontmatter `name:` |
| Bài quá ngắn | Skill 03: "mở rộng thêm 1 đoạn, tổng 320 từ" |
| Vẫn có `—` | Skill 04: "thay mọi em dash, giữ 300–400 từ" |
| CTA quá sales | Skill 05 mode `question-only` hoặc bỏ bước 5 |

---

## 10. Liên hệ

*(Điền email / Zalo / website khi phát hành bản bán.)*

---

**LinkedIn Easy Posting Machine** · 5 skills · Workflow 27 phút
