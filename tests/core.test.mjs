import test from 'node:test';
import assert from 'node:assert/strict';
import * as C from '../js/core.js';

const sub = (o) => ({ id: 'x', name: 'T', price: 100, currency: 'RUB', unit: 'month', every: 1, start: '2026-01-31', status: 'active', ...o });

test('month-end anchor does not drift', () => {
  const s = sub();
  assert.equal(C.nextPayment(s, '2026-02-01'), '2026-02-28');
  assert.equal(C.nextPayment(s, '2026-03-01'), '2026-03-31');
  assert.equal(C.nextPayment(s, '2026-04-01'), '2026-04-30');
  assert.equal(C.nextPayment(s, '2028-02-01'), '2028-02-29');
});

test('next payment on the same day is today', () => {
  assert.equal(C.nextPayment(sub({ start: '2026-05-10' }), '2026-11-10'), '2026-11-10');
});

test('future start returns start', () => {
  assert.equal(C.nextPayment(sub({ start: '2027-03-01' }), '2026-11-25'), '2027-03-01');
});

test('weekly / every-N / yearly', () => {
  assert.equal(C.nextPayment(sub({ unit: 'week', start: '2026-11-02' }), '2026-11-25'), '2026-11-30');
  assert.equal(C.nextPayment(sub({ unit: 'month', every: 3, start: '2026-01-15' }), '2026-11-25'), '2027-01-15');
  assert.equal(C.nextPayment(sub({ unit: 'year', start: '2024-02-29' }), '2026-11-25'), '2027-02-28');
  assert.equal(C.nextPayment(sub({ unit: 'day', every: 10, start: '2026-11-01' }), '2026-11-25'), '2026-12-01');
});

test('prevPayment', () => {
  assert.equal(C.prevPayment(sub({ start: '2026-01-10' }), '2026-11-25'), '2026-11-10');
  assert.equal(C.prevPayment(sub({ start: '2026-12-10' }), '2026-11-25'), null);
});

test('occurrencesBetween is inclusive', () => {
  const d = C.occurrencesBetween(sub({ unit: 'week', start: '2026-11-01' }), '2026-11-01', '2026-11-29');
  assert.deepEqual(d, ['2026-11-01', '2026-11-08', '2026-11-15', '2026-11-22', '2026-11-29']);
});

test('monthly cost, conversion and split', () => {
  const rates = { USD: 1, RUB: 0.0125 };
  assert.equal(Math.round(C.monthlyCost(sub({ price: 1200, unit: 'year' }), 'RUB', rates)), 100);
  assert.equal(Math.round(C.monthlyCost(sub({ price: 10, currency: 'USD' }), 'RUB', rates)), 800);
  assert.equal(C.monthlyCost(sub({ price: 300, shared: 3 }), 'RUB', rates), 100);
});

test('totals skip trials and paused, count savings', () => {
  const rates = { RUB: 1 };
  const t = C.totals([
    sub({ price: 100 }),
    sub({ price: 50, toCancel: true }),
    sub({ price: 999, status: 'paused' }),
    sub({ price: 300, trialEnd: '2026-12-01' }),
  ], 'RUB', rates, '2026-11-25');
  assert.equal(t.month, 150);
  assert.equal(t.cancelSave, 50);
  assert.equal(t.trialAfter, 300);
});

test('forecast buckets 12 months and skips trial payments', () => {
  const f = C.forecast([sub({ start: '2026-01-05', trialEnd: '2026-12-31' })], 'RUB', { RUB: 1 }, '2026-11-25', 12);
  assert.equal(f.length, 12);
  assert.equal(f[0].total, 0);
  assert.equal(f[1].total, 0); // Dec payment inside the trial
  assert.equal(f[2].total, 100);
});

test('upcoming includes trial end', () => {
  const u = C.upcoming([sub({ start: '2026-11-28', trialEnd: '2026-11-27' })], '2026-11-25', 7);
  assert.deepEqual(u.map((e) => e.kind + e.date), ['trial2026-11-27', 'pay2026-11-28']);
});

test('rrule month end', () => {
  assert.equal(C.rrule(sub()), 'FREQ=MONTHLY;INTERVAL=1;BYMONTHDAY=28,29,30,31;BYSETPOS=-1');
  assert.equal(C.rrule(sub({ start: '2026-01-05', unit: 'week', every: 2 })), 'FREQ=WEEKLY;INTERVAL=2');
});

test('ics is well-formed', () => {
  const ics = C.toICS([sub({ name: 'Кино, музыка; всё' })], { now: new Date('2026-11-25T10:00:00Z') });
  assert.match(ics, /^BEGIN:VCALENDAR\r\n/);
  assert.match(ics, /SUMMARY:Кино\\, музыка\\; всё — 100 RUB/);
  assert.match(ics, /TRIGGER:-P1DT0H0M0S/);
  assert.match(ics, /END:VCALENDAR\r\n$/);
});

test('sanitizeSub rejects junk and clamps values', () => {
  let n = 0; const uid = () => 'id' + (++n);
  assert.equal(C.sanitizeSub({ name: '' }, uid), null);
  assert.equal(C.sanitizeSub({ name: 'a', start: 'nope' }, uid), null);
  const s = C.sanitizeSub({ name: ' A ', start: '2026-01-01', price: '-5', unit: 'bogus', url: 'javascript:alert(1)', every: 0 }, uid);
  assert.equal(s.name, 'A');
  assert.equal(s.price, 0);
  assert.equal(s.unit, 'month');
  assert.equal(s.url, '');
  assert.equal(s.every, 1);
});

test('csv escapes', () => {
  assert.equal(C.toCSV([['a;b', 'c"d']]), '﻿"a;b";"c""d"');
});
