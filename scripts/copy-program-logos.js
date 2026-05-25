/**
 * Copy university logos from logo/ to public/assets/logos/ (slug filenames).
 * Run: node scripts/copy-program-logos.js
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const OUT = path.join(ROOT, "public", "assets", "logos");

const MAP = [
  ["ggu", path.join("GGU", "golden-gate-university.png"), "ggu.png"],
  ["edgewood", path.join("Edgewood", "edgewood university black.png"), "edgewood.png"],
  ["ljmu", path.join("LJMU", "Copy of LJMU.png"), "ljmu.png"],
  ["neu", path.join("NEU", "ymkvsdm3404cbsyjqnmi.webp"), "neu.webp"],
  ["uml", path.join("UML", "2025_UML_Logo_RGB.png"), "uml.png"],
  ["esgci", path.join("ESGCI", "egdk6ryu4dbnwtavecqi.webp"), "esgci.webp"],
  ["opj", path.join("OPJ", "OPJ LOGO.svg"), "opj.svg"],
];

fs.mkdirSync(OUT, { recursive: true });

for (const [, relSrc, outName] of MAP) {
  const src = path.join(ROOT, "logo", relSrc);
  const dest = path.join(OUT, outName);
  if (!fs.existsSync(src)) {
    console.warn("[skip] missing:", src);
    continue;
  }
  fs.copyFileSync(src, dest);
  console.log("[ok]", outName);
}

console.log("Done — logos in public/assets/logos/");
