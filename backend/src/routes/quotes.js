const express = require('express');
const { db } = require('../config/database');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');
const { logActivity } = require('./logs');
const { resolveListOrder } = require('../utils/listSort');

const QUOTE_SORT_MAP = {
  numero: 'q.numero',
  assistito: `LOWER(TRIM(COALESCE(ap.cognome, '') || ' ' || COALESCE(ap.nome, '')))`,
  tipo: `LOWER(COALESCE(it.nome, ''))`,
  struttura: `LOWER(COALESCE(s.denominazione, ''))`,
  operatore: `LOWER(TRIM(COALESCE(o.cognome, '') || ' ' || COALESCE(o.nome, '')))`,
  stato: 'q.stato',
  created_at: 'q.created_at',
  data_decorrenza: '(q.data_decorrenza IS NULL), q.data_decorrenza',
};
const DEFAULT_QUOTE_ORDER = 'ORDER BY q.created_at DESC';

const router = express.Router();

function getUserDisplayName(user) {
  return user.role === 'struttura' ? user.denominazione : `${user.nome} ${user.cognome}`;
}

function generateQuoteNumber() {
  const year = new Date().getFullYear();
  const last = db.prepare("SELECT numero FROM quotes WHERE numero LIKE ? ORDER BY id DESC LIMIT 1").get(`PRV-${year}-%`);
  let seq = 1;
  if (last) {
    const parts = last.numero.split('-');
    seq = parseInt(parts[2]) + 1;
  }
  return `PRV-${year}-${String(seq).padStart(5, '0')}`;
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
      data_da,
      data_a,
      assegnata,
      sort_by: sortBy,
      sort_dir: sortDir,
    } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    let where = ['1=1'];
    let params = [];

    if (req.user.role === 'struttura') {
      where.push('q.struttura_id = ?');
      params.push(req.user.id);
    } else if (req.user.role === 'operatore') {
      where.push('q.operatore_id = ?');
      params.push(req.user.id);
    }

    if (stato) { where.push('q.stato = ?'); params.push(stato); }
    if (tipo_assicurazione_id) { where.push('q.tipo_assicurazione_id = ?'); params.push(tipo_assicurazione_id); }
    if (struttura_id) { where.push('q.struttura_id = ?'); params.push(struttura_id); }
    if (operatore_id) { where.push('q.operatore_id = ?'); params.push(operatore_id); }
    if (data_da) { where.push('q.created_at >= ?'); params.push(data_da); }
    if (data_a) { where.push('q.created_at <= ?'); params.push(data_a + ' 23:59:59'); }
    if (assegnata === 'si') { where.push('q.operatore_id IS NOT NULL'); }
    if (assegnata === 'no') { where.push('q.operatore_id IS NULL'); }
    if (search) {
      where.push('(q.numero LIKE ? OR ap.nome LIKE ? OR ap.cognome LIKE ? OR ap.codice_fiscale LIKE ?)');
      params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
    }

    const whereClause = where.join(' AND ');
    const orderClause = resolveListOrder(QUOTE_SORT_MAP, sortBy, sortDir, DEFAULT_QUOTE_ORDER);

    const total = db.prepare(`
      SELECT COUNT(*) as count FROM quotes q
      LEFT JOIN assisted_people ap ON q.assistito_id = ap.id
      WHERE ${whereClause}
    `).get(...params).count;

    const quotes = db.prepare(`
      SELECT q.*,
        ap.nome as assistito_nome, ap.cognome as assistito_cognome, ap.codice_fiscale as assistito_cf,
        it.nome as tipo_nome, it.codice as tipo_codice,
        s.denominazione as struttura_nome,
        o.nome as operatore_nome, o.cognome as operatore_cognome
      FROM quotes q
      LEFT JOIN assisted_people ap ON q.assistito_id = ap.id
      LEFT JOIN insurance_types it ON q.tipo_assicurazione_id = it.id
      LEFT JOIN users s ON q.struttura_id = s.id
      LEFT JOIN users o ON q.operatore_id = o.id
      WHERE ${whereClause}
      ${orderClause}
      LIMIT ? OFFSET ?
    `).all(...params, parseInt(limit), offset);

    res.json({
      data: quotes.map(q => ({
        ...q,
        dati_specifici: q.dati_specifici ? JSON.parse(q.dati_specifici) : null,
        dati_preventivo: q.dati_preventivo ? JSON.parse(q.dati_preventivo) : null
      })),
      total,
      page: parseInt(page),
      limit: parseInt(limit),
      totalPages: Math.ceil(total / parseInt(limit))
    });
  } catch (err) {
    console.error('Error fetching quotes:', err);
    res.status(500).json({ error: 'Errore nel recupero preventivi' });
  }
});

