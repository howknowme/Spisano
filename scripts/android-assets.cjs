// Renders launcher icons and splash screens for android/ from the app logo.
// Run: node scripts/android-assets.cjs  (needs Playwright with Chromium)
const { chromium } = require('playwright');
const path = require('path');
const res = path.join(__dirname, '..', 'android', 'app', 'src', 'main', 'res');

const S = '<path d="M160 328c19 24 54 40 96 40 54 0 90-26 90-66 0-86-176-46-176-134 0-38 35-62 86-62 37 0 67 13 86 34" fill="none" stroke="#fff" stroke-width="42" stroke-linecap="round"/><circle cx="392" cy="120" r="34" fill="#f2a600"/>';
const full = (shape) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">${shape}${S}</svg>`;
const square = full('<rect width="512" height="512" rx="120" fill="#2f46d0"/>');
const round = full('<circle cx="256" cy="256" r="256" fill="#2f46d0"/>');
// adaptive foreground: 108dp canvas, logo inside the 66dp safe zone
const fg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><g transform="translate(256 256) scale(.62) translate(-256 -256)">${S}</g></svg>`;

const dens = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 };
const splash = {
  'drawable': [480, 320],
  'drawable-port-mdpi': [320, 480], 'drawable-port-hdpi': [480, 800], 'drawable-port-xhdpi': [720, 1280], 'drawable-port-xxhdpi': [960, 1600], 'drawable-port-xxxhdpi': [1280, 1920],
  'drawable-land-mdpi': [480, 320], 'drawable-land-hdpi': [800, 480], 'drawable-land-xhdpi': [1280, 720], 'drawable-land-xxhdpi': [1600, 960], 'drawable-land-xxxhdpi': [1920, 1280],
};

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage();
  const shot = async (svg, w, h, file, bg = 'transparent') => {
    await p.setViewportSize({ width: w, height: h });
    await p.setContent(`<style>html,body{margin:0;background:${bg};width:${w}px;height:${h}px;display:grid;place-items:center;overflow:hidden}</style>${svg}`);
    await p.screenshot({ path: file, omitBackground: bg === 'transparent' });
  };
  for (const [d, k] of Object.entries(dens)) {
    const dir = path.join(res, 'mipmap-' + d);
    const n = Math.round(48 * k), f = Math.round(108 * k);
    await shot(square.replace('<svg ', `<svg width="${n}" height="${n}" `), n, n, path.join(dir, 'ic_launcher.png'));
    await shot(round.replace('<svg ', `<svg width="${n}" height="${n}" `), n, n, path.join(dir, 'ic_launcher_round.png'));
    await shot(fg.replace('<svg ', `<svg width="${f}" height="${f}" `), f, f, path.join(dir, 'ic_launcher_foreground.png'));
  }
  for (const [dir, [w, h]] of Object.entries(splash)) {
    const s = Math.round(Math.min(w, h) * 0.3);
    await shot(square.replace('<svg ', `<svg width="${s}" height="${s}" `), w, h, path.join(res, dir, 'splash.png'), '#eef1f6');
  }
  await b.close();
  console.log('android assets rendered');
})();
