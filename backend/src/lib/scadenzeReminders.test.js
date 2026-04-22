'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  REMINDER_TYPE,
  nextCalendarMonth,
  getReminderTypeForRomeDay,
  isPlausibleEmail,
  formatItalianMonthTitle,
  getDatePartsInTimeZone,
  groupByStruttura,
  monthRangeIso,
} = require('./scadenzeReminders');

test('nextCalendarMonth', () => {
  assert.deepEqual(nextCalendarMonth(2026, 4), { year: 2026, month: 5 });
  assert.deepEqual(nextCalendarMonth(2026, 12), { year: 2027, month: 1 });
});

test('getReminderTypeForRomeDay', () => {
  assert.equal(getReminderTypeForRomeDay(1), REMINDER_TYPE.FIRST_NOTICE);
  assert.equal(getReminderTypeForRomeDay(15), REMINDER_TYPE.SECOND_NOTICE);
  assert.equal(getReminderTypeForRomeDay(14), null);
});

test('isPlausibleEmail', () => {
  assert.equal(isPlausibleEmail('a@b.co'), true);
  assert.equal(isPlausibleEmail(''), false);
  assert.equal(isPlausibleEmail('nope'), false);
});

test('formatItalianMonthTitle capitalizes', () => {
  const s = formatItalianMonthTitle(2026, 5);
  assert.match(s, /^Maggio 2026$/i);
  assert.equal(s[0], s[0].toUpperCase());
});

test('getDatePartsInTimeZone — 1 aprile Roma', () => {
  const d = new Date('2026-04-01T06:00:00.000Z');
  const p = getDatePartsInTimeZone(d, 'Europe/Rome');
  assert.equal(p.year, 2026);
  assert.equal(p.month, 4);
  assert.equal(p.day, 1);
});

test('monthRangeIso bounds', () => {
  const { start, end } = monthRangeIso({ y: 2026, m: 5 });
  assert.equal(start, '2026-05-01 00:00:00');
  assert.equal(end, '2026-05-31 23:59:59');
});

test('groupByStruttura', () => {
  const m = groupByStruttura([
    { struttura_id: 2, contraente: 'A' },
    { struttura_id: 2, contraente: 'B' },
    { struttura_id: 3, contraente: 'C' },
  ]);
  assert.equal(m.size, 2);
  assert.equal(m.get(2).length, 2);
  assert.equal(m.get(3).length, 1);
});
