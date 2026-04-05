const express = require('express');
const { db } = require('../config/database');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');
const { logActivity } = require('./logs');
const { resolveListOrder } = require('../utils/listSort');

const POLICY_SORT_MAP = {
  numero: 'p.numero',
  preventivo: `LOWER(COALESCE(q.numero, ''))`,
  assistito: `LOWER(TRIM(COALESCE(ap.cognome, '') || ' ' || COALESCE(ap.nome, '')))`,
  tipo: `LOWER(COALESCE(it.nome, ''))`,
  struttura: `LOWER(COALESCE(s.denominazione, ''))`,
  stato: 'p.stato',
  created_at: 'p.created_at',
};
const DEFAULT_POLICY_ORDER = 'ORDER BY p.created_at DESC';

const router = express.Router();

function getUserDisplayName(user) {
  return user.role === 'struttura' ? user.denominazione : `${user.nome} ${user.cognome}`;
}

function generatePolicyNumber() {
  const year = new Date().getFullYear();
  const last = db.prepare("SELECT numero FROM policies WHERE numero LIKE ? ORDER BY id DESC LIMIT 1").get(`POL-${year}-%`);
  let seq = 1;
  if (last) {
    const parts = last.numero.split('-');
    seq = parseInt(parts[2]) + 1;
  }
  return `POL-${year}-${String(seq).padStart(5, '0')}`;
}

