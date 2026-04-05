const express = require('express');
const { db } = require('../config/database');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');
const { resolveListOrder } = require('../utils/listSort');

const ASSISTED_SORT_MAP = {
  nome_cognome: `LOWER(TRIM(COALESCE(ap.cognome, '') || ' ' || COALESCE(ap.nome, '')))`,
  cognome: 'LOWER(ap.cognome)',
  nome: 'LOWER(ap.nome)',
  codice_fiscale: `LOWER(COALESCE(ap.codice_fiscale, ''))`,
  cellulare: `LOWER(COALESCE(ap.cellulare, ''))`,
  email: `LOWER(COALESCE(ap.email, ''))`,
  num_preventivi: 'num_preventivi',
  num_polizze: 'num_polizze',
  created_at: 'ap.created_at',
};
const DEFAULT_ASSISTED_ORDER = 'ORDER BY ap.cognome, ap.nome';

const router = express.Router();

router.get('/', authenticateToken, (req, res) => {
  try {
    const { page = 1, limit = 25, search, sort_by: sortBy, sort_dir: sortDir } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    let where = ['1=1'];
    let params = [];

    if (req.user.role === 'struttura') {
      where.push('ap.id IN (SELECT assistito_id FROM quotes WHERE struttura_id = ?)');
      params.push(req.user.id);
    }

    if (search) {
      where.push('(ap.nome LIKE ? OR ap.cognome LIKE ? OR ap.codice_fiscale LIKE ? OR ap.cellulare LIKE ? OR ap.email LIKE ?)');
      params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
    }

    const whereClause = where.join(' AND ');
    const orderClause = resolveListOrder(ASSISTED_SORT_MAP, sortBy, sortDir, DEFAULT_ASSISTED_ORDER);

    const total = db.prepare(`SELECT COUNT(*) as count FROM assisted_people ap WHERE ${whereClause}`).get(...params).count;

    const assisted = db.prepare(`
      SELECT ap.*,
        (SELECT COUNT(*) FROM quotes WHERE assistito_id = ap.id) as num_preventivi,
        (SELECT COUNT(*) FROM policies WHERE assistito_id = ap.id) as num_polizze
      FROM assisted_people ap
      WHERE ${whereClause}
      ${orderClause}
      LIMIT ? OFFSET ?
    `).all(...params, parseInt(limit), offset);

    res.json({
      data: assisted,
      total,
      page: parseInt(page),
      limit: parseInt(limit),
      totalPages: Math.ceil(total / parseInt(limit))
    });
  } catch (err) {
    console.error('Error fetching assisted:', err);
    res.status(500).json({ error: 'Errore nel recupero assistiti' });
  }
});

router.get('/:id', authenticateToken, (req, res) => {
  try {
    const person = db.prepare('SELECT * FROM assisted_people WHERE id = ?').get(req.params.id);
    if (!person) return res.status(404).json({ error: 'Assistito non trovato' });

    let quoteFilter = '';
    let policyFilter = '';
    let qParams = [req.params.id];
    let pParams = [req.params.id];

    if (req.user.role === 'struttura') {
      quoteFilter = ' AND q.struttura_id = ?';
      policyFilter = ' AND p.struttura_id = ?';
      qParams.push(req.user.id);
      pParams.push(req.user.id);
    }

    const quotes = db.prepare(`
      SELECT q.id, q.numero, q.stato, q.created_at, it.nome as tipo_nome, s.denominazione as struttura_nome
      FROM quotes q
      LEFT JOIN insurance_types it ON q.tipo_assicurazione_id = it.id
      LEFT JOIN users s ON q.struttura_id = s.id
      WHERE q.assistito_id = ?${quoteFilter}
      ORDER BY q.created_at DESC
    `).all(...qParams);

    const policies = db.prepare(`
      SELECT p.id, p.numero, p.stato, p.created_at, it.nome as tipo_nome, s.denominazione as struttura_nome
      FROM policies p
      LEFT JOIN insurance_types it ON p.tipo_assicurazione_id = it.id
      LEFT JOIN users s ON p.struttura_id = s.id
      WHERE p.assistito_id = ?${policyFilter}
      ORDER BY p.created_at DESC
    `).all(...pParams);

    const attachments = db.prepare(`
      SELECT * FROM attachments WHERE entity_type = 'assisted' AND entity_id = ? ORDER BY created_at DESC
    `).all(req.params.id);

    res.json({ ...person, quotes, policies, attachments });
  } catch (err) {
    console.error('Error fetching assisted detail:', err);
    res.status(500).json({ error: 'Errore nel recupero dettaglio assistito' });
  }
});

router.put('/:id', authenticateToken, (req, res) => {
  try {
    const { nome, cognome, data_nascita, codice_fiscale, cellulare, email, indirizzo, cap, citta } = req.body;

    db.prepare(`
      UPDATE assisted_people SET nome=?, cognome=?, data_nascita=?, codice_fiscale=?, cellulare=?, email=?, indirizzo=?, cap=?, citta=?, updated_at=datetime('now')
      WHERE id=?
    `).run(nome, cognome, data_nascita, codice_fiscale, cellulare, email, indirizzo, cap, citta, req.params.id);

    res.json({ message: 'Assistito aggiornato con successo' });
  } catch (err) {
    console.error('Error updating assisted:', err);
    res.status(500).json({ error: 'Errore nell\'aggiornamento assistito' });
  }
});

router.get('/search/cf/:cf', authenticateToken, (req, res) => {
  const person = db.prepare('SELECT * FROM assisted_people WHERE codice_fiscale = ?').get(req.params.cf);
  res.json(person || null);
});

module.exports = router;
