/**
 * Copy static assets repo root → public/ for Vercel filesystem routing.
 * Run: npm run build
 */
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const pub = path.join(root, "public");

function copyFile(from, to) {
  fs.mkdirSync(path.dirname(to), { recursive: true });
  fs.copyFileSync(from, to);
  console.log("[build]", path.relative(root, from), "→", path.relative(root, to));
}

for (const name of ["admin.js", "admin.css"]) {
  const from = path.join(root, name);
  const to = path.join(pub, name);
  if (!fs.existsSync(from)) {
    console.warn("[build] skip missing:", from);
    continue;
  }
  copyFile(from, to);
}

const productSrc = path.join(root, "san-pham", "linkedin-easy-posting-machine");
const productDest = path.join(pub, "san-pham", "linkedin-easy-posting-machine");

if (fs.existsSync(productSrc)) {
  for (const name of ["index.html", "checkout.html", "cam-on.html", "product.css", "digital-checkout.js"]) {
    const from = path.join(productSrc, name);
    if (!fs.existsSync(from)) continue;
    if (name === "checkout.html" || name === "cam-on.html") {
      const dir = name.replace(".html", "");
      copyFile(from, path.join(productDest, dir, "index.html"));
    } else {
      copyFile(from, path.join(productDest, name));
    }
  }
} else {
  console.warn("[build] skip missing product pages:", productSrc);
}
