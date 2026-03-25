const express = require('express');
const { db } = require('../config/database');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');

const router = express.Router();

router.get('/general', authenticateToken, (req, res) => {
  const settings = db.prepare('SELECT chiave, valore FROM settings').all();
  const result = {};
  settings.forEach(s => { result[s.chiave] = s.valore; });
  res.json(result);
});

router.put('/general', authenticateToken, authorizeRoles('admin'), (req, res) => {
  try {
    const { settings } = req.body;
    const upsert = db.prepare(`
      INSERT INTO settings (chiave, valore, updated_at) VALUES (?, ?, datetime('now'))
      ON CONFLICT(chiave) DO UPDATE SET valore = excluded.valore, updated_at = datetime('now')
    `);

    const transaction = db.transaction((items) => {
      for (const [key, value] of Object.entries(items)) {
        upsert.run(key, value);
      }
    });

    transaction(settings);
    res.json({ message: 'Impostazioni aggiornate' });
  } catch (err) {
    console.error('Error updating settings:', err);
    res.status(500).json({ error: 'Errore nell\'aggiornamento impostazioni' });
  }
});

router.get('/insurance-types', authenticateToken, (req, res) => {
  const types = db.prepare('SELECT * FROM insurance_types ORDER BY ordine, nome').all();
  res.json(types.map(t => ({
    ...t,
    campi_specifici: t.campi_specifici ? JSON.parse(t.campi_specifici) : [],
    checklist_allegati: t.checklist_allegati ? JSON.parse(t.checklist_allegati) : []
  })));
});

router.get('/insurance-types/active', authenticateToken, (req, res) => {
  let types = db.prepare("SELECT * FROM insurance_types WHERE stato = 'attivo' ORDER BY ordine, nome").all();

  if (req.user.role === 'struttura' && req.user.enabled_types) {
    let enabledTypes;
    try {
      enabledTypes = typeof req.user.enabled_types === 'string'
        ? JSON.parse(req.user.enabled_types)
        : req.user.enabled_types;
    } catch (e) {
      enabledTypes = null;
    }
    if (enabledTypes && !enabledTypes.includes('all')) {
      types = types.filter(t => enabledTypes.includes(t.codice));
    }
  }

  res.json(types.map(t => ({
    ...t,
    campi_specifici: t.campi_specifici ? JSON.parse(t.campi_specifici) : [],
    checklist_allegati: t.checklist_allegati ? JSON.parse(t.checklist_allegati) : []
  })));
});

router.post('/insurance-types', authenticateToken, authorizeRoles('admin'), (req, res) => {
  try {
    const { nome, codice, stato, ordine, campi_specifici, checklist_allegati } = req.body;

    const result = db.prepare(`
      INSERT INTO insurance_types (nome, codice, stato, ordine, campi_specifici, checklist_allegati)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(nome, codice, stato || 'attivo', ordine || 0, JSON.stringify(campi_specifici || []), JSON.stringify(checklist_allegati || []));

    res.status(201).json({ id: result.lastInsertRowid, message: 'Tipologia creata' });
  } catch (err) {
    console.error('Error:', err);
    res.status(500).json({ error: 'Errore nella creazione tipologia' });
  }
});

router.put('/insurance-types/:id', authenticateToken, authorizeRoles('admin'), (req, res) => {
  try {
    const { nome, codice, stato, ordine, campi_specifici, checklist_allegati } = req.body;

    db.prepare(`
      UPDATE insurance_types SET nome=?, codice=?, stato=?, ordine=?, campi_specifici=?, checklist_allegati=?, updated_at=datetime('now')
      WHERE id=?
    `).run(nome, codice, stato, ordine || 0, JSON.stringify(campi_specifici || []), JSON.stringify(checklist_allegati || []), req.params.id);

    res.json({ message: 'Tipologia aggiornata' });
  } catch (err) {
    console.error('Error:', err);
    res.status(500).json({ error: 'Errore nell\'aggiornamento tipologia' });
  }
});

module.exports = router;
