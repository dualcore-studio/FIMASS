const express = require('express');
const { list, getById, upsertById, findOne } = require('../data/store');
const { loadContext, enrichPolicy } = require('../data/views');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');
const { normalizePolicyStato } = require('../utils/policyStato');
const {
  datePartYmd,
  calculatePolicyExpiryDate,
  toIsoDateTime,
  parseDbDateTime,
} = require('../utils/policyDates');
const { policyAssigneeUserId } = require('../utils/practiceAssignee');
const { SCADENZE_ACCESS_ROLES, userCanAccessScadenzePolicy } = require('../lib/scadenzeAccess');
const { logActivity } = require('./logs');
const { getClientIp } = require('../lib/requestMeta');
const { writeAuditLog, AUDIT_ACTIONS } = require('../lib/auditLog');
const { sendQuotePresentedByStructureToAdminMail } = require('../lib/resend');
const { PRIVACY_POLICY_VERSION } = require('../config/privacyConstants');
const {
  RENEWAL_STATUS,
  DISPLAY,
  computeScadenzaDisplayStato,
  countsAsScadutaKpi,
  countsAsDaRinnovareKpi,
  ensurePolicyExpirationForEmessaPolicy,
  mergeExpirationsIntoContext,
  createRenewalQuoteFromScadenza,
  reopenRenewalForCorrection,
  normalizeRenewalStatus,
} = require('../lib/policyRenewal');

const router = express.Router();

function parseMonthParam(month) {
  const m = String(month || '').trim();
  if (!/^\d{4}-\d{2}$/.test(m)) return null;
  const [y, mo] = m.split('-').map(Number);
  if (mo < 1 || mo > 12) return null;
  return { y, m: mo, key: m };
}

function monthRangeIso({ y, m }) {
  const start = `${y}-${String(m).padStart(2, '0')}-01 00:00:00`;
  const lastDay = new Date(y, m, 0).getDate();
  const end = `${y}-${String(m).padStart(2, '0')}-${String(lastDay).padStart(2, '0')} 23:59:59`;
  return { start, end };
}

function effectiveDataScadenza(policy) {
  if (policy.data_scadenza) return policy.data_scadenza;
  if (policy.data_emissione) {
    const exp = calculatePolicyExpiryDate(parseDbDateTime(policy.data_emissione));
    return exp ? toIsoDateTime(exp) : null;
  }
  return null;
}

function compagniaLabel(policy, quote) {
  const c = policy.compagnia != null && String(policy.compagnia).trim() !== '' ? String(policy.compagnia).trim() : null;
  return c || compagniaFromQuote(quote);
}

function compagniaFromQuote(quote) {
  const raw = quote?.dati_preventivo;
  let dp = raw;
  if (typeof raw === 'string') {
    try {
      dp = JSON.parse(raw);
    } catch {
      dp = null;
    }
  }
  if (!dp || typeof dp !== 'object') return null;
  const v =
    dp.compagnia ??
    dp.Compagnia ??
    dp.company ??
    dp.nome_compagnia ??
    dp.compagnia_assicuratrice;
  const s = v != null ? String(v).trim() : '';
  return s || null;
}

function sortScadenzeRecords(rows) {
  const rank = {
    Scaduta: 0,
    'Da rinnovare': 1,
    'Preventivo rinnovo creato': 2,
    'Non rinnovata': 3,
    Rinnovata: 4,
  };
  return [...rows].sort((a, b) => {
    const dr = (rank[a.stato_scadenza] ?? 9) - (rank[b.stato_scadenza] ?? 9);
    if (dr !== 0) return dr;
    return String(a.data_scadenza || '').localeCompare(String(b.data_scadenza || ''), 'it');
  });
}

function operatoreLabel(p) {
  const parts = [p.operatore_nome, p.operatore_cognome].filter(Boolean);
  if (parts.length) return parts.join(' ');
  const fp = [p.fornitore_nome, p.fornitore_cognome].filter(Boolean);
  if (fp.length) return fp.join(' ');
  return '—';
}

function policyContraenteSearchText(p) {
  return [p.assistito_cognome, p.assistito_nome].filter(Boolean).join(' ') || '—';
}

function normalizeContraenteSearch(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .trim();
}

/** Ogni “parola” della ricerca deve comparire nel testo contraente (come il frontend). */
function contraenteMatchesSearch(policy, query) {
  const q = normalizeContraenteSearch(query);
  if (!q) return true;
  const tokens = q.split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return true;
  const hay = normalizeContraenteSearch(policyContraenteSearchText(policy));
  return tokens.every((t) => hay.includes(t));
}

