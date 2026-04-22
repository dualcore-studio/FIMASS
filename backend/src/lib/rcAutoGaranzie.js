/**
 * Garanzie RC Auto dai flag booleani e/o `garanzie_selezionate` nei dati specifici.
 * Mappa chiavi → etichette: shared/rcAutoGuaranteeFields.json
 */

const path = require('path');

// eslint-disable-next-line import/no-dynamic-require, global-require
const RC_AUTO_GUARANTEE_FIELDS = require(path.join(__dirname, '..', '..', '..', 'shared', 'rcAutoGuaranteeFields.json'));

const NEST_KEYS = ['formData', 'form', 'values', 'fields', 'campi'];

const MULTI_OPTION_TO_LABEL = {
  'rc auto': 'RC',
  'furto e incendio': 'Furto e Incendio',
  'atti vandalici': 'Atti Vandalici',
  cristalli: 'Cristalli',
  'eventi naturali': 'Eventi Naturali',
  'assistenza stradale': 'Assistenza Stradale',
  'tutela legale': 'Tutela Legale',
  'altre garanzie': 'Altre garanzie',
};

const LABEL_ORDER = [...Object.values(RC_AUTO_GUARANTEE_FIELDS), 'Altre garanzie'];

function labelOrderIndex(label) {
  const i = LABEL_ORDER.indexOf(label);
  return i >= 0 ? i : 1000;
}

function sortGaranzieLabels(labels) {
  return [...labels].sort((a, b) => {
    const d = labelOrderIndex(a) - labelOrderIndex(b);
    if (d !== 0) return d;
    return a.localeCompare(b, 'it');
  });
}

function mapMultiselectOption(raw) {
  const k = String(raw || '').trim().toLowerCase();
  if (!k) return '';
  return MULTI_OPTION_TO_LABEL[k] ?? String(raw).trim();
}

function findGaranzieSelezionateArray(datiSpecifici) {
  const direct = datiSpecifici.garanzie_selezionate;
  if (Array.isArray(direct)) return direct;
  for (const nk of NEST_KEYS) {
    const v = datiSpecifici[nk];
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      const inner = v.garanzie_selezionate;
      if (Array.isArray(inner)) return inner;
    }
  }
  return null;
}

function normalizeNome(s) {
  return String(s || '').trim();
}

function isRcAutoGuaranteeFieldTrue(val) {
  return val === true;
}

/**
 * @param {Record<string, unknown> | null | undefined} datiSpecifici
 * @returns {Record<string, unknown>}
 */
function resolveRcAutoGuaranteeSource(datiSpecifici) {
  if (!datiSpecifici || typeof datiSpecifici !== 'object') return {};
  const guaranteeKeys = Object.keys(RC_AUTO_GUARANTEE_FIELDS);
  /** @type {Record<string, unknown>[]} */
  const candidates = [datiSpecifici];
  for (const k of NEST_KEYS) {
    const v = datiSpecifici[k];
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      candidates.push(v);
    }
  }
  for (const o of candidates) {
    if (guaranteeKeys.some((key) => Object.prototype.hasOwnProperty.call(o, key))) {
      return o;
    }
  }
  return datiSpecifici;
}

function getRcGaranzieFromBooleans(datiSpecifici) {
  const src = resolveRcAutoGuaranteeSource(datiSpecifici);
  const out = [];
  for (const [key, label] of Object.entries(RC_AUTO_GUARANTEE_FIELDS)) {
    if (Object.prototype.hasOwnProperty.call(src, key) && isRcAutoGuaranteeFieldTrue(src[key])) {
      out.push(label);
    }
  }
  return out;
}

function getRcGaranzieFromMultiselect(datiSpecifici) {
  const arr = findGaranzieSelezionateArray(datiSpecifici);
  if (!arr || arr.length === 0) return [];
  const labels = arr.map((x) => mapMultiselectOption(x)).filter((s) => s.length > 0);
  return sortGaranzieLabels([...new Set(labels)]);
}

/**
 * @param {Record<string, unknown> | null | undefined} datiSpecifici
 * @returns {string[]}
 */
function getRcGaranzieSelezionate(datiSpecifici) {
  if (!datiSpecifici || typeof datiSpecifici !== 'object') return [];

  const fromBools = getRcGaranzieFromBooleans(datiSpecifici);
  if (fromBools.length > 0) return fromBools;

  return getRcGaranzieFromMultiselect(datiSpecifici);
}

function isRcAutoTipoCodice(codice) {
  return String(codice ?? '')
    .trim()
    .toLowerCase() === 'rc_auto';
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
  resolveRcAutoGuaranteeSource,
  getRcGaranzieSelezionate,
  isRcAutoGuaranteeFieldTrue,
  isRcAutoTipoCodice,
  validateRcPricingForGaranzie,
  totalFromBreakdown,
  normalizeNome,
};
