const { DatabaseSync } = require("node:sqlite");
const path = require("node:path");

const db = new DatabaseSync(path.join(__dirname, "..", "brain.db"));

db.exec(`
  CREATE TABLE IF NOT EXISTS referrers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    phone TEXT NOT NULL,
    referral_code TEXT UNIQUE NOT NULL,
    status TEXT DEFAULT 'active',
    bank_name TEXT,
    bank_account TEXT,
    bank_holder TEXT,
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS referees (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    referrer_code TEXT NOT NULL,
    name TEXT NOT NULL,
    email TEXT,
    phone TEXT NOT NULL,
    program_interest TEXT,
    status TEXT DEFAULT 'pending',
    enrolled_program TEXT,
    tuition_amount INTEGER,
    commission_rate REAL DEFAULT 0.05,
    commission_amount INTEGER,
    commission_note TEXT,
    payment_schedule TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (referrer_code) REFERENCES referrers(referral_code)
  )
`);

console.log("✓ Table referrers: OK");
console.log("✓ Table referees: OK");
db.close();
