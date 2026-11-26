// README screenshots (docs/*.png). Needs a local server on www/:
//   npm run build && python3 -m http.server 8766 -d www &   then: node scripts/docs-shots.cjs
const { chromium } = require('playwright');
const path = require('path');
const out = path.join(__dirname, '..', 'docs');
const base = 'http://localhost:8766/';
(async () => {
  const b = await chromium.launch();
  const setup = async (ctx) => {
    const p = await ctx.newPage();
    await p.goto(base + '#prefs'); await p.waitForTimeout(300);
    await p.fill('#pref-budget', '15000'); await p.press('#pref-budget', 'Tab');
    await p.evaluate(() => { const s = JSON.parse(localStorage.getItem('subly:v1')); s.demo = false; localStorage.setItem('subly:v1', JSON.stringify(s)); });
    await p.reload(); await p.waitForTimeout(300);
    return p;
  };
  let ctx = await b.newContext({ locale: 'ru-RU', viewport: { width: 1280, height: 860 }, deviceScaleFactor: 2, colorScheme: 'light', serviceWorkers: 'block' });
  let p = await setup(ctx);
  await p.goto(base + '#overview'); await p.waitForTimeout(1200);
  await p.screenshot({ path: path.join(out, 'overview.png') });
  await p.goto(base + '#calendar'); await p.waitForTimeout(600);
  await p.screenshot({ path: path.join(out, 'calendar.png') });
  await ctx.close();
  ctx = await b.newContext({ locale: 'ru-RU', viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, colorScheme: 'dark', serviceWorkers: 'block' });
  p = await setup(ctx);
  await p.goto(base + '#overview'); await p.waitForTimeout(1200);
  await p.screenshot({ path: path.join(out, 'phone-overview.png') });
  await p.goto(base + '#subs'); await p.waitForTimeout(600);
  await p.screenshot({ path: path.join(out, 'phone-list.png') });
  await p.locator('.sub-main').first().click(); await p.waitForTimeout(500);
  await p.screenshot({ path: path.join(out, 'phone-form.png') });
  await ctx.close();
  await b.close();
  console.log('docs screenshots rendered');
})();
