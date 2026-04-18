/**
 * Garanzie RC Auto dai soli flag nei dati specifici (chiavi in shared/rcAutoGuaranteeFields.json).
 */

const path = require('path');

// eslint-disable-next-line import/no-dynamic-require, global-require
const RC_AUTO_GUARANTEE_FIELDS = require(path.join(__dirname, '..', '..', '..', 'shared', 'rcAutoGuaranteeFields.json'));

function normalizeNome(s) {
  return String(s || '').trim();
}

function isRcAutoGuaranteeSi(val) {
  const t = String(val ?? '')
    .trim()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase();
  return t === 'si';
}

/**
 * @param {Record<string, unknown> | null | undefined} datiSpecifici
 * @returns {string[]} etichette garanzia nell'ordine della mappa
 */
function getRcGaranzieSelezionate(datiSpecifici) {
  if (!datiSpecifici || typeof datiSpecifici !== 'object') return [];

  const out = [];
  for (const [key, label] of Object.entries(RC_AUTO_GUARANTEE_FIELDS)) {
    if (isRcAutoGuaranteeSi(datiSpecifici[key])) {
      out.push(label);
    }
  }
  return out;
}

function isRcAutoTipoCodice(codice) {
  return String(codice || '').trim().toLowerCase() === 'rc_auto';
}

/**
 * @param {{ nome: string; prezzo: number }[]} pricingBreakdown
 * @param {string[]} garanzieAttese
 * @returns {{ ok: true } | { ok: false; error: string }}
 */
function validateRcPricingForGaranzie(pricingBreakdown, garanzieAttese) {
  if (!Array.isArray(pricingBreakdown)) {
    return { ok: false, error: 'Formato prezzi non valido' };
  }

  const byNome = new Map();
  for (const row of pricingBreakdown) {
    if (!row || typeof row !== 'object') {
      return { ok: false, error: 'Formato prezzi non valido' };
    }
    const nome = normalizeNome(row.nome);
    if (!nome) {
      return { ok: false, error: 'Ogni voce deve avere un nome garanzia' };
    }
    const prezzo = row.prezzo;
    if (prezzo === null || prezzo === undefined || prezzo === '') {
      return { ok: false, error: `Prezzo mancante per: ${nome}` };
    }
    const n = Number(prezzo);
    if (!Number.isFinite(n) || n < 0) {
      return { ok: false, error: `Prezzo non valido per: ${nome}` };
    }
    byNome.set(nome, n);
  }

  for (const g of garanzieAttese) {
    if (!byNome.has(g)) {
      return { ok: false, error: `Prezzo mancante per la garanzia: ${g}` };
    }
  }

  for (const nome of byNome.keys()) {
    if (!garanzieAttese.includes(nome)) {
      return { ok: false, error: `Voce prezzo non prevista dalla richiesta: ${nome}` };
    }
  }

  return { ok: true };
}

function totalFromBreakdown(pricingBreakdown) {
  if (!Array.isArray(pricingBreakdown)) return 0;
  return pricingBreakdown.reduce((acc, row) => acc + (Number(row?.prezzo) || 0), 0);
}

module.exports = {
  RC_AUTO_GUARANTEE_FIELDS,
  getRcGaranzieSelezionate,
  isRcAutoGuaranteeSi,
  isRcAutoTipoCodice,
  validateRcPricingForGaranzie,
  totalFromBreakdown,
  normalizeNome,
};
