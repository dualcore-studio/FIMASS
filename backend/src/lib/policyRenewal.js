'use strict';

const { list, getById, findOne, insert, upsertById } = require('../data/store');
const { loadContext, parseMaybeJson, enrichPolicy, enrichQuote } = require('../data/views');
const { normalizePolicyStato } = require('../utils/policyStato');
const {
  datePartYmd,
  isDateBeforeTodayYmd,
  parseDbDateTime,
  toIsoDateTime,
} = require('../utils/policyDates');

const RENEWAL_STATUS = {
  DA_RINNOVARE: 'da_rinnovare',
  PREVENTIVO_CREATO: 'preventivo_rinnovo_creato',
  RINNOVATA: 'rinnovata',
  NON_RINNOVATA: 'non_rinnovata',
};

/** Etichette UI allineate al frontend */
const DISPLAY = {
  DA_RINNOVARE: 'Da rinnovare',
  PREVENTIVO_CREATO: 'Preventivo rinnovo creato',
  RINNOVATA: 'Rinnovata',
  SCADUTA: 'Scaduta',
  NON_RINNOVATA: 'Non rinnovata',
};

function isTruthyInt(v) {
  return v === 1 || v === true || v === '1';
}

function normalizeRenewalStatus(raw) {
  const s = raw == null ? '' : String(raw).trim().toLowerCase().replace(/\s+/g, '_');
  const map = {
    da_rinnovare: RENEWAL_STATUS.DA_RINNOVARE,
    preventivo_rinnovo_creato: RENEWAL_STATUS.PREVENTIVO_CREATO,
    rinnovata: RENEWAL_STATUS.RINNOVATA,
    non_rinnovata: RENEWAL_STATUS.NON_RINNOVATA,
  };
  return map[s] || RENEWAL_STATUS.DA_RINNOVARE;
}

/**
 * @param {object} params
 * @param {{ renewal_status?: string, renewed_by_policy_id?: number|null }|null} params.pe
 * @param {{ rinnovata?: number|boolean }} params.policy
 * @param {string|null} params.ymdScadenza
 */
function computeScadenzaDisplayStato({ pe, policy, ymdScadenza }) {
  const st = pe ? normalizeRenewalStatus(pe.renewal_status) : RENEWAL_STATUS.DA_RINNOVARE;
  const legacyRinnovata = isTruthyInt(policy?.rinnovata);
  const hasRenewedBy = pe?.renewed_by_policy_id != null && Number(pe.renewed_by_policy_id) > 0;

  if (st === RENEWAL_STATUS.RINNOVATA || hasRenewedBy || (legacyRinnovata && st !== RENEWAL_STATUS.NON_RINNOVATA)) {
    return DISPLAY.RINNOVATA;
  }
  if (st === RENEWAL_STATUS.NON_RINNOVATA) {
    return DISPLAY.NON_RINNOVATA;
  }
  if (st === RENEWAL_STATUS.PREVENTIVO_CREATO) {
    return DISPLAY.PREVENTIVO_CREATO;
  }
  if (isDateBeforeTodayYmd(ymdScadenza)) {
    return DISPLAY.SCADUTA;
  }
  return DISPLAY.DA_RINNOVARE;
}

function countsAsScadutaKpi(displayStato, ymdScadenza) {
  if (displayStato === DISPLAY.RINNOVATA || displayStato === DISPLAY.NON_RINNOVATA) return false;
  return isDateBeforeTodayYmd(ymdScadenza);
}

function countsAsDaRinnovareKpi(pe, policy, displayStato) {
  if (displayStato === DISPLAY.RINNOVATA || displayStato === DISPLAY.NON_RINNOVATA) return false;
  const st = pe ? normalizeRenewalStatus(pe.renewal_status) : RENEWAL_STATUS.DA_RINNOVARE;
  return st === RENEWAL_STATUS.DA_RINNOVARE || st === RENEWAL_STATUS.PREVENTIVO_CREATO;
}

async function ensurePolicyExpirationForEmessaPolicy(policyId) {
  const pid = Number(policyId);
  const policy = await getById('policies', pid);
  if (!policy || normalizePolicyStato(policy.stato) !== 'EMESSA') return null;

  const existing = await findOne('policy_expirations', (e) => Number(e.policy_id) === pid);
  if (existing) return existing;

  let renewal_status = RENEWAL_STATUS.DA_RINNOVARE;
  if (isTruthyInt(policy.rinnovata)) renewal_status = RENEWAL_STATUS.RINNOVATA;

  const row = await insert('policy_expirations', {
    policy_id: pid,
    renewal_status,
    renewal_quote_id: null,
    renewed_by_policy_id: null,
    renewal_completed_at: null,
  });
  return row;
}

