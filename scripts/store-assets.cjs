// Renders store screenshots (1080x1920), feature graphic (1024x500) and a square icon (512x512)
// into store/. Needs a local server on www/:  npm run build && python3 -m http.server 8767 -d www
// then: node scripts/store-assets.cjs
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const out = path.join(__dirname, '..', 'store');
const base = 'http://localhost:8767/';
// fonts inlined as data URIs: a page built with setContent cannot load them cross-origin
const fontsDir = path.join(__dirname, '..', 'fonts');
const fontsCss = fs.readFileSync(path.join(fontsDir, 'fonts.css'), 'utf8')
  .replace(/url\(\.\/([^)]+)\)/g, (_, f) => `url(data:font/woff2;base64,${fs.readFileSync(path.join(fontsDir, f)).toString('base64')})`);
const iconSvg = fs.readFileSync(path.join(__dirname, '..', 'icon.svg'), 'utf8');

const scenes = [
  { file: '1-overview', theme: 'light', view: 'overview', title: 'Сколько на самом деле уходит на подписки', sub: 'В месяц, в год и в день. С бюджетом и пересчётом валют' },
  { file: '2-reminders', theme: 'dark', view: 'overview', scrollTo: '.alerts', title: 'Напомним до списания', sub: 'И об окончании пробного периода, даже если приложение закрыто' },
  { file: '3-list', theme: 'light', view: 'subs', title: 'Все подписки и платежи в одном месте', sub: 'Поиск, фильтры, пауза в одно касание' },
  { file: '4-calendar', theme: 'dark', view: 'calendar', title: 'Календарь всех списаний', sub: 'Сумма за месяц и за каждый день' },
  { file: '5-details', theme: 'light', view: 'subs', open: 'Spotify', title: 'Пробные периоды и семейные тарифы', sub: 'И ручные платежи: ЖКХ, аренда, кредит' },
  { file: '6-forecast', theme: 'light', view: 'overview', scrollTo: '.chart', offset: 0, title: 'Прогноз на год вперёд', sub: 'Видно «тяжёлые» месяцы и расходы по категориям' },
];

