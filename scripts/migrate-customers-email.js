/**
 * One-off migration: add customers.email to SQLite brain.db (idempotent).
 */
const fs = require("node:fs");
const path = require("node:path");
const { DatabaseSync } = require("node:sqlite");

const root = path.join(__dirname, "..");
const dbPath = path.join(root, "brain.db");

if (!fs.existsSync(dbPath)) {
  console.error("[migrate-customers-email] brain.db not found at", dbPath);
  process.exit(1);
}

const db = new DatabaseSync(dbPath);
const cols = db.prepare("PRAGMA table_info(customers)").all();
if (cols.some((c) => c.name === "email")) {
  console.log("[migrate-customers-email] column email already exists — skip.");
  process.exit(0);
}

db.exec("ALTER TABLE customers ADD COLUMN email TEXT");
console.log("[migrate-customers-email] Added column customers.email OK.");
