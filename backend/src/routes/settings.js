const express = require('express');
const { list, insert, upsertById, getById, sortBy } = require('../data/store');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');

const router = express.Router();

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
    for (const [key, value] of Object.entries(settings || {})) {
      const existing = (await list('settings', (s) => s.chiave === key))[0];
      if (existing) {
        await upsertById('settings', existing.id, { chiave: key, valore: value });
      } else {
        await insert('settings', { chiave: key, valore: value });
      }
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
    res.json(types.map((t) => ({
      ...t,
      campi_specifici: typeof t.campi_specifici === 'string' ? JSON.parse(t.campi_specifici) : (t.campi_specifici || []),
      checklist_allegati: typeof t.checklist_allegati === 'string' ? JSON.parse(t.checklist_allegati) : (t.checklist_allegati || []),
    })));
  })().catch((err) => {
    console.error('Error loading insurance types:', err);
    res.status(500).json({ error: 'Errore nel recupero tipologie' });
  });
});

router.get('/insurance-types/active', authenticateToken, (req, res) => {
  (async () => {
    let types = await list('insurance_types', (t) => t.stato === 'attivo');
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
      // Treat empty/invalid config as "all enabled" to avoid hiding every type.
      if (Array.isArray(enabledTypes) && enabledTypes.length > 0) {
        const normalized = enabledTypes
          .map((v) => String(v || '').trim().toLowerCase())
          .filter(Boolean);
        if (!normalized.includes('all')) {
          types = types.filter((t) => normalized.includes(String(t.codice || '').trim().toLowerCase()));
        }
      }
    }

    res.json(types.map((t) => ({
      ...t,
      campi_specifici: typeof t.campi_specifici === 'string' ? JSON.parse(t.campi_specifici) : (t.campi_specifici || []),
      checklist_allegati: typeof t.checklist_allegati === 'string' ? JSON.parse(t.checklist_allegati) : (t.checklist_allegati || []),
    })));
  })().catch((err) => {
    console.error('Error loading active insurance types:', err);
    res.status(500).json({ error: 'Errore nel recupero tipologie attive' });
  });
});

router.post('/insurance-types', authenticateToken, authorizeRoles('admin'), (req, res) => {
  (async () => {
    const { nome, codice, stato, ordine, campi_specifici, checklist_allegati } = req.body;
    const result = await insert('insurance_types', {
      nome,
      codice,
      stato: stato || 'attivo',
      ordine: ordine || 0,
      campi_specifici: campi_specifici || [],
      checklist_allegati: checklist_allegati || [],
    });
    res.status(201).json({ id: result.id, message: 'Tipologia creata' });
  })().catch((err) => {
    console.error('Error:', err);
    res.status(500).json({ error: 'Errore nella creazione tipologia' });
  });
});

router.put('/insurance-types/:id', authenticateToken, authorizeRoles('admin'), (req, res) => {
  (async () => {
    const { nome, codice, stato, ordine, campi_specifici, checklist_allegati } = req.body;
    const exists = await getById('insurance_types', req.params.id);
    if (!exists) return res.status(404).json({ error: 'Tipologia non trovata' });
    await upsertById('insurance_types', req.params.id, {
      nome,
      codice,
      stato,
      ordine: ordine || 0,
      campi_specifici: campi_specifici || [],
      checklist_allegati: checklist_allegati || [],
    });
    res.json({ message: 'Tipologia aggiornata' });
  })().catch((err) => {
    console.error('Error:', err);
    res.status(500).json({ error: 'Errore nell\'aggiornamento tipologia' });
  });
});

module.exports = router;
