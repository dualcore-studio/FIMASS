const express = require('express');
const {
  list,
  getById,
  insert,
  upsertById,
  removeById,
  like,
  paginate,
  sortBy,
} = require('../data/store');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');
const { logActivity } = require('./logs');
const { pipeCommissionsListPdf } = require('../lib/commissionsExportPdf');

const router = express.Router();

const COMMISSION_TYPES = new Set(['SEGNALATORE', 'PARTNER', 'SPORTELLO_AMICO']);
/** % della provvigione broker spettante alla struttura (SPORTELLO_AMICO: stesso criterio partner rete). */
const SPORTELLO_AMICO_ORG_PCT = 0.65;

function structurePctForType(t) {
  if (t === 'PARTNER') return 50;
  if (t === 'SPORTELLO_AMICO') return 50;
  return 30;
}

function roundMoney(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return 0;
  return Math.round(x * 100) / 100;
}

/**
 * @param {number} provvigioniBroker
 * @param {string} structureCommissionType
 * @returns {{ structure_commission_type: string, structure_commission_percentage: number, structure_commission_amount: number, sportello_amico_commission: number }}
 */
function computeFromProvvigioniBroker(provvigioniBroker, structureCommissionType) {
  const type = COMMISSION_TYPES.has(structureCommissionType) ? structureCommissionType : 'SEGNALATORE';
  const pct = structurePctForType(type);
  const base = Number(provvigioniBroker);
  const safe = Number.isFinite(base) && base >= 0 ? base : 0;
  return {
    structure_commission_type: type,
    structure_commission_percentage: pct,
    structure_commission_amount: roundMoney(safe * (pct / 100)),
    sportello_amico_commission: roundMoney(safe * SPORTELLO_AMICO_ORG_PCT),
  };
}

/**
 * Compat: record con solo importo S.A. legacy (prima la base era S.A. manuale).
 * @param {object} r
 * @returns {number}
 */
function effectiveProvvigioniBrokerFromRow(r) {
  const b = Number(r.broker_commission);
  if (Number.isFinite(b) && b >= 0) return b;
  const sa = Number(r.sportello_amico_commission);
  if (Number.isFinite(sa) && sa > 0) return roundMoney(sa / SPORTELLO_AMICO_ORG_PCT);
  return 0;
}

/** Ricalcola in output (liste/dettagli/export) per coerenza con la convenzione e dati pre-migrazione. */
function enrichCommissionRow(r) {
  if (!r || typeof r !== 'object') return r;
  const broker = effectiveProvvigioniBrokerFromRow(r);
  const t =
    r.structure_commission_type && COMMISSION_TYPES.has(r.structure_commission_type)
      ? r.structure_commission_type
      : 'SEGNALATORE';
  const computed = computeFromProvvigioniBroker(broker, t);
  return {
    ...r,
    provvigioni_broker: broker,
    broker_commission: broker,
    sportello_amico_commission: computed.sportello_amico_commission,
    structure_commission_percentage: computed.structure_commission_percentage,
    structure_commission_amount: computed.structure_commission_amount,
  };
}

function assertCommissionReader(req, res, next) {
  if (req.user.role === 'admin' || req.user.role === 'struttura' || req.user.role === 'fornitore') return next();
  return res.status(403).json({ error: 'Accesso non autorizzato' });
}

function getUserDisplayName(user) {
  return user.role === 'struttura' ? user.denominazione : `${user.nome} ${user.cognome}`;
}

