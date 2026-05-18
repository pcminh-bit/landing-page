#!/usr/bin/env node
/** Chạy trên VPS: node scripts/check-product-path.js */
const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const http = require("node:http");

const ROOT = path.join(__dirname, "..");
const slug = "linkedin-easy-posting-machine";
const rel = path.join("san-pham", slug, "index.html");
const paths = [
  path.join(ROOT, rel),
  path.join(ROOT, "public", rel),
];

function labelPath(p) {
  try {
    if (fs.existsSync(p) && fs.statSync(p).isFile()) {
      fs.accessSync(p, fs.constants.R_OK);
      return "OK";
    }
  } catch {
    return "DENIED";
  }
  return "MISS";
}

console.log("ROOT:", ROOT, "| uid:", process.getuid?.() ?? "n/a");
for (const p of paths) {
  console.log(labelPath(p), p);
}

const ww = spawnSync("sudo", ["-u", "www-data", "test", "-r", paths[0]], {
  encoding: "utf8",
});
console.log("www-data readable:", ww.status === 0 ? "OK" : "DENIED");

function getJson(u) {
  return new Promise((resolve) => {
    http
      .get(`http://127.0.0.1:3000${u}`, (res) => {
        let body = "";
        res.on("data", (c) => (body += c));
        res.on("end", () => {
          try {
            resolve({ u, status: res.statusCode, json: JSON.parse(body) });
          } catch {
            resolve({ u, status: res.statusCode, body: body.slice(0, 80) });
          }
        });
      })
      .on("error", (e) => resolve({ u, error: e.message }));
  });
}

(async () => {
  const health = await getJson("/api/digital-health");
  const page = await getJson("/san-pham/linkedin-easy-posting-machine/");
  console.log(health);
  console.log(page);
  const buildId = health.json?.buildId;
  if (health.status === 404 || buildId !== "2026-05-18-digital-v2") {
    console.error(
      "\n>>> Process trên :3000 CHƯA chạy code mới (hoặc không phải landing-page)."
    );
    console.error(">>> Chạy: bash scripts/restart-landing-page.sh");
    process.exitCode = 1;
  } else if (!health.json?.readable || page.status !== 200) {
    console.error("\n>>> Code mới OK nhưng file chưa đọc được hoặc trang vẫn lỗi.");
    process.exitCode = 1;
  }
})();