function buildScadenzeItemRow(p, ctx) {
  const pe = ctx.policyExpirationsByPolicyId.get(Number(p.id)) || null;
  const quote = ctx.quotesById.get(Number(p.quote_id)) || {};
  const scadenzaEff = effectiveDataScadenza(p);
  const ymd = datePartYmd(scadenzaEff);
  const stato_scadenza = computeScadenzaDisplayStato({ pe, policy: p, ymdScadenza: ymd });
  return {
    id: p.id,
    expiration_id: pe ? pe.id : null,
    quote_id: p.quote_id,
    struttura_id: p.struttura_id,
    incaricato_user_id: policyAssigneeUserId(p),
    contraente: policyContraenteSearchText(p),
    tipologia: p.tipo_nome || '—',
    compagnia: compagniaLabel(p, quote),
    struttura: p.struttura_nome || '—',
    operatore: operatoreLabel(p),
    data_emissione: p.data_emissione || null,
    data_scadenza: scadenzaEff,
    rinnovata: stato_scadenza === DISPLAY.RINNOVATA,
    stato_scadenza,
    renewal_status: pe ? normalizeRenewalStatus(pe.renewal_status) : RENEWAL_STATUS.DA_RINNOVARE,
    renewal_quote_id: pe?.renewal_quote_id ?? null,
    renewed_by_policy_id: pe?.renewed_by_policy_id ?? null,
    counts_as_scaduta_kpi: countsAsScadutaKpi(stato_scadenza, ymd),
    counts_as_da_rinnovare_kpi: countsAsDaRinnovareKpi(pe, p, stato_scadenza),
  };
}

async function ensureExpirationsForPolicies(policies, ctx) {
  for (const p of policies) {
    if (!ctx.policyExpirationsByPolicyId.get(Number(p.id))) {
      await ensurePolicyExpirationForEmessaPolicy(p.id);
    }
  }
}

function getUserDisplayName(user) {
  return user.role === 'struttura' ? user.denominazione : `${user.nome} ${user.cognome}`;
}

async function generateQuoteNumber() {
  const year = new Date().getFullYear();
  const prefix = `PRV-${year}-`;
  const quotes = await list('quotes');
  const seq = quotes
    .map((q) => String(q.numero || ''))
    .filter((n) => n.startsWith(prefix))
    .map((n) => Number(n.split('-')[2]) || 0)
    .reduce((a, b) => Math.max(a, b), 0) + 1;
  return `PRV-${year}-${String(seq).padStart(5, '0')}`;
}

router.get('/', authenticateToken, authorizeRoles(...SCADENZE_ACCESS_ROLES), (req, res) => {
  (async () => {
    const parsedMonth = parseMonthParam(req.query.month);
    if (!parsedMonth) {
      return res.status(400).json({ error: 'Parametro month=YYYY-MM richiesto' });
    }
    const searchRaw = String(req.query.search ?? req.query.q ?? '').trim();
    const { start, end } = monthRangeIso(parsedMonth);
    try {
      let ctx = await mergeExpirationsIntoContext(await loadContext());
      let policies = ctx.policies
        .map((p) => enrichPolicy(p, ctx))
        .filter((p) => normalizePolicyStato(p.stato) === 'EMESSA');

      if (req.user.role === 'struttura') {
        policies = policies.filter((p) => Number(p.struttura_id) === Number(req.user.id));
      }

      const policiesWithScadenza = policies.filter((p) => Boolean(effectiveDataScadenza(p)));

      const policiesInMonth = policiesWithScadenza.filter((p) => {
        const ds = effectiveDataScadenza(p);
        return String(ds) >= start && String(ds) <= end;
      });

      await ensureExpirationsForPolicies(policiesInMonth, ctx);
      ctx = await mergeExpirationsIntoContext(await loadContext());

      const monthItems = sortScadenzeRecords(policiesInMonth.map((p) => buildScadenzeItemRow(p, ctx)));
      const summary = {
        totale: monthItems.length,
        daRinnovare: monthItems.filter((r) => r.counts_as_da_rinnovare_kpi).length,
        scadute: monthItems.filter((r) => r.counts_as_scaduta_kpi).length,
        rinnovate: monthItems.filter((r) => r.stato_scadenza === DISPLAY.RINNOVATA).length,
      };

      let items = monthItems;
      if (searchRaw) {
        const policiesForSearch = policiesWithScadenza.filter((p) => contraenteMatchesSearch(p, searchRaw));
        await ensureExpirationsForPolicies(policiesForSearch, ctx);
        ctx = await mergeExpirationsIntoContext(await loadContext());
        items = sortScadenzeRecords(policiesForSearch.map((p) => buildScadenzeItemRow(p, ctx)));
      }

      res.json({
        month: parsedMonth.key,
        items,
        summary,
        searchActive: Boolean(searchRaw),
      });
    } catch (err) {
      console.error('scadenze list:', err);
      res.status(500).json({ error: 'Errore nel recupero scadenze' });
    }
  })();
});

