/**
 * One-off: sync business table in brain.db with upGrad landing context.
 * Run: node scripts/sync-business-upgrad.js
 */
const { DatabaseSync } = require("node:sqlite");
const path = require("path");

const dbPath = path.join(__dirname, "..", "brain.db");
const db = new DatabaseSync(dbPath);

const updates = [
  {
    id: 1,
    title: "Sản phẩm chủ lực",
    content:
      "Chương trình Cao học trực tuyến upGrad (Thạc sĩ/Tiến sĩ/Song bằng: MBA, DBA, v.v.) cho người đi làm bận 30+. Học bổng % và cashback không cố định — theo ngành, hồ sơ và đợt tuyển sinh. CTA landing: Liên hệ tư vấn / Nhận tư vấn ngay. Đại lý: Tuấn Anh — upGrad.",
  },
  {
    id: 2,
    title: "Insight khách hàng",
    content:
      "Khách hay hỏi: vừa làm vừa học được không, học bổng bao nhiêu %, tổng chi phí thực trả, bằng có giá trị gì, có kịp deadline đợt này không. Cần lộ trình rõ — không thích brochure dài.",
  },
];

const stmt = db.prepare(
  "UPDATE business SET title = ?, content = ? WHERE id = ?"
);

for (const row of updates) {
  stmt.run(row.title, row.content, row.id);
}

console.log("[sync-business-upgrad] Updated", updates.length, "rows in", dbPath);