router.get('/stats', authenticateToken, (req, res) => {
  try {
    let struttura_filter = '';
    let operatore_filter = '';
    let params_s = [];
    let params_o = [];

    if (req.user.role === 'struttura') {
      struttura_filter = ' AND struttura_id = ?';
      params_s = [req.user.id];
      params_o = [req.user.id];
    } else if (req.user.role === 'operatore') {
      operatore_filter = ' AND operatore_id = ?';
      params_o = [req.user.id];
    }

    const stats = {};
    const stati = ['PRESENTATA', 'ASSEGNATA', 'IN LAVORAZIONE', 'STANDBY', 'ELABORATA'];
    stati.forEach(s => {
      const f = req.user.role === 'struttura' ? struttura_filter : operatore_filter;
      const p = req.user.role === 'struttura' ? params_s : params_o;
      stats[s] = db.prepare(`SELECT COUNT(*) as count FROM quotes WHERE stato = ?${f}`).get(s, ...p).count;
    });

    stats.totale = Object.values(stats).reduce((a, b) => a + b, 0);

    res.json(stats);
  } catch (err) {
    console.error('Error fetching quote stats:', err);
    res.status(500).json({ error: 'Errore nel recupero statistiche' });
  }
});

router.get('/in-progress', authenticateToken, authorizeRoles('admin', 'supervisore'), (req, res) => {
  try {
    const { limit = 10 } = req.query;
    const safeLimit = Math.max(1, Math.min(parseInt(limit, 10) || 10, 50));

    const rows = db.prepare(`
      SELECT
        q.id,
        q.numero,
        q.operatore_id,
        q.updated_at,
        u.nome as operatore_nome,
        u.cognome as operatore_cognome,
        COALESCE((
          SELECT qsh.created_at
          FROM quote_status_history qsh
          WHERE qsh.quote_id = q.id AND qsh.stato_nuovo = 'IN LAVORAZIONE'
          ORDER BY qsh.created_at DESC
          LIMIT 1
        ), q.updated_at) as in_lavorazione_dal
      FROM quotes q
      LEFT JOIN users u ON q.operatore_id = u.id
      WHERE q.stato = 'IN LAVORAZIONE'
      ORDER BY in_lavorazione_dal ASC, q.id ASC
      LIMIT ?
    `).all(safeLimit);

    res.json(rows);
  } catch (err) {
    console.error('Error fetching in-progress quotes:', err);
    res.status(500).json({ error: 'Errore nel recupero pratiche in lavorazione' });
  }
});

router.post('/:id/reminders', authenticateToken, authorizeRoles('admin', 'supervisore'), (req, res) => {
  try {
    const quote = db.prepare(`
      SELECT id, numero, stato, operatore_id
      FROM quotes
      WHERE id = ?
    `).get(req.params.id);

    if (!quote) return res.status(404).json({ error: 'Preventivo non trovato' });
    if (quote.stato !== 'IN LAVORAZIONE') {
      return res.status(400).json({ error: 'Il sollecito è disponibile solo per pratiche in lavorazione' });
    }
    if (!quote.operatore_id) {
      return res.status(400).json({ error: 'La pratica non ha un operatore assegnato' });
    }

    db.prepare(`
      INSERT INTO quote_reminders (quote_id, operatore_id, created_by)
      VALUES (?, ?, ?)
    `).run(quote.id, quote.operatore_id, req.user.id);

    logActivity({
      utente_id: req.user.id,
      utente_nome: getUserDisplayName(req.user),
      ruolo: req.user.role,
      azione: 'SOLLECITO_PREVENTIVO',
      modulo: 'preventivi',
      riferimento_id: quote.id,
      riferimento_tipo: 'quote',
      dettaglio: `Sollecito inviato per preventivo ${quote.numero}`
    });

    res.status(201).json({ message: 'Sollecito inviato all\'operatore' });
  } catch (err) {
    console.error('Error creating quote reminder:', err);
    res.status(500).json({ error: 'Errore nell\'invio del sollecito' });
  }
});