router.get(
  '/:policyId',
  authenticateToken,
  authorizeRoles(...SCADENZE_ACCESS_ROLES),
  (req, res) => {
  (async () => {
    const policyId = Number(req.params.policyId);
    if (!Number.isFinite(policyId)) return res.status(400).json({ error: 'ID non valido' });
    try {
      let ctx = await mergeExpirationsIntoContext(await loadContext());
      const row = await getById('policies', policyId);
      if (!row) return res.status(404).json({ error: 'Polizza non trovata' });
      const policy = enrichPolicy(row, ctx);
      if (!userCanAccessScadenzePolicy(req.user, policy)) {
        return res.status(403).json({ error: 'Accesso non autorizzato' });
      }
      if (normalizePolicyStato(policy.stato) !== 'EMESSA') {
        return res.status(400).json({ error: 'Il dettaglio scadenza è disponibile solo per polizze emesse' });
      }

      let pe = ctx.policyExpirationsByPolicyId.get(policyId);
      if (!pe) {
        await ensurePolicyExpirationForEmessaPolicy(policyId);
        ctx = await mergeExpirationsIntoContext(await loadContext());
        pe = ctx.policyExpirationsByPolicyId.get(policyId);
      }

      const quote = ctx.quotesById.get(Number(policy.quote_id)) || {};
      const scadenzaEff = effectiveDataScadenza(policy);
      const ymd = datePartYmd(scadenzaEff);
      const stato_scadenza = computeScadenzaDisplayStato({ pe, policy, ymdScadenza: ymd });

      let renewalQuote = null;
      if (pe?.renewal_quote_id) {
        const rq = await getById('quotes', pe.renewal_quote_id);
        if (rq) renewalQuote = { id: rq.id, numero: rq.numero, stato: rq.stato };
      }
      let renewedPolicy = null;
      if (pe?.renewed_by_policy_id) {
        const np = await getById('policies', pe.renewed_by_policy_id);
        if (np) renewedPolicy = { id: np.id, numero: np.numero, stato: np.stato };
      }

      const logs = await list('activity_logs');
      const timeline = logs
        .filter((l) => {
          if (l.modulo !== 'scadenze') return false;
          const rid = Number(l.riferimento_id);
          return (
            rid === policyId ||
            (pe?.renewal_quote_id && rid === Number(pe.renewal_quote_id)) ||
            (pe?.renewed_by_policy_id && rid === Number(pe.renewed_by_policy_id))
          );
        })
        .sort((a, b) => String(a.created_at || '').localeCompare(String(b.created_at || '')))
        .map((l) => ({
          azione: l.azione,
          dettaglio: l.dettaglio,
          utente_nome: l.utente_nome,
          ruolo: l.ruolo,
          created_at: l.created_at,
        }));

      const baseTimeline = [];
      if (pe?.created_at) {
        baseTimeline.push({
          kind: 'expiration_record',
          label: 'Scadenza registrata nel sistema',
          created_at: pe.created_at,
        });
      }
      if (pe?.renewal_quote_id && renewalQuote) {
        baseTimeline.push({
          kind: 'renewal_quote',
          label: `Preventivo rinnovo creato (${renewalQuote.numero})`,
          created_at: null,
        });
      }
      if (pe?.renewal_completed_at && renewedPolicy) {
        baseTimeline.push({
          kind: 'renewed_policy',
          label: `Polizza emessa ${renewedPolicy.numero} — rinnovo completato`,
          created_at: pe.renewal_completed_at,
        });
      }

      res.json({
        policy: {
          id: policy.id,
          numero: policy.numero,
          quote_id: policy.quote_id,
          assistito_id: policy.assistito_id,
          tipo_assicurazione_id: policy.tipo_assicurazione_id,
          struttura_id: policy.struttura_id,
          data_emissione: policy.data_emissione,
          data_scadenza: scadenzaEff,
          compagnia: compagniaLabel(policy, quote),
          contraente: [policy.assistito_cognome, policy.assistito_nome].filter(Boolean).join(' ') || '—',
          tipologia: policy.tipo_nome || '—',
        },
        expiration: pe
          ? {
              id: pe.id,
              renewal_status: normalizeRenewalStatus(pe.renewal_status),
              renewal_quote_id: pe.renewal_quote_id,
              renewed_by_policy_id: pe.renewed_by_policy_id,
              renewal_completed_at: pe.renewal_completed_at,
              created_at: pe.created_at,
              updated_at: pe.updated_at,
            }
          : null,
        stato_scadenza,
        renewal_quote: renewalQuote,
        renewed_policy: renewedPolicy,
        timeline: [...baseTimeline, ...timeline.map((t) => ({ kind: 'log', ...t }))],
      });
    } catch (err) {
      console.error('scadenze detail:', err);
      res.status(500).json({ error: 'Errore nel recupero del dettaglio scadenza' });
    }
  })();
});