router.get('/', authenticateToken, (req, res) => {
  try {
    const {
      page = 1,
      limit = 25,
      stato,
      tipo_assicurazione_id,
      struttura_id,
      operatore_id,
      search,
      sort_by: sortBy,
      sort_dir: sortDir,
    } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    let where = ['1=1'];
    let params = [];

    if (req.user.role === 'struttura') {
      where.push('p.struttura_id = ?');
      params.push(req.user.id);
    } else if (req.user.role === 'operatore') {
      where.push('p.operatore_id = ?');
      params.push(req.user.id);
    }

    if (stato) { where.push('p.stato = ?'); params.push(stato); }
    if (tipo_assicurazione_id) { where.push('p.tipo_assicurazione_id = ?'); params.push(tipo_assicurazione_id); }
    if (struttura_id) { where.push('p.struttura_id = ?'); params.push(struttura_id); }
    if (operatore_id) { where.push('p.operatore_id = ?'); params.push(operatore_id); }
    if (search) {
      where.push('(p.numero LIKE ? OR ap.nome LIKE ? OR ap.cognome LIKE ?)');
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    const whereClause = where.join(' AND ');
    const orderClause = resolveListOrder(POLICY_SORT_MAP, sortBy, sortDir, DEFAULT_POLICY_ORDER);

    const total = db.prepare(`
      SELECT COUNT(*) as count FROM policies p
      LEFT JOIN assisted_people ap ON p.assistito_id = ap.id
      WHERE ${whereClause}
    `).get(...params).count;

    const policies = db.prepare(`
      SELECT p.*,
        ap.nome as assistito_nome, ap.cognome as assistito_cognome, ap.codice_fiscale as assistito_cf,
        it.nome as tipo_nome, it.codice as tipo_codice,
        s.denominazione as struttura_nome,
        o.nome as operatore_nome, o.cognome as operatore_cognome,
        q.numero as preventivo_numero
      FROM policies p
      LEFT JOIN assisted_people ap ON p.assistito_id = ap.id
      LEFT JOIN insurance_types it ON p.tipo_assicurazione_id = it.id
      LEFT JOIN users s ON p.struttura_id = s.id
      LEFT JOIN users o ON p.operatore_id = o.id
      LEFT JOIN quotes q ON p.quote_id = q.id
      WHERE ${whereClause}
      ${orderClause}
      LIMIT ? OFFSET ?
    `).all(...params, parseInt(limit), offset);

    res.json({
      data: policies.map(p => ({
        ...p,
        dati_specifici: p.dati_specifici ? JSON.parse(p.dati_specifici) : null
      })),
      total,
      page: parseInt(page),
      limit: parseInt(limit),
      totalPages: Math.ceil(total / parseInt(limit))
    });
  } catch (err) {
    console.error('Error fetching policies:', err);
    res.status(500).json({ error: 'Errore nel recupero polizze' });
  }
});

router.get('/stats', authenticateToken, (req, res) => {
  try {
    let filter = '';
    let params = [];

    if (req.user.role === 'struttura') {
      filter = ' AND struttura_id = ?';
      params = [req.user.id];
    } else if (req.user.role === 'operatore') {
      filter = ' AND operatore_id = ?';
      params = [req.user.id];
    }

    const stats = {};
    const stati = ['RICHIESTA PRESENTATA', 'IN VERIFICA', 'DOCUMENTAZIONE MANCANTE', 'PRONTA PER EMISSIONE', 'EMESSA'];
    stati.forEach(s => {
      stats[s] = db.prepare(`SELECT COUNT(*) as count FROM policies WHERE stato = ?${filter}`).get(s, ...params).count;
    });
    stats.totale = Object.values(stats).reduce((a, b) => a + b, 0);

    res.json(stats);
  } catch (err) {
    console.error('Error fetching policy stats:', err);
    res.status(500).json({ error: 'Errore nel recupero statistiche polizze' });
  }
});

router.get('/:id', authenticateToken, (req, res) => {
  try {
    const policy = db.prepare(`
      SELECT p.*,
        ap.nome as assistito_nome, ap.cognome as assistito_cognome, ap.codice_fiscale as assistito_cf,
        ap.data_nascita as assistito_data_nascita, ap.cellulare as assistito_cellulare, ap.email as assistito_email,
        it.nome as tipo_nome, it.codice as tipo_codice,
        s.denominazione as struttura_nome,
        o.nome as operatore_nome, o.cognome as operatore_cognome,
        q.numero as preventivo_numero, q.id as preventivo_id
      FROM policies p
      LEFT JOIN assisted_people ap ON p.assistito_id = ap.id
      LEFT JOIN insurance_types it ON p.tipo_assicurazione_id = it.id
      LEFT JOIN users s ON p.struttura_id = s.id
      LEFT JOIN users o ON p.operatore_id = o.id
      LEFT JOIN quotes q ON p.quote_id = q.id
      WHERE p.id = ?
    `).get(req.params.id);

    if (!policy) return res.status(404).json({ error: 'Polizza non trovata' });

    if (req.user.role === 'struttura' && policy.struttura_id !== req.user.id) {
      return res.status(403).json({ error: 'Accesso non autorizzato' });
    }

    const history = db.prepare(`
      SELECT psh.*, u.nome, u.cognome, u.denominazione, u.role
      FROM policy_status_history psh
      LEFT JOIN users u ON psh.utente_id = u.id
      WHERE psh.policy_id = ?
      ORDER BY psh.created_at DESC
    `).all(req.params.id);

    const attachments = db.prepare(`
      SELECT a.*, u.nome as caricato_nome, u.cognome as caricato_cognome, u.denominazione as caricato_denominazione
      FROM attachments a
      LEFT JOIN users u ON a.caricato_da = u.id
      WHERE a.entity_type = 'policy' AND a.entity_id = ?
      ORDER BY a.created_at DESC
    `).all(req.params.id);

    res.json({
      ...policy,
      dati_specifici: policy.dati_specifici ? JSON.parse(policy.dati_specifici) : null,
      history,
      attachments
    });
  } catch (err) {
    console.error('Error fetching policy:', err);
    res.status(500).json({ error: 'Errore nel recupero polizza' });
  }
});

router.post('/', authenticateToken, authorizeRoles('struttura', 'admin'), (req, res) => {
  try {
    const { quote_id, note_struttura } = req.body;

    if (!quote_id) return res.status(400).json({ error: 'Preventivo di origine richiesto' });

    const quote = db.prepare('SELECT * FROM quotes WHERE id = ?').get(quote_id);
    if (!quote) return res.status(404).json({ error: 'Preventivo non trovato' });
    if (quote.stato !== 'ELABORATA') return res.status(400).json({ error: 'Il preventivo deve essere in stato ELABORATA' });
    if (quote.has_policy) return res.status(409).json({ error: 'Polizza già richiesta per questo preventivo' });

    if (req.user.role === 'struttura' && quote.struttura_id !== req.user.id) {
      return res.status(403).json({ error: 'Accesso non autorizzato' });
    }

    const numero = generatePolicyNumber();

    const result = db.prepare(`
      INSERT INTO policies (numero, quote_id, assistito_id, tipo_assicurazione_id, struttura_id, operatore_id, stato, dati_specifici, note_struttura)
      VALUES (?, ?, ?, ?, ?, ?, 'RICHIESTA PRESENTATA', ?, ?)
    `).run(numero, quote_id, quote.assistito_id, quote.tipo_assicurazione_id, quote.struttura_id, quote.operatore_id, quote.dati_specifici, note_struttura || null);

    const policyId = result.lastInsertRowid;

    db.prepare("UPDATE quotes SET has_policy = 1, updated_at = datetime('now') WHERE id = ?").run(quote_id);

    db.prepare(`INSERT INTO policy_status_history (policy_id, stato_nuovo, utente_id) VALUES (?, 'RICHIESTA PRESENTATA', ?)`).run(policyId, req.user.id);

    logActivity({
      utente_id: req.user.id,
      utente_nome: getUserDisplayName(req.user),
      ruolo: req.user.role,
      azione: 'CREAZIONE_POLIZZA',
      modulo: 'polizze',
      riferimento_id: policyId,
      riferimento_tipo: 'policy',
      dettaglio: `Creata richiesta polizza ${numero} da preventivo ${quote.numero}`
    });

    res.status(201).json({ id: policyId, numero, message: 'Richiesta emissione polizza creata con successo' });
  } catch (err) {
    console.error('Error creating policy:', err);
    res.status(500).json({ error: 'Errore nella creazione polizza' });
  }
});

router.put('/:id/status', authenticateToken, authorizeRoles('admin', 'supervisore', 'operatore'), (req, res) => {
  try {
    const { stato, motivo } = req.body;
    if (!stato) return res.status(400).json({ error: 'Stato richiesto' });

    const policy = db.prepare('SELECT * FROM policies WHERE id = ?').get(req.params.id);
    if (!policy) return res.status(404).json({ error: 'Polizza non trovata' });

    db.prepare("UPDATE policies SET stato = ?, updated_at = datetime('now') WHERE id = ?").run(stato, req.params.id);

    db.prepare(`INSERT INTO policy_status_history (policy_id, stato_precedente, stato_nuovo, motivo, utente_id) VALUES (?, ?, ?, ?, ?)`)
      .run(req.params.id, policy.stato, stato, motivo || null, req.user.id);

    logActivity({
      utente_id: req.user.id,
      utente_nome: getUserDisplayName(req.user),
      ruolo: req.user.role,
      azione: 'CAMBIO_STATO_POLIZZA',
      modulo: 'polizze',
      riferimento_id: parseInt(req.params.id),
      riferimento_tipo: 'policy',
      dettaglio: `Polizza ${policy.numero}: ${policy.stato} → ${stato}`
    });

    res.json({ message: 'Stato polizza aggiornato' });
  } catch (err) {
    console.error('Error updating policy status:', err);
    res.status(500).json({ error: 'Errore nell\'aggiornamento stato polizza' });
  }
});

module.exports = router;
