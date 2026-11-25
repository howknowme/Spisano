import * as C from './core.js';
import { STRINGS, CATEGORIES, TEMPLATES } from './i18n.js';
import * as N from './native.js';

// ---------- storage ----------

const KEY = 'subly:v1';
let storageOK = true;

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { storageOK = false; return null; }
}

function persist() {
  try { localStorage.setItem(KEY, JSON.stringify(state)); storageOK = true; }
  catch { storageOK = false; }
}

const DEFAULT_RATES = {
  USD: 1, EUR: 1.08, GBP: 1.27, RUB: 0.0125, KZT: 0.002, UAH: 0.024, BYN: 0.31,
  TRY: 0.029, CNY: 0.14, AMD: 0.0026, GEL: 0.37, UZS: 0.000079,
};

function defaultPrefs() {
  // Russian first; English only when the browser asks for it explicitly and nothing else.
  const langs = (navigator.languages || [navigator.language || 'ru']).map((l) => l.toLowerCase());
  const lang = langs.some((l) => l.startsWith('ru') || l.startsWith('uk') || l.startsWith('be') || l.startsWith('kk')) || !langs[0]?.startsWith('en') ? 'ru' : 'en';
  return {
    base: lang === 'ru' ? 'RUB' : 'USD', lang, theme: 'auto', weekStart: 1, remindDays: 1,
    rates: { ...DEFAULT_RATES }, ratesDate: '', notified: {}, budget: 0, remindHour: 10,
  };
}

const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);

let state = load();
if (!state || !Array.isArray(state.subs)) {
  state = { subs: demoSubs(), prefs: defaultPrefs(), demo: true };
} else {
  state.prefs = { ...defaultPrefs(), ...state.prefs, rates: { ...DEFAULT_RATES, ...(state.prefs?.rates || {}) } };
  state.subs = state.subs.map((s) => C.sanitizeSub(s, uid)).filter(Boolean);
}

const ui = {
  view: 'overview', q: '', status: 'active', cat: 'all', sort: 'next',
  calMonth: C.todayISO().slice(0, 7), calDay: C.todayISO(), chartTable: false,
  clearArmed: false, installEvt: null,
};

try {
  const saved = JSON.parse(sessionStorage.getItem('subly:ui') || '{}');
  for (const k of ['status', 'cat', 'sort', 'chartTable']) if (k in saved) ui[k] = saved[k];
} catch { /* ignore */ }

function saveUI() {
  try { sessionStorage.setItem('subly:ui', JSON.stringify({ status: ui.status, cat: ui.cat, sort: ui.sort, chartTable: ui.chartTable })); } catch { /* ignore */ }
}

function demoSubs() {
  const t = C.parseDate(C.todayISO());
  const d = (offset) => C.fmtISO(new Date(t.getFullYear(), t.getMonth(), t.getDate() + offset));
  const mk = (o) => C.sanitizeSub({ id: uid(), status: 'active', unit: 'month', every: 1, ...o }, uid);
  return [
    mk({ name: 'Яндекс Плюс', price: 399, currency: 'RUB', category: 'video', start: d(2), method: 'Карта •• 4821', url: 'https://plus.yandex.ru' }),
    mk({ name: 'Spotify Premium', price: 11.99, currency: 'USD', category: 'music', start: d(-21), shared: 2, notes: 'Duo, делю с сестрой' }),
    mk({ name: 'iCloud+ 200 ГБ', price: 2.99, currency: 'USD', category: 'cloud', start: d(9) }),
    mk({ name: 'ChatGPT Plus', price: 20, currency: 'USD', category: 'work', start: d(5), toCancel: true }),
    mk({ name: 'Microsoft 365', price: 99.99, currency: 'USD', category: 'work', unit: 'year', start: d(47) }),
    mk({ name: 'Okko', price: 399, currency: 'RUB', category: 'video', start: d(-10), trialEnd: d(3), notes: 'Пробный месяц по промокоду' }),
    mk({ name: 'Фитнес-клуб', price: 3500, currency: 'RUB', category: 'health', start: d(14), method: 'Наличные' }),
    mk({ name: 'Мобильная связь', price: 650, currency: 'RUB', category: 'home', start: d(1) }),
    mk({ name: 'Коммунальные услуги', price: 5200, currency: 'RUB', category: 'home', start: d(-3), manual: true, paid: [d(-33)], notes: 'Оплачиваю в приложении банка' }),
    mk({ name: 'Домашний интернет', price: 700, currency: 'RUB', category: 'home', start: d(18) }),
    mk({ name: 'Xbox Game Pass', price: 16.99, currency: 'USD', category: 'games', start: d(-30), status: 'paused', endedAt: d(-2) }),
    mk({ name: 'Литрес', price: 399, currency: 'RUB', category: 'learning', start: d(22), toCancel: true }),
  ];
}

// ---------- helpers ----------

const $ = (sel, root = document) => root.querySelector(sel);
const T = () => STRINGS[state.prefs.lang] || STRINGS.ru;
const locale = () => (state.prefs.lang === 'ru' ? 'ru-RU' : 'en-US');
const today = () => C.todayISO();

/** Element builder. Text children become text nodes, so user data never hits innerHTML. */
function h(tag, props, ...children) {
  const el = tag === 'svg' || props?.svg ? document.createElementNS('http://www.w3.org/2000/svg', tag) : document.createElement(tag);
  if (props) {
    for (const [k, v] of Object.entries(props)) {
      if (v == null || v === false || k === 'svg') continue;
      if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
      else if (k === 'class') el.setAttribute('class', v);
      else if (k === 'style' && typeof v === 'object') {
        for (const [sk, sv] of Object.entries(v)) {
          if (sk.startsWith('--')) el.style.setProperty(sk, sv); else el.style[sk] = sv;
        }
      }
      else if (k === 'dataset') Object.assign(el.dataset, v);
      else if (k in el && !(el instanceof SVGElement) && typeof v !== 'string') el[k] = v;
      else el.setAttribute(k, v === true ? '' : v);
    }
  }
  for (const c of children.flat(Infinity)) {
    if (c == null || c === false) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return el;
}

const s = (tag, attrs, ...children) => h(tag, { ...attrs, svg: true }, ...children);

const ICONS = {
  plus: 'M12 5v14M5 12h14',
  grid: 'M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z',
  list: 'M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01',
  cal: 'M4 6h16v14H4zM4 10h16M8 3v4M16 3v4',
  gear: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z',
  left: 'M15 18l-6-6 6-6',
  right: 'M9 18l6-6-6-6',
  close: 'M6 6l12 12M18 6L6 18',
  search: 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM21 21l-4.3-4.3',
  bell: 'M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a1.9 1.9 0 0 0 3.4 0',
  pause: 'M9 5v14M15 5v14',
  play: 'M7 4l13 8-13 8z',
  ext: 'M14 4h6v6M20 4l-9 9M18 14v6H4V6h6',
  copy: 'M9 9h11v11H9zM5 15H4V4h11v1',
  trash: 'M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13',
  down: 'M12 4v12M6 11l6 6 6-6M4 20h16',
  up: 'M12 20V8M6 13l6-6 6 6M4 4h16',
  clock: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7v5l3 2',
  spark: 'M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5L18 18M6 18l2.5-2.5M15.5 8.5L18 6',
};

function icon(name, size = 18) {
  return s('svg', { viewBox: '0 0 24 24', width: size, height: size, fill: 'none', stroke: 'currentColor', 'stroke-width': 1.8, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'aria-hidden': 'true', class: 'ico' },
    s('path', { d: ICONS[name] }));
}

function money(v, cur = state.prefs.base, { compact = false } = {}) {
  const abs = Math.abs(v);
  const frac = abs >= 100 || compact ? 0 : (Math.round(v * 100) % 100 === 0 ? 0 : 2);
  try {
    return new Intl.NumberFormat(locale(), {
      style: 'currency', currency: cur, currencyDisplay: 'narrowSymbol',
      minimumFractionDigits: frac, maximumFractionDigits: frac,
      ...(compact && abs >= 10000 ? { notation: 'compact', maximumFractionDigits: 1, minimumFractionDigits: 0 } : {}),
    }).format(v);
  } catch {
    return `${v.toFixed(frac)} ${cur}`;
  }
}

function fmtDate(iso, { weekday = false, year } = {}) {
  const d = C.parseDate(iso);
  const showYear = year ?? d.getFullYear() !== new Date().getFullYear();
  return new Intl.DateTimeFormat(locale(), { day: 'numeric', month: 'long', ...(showYear ? { year: 'numeric' } : {}), ...(weekday ? { weekday: 'short' } : {}) }).format(d);
}

function relDay(iso) {
  const n = C.diffDays(C.parseDate(today()), C.parseDate(iso));
  if (n === 0) return T().today;
  if (n === 1) return T().tomorrow;
  if (n > 1) return T().inDays(n);
  return T().daysAgo(-n);
}

function nextLabel(iso) {
  const n = C.diffDays(C.parseDate(today()), C.parseDate(iso));
  if (n <= 7) return relDay(iso);
  const d = C.parseDate(iso);
  return new Intl.DateTimeFormat(locale(), { day: 'numeric', month: 'short', ...(d.getFullYear() !== new Date().getFullYear() ? { year: '2-digit' } : {}) }).format(d);
}

function monthName(key, style = 'long') {
  const [y, m] = key.split('-').map(Number);
  return new Intl.DateTimeFormat(locale(), { month: style, ...(style === 'long' ? { year: 'numeric' } : {}) }).format(new Date(y, m - 1, 1));
}

function cycleText(sub) {
  return T().cycleLabel(sub.unit, sub.every);
}

function subColorVar(sub) {
  return sub.color || `var(--c-${CATEGORIES.includes(sub.category) ? sub.category : 'other'})`;
}

function avatar(sub, size = 40) {
  const letter = (sub.name.match(/[\p{L}\p{N}]/u) || ['?'])[0].toUpperCase();
  return h('span', { class: 'avatar', style: { '--c': subColorVar(sub), width: size + 'px', height: size + 'px', fontSize: Math.round(size * 0.42) + 'px' }, 'aria-hidden': 'true' }, letter);
}

function subById(id) { return state.subs.find((x) => x.id === id); }

function commit({ keepDemo = false } = {}) {
  if (!keepDemo) state.demo = false;
  persist();
  render();
  scheduleNative();
}

// Android: hand upcoming reminders to the system so they fire with the app closed.
let nativeTimer;
function scheduleNative() {
  if (!N.isNative()) return;
  clearTimeout(nativeTimer);
  nativeTimer = setTimeout(() => {
    const t = T();
    const td = today();
    const hour = Number(state.prefs.remindHour ?? 10);
    const at = (iso, daysBefore) => { const d = C.parseDate(iso); return new Date(d.getFullYear(), d.getMonth(), d.getDate() - daysBefore, hour, 0, 0); };
    const items = [];
    for (const e of C.upcoming(state.subs, td, 120)) {
      const sub = subById(e.id);
      if (e.kind === 'trial') {
        items.push({ key: `${sub.id}:${e.date}:trial`, at: at(e.date, 1), title: t.trialEnds, body: t.alertTrial(sub.name, fmtDate(e.date)) });
        continue;
      }
      const amount = money(C.share(sub), sub.currency);
      const days = state.prefs.remindDays;
      items.push({ key: `${sub.id}:${e.date}:pay`, at: at(e.date, days), title: t.notifTitle,
        body: `${t.alertPay(sub.name, days === 0 ? t.today : fmtDate(e.date))} · ${amount}` });
      if (sub.manual && days > 0) {
        items.push({ key: `${sub.id}:${e.date}:due`, at: at(e.date, 0), title: t.notifTitle, body: `${t.manual.due(sub.name)} · ${amount}` });
      }
    }
    items.sort((a, b) => a.at - b.at);
    N.syncReminders(items, t.prefs.channelName);
  }, 400);
}

// ---------- toast ----------

let toastTimer;
function toast(msg, action) {
  const box = $('#toast');
  box.replaceChildren(h('span', null, msg), action ? h('button', { class: 'btn btn-text', type: 'button', onclick: () => { action.fn(); box.hidden = true; } }, action.label) : '');
  box.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { box.hidden = true; }, action ? 6000 : 2600);
}