router.post(
  '/:policyId/renewal-quote',
  authenticateToken,
  authorizeRoles('struttura'),
  (req, res) => {
    (async () => {
      const sourcePolicyId = Number(req.params.policyId);
      if (!Number.isFinite(sourcePolicyId)) return res.status(400).json({ error: 'ID non valido' });

      const result = await createRenewalQuoteFromScadenza({
        req,
        sourcePolicyId,
        privacyConsentAccepted: req.body?.privacy_consent_accepted,
        getUserDisplayName,
        generateQuoteNumber,
        logActivity,
        writeAuditLog,
        getClientIp,
        sendQuotePresentedByStructureToAdminMail,
        PRIVACY_POLICY_VERSION,
        AUDIT_ACTIONS,
      });

      if (!result.ok) {
        const code = result.code || 400;
        const payload = { error: result.error };
        if (result.quoteId != null) payload.existing_quote_id = result.quoteId;
        if (result.numero) payload.existing_quote_numero = result.numero;
        return res.status(code).json(payload);
      }

      res.status(201).json({
        message: 'Preventivo di rinnovo creato con successo',
        quote_id: result.quoteId,
        numero: result.numero,
        expiration_id: result.expirationId,
      });
    })().catch((err) => {
      console.error('renewal-quote:', err);
      res.status(500).json({ error: 'Errore nella creazione del preventivo di rinnovo' });
    });
  },
);

router.patch(
  '/:policyId/non-rinnovata',
  authenticateToken,
  authorizeRoles(...SCADENZE_ACCESS_ROLES),
  (req, res) => {
    (async () => {
      const policyId = Number(req.params.policyId);
      if (!Number.isFinite(policyId)) return res.status(400).json({ error: 'ID non valido' });

      const policy = await getById('policies', policyId);
      if (!policy) return res.status(404).json({ error: 'Polizza non trovata' });
      if (normalizePolicyStato(policy.stato) !== 'EMESSA') {
        return res.status(400).json({ error: 'Operazione disponibile solo su polizze emesse' });
      }

      if (!userCanAccessScadenzePolicy(req.user, policy)) {
        return res.status(403).json({ error: 'Accesso non autorizzato' });
      }

      let pe = await findOne('policy_expirations', (e) => Number(e.policy_id) === policyId);
      if (!pe) pe = await ensurePolicyExpirationForEmessaPolicy(policyId);
      if (!pe) return res.status(400).json({ error: 'Scadenza non trovata' });

      const st = normalizeRenewalStatus(pe.renewal_status);
      if (st === RENEWAL_STATUS.RINNOVATA || pe.renewed_by_policy_id) {
        return res.status(400).json({ error: 'Scadenza già rinnovata' });
      }

      await upsertById('policy_expirations', pe.id, {
        renewal_status: RENEWAL_STATUS.NON_RINNOVATA,
        renewal_quote_id: null,
      });

      await logActivity({
        utente_id: req.user.id,
        utente_nome: getUserDisplayName(req.user),
        ruolo: req.user.role,
        azione: 'SCADENZA_NON_RINNOVATA',
        modulo: 'scadenze',
        riferimento_id: policyId,
        riferimento_tipo: 'policy',
        dettaglio: `Polizza ${policy.numero}: segnata come non rinnovata`,
      });
      await writeAuditLog({
        userId: req.user.id,
        action: AUDIT_ACTIONS.SCADENZA_STATUS_UPDATE,
        entityType: 'policy_expiration',
        entityId: pe.id,
        metadata: { policy_id: policyId, status: RENEWAL_STATUS.NON_RINNOVATA },
        ipAddress: getClientIp(req),
      });

      res.json({ message: 'Scadenza segnata come non rinnovata' });
    })().catch((err) => {
      console.error('non-rinnovata:', err);
      res.status(500).json({ error: 'Errore nell\'aggiornamento' });
    });
  },
);

