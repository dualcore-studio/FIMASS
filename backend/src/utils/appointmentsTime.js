const TIME_RE = /^([01]?\d|2[0-3]):[0-5]\d$/;

function parseTimeToMinutes(ora) {
  if (!ora || !TIME_RE.test(String(ora).trim())) return null;
  const [h, m] = String(ora).trim().split(':').map((x) => parseInt(x, 10));
  if (Number.isNaN(h) || Number.isNaN(m)) return null;
  return h * 60 + m;
}

/**
 * @param {string} ora - HH:MM
 * @param {number} addMin
 */
function addMinutesToOra(ora, addMin) {
  const t = parseTimeToMinutes(ora);
  if (t == null) return null;
  let total = t + addMin;
  if (total >= 24 * 60) total = 24 * 60 - 1; // 23:59 cap per stesso giorno
  if (total < 0) total = 0;
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/**
 * @returns {boolean} true se [s1, e1) e [s2, e2) si sovrappongono
 */
function intervalsOverlap(oraInizio1, minEnd1, oraInizio2, minEnd2) {
  const s1 = parseTimeToMinutes(oraInizio1);
  const s2 = parseTimeToMinutes(oraInizio2);
  if (s1 == null || s2 == null) return false;
  const e1 = s1 + minEnd1;
  const e2 = s2 + minEnd2;
  return s1 < e2 && s2 < e1;
}

/**
 * @param {string} data1 - YYYY-MM-DD
 * @param {string} data2
 */
function sameData(data1, data2) {
  return String(data1).slice(0, 10) === String(data2).slice(0, 10);
}

module.exports = {
  TIME_RE,
  parseTimeToMinutes,
  addMinutesToOra,
  intervalsOverlap,
  sameData,
};