router.get('/reminders/mine', authenticateToken, authorizeRoles('operatore'), (req, res) => {
  try {
    const reminders = db.prepare(`
      SELECT
        qr.id,
        qr.quote_id,
        qr.created_at,
        qr.read_at,
        q.numero as quote_numero,
        u.role as created_by_role,
        u.nome as created_by_nome,
        u.cognome as created_by_cognome,
        u.denominazione as created_by_denominazione
      FROM quote_reminders qr
      INNER JOIN quotes q ON q.id = qr.quote_id
      INNER JOIN users u ON u.id = qr.created_by
      WHERE qr.operatore_id = ?
      ORDER BY datetime(qr.created_at) DESC
      LIMIT 50
    `).all(req.user.id);

    res.json(reminders);
  } catch (err) {
    console.error('Error fetching operator reminders:', err);
    res.status(500).json({ error: 'Errore nel recupero solleciti' });
  }
});

router.put('/reminders/:id/read', authenticateToken, authorizeRoles('operatore'), (req, res) => {
  try {
    const reminder = db.prepare('SELECT id, operatore_id, read_at FROM quote_reminders WHERE id = ?').get(req.params.id);
    if (!reminder) return res.status(404).json({ error: 'Sollecito non trovato' });
    if (reminder.operatore_id !== req.user.id) return res.status(403).json({ error: 'Accesso non autorizzato' });
    if (reminder.read_at) return res.json({ message: 'Sollecito già letto' });

    db.prepare("UPDATE quote_reminders SET read_at = datetime('now') WHERE id = ?").run(reminder.id);
    res.json({ message: 'Sollecito segnato come letto' });
  } catch (err) {
    console.error('Error marking reminder as read:', err);
    res.status(500).json({ error: 'Errore nell\'aggiornamento del sollecito' });
  }
});