router.patch(
  '/:policyId/rinnovata-manuale',
  authenticateToken,
  authorizeRoles('admin', 'supervisore'),
  (req, res) => {
    (async () => {
      const policyId = Number(req.params.policyId);
      if (!Number.isFinite(policyId)) return res.status(400).json({ error: 'ID non valido' });
      const renewedById =
        req.body?.renewed_by_policy_id != null && req.body?.renewed_by_policy_id !== ''
          ? Number(req.body.renewed_by_policy_id)
          : null;

      const policy = await getById('policies', policyId);
      if (!policy) return res.status(404).json({ error: 'Polizza non trovata' });
      if (normalizePolicyStato(policy.stato) !== 'EMESSA') {
        return res.status(400).json({ error: 'Operazione disponibile solo su polizze emesse' });
      }

      let pe = await findOne('policy_expirations', (e) => Number(e.policy_id) === policyId);
      if (!pe) pe = await ensurePolicyExpirationForEmessaPolicy(policyId);
      if (!pe) return res.status(400).json({ error: 'Scadenza non trovata' });

      if (normalizeRenewalStatus(pe.renewal_status) === RENEWAL_STATUS.NON_RINNOVATA) {
        return res.status(400).json({
          error: 'Scadenza non rinnovata: usa la riapertura correttiva o contatta il supporto',
        });
      }

      if (renewedById != null && Number.isFinite(renewedById)) {
        const np = await getById('policies', renewedById);
        if (!np || normalizePolicyStato(np.stato) !== 'EMESSA') {
          return res.status(400).json({ error: 'Polizza collegata non valida o non emessa' });
        }
        if (Number(np.struttura_id) !== Number(policy.struttura_id)) {
          return res.status(400).json({ error: 'La polizza emessa deve appartenere alla stessa struttura' });
        }
      }

      const completedAt = new Date().toISOString().slice(0, 19).replace('T', ' ');
      await upsertById('policy_expirations', pe.id, {
        renewal_status: RENEWAL_STATUS.RINNOVATA,
        renewed_by_policy_id: Number.isFinite(renewedById) ? renewedById : null,
        renewal_completed_at: completedAt,
      });
      await upsertById('policies', policyId, { rinnovata: 1 });

      await logActivity({
        utente_id: req.user.id,
        utente_nome: getUserDisplayName(req.user),
        ruolo: req.user.role,
        azione: 'SCADENZA_RINNOVATA_MANUALE',
        modulo: 'scadenze',
        riferimento_id: policyId,
        riferimento_tipo: 'policy',
        dettaglio: `Polizza ${policy.numero}: rinnovata manualmente${renewedById ? ` (polizza ${renewedById})` : ''}`,
      });
      await writeAuditLog({
        userId: req.user.id,
        action: AUDIT_ACTIONS.SCADENZA_STATUS_UPDATE,
        entityType: 'policy_expiration',
        entityId: pe.id,
        metadata: {
          policy_id: policyId,
          status: RENEWAL_STATUS.RINNOVATA,
          manual: true,
          renewed_by_policy_id: renewedById,
        },
        ipAddress: getClientIp(req),
      });

      res.json({ message: 'Scadenza segnata come rinnovata' });
    })().catch((err) => {
      console.error('rinnovata-manuale:', err);
      res.status(500).json({ error: 'Errore nell\'aggiornamento' });
    });
  },
);

router.post(
  '/:policyId/reopen-renewal',
  authenticateToken,
  authorizeRoles('admin', 'supervisore'),
  (req, res) => {
    (async () => {
      const policyId = Number(req.params.policyId);
      if (!Number.isFinite(policyId)) return res.status(400).json({ error: 'ID non valido' });
      const out = await reopenRenewalForCorrection(policyId, req.user);
      if (!out.ok) return res.status(400).json({ error: out.error });
      await logActivity({
        utente_id: req.user.id,
        utente_nome: getUserDisplayName(req.user),
        ruolo: req.user.role,
        azione: 'SCADENZA_RIAPERTA_RINNOVO',
        modulo: 'scadenze',
        riferimento_id: policyId,
        riferimento_tipo: 'policy',
        dettaglio: 'Scadenza riaperta dopo segnalazione non rinnovata',
      });
      res.json({ message: 'Scadenza riaperta al flusso rinnovi' });
    })().catch((err) => {
      console.error('reopen-renewal:', err);
      res.status(500).json({ error: 'Errore nell\'operazione' });
    });
  },
);

module.exports = router;
