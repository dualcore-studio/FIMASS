'use strict';

/**
 * Parsing date/datetime da DB (SQLite / Instant) in Date locale.
 * @param {string|null|undefined} value
 * @returns {Date|null}
 */
function parseDbDateTime(value) {
  if (value == null || value === '') return null;
  const s = String(value).trim();
  if (!s) return null;
  const iso = s.includes('T') ? s : s.replace(' ', 'T');
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * @param {Date} d
 * @returns {string|null}
 */
function toIsoDateTime(d) {
  if (!(d instanceof Date) || Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 19).replace('T', ' ');
}

function addMonths(date, months) {
  const d = new Date(date.getTime());
  const day = d.getDate();
  d.setMonth(d.getMonth() + months);
  if (d.getDate() < day) d.setDate(0);
  return d;
}

/**
 * Scadenza polizza: 12 mesi dopo emissione.
 * @param {Date|null|undefined} fromDate
 * @returns {Date|null}
 */
function calculatePolicyExpiryDate(fromDate) {
  if (!fromDate) return null;
  return addMonths(fromDate, 12);
}

function todayLocalYmd() {
  const n = new Date();
  const y = n.getFullYear();
  const m = String(n.getMonth() + 1).padStart(2, '0');
  const day = String(n.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function datePartYmd(value) {
  if (value == null || value === '') return null;
  const m = String(value).match(/^(\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : null;
}

function isDateBeforeTodayYmd(ymd) {
  if (!ymd) return false;
  return ymd < todayLocalYmd();
}

module.exports = {
  parseDbDateTime,
  toIsoDateTime,
  calculatePolicyExpiryDate,
  addMonths,
  todayLocalYmd,
  datePartYmd,
  isDateBeforeTodayYmd,
};
