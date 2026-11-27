// End-to-end smoke test: node tests/e2e.mjs  (needs Playwright with Chromium)
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const root = fileURLToPath(new URL('..', import.meta.url));
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.webmanifest': 'application/manifest+json' };

const server = http.createServer(async (req, res) => {
  const path = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname)).replace(/^(\.\.[/\\])+/, '');
  try {
    const file = path === '/' || path === '\\' ? 'index.html' : path;
    const body = await readFile(join(root, file));
    res.writeHead(200, { 'content-type': types[extname(file)] || 'application/octet-stream' });
    res.end(body);
  } catch { res.writeHead(404); res.end(); }
}).listen(0);
const base = `http://localhost:${server.address().port}/`;

const browser = await chromium.launch();
const ctx = await browser.newContext({ locale: 'ru-RU', viewport: { width: 1200, height: 900 } });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error' && !/fonts\.g/.test(m.text())) errors.push(m.text()); });

try {
  await page.goto(base + '#overview');
  await page.waitForSelector('.hero');
  assert.match(await page.textContent('.brand-tag'), /Подписки/);

  // demo has an unpaid manual bill → mark it paid, then undo
  const bills = await page.locator('.alert-bill').count();
  assert.ok(bills >= 1, 'demo shows an unpaid bill');
  await page.locator('.alert-bill .btn').first().click();
  assert.equal(await page.locator('.alert-bill').count(), bills - 1);
  await page.click('#toast >> text=Отменить');
  assert.equal(await page.locator('.alert-bill').count(), bills);

  // lifetime card and history
  await page.waitForSelector('text=За всё время');
  await page.locator('.alert-bill .alert-text').first().click();
  await page.waitForSelector('.history-list .h-mark');
  await page.locator('.history-list .h-mark').first().click();
  assert.equal(await page.locator('.history-list .h-mark.is-paid').count() >= 1, true);
  await page.click('button[type=submit]');
  await page.waitForSelector('#sheet', { state: 'hidden' });

  // budget: tiny budget → over-budget alert
  await page.goto(base + '#prefs');
  await page.fill('#pref-budget', '100');
  await page.press('#pref-budget', 'Tab');
  await page.goto(base + '#overview');
  await page.waitForSelector('.alert-over');
  assert.match(await page.textContent('.hb-label'), /%/);

  // start clean: editing demo data keeps it, so reset storage to get the banner back
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.click('text=Очистить и начать');
  await page.waitForSelector('.empty');

  // add from template
  await page.click('#add-btn');
  await page.click('.chip:has-text("Netflix")');
  assert.equal(await page.inputValue('#f-price'), '15.49');
  await page.fill('#f-price', '10');
  await page.click('button[type=submit]');
  await page.waitForSelector('#sheet', { state: 'hidden' });
  await page.waitForSelector('.hero');
  const total = await page.textContent('.hero-num');
  assert.ok(total.includes('$') || /\d/.test(total), 'hero shows total');

  // validation
  await page.click('#add-btn');
  await page.click('button[type=submit]');
  assert.equal(await page.isVisible('#err-name'), true);
  await page.fill('#f-name', 'Спортзал');
  await page.fill('#f-price', '3000');
  await page.selectOption('#f-currency', 'RUB');
  await page.click('button[type=submit]');
  await page.waitForSelector('#sheet', { state: 'hidden' });

  // list + search
  await page.goto(base + '#subs');
  assert.equal(await page.locator('.sub').count(), 2);
  await page.fill('#search', 'спорт');
  assert.equal(await page.locator('.sub').count(), 1);
  await page.fill('#search', '');

  // pause → shows in paused filter
  await page.locator('.sub .icon-btn').first().click();
  await page.click('.seg-btn:has-text("На паузе")');
  assert.equal(await page.locator('.sub').count(), 1);
  await page.click('.seg-btn:has-text("Все")');

  // delete + undo
  await page.locator('.sub-main').first().click();
  await page.click('.sheet-foot >> text=Удалить');
  await page.waitForSelector('#sheet', { state: 'hidden' });
  assert.equal(await page.locator('.sub').count(), 1);
  await page.click('#toast >> text=Отменить');
  assert.equal(await page.locator('.sub').count(), 2);

  // persistence
  await page.reload();
  await page.goto(base + '#subs');
  await page.click('.seg-btn:has-text("Все")');
  assert.equal(await page.locator('.sub').count(), 2);

  // calendar renders month with events
  await page.goto(base + '#calendar');
  await page.waitForSelector('.cal-grid');

  // backup restore round trip via paste
  await page.goto(base + '#prefs');
  const backup = await page.evaluate(() => localStorage.getItem('subly:v1'));
  await page.fill('#paste-json', JSON.stringify({ subs: [{ name: 'Импорт', price: 5, currency: 'EUR', unit: 'month', every: 1, start: '2026-01-03' }] }));
  await page.click('text=Восстановить');
  await page.goto(base + '#subs');
  await page.click('.seg-btn:has-text("Все")');
  assert.equal(await page.locator('.sub').count(), 1);
  assert.ok(backup.includes('Спортзал'));

  // language + theme
  await page.goto(base + '#prefs');
  await page.selectOption('#pref-lang', 'en');
  assert.match(await page.textContent('.nav-top'), /Overview/);
  await page.selectOption('#pref-theme', 'dark');
  assert.equal(await page.getAttribute('html', 'data-theme'), 'dark');

  // no horizontal overflow on phone
  await page.setViewportSize({ width: 360, height: 780 });
  for (const v of ['overview', 'subs', 'calendar', 'prefs']) {
    await page.goto(base + '#' + v);
    await page.waitForTimeout(150);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, v + ' overflows');
  }

  assert.deepEqual(errors, []);
  console.log('e2e: all checks passed');
} finally {
  await browser.close();
  server.close();
}
