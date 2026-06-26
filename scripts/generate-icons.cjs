// 生成 App 图标：将 SVG 转为各尺寸 PNG
// 用法: npx sharp && node scripts/generate-icons.cjs
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const svgPath = path.join(__dirname, '..', 'assets', 'images', 'icon.svg');
const outDir = path.join(__dirname, '..', 'assets', 'images');

async function main() {
  const svg = fs.readFileSync(svgPath);

  const sizes = [48, 72, 96, 144, 192, 512, 1024];
  for (const s of sizes) {
    await sharp(svg).resize(s, s).png().toFile(path.join(outDir, `icon_${s}.png`));
  }
  await sharp(svg).resize(1024, 1024).png().toFile(path.join(outDir, 'icon.png'));
  await sharp(svg).resize(432, 432).png().toFile(path.join(outDir, 'android-icon-foreground.png'));
  await sharp({ create: { width: 432, height: 432, channels: 4, background: '#C29F9A' } })
    .png().toFile(path.join(outDir, 'android-icon-background.png'));
  await sharp(svg).resize(128, 128).png().toFile(path.join(outDir, 'splash-icon.png'));
  await sharp(svg).resize(48, 48).png().toFile(path.join(outDir, 'favicon.png'));

  console.log('Done: all icons generated in assets/images/');
}

main().catch(err => { console.error(err); process.exit(1); });
