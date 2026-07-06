const sharp = require("sharp");
const path = require("path");
const fs = require("fs");

function buildSvg(size) {
  const s = size;
  const r = s / 2;
  const radius = s * 0.44;
  const cx = r;
  const cy = r;
  const cornerRadius = s * 0.22;

  // Globe parameters
  const gR = radius;           // globe radius
  const meridian1 = gR * 0.43; // inner meridian rx
  const meridian2 = gR * 0.86; // outer meridian rx
  const lat1 = cy - gR * 0.35; // upper latitude y
  const lat2 = cy + gR * 0.35; // lower latitude y

  // Japan dot position (upper right)
  const jx = cx + gR * 0.38;
  const jy = cy - gR * 0.28;
  const jDot = Math.max(s * 0.04, 3);
  const ring1 = jDot * 2.2;
  const ring2 = jDot * 3.6;

  // Stroke widths
  const sw = Math.max(s * 0.018, 1);
  const swThin = Math.max(s * 0.012, 0.7);

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}" viewBox="0 0 ${s} ${s}">
  <rect width="${s}" height="${s}" rx="${cornerRadius}" fill="#ffffff"/>
  <circle cx="${cx}" cy="${cy}" r="${gR}" fill="#dbeafe"/>
  <ellipse cx="${cx}" cy="${cy}" rx="${meridian1}" ry="${gR}" fill="none" stroke="#1d4ed8" stroke-width="${sw}"/>
  <ellipse cx="${cx}" cy="${cy}" rx="${meridian2}" ry="${gR}" fill="none" stroke="#1d4ed8" stroke-width="${swThin}"/>
  <line x1="${cx - gR}" y1="${cy}" x2="${cx + gR}" y2="${cy}" stroke="#1d4ed8" stroke-width="${sw}"/>
  <line x1="${cx - gR * 0.92}" y1="${lat1}" x2="${cx + gR * 0.92}" y2="${lat1}" stroke="#1d4ed8" stroke-width="${swThin}"/>
  <line x1="${cx - gR * 0.92}" y1="${lat2}" x2="${cx + gR * 0.92}" y2="${lat2}" stroke="#1d4ed8" stroke-width="${swThin}"/>
  <circle cx="${cx}" cy="${cy}" r="${gR}" fill="none" stroke="#1d4ed8" stroke-width="${sw}"/>
  <circle cx="${jx}" cy="${jy}" r="${ring2}" fill="none" stroke="#ef4444" stroke-width="${swThin}" opacity="0.3"/>
  <circle cx="${jx}" cy="${jy}" r="${ring1}" fill="none" stroke="#ef4444" stroke-width="${swThin}" opacity="0.6"/>
  <circle cx="${jx}" cy="${jy}" r="${jDot}" fill="#ef4444"/>
</svg>`;
}

const sizes = [16, 32, 48, 72, 96, 128, 144, 152, 192, 256, 384, 512];
const outDir = path.join(__dirname, "../public/icons");

(async () => {
  for (const size of sizes) {
    const svg = Buffer.from(buildSvg(size));
    const outPath = path.join(outDir, `icon-${size}x${size}.png`);
    await sharp(svg).png().toFile(outPath);
    console.log(`✓ ${outPath}`);
  }

  // apple-touch-icon (180x180)
  const appleSize = 180;
  const appleSvg = Buffer.from(buildSvg(appleSize));
  const applePath = path.join(__dirname, "../public/apple-touch-icon.png");
  await sharp(appleSvg).png().toFile(applePath);
  console.log(`✓ ${applePath}`);

  // favicon.ico — use 32x32 PNG (browsers accept PNG-based ico)
  const faviconSvg = Buffer.from(buildSvg(32));
  const faviconPath = path.join(__dirname, "../public/favicon.ico");
  await sharp(faviconSvg).png().toFile(faviconPath);
  console.log(`✓ ${faviconPath}`);

  console.log("\nAll icons generated.");
})();
