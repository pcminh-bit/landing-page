const path = require("node:path");
const { DatabaseSync } = require("node:sqlite");

const brainPath = path.join(__dirname, "..", "brain.db");
const db = new DatabaseSync(brainPath);
try {
  db.exec("ALTER TABLE orders ADD COLUMN order_code TEXT");
  console.log("Added order_code column.");
} catch (error) {
  if (String(error.message).includes("duplicate column")) {
    console.log("order_code already exists.");
  } else {
    throw error;
  }
}
