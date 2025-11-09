import fs from 'fs';
import path from 'path';
import sharp from 'sharp';

const root = process.cwd();
const iconsDir = path.join(root, 'public', 'icons');
const svgPath = path.join(iconsDir, 'icon.svg');

const targets = [
  { file: 'apple-touch-icon.png', size: 180 },
  { file: 'icon-192.png', size: 192 },
  { file: 'icon-512.png', size: 512 }
];

export async function ensurePngIcons() {
  try {
    if (!fs.existsSync(svgPath)) return;
    if (!fs.existsSync(iconsDir)) fs.mkdirSync(iconsDir, { recursive: true });
    const svg = fs.readFileSync(svgPath);
    for (const t of targets) {
      const out = path.join(iconsDir, t.file);
      await sharp(svg, { density: 384 })
        .resize(t.size, t.size, { fit: 'contain', background: '#000000' })
        .png({ compressionLevel: 9 })
        .toFile(out);
    }
  } catch (e) {
    // Best-effort; if generation fails, server still runs with SVG icon
    // console.warn('Icon generation failed:', e);
  }
}
