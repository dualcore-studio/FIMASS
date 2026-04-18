/**
 * Garanzie RC Auto richieste dalla struttura (campo multiselect + compatibilità testo libero legacy).
 */

function normalizeNome(s) {
  return String(s || '').trim();
}

/**
 * @param {Record<string, unknown> | null | undefined} datiSpecifici
 * @returns {string[]} nomi garanzie nell'ordine salvato, senza duplicati
 */
function getRcGaranzieSelezionate(datiSpecifici) {
  if (!datiSpecifici || typeof datiSpecifici !== 'object') return [];

  const rawNew = datiSpecifici.garanzie_selezionate;
  if (Array.isArray(rawNew) && rawNew.length > 0) {
    const out = [];
    const seen = new Set();
    for (const x of rawNew) {
      const n = normalizeNome(x);
      if (!n || seen.has(n)) continue;
      seen.add(n);
      out.push(n);
    }
    return out;
  }

  const legacy = datiSpecifici.garanzie_richieste;
  if (typeof legacy === 'string' && legacy.trim()) {
    const parts = legacy
      .split(/[,;\n\r]+/)
      .map((p) => normalizeNome(p))
      .filter(Boolean);
    const out = [];
    const seen = new Set();
    for (const n of parts) {
      if (seen.has(n)) continue;
      seen.add(n);
      out.push(n);
    }
    return out;
  }

  return [];
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
  getRcGaranzieSelezionate,
  isRcAutoTipoCodice,
  validateRcPricingForGaranzie,
  totalFromBreakdown,
  normalizeNome,
};
