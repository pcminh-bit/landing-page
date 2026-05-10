/**
 * Copy admin UI from repo root → public/ so Vercel static can serve /admin.js and /admin.css.
 * Run: npm run build (included in Vercel default build when "build" exists in package.json).
 */
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const pub = path.join(root, "public");

for (const name of ["admin.js", "admin.css"]) {
  const from = path.join(root, name);
  const to = path.join(pub, name);
  if (!fs.existsSync(from)) {
    console.warn("[copy-admin-assets] skip missing:", from);
    continue;
  }
  fs.mkdirSync(pub, { recursive: true });
  fs.copyFileSync(from, to);
  console.log("[copy-admin-assets]", name, "→ public/");
}
