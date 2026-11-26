// Pure logic: dates, cycles, money. No DOM here — covered by tests/core.test.mjs.

export const UNITS = ['day', 'week', 'month', 'year'];

export function parseDate(s) {
  const [y, m, d] = String(s).split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function fmtISO(d) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function todayISO(now = new Date()) {
  return fmtISO(new Date(now.getFullYear(), now.getMonth(), now.getDate()));
}

export function daysInMonth(y, m) {
  return new Date(y, m + 1, 0).getDate();
}

export function addMonthsClamped(date, months, anchorDay = date.getDate()) {
  const total = date.getFullYear() * 12 + date.getMonth() + months;
  const y = Math.floor(total / 12);
  const m = total - y * 12;
  return new Date(y, m, Math.min(anchorDay, daysInMonth(y, m)));
}

export function diffDays(a, b) {
  // whole days from a to b (both Date at local midnight)
  return Math.round((Date.UTC(b.getFullYear(), b.getMonth(), b.getDate()) -
    Date.UTC(a.getFullYear(), a.getMonth(), a.getDate())) / 86400000);
}

/** n-th occurrence (n >= 0) counted from the anchor, so month-end days never drift. */
export function occurrence(startISO, unit, every, n) {
  const start = parseDate(startISO);
  const k = Math.max(1, Math.floor(every || 1)) * n;
  switch (unit) {
    case 'day': return new Date(start.getFullYear(), start.getMonth(), start.getDate() + k);
    case 'week': return new Date(start.getFullYear(), start.getMonth(), start.getDate() + 7 * k);
    case 'year': return addMonthsClamped(start, 12 * k, start.getDate());
    case 'month':
    default: return addMonthsClamped(start, k, start.getDate());
  }
}

/** Rough index of the occurrence near a date, used to skip ahead quickly. */
function estimateIndex(startISO, unit, every, date) {
  const start = parseDate(startISO);
  const e = Math.max(1, Math.floor(every || 1));
  const days = diffDays(start, date);
  if (days <= 0) return 0;
  const per = { day: 1, week: 7, month: 30.436875, year: 365.2425 }[unit] || 30.436875;
  return Math.max(0, Math.floor(days / (per * e)) - 1);
}

/** First payment date on or after `fromISO`. */
export function nextPayment(sub, fromISO) {
  const from = parseDate(fromISO);
  let n = estimateIndex(sub.start, sub.unit, sub.every, from);
  let d = occurrence(sub.start, sub.unit, sub.every, n);
  while (d > from && n > 0) { n--; d = occurrence(sub.start, sub.unit, sub.every, n); }
  while (d < from) { n++; d = occurrence(sub.start, sub.unit, sub.every, n); }
  return fmtISO(d);
}

/** Most recent payment strictly before `fromISO`, or null. */
export function prevPayment(sub, fromISO) {
  const next = parseDate(nextPayment(sub, fromISO));
  let n = estimateIndex(sub.start, sub.unit, sub.every, next) + 2;
  while (n >= 0) {
    const d = occurrence(sub.start, sub.unit, sub.every, n);
    if (d < next) return fmtISO(d);
    n--;
  }
  return null;
}

/** All payment dates within [fromISO, toISO] inclusive. */
export function occurrencesBetween(sub, fromISO, toISO, limit = 2000) {
  const out = [];
  const to = parseDate(toISO);
  let cur = parseDate(nextPayment(sub, fromISO));
  let n = estimateIndex(sub.start, sub.unit, sub.every, cur);
  while (occurrence(sub.start, sub.unit, sub.every, n) < cur) n++;
  while (cur <= to && out.length < limit) {
    out.push(fmtISO(cur));
    n++;
    cur = occurrence(sub.start, sub.unit, sub.every, n);
  }
  return out;
}

/** Average cost per month in the subscription's own currency. */
export function monthlyFactor(unit, every) {
  const e = Math.max(1, Math.floor(every || 1));
  switch (unit) {
    case 'day': return 365.2425 / 12 / e;
    case 'week': return 365.2425 / 7 / 12 / e;
    case 'year': return 1 / 12 / e;
    case 'month':
    default: return 1 / e;
  }
}

/** rates: { CODE: value of 1 unit in USD } */
export function convert(amount, from, to, rates) {
  if (from === to) return amount;
  const a = rates[from], b = rates[to];
  if (!a || !b) return amount;
  return (amount * a) / b;
}

export function isTrialActive(sub, today) {
  return !!sub.trialEnd && sub.trialEnd >= today;
}

/** Does this subscription currently cost money? */
export function isBilling(sub, today) {
  return sub.status === 'active' && !isTrialActive(sub, today);
}

/** Your share of one payment (family / split plans divide the price). */
export function share(sub) {
  return (Number(sub.price) || 0) / Math.max(1, Math.floor(Number(sub.shared) || 1));
}

export function monthlyCost(sub, base, rates) {
  return convert(share(sub), sub.currency, base, rates) * monthlyFactor(sub.unit, sub.every);
}

export function totals(subs, base, rates, today) {
  let month = 0, cancelSave = 0, trialAfter = 0, count = 0;
  for (const s of subs) {
    if (s.status !== 'active') continue;
    const m = monthlyCost(s, base, rates);
    if (isTrialActive(s, today)) { trialAfter += m; continue; }
    month += m; count++;
    if (s.toCancel) cancelSave += m;
  }
  return { month, year: month * 12, day: (month * 12) / 365.2425, cancelSave, trialAfter, count };
}

/** Payments (real dates and amounts) per calendar month for the next `months` months. */
export function forecast(subs, base, rates, today, months = 12) {
  const t = parseDate(today);
  const buckets = [];
  for (let i = 0; i < months; i++) {
    const s = new Date(t.getFullYear(), t.getMonth() + i, 1);
    const e = new Date(t.getFullYear(), t.getMonth() + i + 1, 0);
    buckets.push({ key: fmtISO(s).slice(0, 7), from: i === 0 ? today : fmtISO(s), to: fmtISO(e), total: 0, items: [] });
  }
  for (const sub of subs) {
    if (sub.status !== 'active') continue;
    const price = convert(share(sub), sub.currency, base, rates);
    for (const b of buckets) {
      for (const d of occurrencesBetween(sub, b.from, b.to)) {
        if (sub.trialEnd && d <= sub.trialEnd) continue;
        b.total += price;
        b.items.push({ id: sub.id, date: d, amount: price });
      }
    }
  }
  return buckets;
}

/** Upcoming payment events within `days` days. Trials ending are reported too. */
export function upcoming(subs, today, days = 30) {
  const end = fmtISO(new Date(parseDate(today).getFullYear(), parseDate(today).getMonth(), parseDate(today).getDate() + days));
  const events = [];
  for (const s of subs) {
    if (s.status !== 'active') continue;
    if (s.trialEnd && s.trialEnd >= today && s.trialEnd <= end) {
      events.push({ id: s.id, date: s.trialEnd, kind: 'trial' });
    }
    for (const d of occurrencesBetween(s, today, end, 60)) {
      if (s.trialEnd && d <= s.trialEnd) continue;
      events.push({ id: s.id, date: d, kind: 'pay' });
    }
  }
  events.sort((a, b) => a.date.localeCompare(b.date) || (a.kind === 'trial' ? -1 : 1));
  return events;
}

export function byCategory(subs, base, rates, today) {
  const map = new Map();
  for (const s of subs) {
    if (!isBilling(s, today)) continue;
    const key = s.category || 'other';
    map.set(key, (map.get(key) || 0) + monthlyCost(s, base, rates));
  }
  return [...map.entries()].map(([category, value]) => ({ category, value })).sort((a, b) => b.value - a.value);
}

/** Last day that still counts as paid: today, or the day a paused/cancelled sub stopped. */
function lastCountedDay(sub, today) {
  if (sub.status !== 'active' && sub.endedAt && sub.endedAt < today) return sub.endedAt;
  return today;
}

/** Past charge dates (oldest first), skipping the trial; stops at pause/cancel. */
export function pastPayments(sub, today, limit = 100000) {
  if (sub.start > today) return [];
  const end = lastCountedDay(sub, today);
  return occurrencesBetween(sub, sub.start, end, limit)
    .filter((d) => !(sub.trialEnd && d <= sub.trialEnd));
}

/** Your share paid since the first charge, in the subscription's currency (approximate). */
export function paidSoFar(sub, today) {
  return pastPayments(sub, today).length * share(sub);
}

/** Lifetime spend across all subscriptions in the base currency, plus per-subscription rows. */
export function lifetime(subs, base, rates, today) {
  const rows = subs.map((sub) => {
    const n = pastPayments(sub, today).length;
    return { id: sub.id, count: n, value: convert(n * share(sub), sub.currency, base, rates), since: sub.start };
  }).filter((r) => r.count > 0).sort((a, b) => b.value - a.value);
  return { total: rows.reduce((a, r) => a + r.value, 0), rows };
}

/**
 * Manual bills (rent, utilities) that are due today or overdue and not marked paid.
 * Looks back `lookback` days so old history does not flood the list.
 */
export function unpaid(subs, today, lookback = 62) {
  const t = parseDate(today);
  const from = fmtISO(new Date(t.getFullYear(), t.getMonth(), t.getDate() - lookback));
  const out = [];
  for (const sub of subs) {
    if (!sub.manual || sub.status !== 'active') continue;
    const paid = new Set(sub.paid || []);
    const begin = sub.start > from ? sub.start : from;
    if (begin > today) continue;
    for (const d of occurrencesBetween(sub, begin, today, 400)) {
      if (sub.trialEnd && d <= sub.trialEnd) continue;
      if (!paid.has(d)) out.push({ id: sub.id, date: d, kind: d === today ? 'due' : 'overdue' });
    }
  }
  return out.sort((a, b) => a.date.localeCompare(b.date));
}

/** Toggle a paid mark on a manual bill; keeps the newest 120 marks. */
export function togglePaid(sub, date) {
  const set = new Set(sub.paid || []);
  if (set.has(date)) set.delete(date); else set.add(date);
  return [...set].sort().slice(-120);
}

/** Status change bookkeeping: remember when a subscription stopped costing money. */
export function withStatus(sub, status, today) {
  if (status === sub.status) return { ...sub };
  const next = { ...sub, status };
  if (status === 'active') next.endedAt = '';
  else if (sub.status === 'active') next.endedAt = today;
  return next;
}

// ---------- iCalendar export ----------

function icsEscape(s) {
  return String(s || '').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
}

function foldLine(line) {
  // RFC 5545: lines max 75 octets; fold by characters (good enough for UTF-8 calendars in practice)
  const out = [];
  let rest = line;
  while (rest.length > 74) { out.push(rest.slice(0, 74)); rest = ' ' + rest.slice(74); }
  out.push(rest);
  return out.join('\r\n');
}

export function rrule(sub) {
  const e = Math.max(1, Math.floor(sub.every || 1));
  const day = parseDate(sub.start).getDate();
  switch (sub.unit) {
    case 'day': return `FREQ=DAILY;INTERVAL=${e}`;
    case 'week': return `FREQ=WEEKLY;INTERVAL=${e}`;
    case 'year': return `FREQ=YEARLY;INTERVAL=${e}`;
    case 'month':
    default: {
      if (day <= 28) return `FREQ=MONTHLY;INTERVAL=${e}`;
      // e.g. day 31 → last available day among 28..31 in each month
      const days = [];
      for (let d = 28; d <= day; d++) days.push(d);
      return `FREQ=MONTHLY;INTERVAL=${e};BYMONTHDAY=${days.join(',')};BYSETPOS=-1`;
    }
  }
}

export function toICS(subs, { remindDays = 1, now = new Date(), labels = {} } = {}) {
  const stamp = now.toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Subly//Subscriptions//RU', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
    `X-WR-CALNAME:${icsEscape(labels.calendar || 'Списано')}`];
  for (const s of subs) {
    if (s.status !== 'active') continue;
    const first = s.trialEnd && s.trialEnd >= s.start ? nextPayment(s, fmtISO(new Date(parseDate(s.trialEnd).getTime() + 86400000))) : s.start;
    const dt = first.replace(/-/g, '');
    const next = fmtISO(new Date(parseDate(first).getFullYear(), parseDate(first).getMonth(), parseDate(first).getDate() + 1)).replace(/-/g, '');
    const summary = `${s.name} — ${Number(s.price).toFixed(2).replace(/\.00$/, '')} ${s.currency}`;
    lines.push('BEGIN:VEVENT', `UID:${s.id}@subly.local`, `DTSTAMP:${stamp}`, `DTSTART;VALUE=DATE:${dt}`, `DTEND;VALUE=DATE:${next}`,
      `RRULE:${rrule({ ...s, start: first })}`, `SUMMARY:${icsEscape(summary)}`);
    if (s.notes) lines.push(`DESCRIPTION:${icsEscape(s.notes)}`);
    if (s.url) lines.push(`URL:${icsEscape(s.url)}`);
    if (remindDays >= 0) {
      lines.push('BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${icsEscape(summary)}`,
        `TRIGGER:-P${remindDays}DT0H0M0S`.replace('-P0DT0H0M0S', '-PT0M'), 'END:VALARM');
    }
    lines.push('END:VEVENT');
    if (s.trialEnd && s.trialEnd >= s.start) {
      const t = s.trialEnd.replace(/-/g, '');
      const tn = fmtISO(new Date(parseDate(s.trialEnd).getFullYear(), parseDate(s.trialEnd).getMonth(), parseDate(s.trialEnd).getDate() + 1)).replace(/-/g, '');
      lines.push('BEGIN:VEVENT', `UID:${s.id}-trial@subly.local`, `DTSTAMP:${stamp}`, `DTSTART;VALUE=DATE:${t}`, `DTEND;VALUE=DATE:${tn}`,
        `SUMMARY:${icsEscape((labels.trialEnds || 'Trial ends') + ': ' + s.name)}`,
        'BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${icsEscape(s.name)}`, 'TRIGGER:-P1DT0H0M0S', 'END:VALARM', 'END:VEVENT');
    }
  }
  lines.push('END:VCALENDAR');
  return lines.map(foldLine).join('\r\n') + '\r\n';
}

// ---------- CSV ----------

export function toCSV(rows) {
  const esc = (v) => {
    const s = v == null ? '' : String(v);
    return /[",;\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return '\uFEFF' + rows.map((r) => r.map(esc).join(';')).join('\r\n');
}

// ---------- validation / migration of imported data ----------

const CURRENCY_RE = /^[A-Z]{3}$/;

export function sanitizeSub(raw, uid) {
  if (!raw || typeof raw !== 'object') return null;
  const name = String(raw.name || '').trim().slice(0, 80);
  if (!name) return null;
  const start = /^\d{4}-\d{2}-\d{2}$/.test(raw.start) ? raw.start : null;
  if (!start || isNaN(parseDate(start))) return null;
  const unit = UNITS.includes(raw.unit) ? raw.unit : 'month';
  const every = Math.min(365, Math.max(1, Math.floor(Number(raw.every) || 1)));
  const price = Math.max(0, Math.round((Number(raw.price) || 0) * 100) / 100);
  const currency = CURRENCY_RE.test(raw.currency) ? raw.currency : 'RUB';
  const status = ['active', 'paused', 'cancelled'].includes(raw.status) ? raw.status : 'active';
  const trialEnd = /^\d{4}-\d{2}-\d{2}$/.test(raw.trialEnd) ? raw.trialEnd : '';
  let url = String(raw.url || '').trim().slice(0, 300);
  if (url && !/^https?:\/\//i.test(url)) url = '';
  return {
    id: typeof raw.id === 'string' && raw.id ? raw.id.slice(0, 40) : uid(),
    name, price, currency, unit, every, start, status, trialEnd,
    category: String(raw.category || 'other').slice(0, 40),
    method: String(raw.method || '').slice(0, 60),
    notes: String(raw.notes || '').slice(0, 1000),
    url,
    color: /^#[0-9a-f]{6}$/i.test(raw.color) ? raw.color : '',
    toCancel: !!raw.toCancel,
    manual: !!raw.manual,
    paid: Array.isArray(raw.paid) ? [...new Set(raw.paid.filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d)))].sort().slice(-120) : [],
    endedAt: /^\d{4}-\d{2}-\d{2}$/.test(raw.endedAt) ? raw.endedAt : '',
    shared: Math.min(20, Math.max(1, Math.floor(Number(raw.shared) || 1))),
    created: typeof raw.created === 'string' ? raw.created : todayISO(),
  };
}
