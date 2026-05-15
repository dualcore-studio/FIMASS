'use strict';

/**
 * Giorno civile YYYY-MM-DD da `created_at` (naive "YYYY-MM-DD HH:mm:ss", ISO con T, ecc.).
 * Evita confronti stringa errati tra timestamp ISO e suffissi " 23:59:59".
 * @param {string|number|null|undefined} createdAt
 * @returns {string|null}
 */
function createdAtDayKey(createdAt) {
  if (createdAt == null || createdAt === '') return null;
  const s = String(createdAt).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const m = s.match(/^(\d{4}-\d{2}-\d{2})[ T]/);
  if (m) return m[1];
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return null;
  const y = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, '0');
  const da = String(d.getDate()).padStart(2, '0');
  return `${y}-${mo}-${da}`;
}

/**
 * @param {{ created_at?: string|null }} row
 * @param {string} [dataDa] YYYY-MM-DD
 * @param {string} [dataA] YYYY-MM-DD
 */
function rowCreatedInOpenRange(row, dataDa, dataA) {
  const key = createdAtDayKey(row.created_at);
  if (key == null) return false;
  const da = dataDa != null && dataDa !== '' ? String(dataDa).trim().slice(0, 10) : '';
  const a = dataA != null && dataA !== '' ? String(dataA).trim().slice(0, 10) : '';
  if (da && key < da) return false;
  if (a && key > a) return false;
  return true;
}

module.exports = { createdAtDayKey, rowCreatedInOpenRange };
