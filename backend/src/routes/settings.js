const express = require('express');
const {
  list, insert, upsertById, getById, sortBy, removeById, findOne,
} = require('../data/store');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');
const {
  isInsuranceTypeActive,
  normalizeCampiSpecifici,
  normalizeChecklistAllegati,
  mapInsuranceTypeRow,
} = require('../lib/insuranceTypes');

const router = express.Router();

function respondTypesJson(types, res) {
  const mapped = types.map((t) => {
    const row = mapInsuranceTypeRow(t);
    return {
      ...row,
      campi_specifici: normalizeCampiSpecifici(row.campi_specifici),
      checklist_allegati: normalizeChecklistAllegati(row.checklist_allegati),
    };
  });
  res.json(mapped);
}

router.get('/general', authenticateToken, (req, res) => {
  (async () => {
    const settings = await list('settings');
    const result = {};
    settings.forEach((s) => { result[s.chiave] = s.valore; });
    res.json(result);
  })().catch((err) => {
    console.error('Error reading settings:', err);
    res.status(500).json({ error: 'Errore nel recupero impostazioni' });
  });
});

router.put('/general', authenticateToken, authorizeRoles('admin'), (req, res) => {
  (async () => {
    const { settings } = req.body;
    const allowed = new Set(['nome_portale']);
    for (const [key, value] of Object.entries(settings || {})) {
      if (!allowed.has(key)) continue;
      const existing = (await list('settings', (s) => s.chiave === key))[0];
      if (existing) {
        await upsertById('settings', existing.id, { chiave: key, valore: value });
      } else {
        await insert('settings', { chiave: key, valore: value });
      }
    }
    for (const deprecKey of ['colore_primario', 'colore_secondario']) {
      const row = (await list('settings', (s) => s.chiave === deprecKey))[0];
      if (row) await removeById('settings', row.id);
    }
    res.json({ message: 'Impostazioni aggiornate' });
  })().catch((err) => {
    console.error('Error updating settings:', err);
    res.status(500).json({ error: 'Errore nell\'aggiornamento impostazioni' });
  });
});

router.get('/insurance-types', authenticateToken, (req, res) => {
  (async () => {
    let types = await list('insurance_types');
    types = sortBy(types, 'ordine', 'asc');
    types = sortBy(types, 'nome', 'asc');
    respondTypesJson(types, res);
  })().catch((err) => {
    console.error('Error loading insurance types:', err);
    res.status(500).json({ error: 'Errore nel recupero tipologie' });
  });
});

router.get('/insurance-types/active', authenticateToken, (req, res) => {
  (async () => {
    let types = await list('insurance_types', (t) => isInsuranceTypeActive(t));
    types = sortBy(types, 'ordine', 'asc');
    types = sortBy(types, 'nome', 'asc');

    if (req.user.role === 'struttura' && req.user.enabled_types) {
      let enabledTypes;
      try {
        enabledTypes = typeof req.user.enabled_types === 'string'
          ? JSON.parse(req.user.enabled_types)
          : req.user.enabled_types;
      } catch (e) {
        enabledTypes = null;
      }
      if (Array.isArray(enabledTypes) && enabledTypes.length > 0) {
        const normalized = enabledTypes
          .map((v) => String(v || '').trim().toLowerCase())
          .filter(Boolean);
        if (normalized.length > 0 && !normalized.includes('all')) {
          types = types.filter((t) => normalized.includes(String(t.codice || '').trim().toLowerCase()));
        }
      }
    }

    respondTypesJson(types, res);
  })().catch((err) => {
    console.error('Error loading active insurance types:', err);
    res.status(500).json({ error: 'Errore nel recupero tipologie attive' });
  });
});

