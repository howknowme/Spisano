// Renders the PNG app icons (192, 512, maskable 512) from icon.svg. Run: node scripts/web-icons.cjs
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
(async () => {
  const svg = fs.readFileSync(path.join(root, 'icon.svg'), 'utf8');
  const b = await chromium.launch();
  const p = await b.newPage();
  for (const [name, size, maskable] of [['icon-192.png', 192, false], ['icon-512.png', 512, false], ['icon-maskable-512.png', 512, true]]) {
    await p.setViewportSize({ width: size, height: size });
    // maskable: full-bleed square, mark inside the 80% safe zone
    const inner = maskable
      ? svg.replace('rx="120"', 'rx="0"').replace(/(<path[\s\S]*<\/svg>)/, '<g transform="translate(51 51) scale(.8)">$1').replace('</svg>', '</g></svg>')
      : svg;
    await p.setContent(`<style>html,body{margin:0;background:transparent}</style>${inner.replace('<svg ', `<svg width="${size}" height="${size}" `)}`);
    await p.screenshot({ path: path.join(root, name), omitBackground: true });
  }
  await b.close();
  console.log('web icons rendered');
})();