function parseOptionalNumber(v) {
  if (v === '' || v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : NaN;
}

function parseRequiredMoney(v) {
  if (v === '' || v === null || v === undefined) return NaN;
  const n = Number(v);
  return Number.isFinite(n) ? n : NaN;
}

function parseProvvigioniBrokerInput(body) {
  const raw =
    body.provvigioni_broker !== undefined && body.provvigioni_broker !== null
      ? body.provvigioni_broker
      : body.broker_commission;
  return parseRequiredMoney(raw);
}

function normalizeDateInput(v) {
  if (!v || typeof v !== 'string') return null;
  const s = v.trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  return s;
}

function rowMatchesFilters(row, { search, structureId, company, portal, dataDa, dataAl }) {
  if (structureId && Number(row.structure_id) !== Number(structureId)) return false;
  if (company && !like(row.company, company)) return false;
  if (portal && !like(row.portal, portal)) return false;
  const d = row.date ? String(row.date).slice(0, 10) : '';
  if (dataDa && d && d < dataDa) return false;
  if (dataAl && d && d > dataAl) return false;
  if (search) {
    const ok =
      like(row.customer_name, search) ||
      like(row.policy_number, search) ||
      like(row.notes, search) ||
      like(row.structure_name, search);
    if (!ok) return false;
  }
  return true;
}

function summarize(rows) {
  let totalePremi = 0;
  let totaleBroker = 0;
  let totaleSa = 0;
  let totaleStrutture = 0;
  for (const r of rows) {
    const e = enrichCommissionRow(r);
    totalePremi += Number(e.policy_premium) || 0;
    totaleBroker += Number(e.provvigioni_broker) || 0;
    totaleSa += Number(e.sportello_amico_commission) || 0;
    totaleStrutture += Number(e.structure_commission_amount) || 0;
  }
  return {
    totale_polizze: rows.length,
    totale_premi: roundMoney(totalePremi),
    totale_provigioni_broker: roundMoney(totaleBroker),
    totale_sportello_amico: roundMoney(totaleSa),
    totale_provigioni_strutture: roundMoney(totaleStrutture),
  };
}

/** La struttura non vede provv. broker, quota S.A. o dettagli oltre la propria provvigione. */
function stripStrutturaSensitiveFields(row) {
  if (!row || typeof row !== 'object') return row;
  const {
    sportello_amico_commission: _sa,
    provvigioni_broker: _pb,
    broker_commission: _br,
    ...rest
  } = row;
  return rest;
}

router.get('/', authenticateToken, assertCommissionReader, (req, res) => {
  (async () => {
    const {
      page = 1,
      limit = 10,
      search,
      structure_id: structureId,
      company,
      portal,
      data_da: dataDa,
      data_a: dataAl,
      sort_by: sortByField,
      sort_dir: sortDir,
    } = req.query;

    let rows = await list('commissions');
    if (req.user.role === 'struttura') {
      rows = rows.filter((r) => Number(r.structure_id) === Number(req.user.id));
    }

    rows = rows.filter((r) =>
      rowMatchesFilters(r, {
        search,
        structureId: req.user.role === 'admin' || req.user.role === 'fornitore' ? structureId : null,
        company,
        portal,
        dataDa,
        dataAl,
      }),
    );

    const fullSummary = summarize(rows);
    const summary =
      req.user.role === 'struttura'
        ? {
            totale_polizze: fullSummary.totale_polizze,
            totale_premi: fullSummary.totale_premi,
            totale_provigioni_strutture: fullSummary.totale_provigioni_strutture,
          }
        : fullSummary;

    const sortKey = sortByField && typeof sortByField === 'string' ? sortByField : 'date';
    const dir = sortDir === 'asc' ? 'asc' : 'desc';
    const enriched = rows.map(enrichCommissionRow);
    rows = sortBy(enriched, sortKey, dir);

    const payload = paginate(rows, page, limit);
    const data =
      req.user.role === 'struttura' ? payload.data.map(stripStrutturaSensitiveFields) : payload.data;
    res.json({ ...payload, data, summary });
  })().catch((err) => {
    console.error('commissions list:', err);
    res.status(500).json({ error: 'Errore nel recupero provvigioni' });
  });
});

router.get('/export-pdf', authenticateToken, assertCommissionReader, (req, res) => {
  (async () => {
    const {
      search,
      structure_id: structureId,
      company,
      portal,
      data_da: dataDa,
      data_a: dataAl,
      sort_by: sortByField,
      sort_dir: sortDir,
    } = req.query;

    let rows = await list('commissions');
    if (req.user.role === 'struttura') {
      rows = rows.filter((r) => Number(r.structure_id) === Number(req.user.id));
    }

    rows = rows.filter((r) =>
      rowMatchesFilters(r, {
        search,
        structureId: req.user.role === 'admin' || req.user.role === 'fornitore' ? structureId : null,
        company,
        portal,
        dataDa,
        dataAl,
      }),
    );

    const fullSummary = summarize(rows);
    const summary =
      req.user.role === 'struttura'
        ? {
            totale_polizze: fullSummary.totale_polizze,
            totale_premi: fullSummary.totale_premi,
            totale_provigioni_strutture: fullSummary.totale_provigioni_strutture,
          }
        : fullSummary;

    const sortKey = sortByField && typeof sortByField === 'string' ? sortByField : 'date';
    const dir = sortDir === 'asc' ? 'asc' : 'desc';
    const enrichedExport = rows.map(enrichCommissionRow);
    rows = sortBy(enrichedExport, sortKey, dir);

    pipeCommissionsListPdf(
      {
        rows,
        summary,
        role: req.user.role === 'struttura' ? 'struttura' : 'admin',
      },
      res,
    );
  })().catch((err) => {
    console.error('commissions export-pdf:', err);
    if (!res.headersSent) res.status(500).json({ error: 'Errore nella generazione del PDF provvigioni' });
  });
});

router.get('/:id', authenticateToken, assertCommissionReader, (req, res) => {
  (async () => {
    const row = await getById('commissions', req.params.id);
    if (!row) return res.status(404).json({ error: 'Provvigione non trovata' });
    if (req.user.role === 'struttura' && Number(row.structure_id) !== Number(req.user.id)) {
      return res.status(403).json({ error: 'Accesso non autorizzato' });
    }
    const out = enrichCommissionRow(row);
    res.json(req.user.role === 'struttura' ? stripStrutturaSensitiveFields(out) : out);
  })().catch((err) => {
    console.error('commissions get:', err);
    res.status(500).json({ error: 'Errore nel recupero provvigione' });
  });
});

router.post('/', authenticateToken, authorizeRoles('admin', 'fornitore'), (req, res) => {
  (async () => {
    const {
      date,
      customer_name: customerName,
      policy_number: policyNumber,
      structure_id: structureIdRaw,
      portal,
      company,
      policy_premium: policyPremiumRaw,
      broker_commission: brokerCommissionRaw,
      provvigioni_broker: provvigioniBrokerRaw,
      client_invoice: clientInvoiceRaw,
      notes,
    } = req.body;

    const customer_name = customerName != null ? String(customerName).trim() : '';
    const policy_number = policyNumber != null ? String(policyNumber).trim() : '';
    const structure_id = Number(structureIdRaw);
    const provvigioni_broker = parseProvvigioniBrokerInput({
      provvigioni_broker: provvigioniBrokerRaw,
      broker_commission: brokerCommissionRaw,
    });

    if (!customer_name) return res.status(400).json({ error: 'Nome cliente obbligatorio' });
    if (!policy_number) return res.status(400).json({ error: 'Numero polizza obbligatorio' });
    if (!Number.isFinite(structure_id)) return res.status(400).json({ error: 'Struttura obbligatoria' });
    if (!Number.isFinite(provvigioni_broker) || provvigioni_broker < 0) {
      return res
        .status(400)
        .json({ error: 'Provvigioni broker obbligatorie e devono essere un importo valido (≥ 0)' });
    }

    const structure = await getById('users', structure_id);
    if (!structure || structure.role !== 'struttura') {
      return res.status(400).json({ error: 'Struttura non valida' });
    }
    const ct = structure.commission_type && COMMISSION_TYPES.has(structure.commission_type)
      ? structure.commission_type
      : 'SEGNALATORE';
    const computed = computeFromProvvigioniBroker(provvigioni_broker, ct);

    const d = normalizeDateInput(date);
    if (!d) return res.status(400).json({ error: 'Data non valida (usare AAAA-MM-GG)' });

    const policy_premium = parseOptionalNumber(policyPremiumRaw);
    const client_invoice = parseOptionalNumber(clientInvoiceRaw);
    if ([policy_premium, client_invoice].some((n) => Number.isNaN(n))) {
      return res.status(400).json({ error: 'Importi non validi' });
    }

    const row = await insert('commissions', {
      date: d,
      customer_name,
      policy_number,
      structure_id,
      structure_name: structure.denominazione || null,
      collaborator_name: null,
      portal: portal != null ? String(portal).trim() || null : null,
      company: company != null ? String(company).trim() || null : null,
      policy_premium: policy_premium ?? null,
      broker_commission: provvigioni_broker,
      client_invoice: client_invoice ?? null,
      sportello_amico_commission: computed.sportello_amico_commission,
      structure_commission_type: computed.structure_commission_type,
      structure_commission_percentage: computed.structure_commission_percentage,
      structure_commission_amount: computed.structure_commission_amount,
      notes: notes != null ? String(notes).trim() || null : null,
    });

    await logActivity({
      utente_id: req.user.id,
      utente_nome: getUserDisplayName(req.user),
      ruolo: req.user.role,
      azione: 'CREAZIONE_PROVVIGIONE',
      modulo: 'provvigioni',
      riferimento_id: row.id,
      riferimento_tipo: 'commission',
      dettaglio: `Creata provvigione polizza ${policy_number} per struttura ${structure.denominazione || structure_id}`,
    });

    res.status(201).json(enrichCommissionRow(row));
  })().catch((err) => {
    console.error('commissions create:', err);
    res.status(500).json({ error: 'Errore nella creazione provvigione' });
  });
});

router.put('/:id', authenticateToken, authorizeRoles('admin', 'fornitore'), (req, res) => {
  (async () => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ error: 'ID non valido' });

    const current = await getById('commissions', id);
    if (!current) return res.status(404).json({ error: 'Provvigione non trovata' });

    const {
      date,
      customer_name: customerName,
      policy_number: policyNumber,
      structure_id: structureIdRaw,
      portal,
      company,
      policy_premium: policyPremiumRaw,
      broker_commission: brokerCommissionRaw,
      provvigioni_broker: provvigioniBrokerRaw,
      client_invoice: clientInvoiceRaw,
      notes,
    } = req.body;

    const customer_name =
      customerName !== undefined ? String(customerName).trim() : current.customer_name;
    const policy_number =
      policyNumber !== undefined ? String(policyNumber).trim() : current.policy_number;
    const structure_id =
      structureIdRaw !== undefined ? Number(structureIdRaw) : Number(current.structure_id);

    const hasBrokerInBody =
      (provvigioniBrokerRaw !== undefined && provvigioniBrokerRaw !== null) ||
      (brokerCommissionRaw !== undefined && brokerCommissionRaw !== null);
    const provvigioni_broker = hasBrokerInBody
      ? parseProvvigioniBrokerInput({
          provvigioni_broker: provvigioniBrokerRaw,
          broker_commission: brokerCommissionRaw,
        })
      : effectiveProvvigioniBrokerFromRow(current);

    if (!customer_name) return res.status(400).json({ error: 'Nome cliente obbligatorio' });
    if (!policy_number) return res.status(400).json({ error: 'Numero polizza obbligatorio' });
    if (!Number.isFinite(structure_id)) return res.status(400).json({ error: 'Struttura obbligatoria' });
    if (!Number.isFinite(provvigioni_broker) || provvigioni_broker < 0) {
      return res
        .status(400)
        .json({ error: 'Provvigioni broker obbligatorie e devono essere un importo valido (≥ 0)' });
    }

    const structure = await getById('users', structure_id);
    if (!structure || structure.role !== 'struttura') {
      return res.status(400).json({ error: 'Struttura non valida' });
    }
    const ct = structure.commission_type && COMMISSION_TYPES.has(structure.commission_type)
      ? structure.commission_type
      : 'SEGNALATORE';
    const computed = computeFromProvvigioniBroker(provvigioni_broker, ct);

    const d =
      date !== undefined ? normalizeDateInput(date) : normalizeDateInput(current.date);
    if (!d) return res.status(400).json({ error: 'Data non valida (usare AAAA-MM-GG)' });

    const policy_premium =
      policyPremiumRaw !== undefined ? parseOptionalNumber(policyPremiumRaw) : Number(current.policy_premium);
    const client_invoice =
      clientInvoiceRaw !== undefined ? parseOptionalNumber(clientInvoiceRaw) : Number(current.client_invoice);
    if ([policy_premium, client_invoice].some((n) => Number.isNaN(n))) {
      return res.status(400).json({ error: 'Importi non validi' });
    }

    const updated = await upsertById('commissions', id, {
      date: d,
      customer_name,
      policy_number,
      structure_id,
      structure_name: structure.denominazione || null,
      collaborator_name: null,
      portal: portal !== undefined ? String(portal).trim() || null : current.portal,
      company: company !== undefined ? String(company).trim() || null : current.company,
      policy_premium: policy_premium ?? null,
      broker_commission: provvigioni_broker,
      client_invoice: client_invoice ?? null,
      sportello_amico_commission: computed.sportello_amico_commission,
      structure_commission_type: computed.structure_commission_type,
      structure_commission_percentage: computed.structure_commission_percentage,
      structure_commission_amount: computed.structure_commission_amount,
      notes: notes !== undefined ? String(notes).trim() || null : current.notes,
    });

    await logActivity({
      utente_id: req.user.id,
      utente_nome: getUserDisplayName(req.user),
      ruolo: req.user.role,
      azione: 'MODIFICA_PROVVIGIONE',
      modulo: 'provvigioni',
      riferimento_id: id,
      riferimento_tipo: 'commission',
      dettaglio: `Aggiornata provvigione #${id} polizza ${policy_number}`,
    });

    res.json(enrichCommissionRow(updated));
  })().catch((err) => {
    console.error('commissions update:', err);
    res.status(500).json({ error: 'Errore nell\'aggiornamento provvigione' });
  });
});

router.delete('/:id', authenticateToken, authorizeRoles('admin', 'fornitore'), (req, res) => {
  (async () => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ error: 'ID non valido' });
    const current = await getById('commissions', id);
    if (!current) return res.status(404).json({ error: 'Provvigione non trovata' });

    await removeById('commissions', id);

    await logActivity({
      utente_id: req.user.id,
      utente_nome: getUserDisplayName(req.user),
      ruolo: req.user.role,
      azione: 'ELIMINAZIONE_PROVVIGIONE',
      modulo: 'provvigioni',
      riferimento_id: id,
      riferimento_tipo: 'commission',
      dettaglio: `Eliminata provvigione #${id}`,
    });

    res.json({ message: 'Provvigione eliminata' });
  })().catch((err) => {
    console.error('commissions delete:', err);
    res.status(500).json({ error: 'Errore nell\'eliminazione provvigione' });
  });
});

module.exports = router;