async function getExpirationForPolicy(policyId, ctx) {
  const pid = Number(policyId);
  if (ctx?.policyExpirationsByPolicyId) {
    return ctx.policyExpirationsByPolicyId.get(pid) || null;
  }
  return findOne('policy_expirations', (e) => Number(e.policy_id) === pid);
}

function buildPolicyExpirationsIndex(rows) {
  const map = new Map();
  for (const r of rows || []) {
    map.set(Number(r.policy_id), r);
  }
  return map;
}

async function mergeExpirationsIntoContext(ctx) {
  const rows = await list('policy_expirations');
  return {
    ...ctx,
    policy_expirations: rows,
    policyExpirationsByPolicyId: buildPolicyExpirationsIndex(rows),
  };
}

function deepCopyJson(val) {
  if (val == null) return null;
  if (typeof val === 'object' && !Array.isArray(val)) return { ...val };
  try {
    return JSON.parse(JSON.stringify(val));
  } catch {
    return null;
  }
}

/**
 * @returns {Promise<{ ok: boolean, error?: string, code?: number, quoteId?: number, numero?: string }>}
 */
async function createRenewalQuoteFromScadenza({
  req,
  sourcePolicyId,
  privacyConsentAccepted,
  getUserDisplayName,
  generateQuoteNumber,
  logActivity,
  writeAuditLog,
  getClientIp,
  sendQuotePresentedByStructureToAdminMail,
  PRIVACY_POLICY_VERSION,
  AUDIT_ACTIONS,
}) {
  if (privacyConsentAccepted !== true) {
    return {
      ok: false,
      code: 400,
      error:
        'Per creare il preventivo di rinnovo è necessario prestare il consenso al trattamento dei dati personali come indicato nell’Informativa Privacy.',
    };
  }

  const ctx = await mergeExpirationsIntoContext(await loadContext());

  const policyRow = await getById('policies', sourcePolicyId);
  if (!policyRow) return { ok: false, code: 404, error: 'Polizza non trovata' };
  if (normalizePolicyStato(policyRow.stato) !== 'EMESSA') {
    return { ok: false, code: 400, error: 'Solo polizze emesse possono generare un rinnovo' };
  }

  if (Number(policyRow.struttura_id) !== Number(req.user.id)) {
    return { ok: false, code: 403, error: 'Solo la struttura titolare può creare il preventivo di rinnovo' };
  }

  let pe = await getExpirationForPolicy(sourcePolicyId, ctx);
  if (!pe) {
    pe = await ensurePolicyExpirationForEmessaPolicy(sourcePolicyId);
  }
  if (!pe) return { ok: false, code: 400, error: 'Impossibile inizializzare la scadenza per questa polizza' };

  const st = normalizeRenewalStatus(pe.renewal_status);
  if (st === RENEWAL_STATUS.RINNOVATA || pe.renewed_by_policy_id) {
    return { ok: false, code: 400, error: 'Questa scadenza risulta già rinnovata' };
  }
  if (st === RENEWAL_STATUS.NON_RINNOVATA) {
    return {
      ok: false,
      code: 400,
      error: 'Scadenza segnata come non rinnovata. Contatta un amministratore per riaprire il rinnovo.',
    };
  }

  if (pe.renewal_quote_id) {
    const qPrev = await getById('quotes', pe.renewal_quote_id);
    if (qPrev) {
      return {
        ok: false,
        code: 409,
        error: 'Esiste già un preventivo di rinnovo collegato a questa scadenza.',
        quoteId: qPrev.id,
        numero: qPrev.numero,
      };
    }
    await upsertById('policy_expirations', pe.id, { renewal_quote_id: null });
  }

  const policy = enrichPolicy(policyRow, ctx);
  const oldQuote = ctx.quotesById.get(Number(policy.quote_id)) || {};
  const insType = await getById('insurance_types', policy.tipo_assicurazione_id);
  if (!insType) return { ok: false, code: 400, error: 'Tipologia assicurativa non valida' };

  const { isInsuranceTypeActive, strutturaCanUseInsuranceType } = require('../lib/insuranceTypes');
  if (!isInsuranceTypeActive(insType)) {
    return { ok: false, code: 400, error: 'Questa tipologia non è più attiva per nuove richieste' };
  }
  if (!strutturaCanUseInsuranceType(req.user, insType.codice)) {
    return { ok: false, code: 403, error: 'Tipologia non abilitata per la tua struttura' };
  }

  const assisted = await getById('assisted_people', policy.assistito_id);
  if (!assisted) return { ok: false, code: 400, error: 'Assistito non trovato' };
  if (!assisted.email || !String(assisted.email).trim()) {
    return { ok: false, code: 400, error: 'Email assistito obbligatoria per creare il preventivo' };
  }
  const indirizzoAss = assisted.indirizzo != null ? String(assisted.indirizzo).trim() : '';
  const capAss = assisted.cap != null ? String(assisted.cap).trim() : '';
  const cittaAss = assisted.citta != null ? String(assisted.citta).trim() : '';
  if (!indirizzoAss || !capAss || !/^\d{5}$/.test(capAss) || !cittaAss) {
    return {
      ok: false,
      code: 400,
      error: 'Completa indirizzo, CAP e città dell’assistito prima di creare il rinnovo.',
    };
  }

  const scadenzaEff = policy.data_scadenza
    ? policy.data_scadenza
    : oldQuote.data_decorrenza || null;
  const ymd = datePartYmd(scadenzaEff);
  let data_decorrenza = ymd;
  if (ymd) {
    const d = parseDbDateTime(`${ymd} 00:00:00`);
    if (d) {
      const next = new Date(d.getTime());
      next.setDate(next.getDate() + 1);
      data_decorrenza = next.toISOString().slice(0, 10);
    }
  }

  const datiSpecifici = deepCopyJson(parseMaybeJson(policy.dati_specifici)) || deepCopyJson(parseMaybeJson(oldQuote.dati_specifici)) || {};
  const prevDp = normalizeDatiPreventivoForRenewal(oldQuote.dati_preventivo, policy);
  const compagniaVal = policy.compagnia != null && String(policy.compagnia).trim() !== '' ? String(policy.compagnia).trim() : prevDp.compagnia;
  const dati_preventivo = {
    ...prevDp,
    rinnovo: true,
    polizza_origine_id: policy.id,
    polizza_origine_numero: policy.numero,
    compagnia: compagniaVal || prevDp.compagnia,
  };

  const scadenzaLabel = ymd
    ? new Date(`${ymd}T12:00:00`).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' })
    : '—';
  const noteRenewal = `Preventivo generato come rinnovo della polizza ${policy.numero} in scadenza il ${scadenzaLabel}.`;
  const note_struttura = noteRenewal;

  const numero = await generateQuoteNumber();
  const consentAt = new Date().toISOString().slice(0, 19).replace('T', ' ');
  const consentIp = getClientIp(req);

  const result = await insert('quotes', {
    numero,
    assistito_id: policy.assistito_id,
    tipo_assicurazione_id: policy.tipo_assicurazione_id,
    struttura_id: policy.struttura_id,
    operatore_id: policy.operatore_id ?? null,
    fornitore_id: policy.fornitore_id ?? null,
    stato: 'PRESENTATA',
    data_decorrenza,
    note_struttura,
    note_allegati: null,
    dati_specifici: Object.keys(datiSpecifici).length ? datiSpecifici : null,
    dati_preventivo: Object.keys(dati_preventivo).length ? dati_preventivo : null,
    has_policy: 0,
    privacy_consent_required: 1,
    privacy_consent_at: consentAt,
    privacy_consent_ip: consentIp,
    privacy_policy_version: PRIVACY_POLICY_VERSION,
    marketing_consent: 0,
    marketing_consent_at: null,
    is_renewal: 1,
    renewal_source_expiration_id: pe.id,
    renewal_source_policy_id: policy.id,
  });

  const quoteId = result.id;

  await insert('quote_status_history', { quote_id: quoteId, stato_nuovo: 'PRESENTATA', utente_id: req.user.id });
  await upsertById('policy_expirations', pe.id, {
    renewal_quote_id: quoteId,
    renewal_status: RENEWAL_STATUS.PREVENTIVO_CREATO,
  });

  await logActivity({
    utente_id: req.user.id,
    utente_nome: getUserDisplayName(req.user),
    ruolo: req.user.role,
    azione: 'CREAZIONE_PREVENTIVO_RINNOVO',
    modulo: 'scadenze',
    riferimento_id: quoteId,
    riferimento_tipo: 'quote',
    dettaglio: `Preventivo rinnovo ${numero} da polizza ${policy.numero} (scadenza id ${pe.id})`,
  });

  await writeAuditLog({
    userId: req.user.id,
    action: AUDIT_ACTIONS.QUOTE_RENEWAL_CREATE,
    entityType: 'quote',
    entityId: quoteId,
    metadata: { numero, source_policy_id: policy.id, expiration_id: pe.id },
    ipAddress: consentIp,
  });

  const ctxPresented = await loadContext();
  const enrichedPresented = enrichQuote(await getById('quotes', quoteId), ctxPresented);
  const dataPresentazione =
    enrichedPresented.created_at || enrichedPresented.updated_at || consentAt;
  const strutturaNomePresented = enrichedPresented.struttura_nome || getUserDisplayName(req.user);
  const admins = (await list('users')).filter((u) => u.role === 'admin');
  const adminEmailsSeen = new Set();
  for (const u of admins) {
    const adminMail = u.email && String(u.email).trim();
    if (!adminMail) continue;
    if (adminEmailsSeen.has(adminMail)) continue;
    adminEmailsSeen.add(adminMail);
    const adminName = [u.nome, u.cognome].filter(Boolean).join(' ').trim() || u.username || 'Amministratore';
    await sendQuotePresentedByStructureToAdminMail({
      to: adminMail,
      adminName,
      quoteId,
      quoteNumero: numero,
      strutturaNome: strutturaNomePresented,
      dataPresentazione,
    });
  }

  return { ok: true, quoteId, numero, expirationId: pe.id };
}

