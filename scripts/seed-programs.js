/**
 * Seed programs table from scripts/programs_final.json into brain.db.
 * Run: node scripts/seed-programs.js
 *
 * Uses the same SQLite setup as server.js (DatabaseSync + brain.db at project root).
 */
const fs = require("node:fs");
const path = require("node:path");
const { DatabaseSync } = require("node:sqlite");

const ROOT = path.join(__dirname, "..");
const SOURCE_DB_PATH = path.join(ROOT, "brain.db");
const DB_PATH = process.env.VERCEL ? "/tmp/brain.db" : SOURCE_DB_PATH;
const PROGRAMS_JSON = path.join(__dirname, "programs_final.json");

const db = new DatabaseSync(DB_PATH);

db.exec(`
CREATE TABLE IF NOT EXISTS programs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  program_slug TEXT UNIQUE NOT NULL,
  folder_name TEXT,
  category_slug TEXT NOT NULL,
  sort_order INTEGER DEFAULT 0,
  is_published INTEGER DEFAULT 1,
  university_name TEXT,
  university_slug TEXT,
  accreditation_label TEXT,
  degree_badge TEXT,
  program_title TEXT NOT NULL,
  meta_line_1 TEXT,
  meta_line_2 TEXT,
  meta_line_3 TEXT,
  price_after INTEGER,
  price_display TEXT,
  price_after_text TEXT,
  cta_primary_label TEXT,
  cta_primary_url TEXT,
  brochure_url TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
`);

const programs = JSON.parse(fs.readFileSync(PROGRAMS_JSON, "utf-8"));

const upsert = db.prepare(`
INSERT OR REPLACE INTO programs (
  program_slug,
  folder_name,
  category_slug,
  sort_order,
  is_published,
  university_name,
  university_slug,
  accreditation_label,
  degree_badge,
  program_title,
  meta_line_1,
  meta_line_2,
  meta_line_3,
  price_after,
  price_display,
  price_after_text,
  cta_primary_label,
  cta_primary_url,
  brochure_url,
  updated_at
) VALUES (
  ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
  CURRENT_TIMESTAMP
)
`);

let seeded = 0;

for (const row of programs) {
  upsert.run(
    row.program_slug,
    row.folder_name ?? null,
    row.category_slug,
    row.sort_order ?? 0,
    row.is_published === false ? 0 : 1,
    row.university_name ?? null,
    row.university_slug ?? null,
    row.accreditation_label ?? null,
    row.degree_badge ?? null,
    row.program_title,
    row.meta_line_1 ?? null,
    row.meta_line_2 ?? null,
    row.meta_line_3 ?? null,
    row.price_after ?? null,
    row.price_display ?? null,
    row.price_after_text ?? null,
    row.cta_primary_label ?? null,
    row.cta_primary_url ?? null,
    row.brochure_url ?? null
  );
  console.log(`✓ Seeded: ${row.program_title}`);
  seeded += 1;
}

console.log(`Done — seeded ${seeded} programs`);

db.close();