// ---------- theme / language ----------

function applyTheme() {
  const r = document.documentElement;
  if (state.prefs.theme === 'auto') r.removeAttribute('data-theme');
  else r.setAttribute('data-theme', state.prefs.theme);
  r.lang = state.prefs.lang;
  document.title = 'Subly';
  if (N.isNative()) {
    const bg = getComputedStyle(document.body).backgroundColor;
    const [rr, gg, bb] = (bg.match(/\d+/g) || [238, 241, 246]).map(Number);
    const hex = '#' + [rr, gg, bb].map((v) => v.toString(16).padStart(2, '0')).join('');
    const key = hex + state.prefs.theme;
    if (key !== ui.statusBarKey) { ui.statusBarKey = key; N.setStatusBar(hex, (rr + gg + bb) / 3 < 128); }
  }
}

// ---------- routing ----------

const VIEWS = ['overview', 'subs', 'calendar', 'prefs'];

function route() {
  const v = location.hash.replace('#', '');
  ui.view = VIEWS.includes(v) ? v : 'overview';
  render();
  window.scrollTo({ top: 0 });
}

function go(view) {
  if (location.hash !== '#' + view) location.hash = view;
  else route();
}

// ---------- render: shell ----------

function render() {
  applyTheme();
  const t = T();
  const tot = C.totals(state.subs, state.prefs.base, state.prefs.rates, today());

  // header summary
  $('#brand-tag').textContent = t.tagline;
  $('#head-total').textContent = money(tot.month);
  $('#head-total-label').textContent = t.perMonth;
  $('#add-btn-label').textContent = t.add;
  $('#add-btn').setAttribute('aria-label', t.addSub);

  // navs
  for (const nav of document.querySelectorAll('[data-nav]')) {
    nav.replaceChildren(...VIEWS.map((v) => h('a', {
      href: '#' + v, class: 'nav-link', 'aria-current': ui.view === v ? 'page' : null,
    }, icon({ overview: 'grid', subs: 'list', calendar: 'cal', prefs: 'gear' }[v], 20), h('span', null, t.nav[v]))));
  }

  const main = $('#view');
  main.replaceChildren();
  if (!storageOK) main.append(h('div', { class: 'banner banner-warn', role: 'status' }, t.prefs.storageWarn));
  if (state.demo) {
    main.append(h('div', { class: 'banner', role: 'status' },
      h('span', null, t.demoBanner),
      h('span', { class: 'banner-actions' },
        h('button', { class: 'btn btn-small', type: 'button', onclick: () => { state.subs = []; state.demo = false; persist(); render(); } }, t.demoClear),
        h('button', { class: 'btn btn-small btn-ghost', type: 'button', onclick: () => { state.demo = false; persist(); render(); } }, t.demoKeep))));
  }
  const views = { overview: viewOverview, subs: viewSubs, calendar: viewCalendar, prefs: viewPrefs };
  main.append(views[ui.view]());
  main.setAttribute('aria-label', t.nav[ui.view]);
}

// ---------- view: overview ----------

function viewOverview() {
  const t = T();
  const { base, rates, remindDays } = state.prefs;
  const td = today();
  const tot = C.totals(state.subs, base, rates, td);
  const wrap = h('div', { class: 'stack' });

  if (!state.subs.length) {
    wrap.append(emptyState());
    return wrap;
  }

  // hero
  const toCancelN = state.subs.filter((x) => x.toCancel && C.isBilling(x, td)).length;
  wrap.append(h('section', { class: 'hero' },
    h('div', { class: 'hero-main' },
      h('p', { class: 'eyebrow' }, t.activeCount(tot.count)),
      h('p', { class: 'hero-num' }, money(tot.month)),
      h('p', { class: 'hero-sub' }, t.perMonth),
      budgetMeter(tot.month)),
    h('dl', { class: 'hero-facts' },
      h('div', null, h('dt', null, t.perYear), h('dd', null, money(tot.year))),
      h('div', null, h('dt', null, t.perDay), h('dd', null, money(tot.day))),
      tot.cancelSave > 0 ? h('div', { class: 'fact-save' }, h('dt', null, t.savings), h('dd', null, money(tot.cancelSave * 12), h('small', null, ' ' + t.perYear)), h('p', { class: 'fact-hint' }, t.savingsHint(toCancelN))) : null,
      tot.trialAfter > 0 ? h('div', null, h('dt', null, t.trialAfter), h('dd', null, '+' + money(tot.trialAfter), h('small', null, ' ' + t.perMonth))) : null)));

  // alerts: due within remindDays, trials ending within 3 days
  const alerts = C.upcoming(state.subs, td, Math.max(remindDays, 3)).filter((e) => {
    const n = C.diffDays(C.parseDate(td), C.parseDate(e.date));
    return e.kind === 'trial' ? n <= 3 : n <= remindDays;
  });
  const bills = C.unpaid(state.subs, td);
  const budget = Number(state.prefs.budget) || 0;
  if (alerts.length || bills.length || (budget > 0 && tot.month > budget)) {
    wrap.append(h('section', { class: 'alerts', 'aria-label': t.prefs.reminders },
      budget > 0 && tot.month > budget
        ? h('button', { type: 'button', class: 'alert alert-over', onclick: () => { ui.sort = 'price'; ui.status = 'active'; ui.cat = 'all'; saveUI(); go('subs'); } },
          icon('spark'), h('span', null, t.budget.over(money(tot.month - budget))))
        : null,
      bills.map((e) => {
        const sub = subById(e.id);
        return h('div', { class: 'alert alert-bill' + (e.kind === 'overdue' ? ' is-overdue' : '') },
          icon('clock'),
          h('button', { type: 'button', class: 'alert-text', onclick: () => openForm(sub) },
            e.kind === 'due' ? t.manual.due(sub.name) : t.manual.overdue(sub.name, fmtDate(e.date))),
          h('strong', { class: 'num' }, money(C.share(sub), sub.currency)),
          h('button', { type: 'button', class: 'btn btn-small', onclick: () => markPaid(sub, e.date) }, t.manual.markPaid));
      }),
      alerts.map((e) => {
        const sub = subById(e.id);
        const when = relDay(e.date);
        return h('button', { type: 'button', class: 'alert ' + (e.kind === 'trial' ? 'alert-trial' : 'alert-pay'), onclick: () => openForm(sub) },
          icon(e.kind === 'trial' ? 'clock' : 'bell'),
          h('span', null, e.kind === 'trial' ? t.alertTrial(sub.name, when) : t.alertPay(sub.name, when)),
          e.kind === 'pay' ? h('strong', { class: 'num' }, money(C.convert(C.share(sub), sub.currency, base, rates))) : null);
      })));
  }

  wrap.append(h('div', { class: 'grid-2' },
    h('div', { class: 'stack' }, upcomingCard(), topCard(), lifetimeCard()),
    h('div', { class: 'stack' }, forecastCard(), categoryCard())));
  return wrap;
}

