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

const router = express.Router();

const COMMISSION_TYPES = new Set(['SEGNALATORE', 'PARTNER']);

function pctForType(t) {
  return t === 'PARTNER' ? 60 : 30;
}

function roundMoney(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return 0;
  return Math.round(x * 100) / 100;
}

function computeStructureCommission(sportelloAmico, structureCommissionType) {
  const type = COMMISSION_TYPES.has(structureCommissionType) ? structureCommissionType : 'SEGNALATORE';
  const pct = pctForType(type);
  const base = Number(sportelloAmico);
  const safeBase = Number.isFinite(base) ? base : 0;
  return {
    structure_commission_type: type,
    structure_commission_percentage: pct,
    structure_commission_amount: roundMoney(safeBase * (pct / 100)),
  };
}

function assertCommissionReader(req, res, next) {
  if (req.user.role === 'admin' || req.user.role === 'struttura') return next();
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
      like(row.collaborator_name, search) ||
      like(row.notes, search) ||
      like(row.structure_name, search);
    if (!ok) return false;
  }
  return true;
}

function summarize(rows) {
  let totalePremi = 0;
  let totaleSa = 0;
  let totaleStrutture = 0;
  for (const r of rows) {
    totalePremi += Number(r.policy_premium) || 0;
    totaleSa += Number(r.sportello_amico_commission) || 0;
    totaleStrutture += Number(r.structure_commission_amount) || 0;
  }
  return {
    totale_polizze: rows.length,
    totale_premi: roundMoney(totalePremi),
    totale_sportello_amico: roundMoney(totaleSa),
    totale_provigioni_strutture: roundMoney(totaleStrutture),
  };
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
        structureId: req.user.role === 'admin' ? structureId : null,
        company,
        portal,
        dataDa,
        dataAl,
      }),
    );

    const summary = summarize(rows);

    const sortKey = sortByField && typeof sortByField === 'string' ? sortByField : 'date';
    const dir = sortDir === 'asc' ? 'asc' : 'desc';
    rows = sortBy(rows, sortKey, dir);

    const payload = paginate(rows, page, limit);
    res.json({ ...payload, summary });
  })().catch((err) => {
    console.error('commissions list:', err);
    res.status(500).json({ error: 'Errore nel recupero provvigioni' });
  });
});

router.get('/:id', authenticateToken, assertCommissionReader, (req, res) => {
  (async () => {
    const row = await getById('commissions', req.params.id);
    if (!row) return res.status(404).json({ error: 'Provvigione non trovata' });
    if (req.user.role === 'struttura' && Number(row.structure_id) !== Number(req.user.id)) {
      return res.status(403).json({ error: 'Accesso non autorizzato' });
    }
    res.json(row);
  })().catch((err) => {
    console.error('commissions get:', err);
    res.status(500).json({ error: 'Errore nel recupero provvigione' });
  });
});