router.post('/insurance-types', authenticateToken, authorizeRoles('admin'), (req, res) => {
  (async () => {
    const {
      nome, codice, stato, ordine, descrizione, campi_specifici, checklist_allegati,
    } = req.body || {};
    const cod = String(codice || '').trim();
    const nom = String(nome || '').trim();
    if (!nom || !cod) {
      return res.status(400).json({ error: 'Nome e codice sono obbligatori' });
    }
    const dup = await findOne('insurance_types', (t) => String(t.codice || '').toLowerCase() === cod.toLowerCase());
    if (dup) return res.status(409).json({ error: 'Codice tipologia già in uso' });

    const campi = normalizeCampiSpecifici(campi_specifici);
    const checklist = normalizeChecklistAllegati(checklist_allegati);
    const result = await insert('insurance_types', {
      nome: nom,
      codice: cod,
      stato: stato && String(stato).toLowerCase() === 'disattivo' ? 'disattivo' : 'attivo',
      ordine: ordine != null && ordine !== '' ? Number(ordine) : 0,
      descrizione: descrizione != null && String(descrizione).trim() !== '' ? String(descrizione).trim() : null,
      campi_specifici: campi,
      checklist_allegati: checklist,
    });
    res.status(201).json({ id: result.id, message: 'Tipologia creata' });
  })().catch((err) => {
    console.error('Error:', err);
    res.status(500).json({ error: 'Errore nella creazione tipologia' });
  });
});

router.put('/insurance-types/:id', authenticateToken, authorizeRoles('admin'), (req, res) => {
  (async () => {
    const exists = await getById('insurance_types', req.params.id);
    if (!exists) return res.status(404).json({ error: 'Tipologia non trovata' });

    const body = req.body || {};
    const ex = mapInsuranceTypeRow(exists);
    const codInput = body.codice !== undefined ? String(body.codice || '').trim() : ex.codice;
    const nomInput = body.nome !== undefined ? String(body.nome || '').trim() : ex.nome;
    if (!nomInput || !codInput) {
      return res.status(400).json({ error: 'Nome e codice sono obbligatori' });
    }
    if (codInput.toLowerCase() !== String(ex.codice || '').toLowerCase()) {
      const dup = await findOne(
        'insurance_types',
        (t) => Number(t.id) !== Number(exists.id)
          && String(t.codice || '').toLowerCase() === codInput.toLowerCase(),
      );
      if (dup) return res.status(409).json({ error: 'Codice tipologia già in uso' });
    }

    let st = ex.stato;
    if (body.stato !== undefined) {
      st = String(body.stato).toLowerCase() === 'disattivo' ? 'disattivo' : 'attivo';
    }
    let ord = ex.ordine ?? 0;
    if (body.ordine !== undefined && body.ordine !== null && body.ordine !== '') {
      ord = Number(body.ordine);
    }
    let descr = ex.descrizione ?? null;
    if (body.descrizione !== undefined) {
      descr = body.descrizione != null && String(body.descrizione).trim() !== ''
        ? String(body.descrizione).trim()
        : null;
    }
    const campi = body.campi_specifici !== undefined
      ? normalizeCampiSpecifici(body.campi_specifici)
      : normalizeCampiSpecifici(ex.campi_specifici);
    const checklist = body.checklist_allegati !== undefined
      ? normalizeChecklistAllegati(body.checklist_allegati)
      : normalizeChecklistAllegati(ex.checklist_allegati);

    await upsertById('insurance_types', req.params.id, {
      nome: nomInput,
      codice: codInput,
      stato: st,
      ordine: ord,
      descrizione: descr,
      campi_specifici: campi,
      checklist_allegati: checklist,
    });
    res.json({ message: 'Tipologia aggiornata' });
  })().catch((err) => {
    console.error('Error:', err);
    res.status(500).json({ error: 'Errore nell\'aggiornamento tipologia' });
  });
});

router.delete('/insurance-types/:id', authenticateToken, authorizeRoles('admin'), (req, res) => {
  (async () => {
    const exists = await getById('insurance_types', req.params.id);
    if (!exists) return res.status(404).json({ error: 'Tipologia non trovata' });
    const idNum = Number(req.params.id);
    const q = await list('quotes', (row) => Number(row.tipo_assicurazione_id) === idNum);
    if (q.length) {
      return res.status(400).json({
        error: 'Impossibile eliminare: esistono preventivi collegati a questa tipologia. Disattivala invece.',
      });
    }
    const p = await list('policies', (row) => Number(row.tipo_assicurazione_id) === idNum);
    if (p.length) {
      return res.status(400).json({
        error: 'Impossibile eliminare: esistono polizze collegate a questa tipologia. Disattivala invece.',
      });
    }
    await removeById('insurance_types', req.params.id);
    res.json({ message: 'Tipologia eliminata' });
  })().catch((err) => {
    console.error('Error:', err);
    res.status(500).json({ error: 'Errore nell\'eliminazione tipologia' });
  });
});

module.exports = router;