function budgetMeter(month) {
  const t = T();
  const budget = Number(state.prefs.budget) || 0;
  if (!(budget > 0)) {
    return h('a', { class: 'hero-budget-set', href: '#prefs', onclick: () => setTimeout(() => $('#pref-budget')?.focus(), 50) }, '+ ' + t.budget.set);
  }
  const pct = Math.round((month / budget) * 100);
  const over = month > budget;
  return h('div', { class: 'hero-budget' + (over ? ' is-over' : '') },
    h('div', { class: 'hb-track', role: 'meter', 'aria-valuemin': 0, 'aria-valuemax': 100, 'aria-valuenow': Math.min(pct, 100), 'aria-label': t.budget.of(pct, money(budget)) },
      h('span', { class: 'hb-fill', style: { width: Math.min(100, pct) + '%' } })),
    h('p', { class: 'hb-label' }, t.budget.of(pct, money(budget)), over ? '' : ` · ${t.budget.left(money(budget - month))}`));
}

function markPaid(sub, date) {
  const t = T();
  sub.paid = C.togglePaid(sub, date);
  commit();
  toast(t.manual.marked(sub.name), { label: t.undo, fn: () => { sub.paid = C.togglePaid(sub, date); commit(); } });
}

function lifetimeCard() {
  const t = T();
  const { base, rates } = state.prefs;
  const l = C.lifetime(state.subs, base, rates, today());
  const card = h('section', { class: 'card' }, h('header', { class: 'card-head' },
    h('div', null, h('h2', null, t.lifetime.title), h('p', { class: 'card-hint' }, t.lifetime.hint)),
    h('span', { class: 'card-meta num' }, money(l.total))));
  if (!l.rows.length) { card.append(h('p', { class: 'muted' }, t.lifetime.empty)); return card; }
  card.append(h('ol', { class: 'rank' }, l.rows.slice(0, 5).map((r) => {
    const sub = subById(r.id);
    return h('li', null, h('button', { type: 'button', class: 'rank-btn', onclick: () => openForm(sub) },
      avatar(sub, 32),
      h('span', { class: 'rank-body' }, h('span', { class: 'rank-name' }, sub.name),
        h('span', { class: 'rank-meta' }, `${t.lifetime.count(r.count)} · ${t.lifetime.since(fmtDate(r.since, { year: true }))}`)),
      h('span', { class: 'rank-val num' }, money(r.value))));
  })));
  return card;
}

function emptyState() {
  const t = T();
  return h('section', { class: 'empty' },
    h('div', { class: 'empty-art', 'aria-hidden': 'true' },
      ...['video', 'music', 'cloud', 'work'].map((c, i) => h('span', { style: { '--c': `var(--c-${c})`, '--i': i } }))),
    h('h2', null, t.emptyTitle),
    h('p', null, t.emptyText),
    h('div', { class: 'row-wrap center' },
      h('button', { class: 'btn btn-primary', type: 'button', onclick: () => openForm() }, icon('plus'), t.addSub),
      h('button', { class: 'btn', type: 'button', onclick: () => { state.subs = demoSubs(); state.demo = true; persist(); render(); } }, t.prefs.loadDemo)));
}

function upcomingCard() {
  const t = T();
  const { base, rates } = state.prefs;
  const events = C.upcoming(state.subs, today(), 30);
  const card = h('section', { class: 'card' }, h('header', { class: 'card-head' }, h('h2', null, t.upcoming)));
  if (!events.length) { card.append(h('p', { class: 'muted' }, t.upcomingEmpty)); return card; }
  const total = events.filter((e) => e.kind === 'pay').reduce((acc, e) => {
    const sub = subById(e.id); return acc + C.convert(C.share(sub), sub.currency, base, rates);
  }, 0);
  card.querySelector('.card-head').append(h('span', { class: 'card-meta num' }, money(total)));
  const list = h('ol', { class: 'timeline' });
  for (const e of events.slice(0, 12)) {
    const sub = subById(e.id);
    const n = C.diffDays(C.parseDate(today()), C.parseDate(e.date));
    list.append(h('li', { class: 'tl-item' + (n <= state.prefs.remindDays ? ' is-soon' : '') },
      h('button', { type: 'button', class: 'tl-btn', onclick: () => openForm(sub) },
        h('span', { class: 'tl-date' }, h('span', { class: 'tl-day num' }, String(C.parseDate(e.date).getDate())), h('span', { class: 'tl-mon' }, monthName(e.date.slice(0, 7), 'short'))),
        avatar(sub, 32),
        h('span', { class: 'tl-body' }, h('span', { class: 'tl-name' }, sub.name), h('span', { class: 'tl-when' }, e.kind === 'trial' ? `${t.trialEnds} · ${relDay(e.date)}` : relDay(e.date))),
        sub.manual && e.kind === 'pay' ? h('span', { class: 'badge' }, t.manual.badge) : null,
        e.kind === 'pay'
          ? h('span', { class: 'tl-amt num' }, money(C.share(sub), sub.currency))
          : h('span', { class: 'badge badge-trial' }, t.trialBadge))));
  }
  card.append(list);
  if (events.length > 12) card.append(h('a', { class: 'link-more', href: '#calendar' }, `+${events.length - 12} → ${t.nav.calendar}`));
  return card;
}

function niceTicks(max, count = 3) {
  if (max <= 0) return [0];
  const raw = max / count;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((x) => x >= raw) || raw;
  const ticks = [];
  for (let v = 0; v <= max + step * 0.001; v += step) ticks.push(v);
  if (ticks[ticks.length - 1] < max) ticks.push(ticks[ticks.length - 1] + step);
  return ticks;
}

function forecastCard() {
  const t = T();
  const { base, rates } = state.prefs;
  const data = C.forecast(state.subs, base, rates, today(), 12);
  const avg = data.reduce((a, b) => a + b.total, 0) / data.length;
  const card = h('section', { class: 'card' },
    h('header', { class: 'card-head' },
      h('div', null, h('h2', null, t.forecast), h('p', { class: 'card-hint' }, t.forecastHint)),
      h('button', { type: 'button', class: 'btn btn-small btn-ghost', 'aria-pressed': String(ui.chartTable), onclick: () => { ui.chartTable = !ui.chartTable; saveUI(); render(); } }, ui.chartTable ? t.showChart : t.showTable)));

  if (ui.chartTable) {
    card.append(h('div', { class: 'table-wrap' }, h('table', { class: 'table' },
      h('thead', null, h('tr', null, h('th', null, t.month), h('th', { class: 'r' }, t.payments), h('th', { class: 'r' }, t.amount))),
      h('tbody', null, data.map((b) => h('tr', null, h('td', null, monthName(b.key)), h('td', { class: 'r num' }, String(b.items.length)), h('td', { class: 'r num' }, money(b.total))))))));
    return card;
  }

  const chart = h('div', { class: 'chart' });
  const tip = h('div', { class: 'tip', hidden: true, role: 'status' });
  chart.append(tip);
  card.append(chart);

  const draw = () => {
    const W = Math.max(280, chart.clientWidth || 520);
    const H = 210, padL = 52, padR = 8, padT = 12, padB = 28;
    const max = Math.max(...data.map((d) => d.total), 1);
    const ticks = niceTicks(max);
    const top = ticks[ticks.length - 1];
    const y = (v) => padT + (H - padT - padB) * (1 - v / top);
    const bw = (W - padL - padR) / data.length;
    const barW = Math.max(6, Math.min(30, bw - 6));
    const svg = s('svg', { viewBox: `0 0 ${W} ${H}`, width: W, height: H, role: 'img', 'aria-label': `${t.forecast}: ${data.map((b) => `${monthName(b.key, 'short')} ${money(b.total)}`).join(', ')}` });
    for (const tk of ticks) {
      svg.append(s('line', { x1: padL, x2: W - padR, y1: y(tk), y2: y(tk), class: tk === 0 ? 'axis' : 'grid' }));
      svg.append(s('text', { x: padL - 8, y: y(tk) + 4, 'text-anchor': 'end', class: 'tick' }, money(tk, base, { compact: true })));
    }
    if (avg > 0) {
      svg.append(s('line', { x1: padL, x2: W - padR, y1: y(avg), y2: y(avg), class: 'avg' }));
    }
    data.forEach((b, i) => {
      const cx = padL + bw * i + bw / 2;
      const yy = y(b.total), base0 = y(0);
      const hgt = Math.max(0, base0 - yy);
      const r = Math.min(4, barW / 2, hgt);
      const x0 = cx - barW / 2;
      const path = hgt > 0
        ? `M${x0},${base0} V${yy + r} Q${x0},${yy} ${x0 + r},${yy} H${x0 + barW - r} Q${x0 + barW},${yy} ${x0 + barW},${yy + r} V${base0} Z`
        : '';
      const g = s('g', { class: 'bar-g', tabindex: 0, role: 'button', 'aria-label': `${monthName(b.key)}: ${money(b.total)}` });
      g.append(s('rect', { x: padL + bw * i, y: padT, width: bw, height: H - padT - padB, class: 'hit', fill: 'transparent' }));
      if (path) g.append(s('path', { d: path, class: 'bar' + (b.total > avg * 1.25 ? ' bar-peak' : '') }));
      const showLabel = data.length <= 6 || W > 560 || i % 2 === 0;
      if (showLabel) g.append(s('text', { x: cx, y: H - 9, 'text-anchor': 'middle', class: 'tick' + (i === 0 ? ' tick-now' : '') }, monthName(b.key, 'short').replace('.', '')));
      const show = () => {
        tip.replaceChildren(h('strong', { class: 'num' }, money(b.total)), h('span', null, monthName(b.key)),
          ...b.items.slice(0, 5).map((it) => h('span', { class: 'tip-row' }, h('i', { style: { background: subColorVar(subById(it.id)) } }), `${subById(it.id).name} · ${C.parseDate(it.date).getDate()}`)),
          b.items.length > 5 ? h('span', { class: 'tip-row muted' }, `+${b.items.length - 5}`) : '');
        tip.hidden = false;
        const left = Math.min(Math.max(cx - 90, 0), W - 180);
        tip.style.left = left + 'px';
        tip.style.top = Math.max(0, yy - 12) + 'px';
        g.classList.add('is-hover');
      };
      const hide = () => { tip.hidden = true; g.classList.remove('is-hover'); };
      g.addEventListener('pointerenter', show);
      g.addEventListener('pointerleave', hide);
      g.addEventListener('focus', show);
      g.addEventListener('blur', hide);
      g.addEventListener('click', () => { ui.calMonth = b.key; ui.calDay = b.items[0]?.date || b.from; go('calendar'); });
      g.addEventListener('keydown', (ev) => { if (ev.key === 'Enter') g.dispatchEvent(new Event('click')); });
      svg.append(g);
    });
    chart.querySelector('svg')?.remove();
    chart.prepend(svg);
  };
  requestAnimationFrame(draw);
  chartResizers.add(draw);
  card.append(h('p', { class: 'card-foot' }, h('span', { class: 'legend-avg' }), ` ${state.prefs.lang === 'ru' ? 'в среднем' : 'average'} ${money(avg)} · ${t.perYear} ${money(data.reduce((a, b) => a + b.total, 0))}`));
  return card;
}