router.post('/', authenticateToken, authorizeRoles('admin'), (req, res) => {
  (async () => {
    const {
      date,
      customer_name: customerName,
      policy_number: policyNumber,
      structure_id: structureIdRaw,
      collaborator_name: collaboratorName,
      portal,
      company,
      policy_premium: policyPremiumRaw,
      broker_commission: brokerCommissionRaw,
      client_invoice: clientInvoiceRaw,
      sportello_amico_commission: saRaw,
      notes,
    } = req.body;

    const customer_name = customerName != null ? String(customerName).trim() : '';
    const policy_number = policyNumber != null ? String(policyNumber).trim() : '';
    const structure_id = Number(structureIdRaw);
    const sportello_amico_commission = parseRequiredMoney(saRaw);

    if (!customer_name) return res.status(400).json({ error: 'Nome cliente obbligatorio' });
    if (!policy_number) return res.status(400).json({ error: 'Numero polizza obbligatorio' });
    if (!Number.isFinite(structure_id)) return res.status(400).json({ error: 'Struttura obbligatoria' });
    if (!Number.isFinite(sportello_amico_commission)) {
      return res.status(400).json({ error: 'Provvigioni Sportello Amico obbligatorie e devono essere un numero valido' });
    }

    const structure = await getById('users', structure_id);
    if (!structure || structure.role !== 'struttura') {
      return res.status(400).json({ error: 'Struttura non valida' });
    }
    const ct = structure.commission_type && COMMISSION_TYPES.has(structure.commission_type)
      ? structure.commission_type
      : 'SEGNALATORE';
    const computed = computeStructureCommission(sportello_amico_commission, ct);

    const d = normalizeDateInput(date);
    if (!d) return res.status(400).json({ error: 'Data non valida (usare AAAA-MM-GG)' });

    const policy_premium = parseOptionalNumber(policyPremiumRaw);
    const broker_commission = parseOptionalNumber(brokerCommissionRaw);
    const client_invoice = parseOptionalNumber(clientInvoiceRaw);
    if ([policy_premium, broker_commission, client_invoice].some((n) => Number.isNaN(n))) {
      return res.status(400).json({ error: 'Importi non validi' });
    }

    const row = await insert('commissions', {
      date: d,
      customer_name,
      policy_number,
      structure_id,
      structure_name: structure.denominazione || null,
      collaborator_name: collaboratorName != null ? String(collaboratorName).trim() || null : null,
      portal: portal != null ? String(portal).trim() || null : null,
      company: company != null ? String(company).trim() || null : null,
      policy_premium: policy_premium ?? null,
      broker_commission: broker_commission ?? null,
      client_invoice: client_invoice ?? null,
      sportello_amico_commission,
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

    res.status(201).json(row);
  })().catch((err) => {
    console.error('commissions create:', err);
    res.status(500).json({ error: 'Errore nella creazione provvigione' });
  });
});

router.put('/:id', authenticateToken, authorizeRoles('admin'), (req, res) => {
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
      collaborator_name: collaboratorName,
      portal,
      company,
      policy_premium: policyPremiumRaw,
      broker_commission: brokerCommissionRaw,
      client_invoice: clientInvoiceRaw,
      sportello_amico_commission: saRaw,
      notes,
    } = req.body;

    const customer_name =
      customerName !== undefined ? String(customerName).trim() : current.customer_name;
    const policy_number =
      policyNumber !== undefined ? String(policyNumber).trim() : current.policy_number;
    const structure_id =
      structureIdRaw !== undefined ? Number(structureIdRaw) : Number(current.structure_id);

    const sportello_amico_commission =
      saRaw !== undefined ? parseRequiredMoney(saRaw) : Number(current.sportello_amico_commission);

    if (!customer_name) return res.status(400).json({ error: 'Nome cliente obbligatorio' });
    if (!policy_number) return res.status(400).json({ error: 'Numero polizza obbligatorio' });
    if (!Number.isFinite(structure_id)) return res.status(400).json({ error: 'Struttura obbligatoria' });
    if (!Number.isFinite(sportello_amico_commission)) {
      return res.status(400).json({ error: 'Provvigioni Sportello Amico obbligatorie e devono essere un numero valido' });
    }

    const structure = await getById('users', structure_id);
    if (!structure || structure.role !== 'struttura') {
      return res.status(400).json({ error: 'Struttura non valida' });
    }
    const ct = structure.commission_type && COMMISSION_TYPES.has(structure.commission_type)
      ? structure.commission_type
      : 'SEGNALATORE';
    const computed = computeStructureCommission(sportello_amico_commission, ct);

    const d =
      date !== undefined ? normalizeDateInput(date) : normalizeDateInput(current.date);
    if (!d) return res.status(400).json({ error: 'Data non valida (usare AAAA-MM-GG)' });

    const policy_premium =
      policyPremiumRaw !== undefined ? parseOptionalNumber(policyPremiumRaw) : Number(current.policy_premium);
    const broker_commission =
      brokerCommissionRaw !== undefined ? parseOptionalNumber(brokerCommissionRaw) : Number(current.broker_commission);
    const client_invoice =
      clientInvoiceRaw !== undefined ? parseOptionalNumber(clientInvoiceRaw) : Number(current.client_invoice);
    if ([policy_premium, broker_commission, client_invoice].some((n) => Number.isNaN(n))) {
      return res.status(400).json({ error: 'Importi non validi' });
    }

    const updated = await upsertById('commissions', id, {
      date: d,
      customer_name,
      policy_number,
      structure_id,
      structure_name: structure.denominazione || null,
      collaborator_name:
        collaboratorName !== undefined
          ? String(collaboratorName).trim() || null
          : current.collaborator_name,
      portal: portal !== undefined ? String(portal).trim() || null : current.portal,
      company: company !== undefined ? String(company).trim() || null : current.company,
      policy_premium: policy_premium ?? null,
      broker_commission: broker_commission ?? null,
      client_invoice: client_invoice ?? null,
      sportello_amico_commission,
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

    res.json(updated);
  })().catch((err) => {
    console.error('commissions update:', err);
    res.status(500).json({ error: 'Errore nell\'aggiornamento provvigione' });
  });
});

router.delete('/:id', authenticateToken, authorizeRoles('admin'), (req, res) => {
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
