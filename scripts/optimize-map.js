/**
 * Rebuilds the web versions of the world map from a full-resolution source
 * image (PNG/JPG, ideally 2816x1504 like the original art):
 *   public/map.webp                  world map view (full resolution)
 *   public/og-image.jpg              1200x630 social share card
 *   public/images/map-backdrop.webp  small blurred backdrop on the sign-in screen
 *
 * Usage: node scripts/optimize-map.js <path-to-source-image>
 */
// sharp is installed as a dependency of Next.js
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const src = process.argv[2];
if (!src || !fs.existsSync(src)) {
  console.error('Usage: node scripts/optimize-map.js <path-to-source-image>');
  process.exit(1);
}

const publicDir = path.join(__dirname, '..', 'public');
const outputs = [
  ['map.webp', (img) => img.webp({ quality: 82, effort: 6 })],
  ['og-image.jpg', (img) => img.resize(1200, 630, { fit: 'cover' }).jpeg({ quality: 82, mozjpeg: true })],
  ['images/map-backdrop.webp', (img) => img.resize(960).webp({ quality: 50 })],
];

(async () => {
  const { width, height } = await sharp(src).metadata();
  console.log(`Source: ${src} (${width}x${height})`);
  for (const [name, transform] of outputs) {
    const out = path.join(publicDir, name);
    await transform(sharp(src)).toFile(out);
    console.log(`  public/${name.padEnd(26)} ${(fs.statSync(out).size / 1024).toFixed(0)} KB`);
  }
})();