const chartResizers = new Set();
let resizeRaf;
window.addEventListener('resize', () => {
  cancelAnimationFrame(resizeRaf);
  resizeRaf = requestAnimationFrame(() => { for (const f of chartResizers) if (document.contains(document.querySelector('.chart'))) f(); });
});

function categoryCard() {
  const t = T();
  const { base, rates } = state.prefs;
  const rows = C.byCategory(state.subs, base, rates, today());
  const sum = rows.reduce((a, r) => a + r.value, 0) || 1;
  const max = Math.max(...rows.map((r) => r.value), 1);
  const card = h('section', { class: 'card' }, h('header', { class: 'card-head' }, h('div', null, h('h2', null, t.byCategory), h('p', { class: 'card-hint' }, t.byCategoryHint))));
  if (!rows.length) { card.append(h('p', { class: 'muted' }, '—')); return card; }
  card.append(h('ul', { class: 'meters' }, rows.map((r) => h('li', { class: 'meter' },
    h('button', { type: 'button', class: 'meter-btn', onclick: () => { ui.cat = r.category; ui.status = 'active'; saveUI(); go('subs'); } },
      h('span', { class: 'meter-name' }, t.categories[r.category] || r.category),
      h('span', { class: 'meter-val num' }, money(r.value), h('small', null, ` ${Math.round((r.value / sum) * 100)}%`)),
      h('span', { class: 'meter-track' }, h('span', { class: 'meter-fill', style: { width: `${Math.max(2, (r.value / max) * 100)}%`, background: `var(--c-${CATEGORIES.includes(r.category) ? r.category : 'other'})` } })))))));
  return card;
}

function topCard() {
  const t = T();
  const { base, rates } = state.prefs;
  const top = state.subs.filter((x) => C.isBilling(x, today()))
    .map((x) => ({ sub: x, m: C.monthlyCost(x, base, rates) }))
    .sort((a, b) => b.m - a.m).slice(0, 5);
  const card = h('section', { class: 'card' }, h('header', { class: 'card-head' }, h('h2', null, t.topExpensive)));
  if (!top.length) { card.append(h('p', { class: 'muted' }, '—')); return card; }
  card.append(h('ol', { class: 'rank' }, top.map(({ sub, m }) => h('li', null,
    h('button', { type: 'button', class: 'rank-btn', onclick: () => openForm(sub) },
      avatar(sub, 32),
      h('span', { class: 'rank-body' }, h('span', { class: 'rank-name' }, sub.name), h('span', { class: 'rank-meta' }, `${money(Number(sub.price), sub.currency)} · ${cycleText(sub)}`)),
      h('span', { class: 'rank-val num' }, money(m), h('small', null, '/' + t.cycleShort.month)),
      sub.toCancel ? h('span', { class: 'badge badge-cancel' }, t.toCancelBadge) : null)))));
  return card;
}

// ---------- view: subscriptions ----------

function viewSubs() {
  const t = T();
  const { base, rates } = state.prefs;
  const td = today();
  const wrap = h('div', { class: 'stack' });

  const counts = { all: state.subs.length, active: 0, paused: 0, cancelled: 0 };
  for (const x of state.subs) counts[x.status]++;

  const search = h('input', {
    id: 'search', type: 'search', class: 'input', placeholder: t.search, value: ui.q, autocomplete: 'off', 'aria-label': t.search,
    oninput: (e) => { ui.q = e.target.value; renderList(); },
  });

  const statusSeg = h('div', { class: 'seg', role: 'group', 'aria-label': t.form.status },
    ['active', 'paused', 'cancelled', 'all'].map((st) => h('button', {
      type: 'button', class: 'seg-btn', 'aria-pressed': String(ui.status === st),
      onclick: () => { ui.status = st; saveUI(); render(); },
    }, st === 'all' ? t.filterAll : t['status' + st[0].toUpperCase() + st.slice(1)], h('span', { class: 'seg-count num' }, String(counts[st])))));

  const catSel = h('select', { id: 'filter-cat', class: 'input input-select', 'aria-label': t.form.category, onchange: (e) => { ui.cat = e.target.value; saveUI(); renderList(); } },
    h('option', { value: 'all' }, t.allCategories),
    CATEGORIES.map((c) => h('option', { value: c, selected: ui.cat === c }, t.categories[c])));
  const sortSel = h('select', { id: 'sort', class: 'input input-select', 'aria-label': 'Sort', onchange: (e) => { ui.sort = e.target.value; saveUI(); renderList(); } },
    [['next', t.sortNext], ['price', t.sortPrice], ['name', t.sortName]].map(([v, l]) => h('option', { value: v, selected: ui.sort === v }, l)));

  wrap.append(h('div', { class: 'toolbar' },
    h('label', { class: 'search' }, icon('search'), search),
    h('div', { class: 'toolbar-row' }, statusSeg, catSel, sortSel)));

  const listBox = h('div', { class: 'sub-list-wrap' });
  wrap.append(listBox);

  function renderList() {
    const q = ui.q.trim().toLowerCase();
    let items = state.subs.filter((x) =>
      (ui.status === 'all' || x.status === ui.status) &&
      (ui.cat === 'all' || x.category === ui.cat) &&
      (!q || [x.name, x.notes, x.method, t.categories[x.category]].join(' ').toLowerCase().includes(q)));
    const nextOf = (x) => C.nextPayment(x, td);
    items = items.map((x) => ({ x, next: nextOf(x), m: C.monthlyCost(x, base, rates) }));
    if (ui.sort === 'next') items.sort((a, b) => (a.x.status !== 'active') - (b.x.status !== 'active') || a.next.localeCompare(b.next));
    if (ui.sort === 'price') items.sort((a, b) => b.m - a.m);
    if (ui.sort === 'name') items.sort((a, b) => a.x.name.localeCompare(b.x.name, locale()));

    if (!state.subs.length) { listBox.replaceChildren(emptyState()); return; }
    if (!items.length) { listBox.replaceChildren(h('p', { class: 'empty-filter' }, t.emptyFilter)); return; }

    const sumMonth = items.filter((i) => C.isBilling(i.x, td)).reduce((a, i) => a + i.m, 0);
    listBox.replaceChildren(
      h('p', { class: 'list-sum' }, `${items.length} · `, h('strong', { class: 'num' }, money(sumMonth)), ` ${t.perMonth}`),
      h('ul', { class: 'sub-list' }, items.map(({ x, next, m }) => subRow(x, next, m))));
  }
  renderList();
  return wrap;
}

function subRow(sub, next, m) {
  const t = T();
  const td = today();
  const badges = [];
  if (C.isTrialActive(sub, td)) badges.push(h('span', { class: 'badge badge-trial' }, `${t.trialEndsShort} ${fmtDate(sub.trialEnd)}`));
  if (sub.status === 'paused') badges.push(h('span', { class: 'badge badge-paused' }, t.pausedBadge));
  if (sub.status === 'cancelled') badges.push(h('span', { class: 'badge badge-off' }, t.cancelledBadge));
  if (sub.toCancel && sub.status === 'active') badges.push(h('span', { class: 'badge badge-cancel' }, t.toCancelBadge));
  if (sub.manual) badges.push(h('span', { class: 'badge' }, t.manual.badge));
  if (sub.shared > 1) badges.push(h('span', { class: 'badge' }, t.sharedBadge(sub.shared)));

  const quick = sub.status === 'active'
    ? h('button', { type: 'button', class: 'icon-btn', title: t.actions.pause, 'aria-label': `${t.actions.pause}: ${sub.name}`, onclick: (e) => { e.stopPropagation(); setStatus(sub, 'paused'); } }, icon('pause'))
    : h('button', { type: 'button', class: 'icon-btn', title: t.actions.resume, 'aria-label': `${t.actions.resume}: ${sub.name}`, onclick: (e) => { e.stopPropagation(); setStatus(sub, 'active'); } }, icon('play'));

  return h('li', { class: 'sub' + (sub.status !== 'active' ? ' is-off' : '') },
    h('button', { type: 'button', class: 'sub-main', onclick: () => openForm(sub), 'aria-label': `${t.actions.edit}: ${sub.name}` },
      avatar(sub, 44),
      h('span', { class: 'sub-body' },
        h('span', { class: 'sub-name' }, sub.name),
        h('span', { class: 'sub-meta' }, `${t.categories[sub.category] || ''} · ${cycleText(sub)}${sub.method ? ' · ' + sub.method : ''}`),
        badges.length ? h('span', { class: 'badges' }, badges) : null),
      h('span', { class: 'sub-right' },
        h('span', { class: 'sub-price num' }, money(Number(sub.price), sub.currency)),
        sub.status === 'active'
          ? h('span', { class: 'sub-next', title: fmtDate(next, { weekday: true }) }, nextLabel(next))
          : h('span', { class: 'sub-next' }, `≈ ${money(m)} / ${t.cycleShort.month}`))),
    h('span', { class: 'sub-actions' }, sub.status !== 'cancelled' ? quick : null));
}