router.get('/:id', authenticateToken, (req, res) => {
  try {
    const quote = db.prepare(`
      SELECT q.*,
        ap.nome as assistito_nome, ap.cognome as assistito_cognome, ap.codice_fiscale as assistito_cf,
        ap.data_nascita as assistito_data_nascita, ap.cellulare as assistito_cellulare,
        ap.email as assistito_email, ap.indirizzo as assistito_indirizzo, ap.cap as assistito_cap, ap.citta as assistito_citta,
        it.nome as tipo_nome, it.codice as tipo_codice,
        s.denominazione as struttura_nome, s.email as struttura_email,
        o.nome as operatore_nome, o.cognome as operatore_cognome
      FROM quotes q
      LEFT JOIN assisted_people ap ON q.assistito_id = ap.id
      LEFT JOIN insurance_types it ON q.tipo_assicurazione_id = it.id
      LEFT JOIN users s ON q.struttura_id = s.id
      LEFT JOIN users o ON q.operatore_id = o.id
      WHERE q.id = ?
    `).get(req.params.id);

    if (!quote) return res.status(404).json({ error: 'Preventivo non trovato' });

    if (req.user.role === 'struttura' && quote.struttura_id !== req.user.id) {
      return res.status(403).json({ error: 'Accesso non autorizzato' });
    }
    if (req.user.role === 'operatore' && quote.operatore_id !== req.user.id) {
      return res.status(403).json({ error: 'Accesso non autorizzato' });
    }

    const history = db.prepare(`
      SELECT qsh.*, u.nome, u.cognome, u.denominazione, u.role
      FROM quote_status_history qsh
      LEFT JOIN users u ON qsh.utente_id = u.id
      ORDER BY qsh.created_at DESC
    `).all();

    const quoteHistory = history.filter(h => h.quote_id === quote.id);

    const notes = db.prepare(`
      SELECT qn.*, u.nome, u.cognome, u.denominazione, u.role
      FROM quote_notes qn
      LEFT JOIN users u ON qn.utente_id = u.id
      WHERE qn.quote_id = ?
      ORDER BY qn.created_at DESC
    `).all(req.params.id);

    const attachments = db.prepare(`
      SELECT a.*, u.nome as caricato_nome, u.cognome as caricato_cognome, u.denominazione as caricato_denominazione
      FROM attachments a
      LEFT JOIN users u ON a.caricato_da = u.id
      WHERE a.entity_type = 'quote' AND a.entity_id = ?
      ORDER BY a.created_at DESC
    `).all(req.params.id);

    const policy = db.prepare('SELECT id, numero, stato FROM policies WHERE quote_id = ?').get(req.params.id);

    res.json({
      ...quote,
      dati_specifici: quote.dati_specifici ? JSON.parse(quote.dati_specifici) : null,
      dati_preventivo: quote.dati_preventivo ? JSON.parse(quote.dati_preventivo) : null,
      history: quoteHistory,
      notes,
      attachments,
      policy
    });
  } catch (err) {
    console.error('Error fetching quote:', err);
    res.status(500).json({ error: 'Errore nel recupero preventivo' });
  }
});