(async () => {
  const b = await chromium.launch();
  const shots = {};
  for (const theme of ['light', 'dark']) {
    const ctx = await b.newContext({ locale: 'ru-RU', viewport: { width: 390, height: 690 }, deviceScaleFactor: 3, colorScheme: theme, serviceWorkers: 'block' });
    const p = await ctx.newPage();
    await p.goto(base + '#prefs');
    await p.waitForTimeout(300);
    await p.fill('#pref-budget', '15000'); await p.press('#pref-budget', 'Tab');
    await p.evaluate(() => { const s = JSON.parse(localStorage.getItem('subly:v1')); s.demo = false; localStorage.setItem('subly:v1', JSON.stringify(s)); });
    await p.reload(); await p.waitForTimeout(400);
    for (const sc of scenes.filter((x) => x.theme === theme)) {
      await p.goto(base + '#' + sc.view); await p.waitForTimeout(700);
      await p.mouse.move(1, 1);
      if (sc.scrollTo) await p.evaluate(([sel, off]) => { const el = document.querySelector(sel).closest('.card') || document.querySelector(sel); window.scrollTo(0, el.getBoundingClientRect().top + scrollY - 72 - (off || 0)); }, [sc.scrollTo, sc.offset]);
      if (sc.open) { await p.locator('.sub-main', { hasText: sc.open }).first().click(); await p.waitForTimeout(500); await p.evaluate(() => { const d = document.querySelector('.more'); if (d) { d.open = true; const body = document.querySelector('.sheet-body'); body.scrollTop = d.offsetTop - body.offsetTop - 260; } }); await p.mouse.move(1, 1); await p.waitForTimeout(200); }
      await p.waitForTimeout(300);
      shots[sc.file] = (await p.screenshot()).toString('base64');
      if (sc.open) await p.keyboard.press('Escape');
    }
    await ctx.close();
  }

  const page = await b.newPage({ viewport: { width: 1080, height: 1920 } });
  const frame = (sc) => `<!doctype html><style>${fontsCss}
    html,body{margin:0;width:1080px;height:1920px;overflow:hidden}
    body{background:${sc.theme === 'dark' ? '#121733' : '#2f46d0'};color:#fff;font-family:Manrope,sans-serif;position:relative}
    body::before{content:"";position:absolute;inset:0;background:radial-gradient(circle at 85% 8%,rgba(255,255,255,.14),transparent 40%)}
    .cap{position:absolute;left:90px;right:90px;top:120px}
    h1{font:700 76px/1.08 Unbounded,sans-serif;letter-spacing:-2px;margin:0;text-wrap:balance}
    p{font:600 36px/1.35 Manrope,sans-serif;margin:24px 0 0;opacity:.85;text-wrap:balance}
    .ph{position:absolute;left:130px;top:560px;width:820px;height:1451px;border-radius:56px;overflow:hidden;
        box-shadow:0 0 0 14px #0b0e1a,0 40px 80px rgba(0,0,0,.45)}
    .ph img{width:100%;display:block}
  </style><div class="cap"><h1>${sc.title}</h1><p>${sc.sub}</p></div>
  <div class="ph"><img src="data:image/png;base64,${shots[sc.file]}"></div>`;
  for (const sc of scenes) {
    await page.setContent(frame(sc)); await page.waitForTimeout(300);
    await page.screenshot({ path: path.join(out, 'screenshots', sc.file + '.png') });
  }
  // privacy slide
  await page.setContent(`<!doctype html><style>${fontsCss}
    html,body{margin:0;width:1080px;height:1920px;overflow:hidden}
    body{background:#141821;color:#fff;font-family:Manrope,sans-serif;display:flex;flex-direction:column;justify-content:center;padding:0 110px;box-sizing:border-box}
    .lock{width:200px;height:200px;border-radius:56px;background:#2f46d0;display:grid;place-items:center;margin-bottom:70px}
    h1{font:700 84px/1.08 Unbounded,sans-serif;letter-spacing:-2px;margin:0 0 70px}
    ul{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:38px}
    li{font:600 44px/1.3 Manrope,sans-serif;display:flex;gap:28px;align-items:flex-start}
    li::before{content:"";flex:none;width:44px;height:44px;margin-top:6px;border-radius:50%;background:#8796ff url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath d='M6 12.5l4 4 8-9' fill='none' stroke='%23141821' stroke-width='3' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E") center/70% no-repeat}
  </style>
  <div class="lock"><svg width="110" height="110" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="11" width="16" height="10" rx="2.5"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg></div>
  <h1>Ваши данные остаются у вас</h1>
  <ul><li>Без регистрации и аккаунтов</li><li>Не подключается к банку и не читает SMS</li><li>Всё хранится только на телефоне</li><li>Без рекламы и аналитики</li><li>Работает без интернета</li></ul>`);
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(out, 'screenshots', '7-privacy.png') });

  // feature graphic 1024x500
  await page.setViewportSize({ width: 1024, height: 500 });
  await page.setContent(`<!doctype html><style>${fontsCss}
    html,body{margin:0;width:1024px;height:500px;overflow:hidden}
    body{background:#2f46d0;color:#fff;font-family:Manrope,sans-serif;position:relative}
    .t{position:absolute;left:70px;top:110px;width:520px}
    .logo{display:flex;align-items:center;gap:18px;font:700 54px Unbounded,sans-serif;letter-spacing:-1px}
    h1{font:700 40px/1.15 Unbounded,sans-serif;letter-spacing:-1px;margin:34px 0 14px}
    p{font:600 24px/1.4 Manrope;margin:0;opacity:.85}
    .ph{position:absolute;right:70px;top:60px;width:300px;height:530px;border-radius:30px;overflow:hidden;box-shadow:0 0 0 8px #0b0e1a,0 30px 60px rgba(0,0,0,.4)}
    .ph img{width:100%;display:block}
  </style>
  <div class="t"><div class="logo"><span style="display:block;width:72px;height:72px;border-radius:17px;box-shadow:0 0 0 3px rgba(255,255,255,.4)">${iconSvg.replace('<svg ', '<svg width="72" height="72" ')}</span>Subly</div>
  <h1>Все подписки под контролем</h1><p>Напоминания до списания. Без регистрации, данные только на телефоне.</p></div>
  <div class="ph"><img src="data:image/png;base64,${shots['1-overview']}"></div>`);
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(out, 'feature-1024x500.png') });

  // square icon 512 (stores apply their own mask)
  await page.setViewportSize({ width: 512, height: 512 });
  const svg = fs.readFileSync(path.join(__dirname, '..', 'icon.svg'), 'utf8').replace('rx="120"', 'rx="0"').replace('<svg ', '<svg width="512" height="512" ');
  await page.setContent(`<style>html,body{margin:0}</style>${svg}`);
  await page.screenshot({ path: path.join(out, 'icon-512.png') });
  await b.close();
  console.log('store assets rendered');
})();