function setStatus(sub, status) {
  const prev = { status: sub.status, endedAt: sub.endedAt };
  Object.assign(sub, C.withStatus(sub, status, today()));
  commit();
  const t = T();
  const label = { paused: t.pausedBadge, active: t.statusActive, cancelled: t.cancelledBadge }[status];
  toast(`${sub.name}: ${label.toLowerCase()}`, { label: t.undo, fn: () => { Object.assign(sub, prev); commit(); } });
}

// ---------- view: calendar ----------

function viewCalendar() {
  const t = T();
  const { base, rates } = state.prefs;
  const [y, m] = ui.calMonth.split('-').map(Number);
  const first = new Date(y, m - 1, 1);
  const last = new Date(y, m, 0);
  const fromISO = C.fmtISO(first), toISO = C.fmtISO(last);
  const td = today();

  const byDay = new Map();
  let monthTotal = 0;
  for (const sub of state.subs) {
    if (sub.status !== 'active') continue;
    if (sub.trialEnd && sub.trialEnd >= fromISO && sub.trialEnd <= toISO) {
      if (!byDay.has(sub.trialEnd)) byDay.set(sub.trialEnd, []);
      byDay.get(sub.trialEnd).push({ sub, kind: 'trial' });
    }
    for (const d of C.occurrencesBetween(sub, fromISO, toISO, 40)) {
      if (sub.trialEnd && d <= sub.trialEnd) continue;
      if (!byDay.has(d)) byDay.set(d, []);
      const amt = C.convert(C.share(sub), sub.currency, base, rates);
      byDay.get(d).push({ sub, kind: 'pay', amt });
      monthTotal += amt;
    }
  }

  const shift = (k) => {
    const d = new Date(y, m - 1 + k, 1);
    ui.calMonth = C.fmtISO(d).slice(0, 7);
    ui.calDay = ui.calMonth === td.slice(0, 7) ? td : C.fmtISO(d);
    render();
  };

  const head = h('header', { class: 'cal-head' },
    h('button', { type: 'button', class: 'icon-btn', 'aria-label': t.cal.prev, onclick: () => shift(-1) }, icon('left')),
    h('h2', { class: 'cal-title' }, monthName(ui.calMonth)),
    h('button', { type: 'button', class: 'icon-btn', 'aria-label': t.cal.next, onclick: () => shift(1) }, icon('right')),
    ui.calMonth !== td.slice(0, 7) ? h('button', { type: 'button', class: 'btn btn-small btn-ghost', onclick: () => { ui.calMonth = td.slice(0, 7); ui.calDay = td; render(); } }, t.cal.today) : null,
    h('p', { class: 'cal-total' }, h('span', null, t.cal.total), h('strong', { class: 'num' }, money(monthTotal))));

  const ws = state.prefs.weekStart;
  const wd = ws === 1 ? t.cal.weekdays : [t.cal.weekdays[6], ...t.cal.weekdays.slice(0, 6)];
  const grid = h('div', { class: 'cal-grid', role: 'grid', 'aria-label': monthName(ui.calMonth) },
    wd.map((w, i) => h('div', { class: 'cal-wd' + ((ws === 1 ? i >= 5 : i === 0 || i === 6) ? ' is-we' : ''), role: 'columnheader' }, w)));
  const lead = (first.getDay() - ws + 7) % 7;
  for (let i = 0; i < lead; i++) grid.append(h('div', { class: 'cal-cell is-pad', 'aria-hidden': 'true' }));
  for (let d = 1; d <= last.getDate(); d++) {
    const iso = C.fmtISO(new Date(y, m - 1, d));
    const ev = byDay.get(iso) || [];
    const sum = ev.filter((e) => e.kind === 'pay').reduce((a, e) => a + e.amt, 0);
    grid.append(h('button', {
      type: 'button', role: 'gridcell',
      class: 'cal-cell' + (iso === td ? ' is-today' : '') + (iso === ui.calDay ? ' is-sel' : '') + (iso < td ? ' is-past' : '') + (ev.length ? ' has-ev' : ''),
      'aria-label': `${fmtDate(iso)}${ev.length ? ': ' + ev.map((e) => e.sub.name).join(', ') : ''}`,
      'aria-pressed': String(iso === ui.calDay),
      onclick: () => { ui.calDay = iso; render(); },
    },
    h('span', { class: 'cal-num num' }, String(d)),
    ev.length ? h('span', { class: 'cal-dots' }, ev.slice(0, 4).map((e) => h('i', { class: e.kind === 'trial' ? 'dot-trial' : '', style: { '--c': subColorVar(e.sub) } }))) : null,
    sum > 0 ? h('span', { class: 'cal-sum num' }, money(sum, base, { compact: true })) : null));
  }

  const dayEv = byDay.get(ui.calDay) || [];
  const dayCard = h('section', { class: 'card' },
    h('header', { class: 'card-head' }, h('h2', null, fmtDate(ui.calDay, { weekday: true })), h('span', { class: 'card-meta' }, relDay(ui.calDay))),
    dayEv.length
      ? h('ul', { class: 'rank' }, dayEv.map((e) => h('li', null, h('button', { type: 'button', class: 'rank-btn', onclick: () => openForm(e.sub) },
        avatar(e.sub, 32),
        h('span', { class: 'rank-body' }, h('span', { class: 'rank-name' }, e.sub.name), h('span', { class: 'rank-meta' }, e.kind === 'trial' ? t.trialEnds : cycleText(e.sub))),
        e.kind === 'pay' ? h('span', { class: 'rank-val num' }, money(C.share(e.sub), e.sub.currency)) : h('span', { class: 'badge badge-trial' }, t.trialBadge)))))
      : h('p', { class: 'muted' }, t.cal.none));

  return h('div', { class: 'stack' }, h('section', { class: 'card cal' }, head, grid), dayCard);
}

// ---------- view: preferences ----------

