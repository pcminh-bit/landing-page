/**
 * Export all SQLite tables from brain.db to markdown files under vault-ready/.
 * Usage:
 *   node scripts/export-brain-to-vault.js [path/to/brain.db]
 *   node scripts/export-brain-to-vault.js   # uses MY_BRAIN_DB or ../brain.db
 */
const fs = require("node:fs");
const path = require("node:path");
const { DatabaseSync } = require("node:sqlite");

const TABLE_FILES = {
  brand_voice: "brand-voice.md",
  knowledge: "knowledge-base.md",
  business: "my-business.md",
};

function slugify(name) {
  return String(name)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") || "table";
}

function escapeMdCell(s) {
  if (s == null) return "";
  const t = String(s);
  return t.replace(/\|/g, "\\|").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}

function defaultDbPath() {
  if (process.env.MY_BRAIN_DB && fs.existsSync(process.env.MY_BRAIN_DB)) {
    return process.env.MY_BRAIN_DB;
  }
  const fromEnv = process.env.LANDING_BRAIN_DB;
  if (fromEnv && fs.existsSync(fromEnv)) return fromEnv;
  return path.join(__dirname, "..", "brain.db");
}

function main() {
  const dbPath = path.resolve(process.argv[2] || defaultDbPath());
  const outRoot = path.join(path.dirname(dbPath), "vault-ready");

  if (!fs.existsSync(dbPath)) {
    console.error("[export-brain] brain.db not found:", dbPath);
    console.error("  Pass path: node scripts/export-brain-to-vault.js \"C:\\path\\to\\brain.db\"");
    console.error("  Or set MY_BRAIN_DB=");
    process.exit(1);
  }

  fs.mkdirSync(outRoot, { recursive: true });

  const db = new DatabaseSync(dbPath);
  const tables = db
    .prepare(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name"
    )
    .all()
    .map((r) => r.name);

  if (!tables.length) {
    console.error("[export-brain] No user tables in", dbPath);
    process.exit(1);
  }

  const indexLines = [
    "# vault-ready",
    "",
    `Nguồn: \`${dbPath.replace(/\\/g, "/")}\``,
    "",
    "## Files",
    "",
  ];

  for (const table of tables) {
    const fileName = TABLE_FILES[table] || `${slugify(table)}.md`;
    const filePath = path.join(outRoot, fileName);

    const cols = db.prepare(`PRAGMA table_info(${quoteIdent(table)})`).all();
    const colNames = cols.map((c) => c.name);
    const selectList = colNames.map((c) => quoteIdent(c)).join(", ");
    const rows = db
      .prepare(`SELECT ${selectList} FROM ${quoteIdent(table)}`)
      .all();

    const lines = [];
    lines.push(`# ${table}`);
    lines.push("");
    lines.push(`Bảng \`${table}\` — ${rows.length} bản ghi.`);
    lines.push("");

    if (!rows.length) {
      lines.push("*(Không có dữ liệu.)*");
    } else {
      lines.push("| " + colNames.join(" | ") + " |");
      lines.push("| " + colNames.map(() => "---").join(" | ") + " |");
      for (const row of rows) {
        lines.push(
          "| " +
            colNames
              .map((c) => escapeMdCell(row[c]).replace(/\n/g, "<br>"))
              .join(" | ") +
            " |"
        );
      }
    }
    lines.push("");

    fs.writeFileSync(filePath, lines.join("\n"), "utf-8");
    indexLines.push(`- [\`${fileName}\`](./${fileName}) — bảng \`${table}\` (${rows.length} rows)`);
    console.error("[export-brain]", table, "->", filePath, `(${rows.length} rows)`);
  }

  indexLines.push("");
  fs.writeFileSync(path.join(outRoot, "README.md"), indexLines.join("\n"), "utf-8");
  console.error("[export-brain] Done. Output:", outRoot);
}

function quoteIdent(name) {
  return `"${String(name).replace(/"/g, '""')}"`;
}

main();