function normalizeDatiPreventivoForRenewal(rawDp, policy) {
  const dp = parseMaybeJson(rawDp);
  const base = dp && typeof dp === 'object' && !Array.isArray(dp) ? { ...dp } : {};
  if (policy.compagnia) {
    const c = String(policy.compagnia).trim();
    if (c) base.compagnia = c;
  }
  return base;
}

/**
 * Chiusura automatica rinnovo quando la nuova polizza passa a EMESSA.
 */
async function completeRenewalIfIssuedFromRenewalQuote({
  newPolicy,
  actingUser,
  getUserDisplayName,
  logActivity,
  writeAuditLog,
  getClientIp,
  req,
  AUDIT_ACTIONS,
}) {
  const quote = await getById('quotes', newPolicy.quote_id);
  if (!quote || !isTruthyInt(quote.is_renewal)) return null;

  const expId = quote.renewal_source_expiration_id;
  let pe = expId ? await getById('policy_expirations', expId) : null;
  if (!pe && quote.id) {
    pe = await findOne('policy_expirations', (e) => Number(e.renewal_quote_id) === Number(quote.id));
  }
  if (!pe) return null;

  const completedAt =
    newPolicy.data_emissione || new Date().toISOString().slice(0, 19).replace('T', ' ');

  await upsertById('policy_expirations', pe.id, {
    renewal_status: RENEWAL_STATUS.RINNOVATA,
    renewed_by_policy_id: newPolicy.id,
    renewal_completed_at: completedAt,
  });

  const srcPolicyId = quote.renewal_source_policy_id || pe.policy_id;
  if (srcPolicyId) {
    await upsertById('policies', srcPolicyId, { rinnovata: 1 });
  }

  const displayName = getUserDisplayName(actingUser);
  await logActivity({
    utente_id: actingUser.id,
    utente_nome: displayName,
    ruolo: actingUser.role,
    azione: 'RINNOVO_COMPLETATO_AUTO',
    modulo: 'scadenze',
    riferimento_id: newPolicy.id,
    riferimento_tipo: 'policy',
    dettaglio: `Rinnovo chiuso: nuova polizza emessa id ${newPolicy.id} su scadenza (expiration ${pe.id})`,
  });

  await writeAuditLog({
    userId: actingUser.id,
    action: AUDIT_ACTIONS.POLICY_RENEWAL_COMPLETED,
    entityType: 'policy_expiration',
    entityId: pe.id,
    metadata: { new_policy_id: newPolicy.id, source_policy_id: srcPolicyId, quote_id: quote.id },
    ipAddress: getClientIp ? getClientIp(req) : null,
  });

  return pe.id;
}

async function reopenRenewalForCorrection(policyId, actingUser) {
  const pe = await findOne('policy_expirations', (e) => Number(e.policy_id) === Number(policyId));
  if (!pe) return { ok: false, error: 'Scadenza non trovata' };
  if (normalizeRenewalStatus(pe.renewal_status) !== RENEWAL_STATUS.NON_RINNOVATA) {
    return { ok: false, error: 'Riapertura consentita solo su scadenze segnate come non rinnovate' };
  }
  await upsertById('policy_expirations', pe.id, {
    renewal_status: RENEWAL_STATUS.DA_RINNOVARE,
    renewal_quote_id: null,
  });
  return { ok: true, expirationId: pe.id };
}

module.exports = {
  RENEWAL_STATUS,
  DISPLAY,
  normalizeRenewalStatus,
  computeScadenzaDisplayStato,
  countsAsScadutaKpi,
  countsAsDaRinnovareKpi,
  ensurePolicyExpirationForEmessaPolicy,
  getExpirationForPolicy,
  mergeExpirationsIntoContext,
  buildPolicyExpirationsIndex,
  createRenewalQuoteFromScadenza,
  completeRenewalIfIssuedFromRenewalQuote,
  reopenRenewalForCorrection,
  isTruthyInt,
};