router.post('/', authenticateToken, authorizeRoles('struttura', 'admin'), (req, res) => {
  try {
    const { tipo_assicurazione_id, assistito, dati_specifici, data_decorrenza, note_struttura } = req.body;

    if (!tipo_assicurazione_id || !assistito) {
      return res.status(400).json({ error: 'Dati obbligatori mancanti' });
    }

    const struttura_id = req.user.role === 'struttura' ? req.user.id : req.body.struttura_id;

    let assistito_id;
    if (assistito.id) {
      assistito_id = assistito.id;
      db.prepare(`
        UPDATE assisted_people SET nome=?, cognome=?, data_nascita=?, codice_fiscale=?, cellulare=?, email=?, indirizzo=?, cap=?, citta=?, updated_at=datetime('now')
        WHERE id=?
      `).run(assistito.nome, assistito.cognome, assistito.data_nascita, assistito.codice_fiscale, assistito.cellulare, assistito.email, assistito.indirizzo, assistito.cap, assistito.citta, assistito.id);
    } else {
      if (assistito.codice_fiscale) {
        const existing = db.prepare('SELECT id FROM assisted_people WHERE codice_fiscale = ?').get(assistito.codice_fiscale);
        if (existing) {
          assistito_id = existing.id;
          db.prepare(`
            UPDATE assisted_people SET nome=?, cognome=?, data_nascita=?, cellulare=?, email=?, indirizzo=?, cap=?, citta=?, updated_at=datetime('now')
            WHERE id=?
          `).run(assistito.nome, assistito.cognome, assistito.data_nascita, assistito.cellulare, assistito.email, assistito.indirizzo, assistito.cap, assistito.citta, existing.id);
        }
      }
      if (!assistito_id) {
        const result = db.prepare(`
          INSERT INTO assisted_people (nome, cognome, data_nascita, codice_fiscale, cellulare, email, indirizzo, cap, citta, created_by)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(assistito.nome, assistito.cognome, assistito.data_nascita, assistito.codice_fiscale, assistito.cellulare, assistito.email, assistito.indirizzo, assistito.cap, assistito.citta, req.user.id);
        assistito_id = result.lastInsertRowid;
      }
    }

    const numero = generateQuoteNumber();
    const datiSpecificiJson = dati_specifici ? JSON.stringify(dati_specifici) : null;

    const result = db.prepare(`
      INSERT INTO quotes (numero, assistito_id, tipo_assicurazione_id, struttura_id, stato, data_decorrenza, note_struttura, dati_specifici)
      VALUES (?, ?, ?, ?, 'PRESENTATA', ?, ?, ?)
    `).run(numero, assistito_id, tipo_assicurazione_id, struttura_id, data_decorrenza, note_struttura, datiSpecificiJson);

    const quoteId = result.lastInsertRowid;

    db.prepare(`
      INSERT INTO quote_status_history (quote_id, stato_nuovo, utente_id) VALUES (?, 'PRESENTATA', ?)
    `).run(quoteId, req.user.id);

    logActivity({
      utente_id: req.user.id,
      utente_nome: getUserDisplayName(req.user),
      ruolo: req.user.role,
      azione: 'CREAZIONE_PREVENTIVO',
      modulo: 'preventivi',
      riferimento_id: quoteId,
      riferimento_tipo: 'quote',
      dettaglio: `Creato preventivo ${numero} - ${assistito.nome} ${assistito.cognome}`
    });

    res.status(201).json({ id: quoteId, numero, message: 'Preventivo creato con successo' });
  } catch (err) {
    console.error('Error creating quote:', err);
    res.status(500).json({ error: 'Errore nella creazione del preventivo' });
  }
});

router.put('/:id/assign', authenticateToken, authorizeRoles('supervisore', 'admin'), (req, res) => {
  try {
    const { operatore_id } = req.body;
    if (!operatore_id) return res.status(400).json({ error: 'Operatore richiesto' });

    const quote = db.prepare('SELECT * FROM quotes WHERE id = ?').get(req.params.id);
    if (!quote) return res.status(404).json({ error: 'Preventivo non trovato' });

    const prevStato = quote.stato;
    const newStato = prevStato === 'PRESENTATA' ? 'ASSEGNATA' : prevStato;

    db.prepare("UPDATE quotes SET operatore_id = ?, stato = ?, updated_at = datetime('now') WHERE id = ?").run(operatore_id, newStato, req.params.id);

    if (prevStato !== newStato) {
      db.prepare(`INSERT INTO quote_status_history (quote_id, stato_precedente, stato_nuovo, utente_id) VALUES (?, ?, ?, ?)`).run(req.params.id, prevStato, newStato, req.user.id);
    }

    const op = db.prepare('SELECT nome, cognome FROM users WHERE id = ?').get(operatore_id);

    logActivity({
      utente_id: req.user.id,
      utente_nome: getUserDisplayName(req.user),
      ruolo: req.user.role,
      azione: prevStato === newStato ? 'RIASSEGNAZIONE' : 'ASSEGNAZIONE',
      modulo: 'preventivi',
      riferimento_id: parseInt(req.params.id),
      riferimento_tipo: 'quote',
      dettaglio: `Preventivo ${quote.numero} ${prevStato === newStato ? 'riassegnato' : 'assegnato'} a ${op.nome} ${op.cognome}`
    });

    res.json({ message: 'Preventivo assegnato con successo' });
  } catch (err) {
    console.error('Error assigning quote:', err);
    res.status(500).json({ error: 'Errore nell\'assegnazione' });
  }
});

router.put('/:id/status', authenticateToken, (req, res) => {
  try {
    const { stato, motivo } = req.body;
    if (!stato) return res.status(400).json({ error: 'Stato richiesto' });

    const quote = db.prepare('SELECT * FROM quotes WHERE id = ?').get(req.params.id);
    if (!quote) return res.status(404).json({ error: 'Preventivo non trovato' });

    const validTransitions = {
      'ASSEGNATA': ['IN LAVORAZIONE'],
      'IN LAVORAZIONE': ['STANDBY', 'ELABORATA'],
      'STANDBY': ['IN LAVORAZIONE']
    };

    if (req.user.role === 'operatore') {
      if (quote.operatore_id !== req.user.id) return res.status(403).json({ error: 'Non sei l\'operatore assegnato' });
      if (!validTransitions[quote.stato] || !validTransitions[quote.stato].includes(stato)) {
        return res.status(400).json({ error: `Transizione da ${quote.stato} a ${stato} non consentita` });
      }
    }

    if (stato === 'STANDBY' && !motivo) {
      return res.status(400).json({ error: 'Motivo standby obbligatorio' });
    }

    db.prepare("UPDATE quotes SET stato = ?, updated_at = datetime('now') WHERE id = ?").run(stato, req.params.id);

    db.prepare(`INSERT INTO quote_status_history (quote_id, stato_precedente, stato_nuovo, motivo, utente_id) VALUES (?, ?, ?, ?, ?)`)
      .run(req.params.id, quote.stato, stato, motivo || null, req.user.id);

    logActivity({
      utente_id: req.user.id,
      utente_nome: getUserDisplayName(req.user),
      ruolo: req.user.role,
      azione: stato === 'STANDBY' ? 'STANDBY' : 'CAMBIO_STATO',
      modulo: 'preventivi',
      riferimento_id: parseInt(req.params.id),
      riferimento_tipo: 'quote',
      dettaglio: `Preventivo ${quote.numero}: ${quote.stato} → ${stato}${motivo ? ` (Motivo: ${motivo})` : ''}`
    });

    res.json({ message: 'Stato aggiornato con successo' });
  } catch (err) {
    console.error('Error updating quote status:', err);
    res.status(500).json({ error: 'Errore nell\'aggiornamento stato' });
  }
});

router.put('/:id', authenticateToken, (req, res) => {
  try {
    const { dati_specifici, dati_preventivo, note_struttura } = req.body;
    const quote = db.prepare('SELECT * FROM quotes WHERE id = ?').get(req.params.id);
    if (!quote) return res.status(404).json({ error: 'Preventivo non trovato' });

    const updates = [];
    const params = [];

    if (dati_specifici !== undefined) { updates.push('dati_specifici = ?'); params.push(JSON.stringify(dati_specifici)); }
    if (dati_preventivo !== undefined) { updates.push('dati_preventivo = ?'); params.push(JSON.stringify(dati_preventivo)); }
    if (note_struttura !== undefined) { updates.push('note_struttura = ?'); params.push(note_struttura); }

    if (updates.length > 0) {
      updates.push("updated_at = datetime('now')");
      params.push(req.params.id);
      db.prepare(`UPDATE quotes SET ${updates.join(', ')} WHERE id = ?`).run(...params);
    }

    logActivity({
      utente_id: req.user.id,
      utente_nome: getUserDisplayName(req.user),
      ruolo: req.user.role,
      azione: 'MODIFICA_PREVENTIVO',
      modulo: 'preventivi',
      riferimento_id: parseInt(req.params.id),
      riferimento_tipo: 'quote',
      dettaglio: `Modificato preventivo ${quote.numero}`
    });

    res.json({ message: 'Preventivo aggiornato con successo' });
  } catch (err) {
    console.error('Error updating quote:', err);
    res.status(500).json({ error: 'Errore nell\'aggiornamento preventivo' });
  }
});

router.post('/:id/notes', authenticateToken, (req, res) => {
  try {
    const { testo, tipo } = req.body;
    if (!testo) return res.status(400).json({ error: 'Testo nota richiesto' });

    const quote = db.prepare('SELECT * FROM quotes WHERE id = ?').get(req.params.id);
    if (!quote) return res.status(404).json({ error: 'Preventivo non trovato' });

    const result = db.prepare(`INSERT INTO quote_notes (quote_id, utente_id, tipo, testo) VALUES (?, ?, ?, ?)`)
      .run(req.params.id, req.user.id, tipo || 'interna', testo);

    res.status(201).json({ id: result.lastInsertRowid, message: 'Nota aggiunta con successo' });
  } catch (err) {
    console.error('Error adding note:', err);
    res.status(500).json({ error: 'Errore nell\'aggiunta nota' });
  }
});

module.exports = router;