function viewPrefs() {
  const t = T();
  const p = state.prefs;
  const tp = t.prefs;
  const currencies = Object.keys(p.rates).sort();

  const field = (label, control, hint) => h('div', { class: 'field' }, h('label', { class: 'label', for: control.id }, label), control, hint ? h('p', { class: 'hint' }, hint) : null);
  const select = (id, value, options, onchange) => h('select', { id, class: 'input input-select', onchange: (e) => onchange(e.target.value) },
    options.map(([v, l]) => h('option', { value: v, selected: String(value) === String(v) }, l)));

  const general = h('section', { class: 'card' }, h('h2', null, tp.general),
    h('div', { class: 'form-grid' },
      field(tp.baseCurrency, select('pref-base', p.base, currencies.map((c) => [c, c]), (v) => { p.base = v; commit({ keepDemo: true }); }), tp.baseCurrencyHint),
      field(tp.language, select('pref-lang', p.lang, [['ru', 'Русский'], ['en', 'English']], (v) => { p.lang = v; commit({ keepDemo: true }); })),
      field(tp.theme, select('pref-theme', p.theme, [['auto', tp.themeAuto], ['light', tp.themeLight], ['dark', tp.themeDark]], (v) => { p.theme = v; commit({ keepDemo: true }); })),
      field(t.budget.title, h('input', { id: 'pref-budget', class: 'input input-num num', type: 'number', inputmode: 'decimal', min: '0', step: '100', placeholder: '—',
        value: p.budget > 0 ? String(p.budget) : '',
        onchange: (e) => { const v = Number(e.target.value); p.budget = v > 0 ? v : 0; commit({ keepDemo: true }); } }), `${t.budget.hint} (${p.base})`),
      field(tp.week, select('pref-week', p.weekStart, [[1, tp.monday], [0, tp.sunday]], (v) => { p.weekStart = Number(v); commit({ keepDemo: true }); }))));

  // reminders
  const native = N.isNative();
  const notifState = native ? (ui.nativeNotif || 'prompt') : !('Notification' in window) ? 'unsupported' : Notification.permission;
  const notifBox = h('div', { class: 'row-wrap' });
  if (notifState === 'granted') notifBox.append(h('span', { class: 'badge badge-ok' }, tp.notifyGranted));
  else if (notifState === 'denied') notifBox.append(h('p', { class: 'hint' }, tp.notifyDenied));
  else if (notifState === 'unsupported') notifBox.append(h('p', { class: 'hint' }, tp.notifyUnsupported));
  else notifBox.append(h('button', { type: 'button', class: 'btn', onclick: async () => {
    if (native) { ui.nativeNotif = await N.requestNotifications(); scheduleNative(); render(); return; }
    try { await Notification.requestPermission(); } catch { /* ignore */ }
    checkReminders(); render();
  } }, icon('bell'), tp.notifyOn));

  const reminders = h('section', { class: 'card' }, h('h2', null, tp.reminders),
    h('div', { class: 'form-grid' },
      field(tp.remindDays, select('pref-remind', p.remindDays, [0, 1, 2, 3, 5, 7].map((n) => [n, tp.remindDaysOpt(n)]), (v) => { p.remindDays = Number(v); commit({ keepDemo: true }); })),
      native ? field(tp.remindHour, select('pref-hour', p.remindHour ?? 10, Array.from({ length: 16 }, (_, i) => i + 7).map((hr) => [hr, `${String(hr).padStart(2, '0')}:00`]), (v) => { p.remindHour = Number(v); commit({ keepDemo: true }); })) : null),
    h('div', { class: 'sub-block' }, h('h3', null, native ? tp.notifyNativeTitle : tp.notify), h('p', { class: 'hint' }, native ? tp.notifyNativeHint : tp.notifyHint), notifBox),
    h('div', { class: 'sub-block' }, h('h3', null, tp.ics), h('p', { class: 'hint' }, native ? tp.icsNativeHint : tp.icsHint),
      h('div', { class: 'row-wrap' },
        h('button', { type: 'button', class: 'btn btn-primary', onclick: exportICS }, icon('cal'), tp.ics))));

  // rates
  const rateRows = currencies.filter((c) => c !== p.base).map((c) => {
    const inBase = C.convert(1, c, p.base, p.rates);
    const id = 'rate-' + c;
    return h('div', { class: 'rate' },
      h('label', { for: id, class: 'rate-code' }, `1 ${c} =`),
      h('input', { id, class: 'input input-num num', type: 'number', inputmode: 'decimal', step: 'any', min: '0', value: String(+inBase.toPrecision(6)),
        onchange: (e) => {
          const v = Number(e.target.value);
          if (!(v > 0)) { e.target.value = String(+inBase.toPrecision(6)); return; }
          p.rates[c] = v * p.rates[p.base]; p.ratesDate = ''; commit({ keepDemo: true });
        } }),
      h('span', { class: 'rate-base' }, p.base));
  });
  const newCur = h('input', { id: 'new-cur', class: 'input', placeholder: tp.addCurrencyPh, maxlength: 3, autocomplete: 'off', style: { textTransform: 'uppercase', maxWidth: '12rem' } });
  const rates = h('section', { class: 'card' }, h('h2', null, tp.rates), h('p', { class: 'hint' }, tp.ratesHint(p.base)),
    h('div', { class: 'rates' }, rateRows),
    h('div', { class: 'row-wrap' },
      h('button', { type: 'button', class: 'btn', onclick: (e) => updateRates(e.currentTarget) }, icon('down'), tp.ratesUpdate),
      h('span', { class: 'hint' }, p.ratesDate ? tp.ratesUpdated(fmtDate(p.ratesDate, { year: true })) : tp.ratesManual)),
    h('form', { class: 'row-wrap', onsubmit: (e) => {
      e.preventDefault();
      const code = newCur.value.trim().toUpperCase();
      if (!/^[A-Z]{3}$/.test(code) || p.rates[code]) return;
      p.rates[code] = 1; commit({ keepDemo: true });
      toast(`${code}: ${state.prefs.lang === 'ru' ? 'укажите курс' : 'set the rate'}`);
    } }, newCur, h('button', { type: 'submit', class: 'btn btn-ghost' }, icon('plus'), tp.addCurrency)));

  // data
  const paste = h('textarea', { id: 'paste-json', class: 'input', rows: 3, placeholder: tp.pastePh });
  const file = h('input', { id: 'import-file', type: 'file', accept: 'application/json,.json', hidden: true, onchange: async (e) => {
    const f = e.target.files[0]; if (!f) return;
    importJSON(await f.text()); e.target.value = '';
  } });
  const clearBtn = h('button', { type: 'button', class: 'btn btn-danger', onclick: () => {
    if (!ui.clearArmed) { ui.clearArmed = true; clearBtn.textContent = tp.clearConfirm; setTimeout(() => { ui.clearArmed = false; if (document.contains(clearBtn)) clearBtn.replaceChildren(icon('trash'), tp.clearAll); }, 5000); return; }
    ui.clearArmed = false; state.subs = []; state.demo = false; persist(); render(); toast(tp.cleared);
  } }, icon('trash'), tp.clearAll);

  const data = h('section', { class: 'card' }, h('h2', null, tp.data), h('p', { class: 'hint' }, tp.dataHint),
    h('div', { class: 'row-wrap' },
      h('button', { type: 'button', class: 'btn', onclick: exportJSON }, icon('down'), tp.exportJson),
      h('button', { type: 'button', class: 'btn', onclick: (e) => copyText(backupText(), e.currentTarget) }, icon('copy'), tp.copyJson),
      h('button', { type: 'button', class: 'btn', onclick: exportCSV }, icon('down'), tp.exportCsv)),
    h('div', { class: 'row-wrap' },
      h('button', { type: 'button', class: 'btn', onclick: () => file.click() }, icon('up'), tp.importJson), file),
    h('div', { class: 'field' }, h('label', { class: 'label', for: 'paste-json' }, tp.pasteJson), paste,
      h('div', { class: 'row-wrap' }, h('button', { type: 'button', class: 'btn', onclick: () => importJSON(paste.value) }, tp.restore))),
    h('div', { class: 'row-wrap danger-zone' },
      h('button', { type: 'button', class: 'btn btn-ghost', onclick: () => { state.subs = demoSubs(); state.demo = true; persist(); go('overview'); } }, tp.loadDemo),
      clearBtn));

  const about = h('section', { class: 'card' }, h('h2', null, tp.about), h('p', null, tp.aboutText), h('p', { class: 'hint' }, tp.shortcuts),
    ui.installEvt ? h('div', { class: 'row-wrap' }, h('button', { type: 'button', class: 'btn btn-primary', onclick: install }, icon('down'), tp.install), h('span', { class: 'hint' }, tp.installHint)) : null,
    N.isNative() ? null : h('div', { class: 'row-wrap' },
      h('a', { class: 'btn', href: 'https://github.com/howknowme/subly/releases/latest/download/subly.apk', target: '_blank', rel: 'noopener' }, icon('down'), tp.android),
      h('span', { class: 'hint' }, tp.androidHint)));

  return h('div', { class: 'stack prefs' }, general, reminders, rates, data, about);
}

async function updateRates(btn) {
  const t = T();
  btn.disabled = true;
  try {
    const res = await fetch('https://open.er-api.com/v6/latest/USD', { cache: 'no-store' });
    const j = await res.json();
    if (j.result !== 'success' || !j.rates) throw new Error('bad');
    for (const code of Object.keys(state.prefs.rates)) {
      if (j.rates[code] > 0) state.prefs.rates[code] = 1 / j.rates[code];
    }
    state.prefs.ratesDate = today();
    commit({ keepDemo: true });
    toast(t.prefs.ratesUpdated(fmtDate(today(), { year: true })));
  } catch {
    btn.disabled = false;
    toast(t.prefs.ratesFail);
  }
}

// ---------- export / import ----------

function download(name, text, type) {
  if (N.isNative()) {
    N.saveFile(name, text, name).catch(() => toast(T().prefs.copyFail));
    return;
  }
  try {
    const url = URL.createObjectURL(new Blob([text], { type }));
    const a = h('a', { href: url, download: name, hidden: true });
    document.body.append(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 1000);
  } catch {
    toast(T().prefs.copyFail);
  }
}

function backupText() {
  return JSON.stringify({ app: 'subly', version: 1, exported: new Date().toISOString(), subs: state.subs, prefs: { ...state.prefs, notified: {} } }, null, 2);
}

function exportJSON() { download(`subly-${today()}.json`, backupText(), 'application/json'); }

function exportCSV() {
  const t = T();
  const { base, rates } = state.prefs;
  const rows = [[t.form.name, t.form.price, t.form.currency, t.form.unit, t.form.every, t.next, t.form.category, t.form.status, t.form.shared, `${t.perMonth} (${base})`, t.form.trial, t.form.method, t.form.url, t.form.notes]];
  for (const x of state.subs) {
    rows.push([x.name, x.price, x.currency, x.unit, x.every, x.status === 'active' ? C.nextPayment(x, today()) : '', t.categories[x.category], x.status, x.shared,
      C.monthlyCost(x, base, rates).toFixed(2), x.trialEnd, x.method, x.url, x.notes]);
  }
  download(`subly-${today()}.csv`, C.toCSV(rows), 'text/csv;charset=utf-8');
}

function exportICS() {
  const t = T();
  const ics = C.toICS(state.subs, { remindDays: state.prefs.remindDays, labels: { calendar: 'Subly', trialEnds: t.trialEnds } });
  download('subly.ics', ics, 'text/calendar;charset=utf-8');
}

