// Phone screenshots for the landing page (site/img/*.jpg). Needs a local server on www/:
//   npm run build && python3 -m http.server 8771 -d www &   then: node scripts/site-shots.cjs
const { chromium } = require('playwright');
const path = require('path');
const out = path.join(__dirname, '..', 'site', 'img');
const base = 'http://localhost:8771/';
(async () => {
  const b = await chromium.launch();
  for (const theme of ['light', 'dark']) {
    const ctx = await b.newContext({ locale: 'ru-RU', viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, colorScheme: theme, serviceWorkers: 'block' });
    const p = await ctx.newPage();
    await p.goto(base + '#prefs'); await p.waitForTimeout(300);
    await p.fill('#pref-budget', '15000'); await p.press('#pref-budget', 'Tab');
    await p.evaluate(() => { const s = JSON.parse(localStorage.getItem('subly:v1')); s.demo = false; localStorage.setItem('subly:v1', JSON.stringify(s)); });
    await p.reload(); await p.waitForTimeout(400);
    const shot = async (name, view, fn) => {
      await p.goto(base + '#' + view); await p.waitForTimeout(900); await p.mouse.move(1, 1);
      if (fn) await fn(); await p.waitForTimeout(900);
      await p.screenshot({ path: path.join(out, `${name}-${theme}.jpg`), type: 'jpeg', quality: 86 });
      await p.keyboard.press('Escape').catch(() => {}); await p.waitForTimeout(300);
    };
    const toCard = (re) => p.evaluate((src) => { const h = [...document.querySelectorAll('.card h2')].find((x) => new RegExp(src).test(x.textContent)); const el = h.closest('.card'); scrollTo(0, el.getBoundingClientRect().top + scrollY - 76); }, re);
    await shot('overview', 'overview');
    await shot('reminders', 'overview', () => p.evaluate(() => { const el = document.querySelector('.alerts'); scrollTo(0, el.getBoundingClientRect().top + scrollY - 76); }));
    await shot('calendar', 'calendar');
    await shot('forecast', 'overview', () => toCard('Списания по месяцам'));
    await shot('family', 'subs', async () => {
      await p.locator('.sub-main', { hasText: 'Spotify' }).first().click(); await p.waitForTimeout(500);
      await p.evaluate(() => { const d = document.querySelector('.more'); d.open = true; const body = document.querySelector('.sheet-body'); const f = document.querySelector('#f-shared'); body.scrollTop = f.getBoundingClientRect().top - body.getBoundingClientRect().top + body.scrollTop - 260; });
    });
    await shot('bills', 'subs', async () => {
      await p.click('.seg-btn:has-text("Все")');
      await p.locator('.sub-main', { hasText: 'Коммунальные' }).first().click(); await p.waitForTimeout(500);
      await p.evaluate(() => { const body = document.querySelector('.sheet-body'); const h = document.querySelector('.history'); body.scrollTop = h.offsetTop - body.offsetTop - 140; });
    });
    await ctx.close();
  }
  await b.close();
  console.log('site screenshots rendered');
})();
