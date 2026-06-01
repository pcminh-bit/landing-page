/**
 * Generate favicon + apple-touch-icon.
 * Run: npm install sharp to-ico --save-dev && node scripts/generate-favicon.js
 */
const fs = require("node:fs");
const path = require("node:path");

const PUBLIC_DIR = path.join(__dirname, "..", "public");
const ASSETS_DIR = path.join(PUBLIC_DIR, "assets");

function iconSvg(size, letter) {
  return Buffer.from(`<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" rx="${Math.round(size * 0.18)}" fill="#E50913"/>
  <text x="50%" y="54%" font-family="Arial, Helvetica, sans-serif" font-size="${Math.round(size * 0.42)}" font-weight="700" fill="#ffffff" text-anchor="middle" dominant-baseline="middle">${letter}</text>
</svg>`);
}

async function main() {
  let sharp;
  let toIco;
  try {
    sharp = require("sharp");
    toIco = require("to-ico");
  } catch {
    console.error(
      "Missing dependencies. Run:\n  npm install sharp to-ico --save-dev\n  node scripts/generate-favicon.js"
    );
    process.exit(1);
  }

  fs.mkdirSync(ASSETS_DIR, { recursive: true });

  const png32 = await sharp(iconSvg(32, "H")).png().toBuffer();
  const png16 = await sharp(iconSvg(16, "H")).png().toBuffer();
  const png180 = await sharp(iconSvg(180, "H")).png().toBuffer();

  fs.writeFileSync(path.join(PUBLIC_DIR, "favicon.ico"), await toIco([png16, png32]));
  fs.writeFileSync(path.join(ASSETS_DIR, "favicon-32.png"), png32);
  fs.writeFileSync(path.join(ASSETS_DIR, "apple-touch-icon.png"), png180);

  console.log("[favicon] wrote public/favicon.ico");
  console.log("[favicon] wrote public/assets/apple-touch-icon.png");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