function importJSON(text) {
  const t = T();
  try {
    const j = JSON.parse(text);
    const list = Array.isArray(j) ? j : j.subs;
    if (!Array.isArray(list)) throw new Error('shape');
    const subs = list.map((x) => C.sanitizeSub(x, uid)).filter(Boolean);
    if (!subs.length && list.length) throw new Error('empty');
    state.subs = subs;
    if (j.prefs && typeof j.prefs === 'object') {
      const pr = j.prefs;
      const next = { ...state.prefs };
      if (/^[A-Z]{3}$/.test(pr.base)) next.base = pr.base;
      if (['ru', 'en'].includes(pr.lang)) next.lang = pr.lang;
      if (['auto', 'light', 'dark'].includes(pr.theme)) next.theme = pr.theme;
      if ([0, 1].includes(pr.weekStart)) next.weekStart = pr.weekStart;
      if (Number.isInteger(pr.remindDays) && pr.remindDays >= 0 && pr.remindDays <= 30) next.remindDays = pr.remindDays;
      if (Number(pr.budget) >= 0) next.budget = Number(pr.budget) || 0;
      if (pr.rates && typeof pr.rates === 'object') {
        for (const [k, v] of Object.entries(pr.rates)) if (/^[A-Z]{3}$/.test(k) && Number(v) > 0) next.rates[k] = Number(v);
      }
      state.prefs = next;
    }
    commit();
    toast(t.prefs.imported(subs.length));
  } catch {
    toast(t.prefs.importFail);
  }
}

async function copyText(text, btn) {
  const t = T();
  try {
    await navigator.clipboard.writeText(text);
    toast(t.prefs.copied);
  } catch {
    const ta = $('#paste-json');
    if (ta) { ta.value = text; ta.focus(); ta.select(); }
    toast(t.prefs.copyFail);
  }
  btn?.blur();
}

// ---------- form ----------

const dialog = () => $('#sheet');

function openForm(sub, preset) {
  const t = T();
  const tf = t.form;
  const isNew = !sub;
  const draft = sub ? { ...sub } : {
    id: uid(), name: '', price: '', currency: state.prefs.base, unit: 'month', every: 1, start: today(),
    category: 'other', status: 'active', trialEnd: '', shared: 1, method: '', url: '', notes: '', color: '', toCancel: false, ...preset,
  };
  const currencies = [...new Set([...Object.keys(state.prefs.rates), draft.currency])].sort();
  const el = {};
  const input = (key, attrs) => (el[key] = h('input', { id: 'f-' + key, name: key, class: 'input', value: draft[key] ?? '', ...attrs }));
  const fieldWrap = (key, label, control, hint, extra = '') => h('div', { class: 'field ' + extra },
    h('label', { class: 'label', for: 'f-' + key }, label), control,
    hint ? h('p', { class: 'hint' }, hint) : null,
    h('p', { class: 'err', id: 'err-' + key, hidden: true }));

  const nameInput = input('name', { placeholder: tf.namePh, autocomplete: 'off', required: true, maxlength: 80, list: 'tpl-list' });
  const datalist = h('datalist', { id: 'tpl-list' }, TEMPLATES.map((tp) => h('option', { value: tp.name })));
  nameInput.addEventListener('change', () => {
    const tp = TEMPLATES.find((x) => x.name.toLowerCase() === nameInput.value.trim().toLowerCase());
    if (tp && isNew && !el.price.value) applyTemplate(tp);
  });

  const price = input('price', { type: 'number', inputmode: 'decimal', step: '0.01', min: '0', placeholder: '0', class: 'input input-num num', required: true });
  const currency = (el.currency = h('select', { id: 'f-currency', class: 'input input-select' }, currencies.map((c) => h('option', { value: c, selected: c === draft.currency }, c))));
  const every = input('every', { type: 'number', min: '1', max: '365', step: '1', inputmode: 'numeric', class: 'input input-num num' });
  const unit = (el.unit = h('select', { id: 'f-unit', class: 'input input-select' }, C.UNITS.map((u) => h('option', { value: u, selected: u === draft.unit }, t.unitNames[u]))));
  const start = input('start', { type: 'date', required: true });
  const category = (el.category = h('select', { id: 'f-category', class: 'input input-select' }, CATEGORIES.map((c) => h('option', { value: c, selected: c === draft.category }, t.categories[c]))));
  const trial = input('trialEnd', { type: 'date' });
  const shared = (el.shared = h('select', { id: 'f-shared', class: 'input input-select' }, Array.from({ length: 8 }, (_, i) => i + 1).map((n) => h('option', { value: n, selected: n === draft.shared }, n === 1 ? '—' : tf.people(n)))));
  const method = input('method', { placeholder: tf.methodPh, maxlength: 60 });
  const url = input('url', { type: 'url', placeholder: tf.urlPh, maxlength: 300, inputmode: 'url' });
  const notes = (el.notes = h('textarea', { id: 'f-notes', class: 'input', rows: 2, placeholder: tf.notesPh, maxlength: 1000 }, draft.notes || ''));
  const statusSel = (el.status = h('select', { id: 'f-status', class: 'input input-select' },
    [['active', t.statusActive], ['paused', t.pausedBadge], ['cancelled', t.cancelledBadge]].map(([v, l]) => h('option', { value: v, selected: v === draft.status }, l))));
  const toCancel = (el.toCancel = h('input', { id: 'f-toCancel', type: 'checkbox', checked: !!draft.toCancel }));
  const manual = (el.manual = h('input', { id: 'f-manual', type: 'checkbox', checked: !!draft.manual }));
  let paidMarks = [...(draft.paid || [])];
  const historyBox = h('div', { class: 'history' });

  const swatches = ['', '#2f6fdb', '#e0612b', '#0b9d7e', '#d39200', '#d6487f', '#16872a', '#6a4ce2', '#d83a3b', '#5d6678'];
  let color = draft.color || '';
  const colorRow = h('div', { class: 'swatches', role: 'radiogroup', 'aria-label': tf.color }, swatches.map((c) => h('button', {
    type: 'button', role: 'radio', class: 'swatch' + (c ? '' : ' swatch-auto'), 'aria-checked': String(c === color), title: c || tf.colorAuto, 'aria-label': c || tf.colorAuto,
    style: c ? { '--c': c } : null,
    onclick: (e) => { color = c; for (const b of colorRow.children) b.setAttribute('aria-checked', String(b === e.currentTarget)); preview(); },
  })));

  const previewBox = h('div', { class: 'preview', 'aria-live': 'polite' });

  function readDraft() {
    return {
      ...draft,
      name: el.name.value.trim(),
      price: el.price.value === '' ? NaN : Number(el.price.value),
      currency: el.currency.value, unit: el.unit.value, every: Math.max(1, Math.floor(Number(el.every.value) || 1)),
      start: el.start.value, category: el.category.value, trialEnd: el.trialEnd.value, shared: Number(el.shared.value),
      method: el.method.value.trim(), url: el.url.value.trim(), notes: el.notes.value.trim(), status: el.status.value,
      toCancel: el.toCancel.checked, manual: el.manual.checked, paid: paidMarks, color,
    };
  }

  function preview() {
    const d = readDraft();
    const ok = d.start && d.price >= 0;
    if (!ok) { previewBox.replaceChildren(); return; }
    const { base, rates } = state.prefs;
    const m = C.monthlyCost(d, base, rates);
    const next = C.nextPayment(d, today());
    const ava = avatar({ ...d, name: d.name || '?' }, 44);
    const facts = [
      h('div', null, h('dt', null, tf.perMonthEq), h('dd', { class: 'num' }, money(m))),
      h('div', null, h('dt', null, tf.perYearEq), h('dd', { class: 'num' }, money(m * 12))),
      h('div', null, h('dt', null, t.next), h('dd', null, d.status === 'active' ? `${fmtDate(next)}, ${relDay(next)}` : '—')),
    ];
    if (!isNew) facts.push(h('div', null, h('dt', null, tf.paidSoFar), h('dd', { class: 'num' }, money(C.paidSoFar(d, today()), d.currency))));
    previewBox.replaceChildren(ava, h('dl', { class: 'preview-facts' }, facts));
    renderHistory(d);
  }

  function renderHistory(d) {
    if (isNew) return;
    const th = t.history;
    const past = C.pastPayments(d, today()).reverse();
    const shown = past.slice(0, 8);
    const paid = new Set(paidMarks);
    historyBox.replaceChildren(
      h('h3', null, th.title),
      shown.length ? h('ul', { class: 'history-list' }, shown.map((date) => h('li', null,
        h('span', { class: 'h-date' }, fmtDate(date, { year: true })),
        h('span', { class: 'h-amt num' }, money(C.share(d), d.currency)),
        d.manual
          ? h('button', { type: 'button', class: 'h-mark' + (paid.has(date) ? ' is-paid' : ''), 'aria-pressed': String(paid.has(date)), title: th.toggle,
            onclick: () => { paidMarks = C.togglePaid({ paid: paidMarks }, date); renderHistory(readDraft()); } }, paid.has(date) ? '✓ ' + th.paid : th.notPaid)
          : h('span', { class: 'h-state' }, th.charged))))
        : h('p', { class: 'hint' }, th.empty),
      past.length > shown.length ? h('p', { class: 'hint' }, th.more(past.length - shown.length)) : '');
  }

  function applyTemplate(tp) {
    el.name.value = tp.name;
    el.price.value = tp.price;
    if (![...el.currency.options].some((o) => o.value === tp.currency)) el.currency.append(h('option', { value: tp.currency }, tp.currency));
    el.currency.value = tp.currency;
    el.category.value = tp.category;
    el.unit.value = tp.unit || 'month';
    el.every.value = 1;
    if (tp.url && !el.url.value) el.url.value = tp.url;
    preview();
    el.price.focus();
    el.price.select();
  }

  const chips = isNew ? h('div', { class: 'field' },
    h('span', { class: 'label' }, tf.template),
    h('div', { class: 'chips' }, TEMPLATES.filter((tp) => state.prefs.lang === 'ru' || /^[\x00-\x7F]+$/.test(tp.name)).slice(0, 18).map((tp) =>
      h('button', { type: 'button', class: 'chip', onclick: () => applyTemplate(tp) }, tp.name))),
    h('p', { class: 'hint' }, tf.templateHint)) : null;

  const form = h('form', { class: 'sheet-form', novalidate: true, onsubmit: (e) => { e.preventDefault(); save(); }, oninput: preview, onchange: preview },
    h('header', { class: 'sheet-head' },
      h('h2', { id: 'sheet-title' }, isNew ? t.addSub : t.editSub),
      h('button', { type: 'button', class: 'icon-btn', 'aria-label': tf.cancel, onclick: () => dialog().close() }, icon('close'))),
    h('div', { class: 'sheet-body' },
      previewBox,
      chips,
      fieldWrap('name', tf.name, nameInput), datalist,
      h('div', { class: 'form-grid g-price' },
        fieldWrap('price', tf.price, price),
        fieldWrap('currency', tf.currency, currency)),
      h('div', { class: 'form-grid g-price' },
        fieldWrap('every', tf.every, every),
        fieldWrap('unit', tf.unit, unit)),
      h('div', { class: 'form-grid' },
        fieldWrap('start', tf.start, start, tf.startHint),
        fieldWrap('category', tf.category, category)),
      h('label', { class: 'check' }, toCancel, h('span', null, h('strong', null, tf.toCancel), h('span', { class: 'hint' }, ' ' + tf.toCancelHint))),
      h('label', { class: 'check' }, manual, h('span', null, h('strong', null, t.manual.label), h('span', { class: 'hint' }, ' ' + t.manual.hint))),
      h('details', { class: 'more', open: !isNew && (draft.trialEnd || draft.shared > 1 || draft.method || draft.url || draft.notes || draft.status !== 'active') ? true : null },
        h('summary', null, tf.more),
        h('div', { class: 'more-body' },
          h('div', { class: 'form-grid' },
            fieldWrap('trialEnd', tf.trial, trial, tf.trialHint),
            fieldWrap('shared', tf.shared, shared, tf.sharedHint)),
          h('div', { class: 'form-grid' },
            fieldWrap('method', tf.method, method),
            fieldWrap('status', tf.status, statusSel)),
          fieldWrap('url', tf.url, url),
          fieldWrap('notes', tf.notes, notes),
          h('div', { class: 'field' }, h('span', { class: 'label' }, tf.color), colorRow))),
      isNew ? null : historyBox),
    h('footer', { class: 'sheet-foot' },
      !isNew ? h('button', { type: 'button', class: 'btn btn-ghost btn-danger-text', onclick: () => remove(sub) }, icon('trash'), tf.delete) : null,
      !isNew ? h('button', { type: 'button', class: 'btn btn-ghost', onclick: () => { dialog().close(); openForm(null, { ...sub, id: uid(), name: sub.name + ' 2' }); } }, icon('copy'), h('span', { class: 'hide-sm' }, tf.duplicate)) : null,
      !isNew && draft.url ? h('a', { class: 'btn btn-ghost', href: draft.url, target: '_blank', rel: 'noopener noreferrer' }, icon('ext'), h('span', { class: 'hide-sm' }, t.actions.open)) : null,
      h('span', { class: 'spacer' }),
      h('button', { type: 'submit', class: 'btn btn-primary' }, tf.save)));

  function showErr(key, msg) {
    const e = form.querySelector('#err-' + key);
    e.textContent = msg; e.hidden = !msg;
    el[key].setAttribute('aria-invalid', msg ? 'true' : 'false');
    if (msg) el[key].setAttribute('aria-describedby', 'err-' + key); else el[key].removeAttribute('aria-describedby');
  }

  function save() {
    const d = readDraft();
    let bad = null;
    showErr('name', d.name ? '' : tf.errName); if (!d.name) bad = bad || 'name';
    const pOk = Number.isFinite(d.price) && d.price >= 0;
    showErr('price', pOk ? '' : tf.errPrice); if (!pOk) bad = bad || 'price';
    showErr('start', d.start ? '' : tf.errStart); if (!d.start) bad = bad || 'start';
    if (bad) { el[bad].focus(); return; }
    if (d.url && !/^https?:\/\//i.test(d.url)) d.url = 'https://' + d.url;
    const withEnd = sub ? C.withStatus({ ...d, status: sub.status, endedAt: sub.endedAt }, d.status, today()) : d;
    const clean = C.sanitizeSub(withEnd, uid);
    if (!clean) return;
    const i = state.subs.findIndex((x) => x.id === clean.id);
    if (i >= 0) state.subs[i] = clean; else state.subs.push(clean);
    dialog().close();
    commit();
    toast(T().saved);
  }

  const dlg = dialog();
  dlg.replaceChildren(form);
  dlg.setAttribute('aria-labelledby', 'sheet-title');
  preview();
  if (!dlg.open) dlg.showModal();
  if (isNew && !preset) setTimeout(() => nameInput.focus(), 30);
}

function remove(sub) {
  const t = T();
  const i = state.subs.findIndex((x) => x.id === sub.id);
  if (i < 0) return;
  const [removed] = state.subs.splice(i, 1);
  dialog().close();
  commit();
  toast(t.deleted(removed.name), { label: t.undo, fn: () => { state.subs.splice(i, 0, removed); commit(); } });
}

// ---------- reminders ----------

async function checkReminders() {
  if (N.isNative()) return;
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  const t = T();
  const td = today();
  const notified = state.prefs.notified || (state.prefs.notified = {});
  // forget keys older than 60 days
  for (const [k, v] of Object.entries(notified)) if (C.diffDays(C.parseDate(v), C.parseDate(td)) > 60) delete notified[k];
  const events = C.upcoming(state.subs, td, Math.max(state.prefs.remindDays, 1));
  let reg = null;
  try { reg = await navigator.serviceWorker?.getRegistration(); } catch { /* ignore */ }
  for (const e of events) {
    const n = C.diffDays(C.parseDate(td), C.parseDate(e.date));
    if (e.kind === 'pay' && n > state.prefs.remindDays) continue;
    if (e.kind === 'trial' && n > 1) continue;
    const key = `${e.id}:${e.date}:${e.kind}`;
    if (notified[key]) continue;
    const sub = subById(e.id);
    const body = e.kind === 'trial' ? t.alertTrial(sub.name, relDay(e.date)) : `${t.alertPay(sub.name, relDay(e.date))} · ${money(Number(sub.price), sub.currency)}`;
    try {
      if (reg) await reg.showNotification(t.notifTitle, { body, tag: key, icon: 'icon.svg', badge: 'icon.svg' });
      else new Notification(t.notifTitle, { body, tag: key, icon: 'icon.svg' });
      notified[key] = td;
    } catch { /* ignore */ }
  }
  persist();
}

// ---------- PWA ----------

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  ui.installEvt = e;
  if (ui.view === 'prefs') render();
});

