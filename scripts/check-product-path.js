#!/usr/bin/env node
/** Chạy trên VPS: node scripts/check-product-path.js */
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.join(__dirname, "..");
const PUBLIC = path.join(ROOT, "public");
const slug = "linkedin-easy-posting-machine";
const rel = path.join("san-pham", slug, "index.html");

const paths = [
  path.join(ROOT, rel),
  path.join(PUBLIC, rel),
];

console.log("ROOT:", ROOT, "| uid:", process.getuid?.() ?? "n/a");
for (const p of paths) {
  let label = "MISS";
  try {
    if (fs.existsSync(p) && fs.statSync(p).isFile()) {
      fs.accessSync(p, fs.constants.R_OK);
      label = "OK";
    }
  } catch {
    label = "DENIED (exists but not readable for this user)";
  }
  console.log(label, p);
}

console.log(
  "\nService chạy www-data — chạy thêm:\n" +
    "  sudo -u www-data test -r " +
    paths[0] +
    " && echo www-data:OK || echo www-data:DENIED"
);

const http = require("node:http");
const urls = [
  "/san-pham/linkedin-easy-posting-machine/",
  "/san-pham/linkedin-easy-posting-machine/index.html",
];

function probe(u) {
  return new Promise((resolve) => {
    http.get(`http://127.0.0.1:3000${u}`, (res) => {
      let body = "";
      res.on("data", (c) => (body += c));
      res.on("end", () => resolve({ u, status: res.statusCode, body: body.slice(0, 80) }));
    }).on("error", (e) => resolve({ u, error: e.message }));
  });
}

(async () => {
  for (const u of urls) {
    console.log(await probe(u));
  }
})();
