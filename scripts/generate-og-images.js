/**
 * Generate Open Graph placeholder JPEGs (1200×630).
 * Run: npm install sharp --save-dev && node scripts/generate-og-images.js
 */
const fs = require("node:fs");
const path = require("node:path");

const OUT_DIR = path.join(__dirname, "..", "public", "assets");

function svgCard(bg, line1, line2) {
  const esc = (s) =>
    String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  return Buffer.from(`<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <rect width="1200" height="630" fill="${bg}"/>
  <text x="600" y="290" font-family="Arial, Helvetica, sans-serif" font-size="52" font-weight="700" fill="#ffffff" text-anchor="middle">${esc(line1)}</text>
  <text x="600" y="360" font-family="Arial, Helvetica, sans-serif" font-size="28" fill="#ffffff" fill-opacity="0.92" text-anchor="middle">${esc(line2)}</text>
</svg>`);
}

async function main() {
  let sharp;
  try {
    sharp = require("sharp");
  } catch {
    console.error("Missing dependency. Run:\n  npm install sharp --save-dev\n  node scripts/generate-og-images.js");
    process.exit(1);
  }

  fs.mkdirSync(OUT_DIR, { recursive: true });

  const cards = [
    {
      file: "og-image.jpg",
      svg: svgCard("#E50913", "hocbong-upgrad.com", "Học bổng upGrad — Thạc sĩ & Tiến sĩ"),
    },
    {
      file: "og-referral.jpg",
      svg: svgCard("#1f2937", "Giới thiệu học viên", "hocbong-upgrad.com"),
    },
  ];

  for (const card of cards) {
    const out = path.join(OUT_DIR, card.file);
    await sharp(card.svg).jpeg({ quality: 88, mozjpeg: true }).toFile(out);
    console.log("[og] wrote", out);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