async function install() {
  if (!ui.installEvt) return;
  ui.installEvt.prompt();
  try { await ui.installEvt.userChoice; } catch { /* ignore */ }
  ui.installEvt = null;
  render();
}

if ('serviceWorker' in navigator && location.protocol !== 'file:' && !window.__SUBLY_NO_SW__ && !N.isNative()) {
  navigator.serviceWorker.register('sw.js').catch(() => { /* offline mode unavailable */ });
}

// ---------- global events ----------

document.addEventListener('keydown', (e) => {
  const tag = (e.target.tagName || '').toLowerCase();
  const typing = ['input', 'textarea', 'select'].includes(tag) || e.target.isContentEditable;
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  if (dialog().open) return;
  if (!typing && (e.key === 'n' || e.key === 'т' || e.key === 'N')) { e.preventDefault(); openForm(); }
  if (!typing && e.key === '/') { e.preventDefault(); if (ui.view !== 'subs') go('subs'); setTimeout(() => $('#search')?.focus(), 0); }
});

window.addEventListener('hashchange', route);
window.addEventListener('storage', (e) => {
  if (e.key !== KEY || !e.newValue) return;
  try { state = JSON.parse(e.newValue); render(); } catch { /* ignore */ }
});
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') { render(); checkReminders(); }
});

$('#add-btn').addEventListener('click', () => openForm());
$('#head-total-btn').addEventListener('click', () => go('overview'));
dialog().addEventListener('click', (e) => { if (e.target === dialog()) dialog().close(); });

// refresh at midnight so "today" stays right on a long-open tab
setInterval(() => {
  const td = today();
  if (td !== ui.lastDay) { ui.lastDay = td; render(); checkReminders(); }
}, 60000);
ui.lastDay = today();

route();
checkReminders();

if (N.isNative()) {
  document.documentElement.classList.add('is-native');
  N.notificationState().then(async (st) => {
    // ask once on first launch; later the button in Preferences asks again
    if (st === 'prompt' || st === 'prompt-with-rationale') {
      let asked = false;
      try { asked = localStorage.getItem('subly:asked-notif') === '1'; localStorage.setItem('subly:asked-notif', '1'); } catch { /* ignore */ }
      if (!asked) st = await N.requestNotifications();
    }
    ui.nativeNotif = st;
    scheduleNative();
    if (ui.view === 'prefs') render();
  });
  N.onBackButton(() => {
    if (dialog().open) { dialog().close(); return; }
    if (ui.view !== 'overview') { go('overview'); return; }
    N.minimizeApp();
  });
  N.onResume(() => { render(); scheduleNative(); });
}
