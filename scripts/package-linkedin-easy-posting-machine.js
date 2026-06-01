#!/usr/bin/env node
/**
 * Đóng gói products/linkedin-easy-posting-machine → dist/linkedin-easy-posting-machine.zip
 * Chạy: node scripts/package-linkedin-easy-posting-machine.js
 */
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const root = path.resolve(__dirname, "..");
const src = path.join(root, "products", "linkedin-easy-posting-machine");
const distDir = path.join(root, "dist");
const zipName = "linkedin-easy-posting-machine.zip";
const zipPath = path.join(distDir, zipName);

if (!fs.existsSync(src)) {
  console.error("Không thấy:", src);
  process.exit(1);
}

fs.mkdirSync(distDir, { recursive: true });
if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath);

const isWin = process.platform === "win32";
if (isWin) {
  const srcWin = src.replace(/'/g, "''");
  const zipWin = zipPath.replace(/'/g, "''");
  execSync(
    `powershell -NoProfile -Command "Compress-Archive -Path '${srcWin}\\*' -DestinationPath '${zipWin}' -Force"`,
    { stdio: "inherit" }
  );
} else {
  execSync(`cd "${src}" && zip -r "${zipPath}" .`, { stdio: "inherit" });
}

const publicDl = path.join(root, "public", "downloads");
fs.mkdirSync(publicDl, { recursive: true });
const publicZip = path.join(publicDl, zipName);
fs.copyFileSync(zipPath, publicZip);

const stat = fs.statSync(zipPath);
console.log("\n✓ Đã tạo:", zipPath);
console.log("✓ Copy:", publicZip);
console.log("  Kích thước:", (stat.size / 1024).toFixed(1), "KB");
console.log("\nDeploy lên VPS kèm dist/ hoặc public/downloads/ để API tải file hoạt động.");
