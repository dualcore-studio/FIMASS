const express = require('express');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');
const { logActivity } = require('./logs');
const { list, getById, findOne, insert, upsertById, like, paginate } = require('../data/store');
const { loadContext, enrichQuote } = require('../data/views');
const { sortQuotesForList } = require('../utils/practiceListSort');

const router = express.Router();

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

router.get('/', authenticateToken, (req, res) => {
  (async () => {
    const {
      page = 1,
      limit = 25,
      stato,
      tipo_assicurazione_id,
      struttura_id,
      operatore_id,
      search,
      numero,
      assistito,
      data_da,
      data_a,
      assegnata,
      alert,
      sort_by: sortByParam,
      sort_dir: sortDir,
    } = req.query;
    try {
      const ctx = await loadContext();
      let quotes = ctx.quotes.map((q) => enrichQuote(q, ctx));
      if (req.user.role === 'struttura') quotes = quotes.filter((q) => Number(q.struttura_id) === Number(req.user.id));
      else if (req.user.role === 'operatore') quotes = quotes.filter((q) => Number(q.operatore_id) === Number(req.user.id));
      if (stato) quotes = quotes.filter((q) => q.stato === stato);
      if (tipo_assicurazione_id) quotes = quotes.filter((q) => Number(q.tipo_assicurazione_id) === Number(tipo_assicurazione_id));
      if (struttura_id) quotes = quotes.filter((q) => Number(q.struttura_id) === Number(struttura_id));
      if (operatore_id) quotes = quotes.filter((q) => Number(q.operatore_id) === Number(operatore_id));
      if (data_da) quotes = quotes.filter((q) => String(q.created_at || '') >= String(data_da));
      if (data_a) quotes = quotes.filter((q) => String(q.created_at || '') <= `${data_a} 23:59:59`);
      if (assegnata === 'si') quotes = quotes.filter((q) => q.operatore_id != null);
      if (assegnata === 'no') quotes = quotes.filter((q) => q.operatore_id == null);
      const daysAgo = (d) => new Date(Date.now() - d * 86400000).toISOString().slice(0, 19).replace('T', ' ');
      if (alert === 'unassigned') quotes = quotes.filter((q) => q.stato === 'PRESENTATA' && q.operatore_id == null);
      if (alert === 'standby_long') quotes = quotes.filter((q) => q.stato === 'STANDBY' && String(q.updated_at || '') <= daysAgo(7));
      if (alert === 'stale_quotes') quotes = quotes.filter((q) => ['ASSEGNATA', 'IN LAVORAZIONE'].includes(q.stato) && String(q.updated_at || '') <= daysAgo(7));
      if (numero) quotes = quotes.filter((q) => like(q.numero, numero));
      if (assistito) {
        quotes = quotes.filter(
          (q) =>
            like(q.assistito_nome, assistito) ||
            like(q.assistito_cognome, assistito) ||
            like(q.assistito_cf, assistito),
        );
      }
      if (search) quotes = quotes.filter((q) => like(q.numero, search) || like(q.assistito_nome, search) || like(q.assistito_cognome, search) || like(q.assistito_cf, search));
      const sortMap = { numero: 'numero', assistito: 'assistito_cognome', tipo: 'tipo_nome', struttura: 'struttura_nome', operatore: 'operatore_cognome', stato: 'stato', created_at: 'created_at', data_decorrenza: 'data_decorrenza' };
      quotes = sortQuotesForList(quotes, sortByParam, sortDir || 'desc', sortMap);
      res.json(paginate(quotes, page, limit));
    } catch (err) {
      console.error('Error fetching quotes:', err);
      res.status(500).json({ error: 'Errore nel recupero preventivi' });
    }
  })();
});

router.get('/stats', authenticateToken, (req, res) => {
  (async () => {
    try {
      let quotes = await list('quotes');
      if (req.user.role === 'struttura') quotes = quotes.filter((q) => Number(q.struttura_id) === Number(req.user.id));
      else if (req.user.role === 'operatore') quotes = quotes.filter((q) => Number(q.operatore_id) === Number(req.user.id));
      const stats = {};
      const stati = ['PRESENTATA', 'ASSEGNATA', 'IN LAVORAZIONE', 'STANDBY', 'ELABORATA'];
      stati.forEach((s) => { stats[s] = quotes.filter((q) => q.stato === s).length; });
      stats.totale = Object.values(stats).reduce((a, b) => a + b, 0);
      res.json(stats);
    } catch (err) {
      console.error('Error fetching quote stats:', err);
      res.status(500).json({ error: 'Errore nel recupero statistiche' });
    }
  })();
});

router.get('/in-progress', authenticateToken, authorizeRoles('admin', 'supervisore'), (req, res) => {
  (async () => {
    const { limit = 10 } = req.query;
    const safeLimit = Math.max(1, Math.min(parseInt(limit, 10) || 10, 50));
    try {
      const ctx = await loadContext();
      const rows = ctx.quotes
        .filter((q) => q.stato === 'IN LAVORAZIONE')
        .map((q) => {
          const hist = ctx.quote_status_history
            .filter((h) => Number(h.quote_id) === Number(q.id) && h.stato_nuovo === 'IN LAVORAZIONE')
            .sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')))[0];
          return {
            id: q.id,
            numero: q.numero,
            operatore_id: q.operatore_id,
            updated_at: q.updated_at,
            operatore_nome: ctx.usersById.get(Number(q.operatore_id))?.nome,
            operatore_cognome: ctx.usersById.get(Number(q.operatore_id))?.cognome,
            in_lavorazione_dal: hist?.created_at || q.updated_at,
          };
        })
        .sort((a, b) => String(a.in_lavorazione_dal || '').localeCompare(String(b.in_lavorazione_dal || '')))
        .slice(0, safeLimit);
      res.json(rows);
    } catch (err) {
      console.error('Error fetching in-progress quotes:', err);
      res.status(500).json({ error: 'Errore nel recupero pratiche in lavorazione' });
    }
  })();
});

async function insertQuoteReminder(quoteId, req, res) {
  const quote = await getById('quotes', quoteId);
  if (!quote) return res.status(404).json({ error: 'Preventivo non trovato' });
  if (quote.stato !== 'IN LAVORAZIONE') return res.status(400).json({ error: 'Il sollecito è disponibile solo per pratiche in lavorazione' });
  if (!quote.operatore_id) return res.status(400).json({ error: 'La pratica non ha un operatore assegnato' });
  try {
    await insert('quote_reminders', { quote_id: quote.id, operatore_id: quote.operatore_id, created_by: req.user.id, read_at: null });
    await logActivity({
      utente_id: req.user.id,
      utente_nome: getUserDisplayName(req.user),
      ruolo: req.user.role,
      azione: 'SOLLECITO_PREVENTIVO',
      modulo: 'preventivi',
      riferimento_id: quote.id,
      riferimento_tipo: 'quote',
      dettaglio: `Sollecito inviato per preventivo ${quote.numero}`,
    });
    return res.status(201).json({ message: 'Sollecito inviato all\'operatore' });
  } catch (err) {
    console.error('Error creating quote reminder:', err);
    return res.status(500).json({ error: 'Errore nell\'invio del sollecito' });
  }
}

/** Body: { quote_id } — percorso esplicito (evita ambiguità con proxy o versioni vecchie del client). */
router.post('/sollecito', authenticateToken, authorizeRoles('admin', 'supervisore'), (req, res) => {
  (async () => {
  const raw = req.body?.quote_id ?? req.body?.quoteId;
  const quoteId = parseInt(raw, 10);
  if (!raw || Number.isNaN(quoteId)) {
    return res.status(400).json({ error: 'quote_id richiesto' });
  }
  return insertQuoteReminder(quoteId, req, res);
  })();
});

router.post('/:id/reminders', authenticateToken, authorizeRoles('admin', 'supervisore'), (req, res) => {
  (async () => {
  const quoteId = parseInt(req.params.id, 10);
  if (Number.isNaN(quoteId)) {
    return res.status(400).json({ error: 'ID preventivo non valido' });
  }
  return insertQuoteReminder(quoteId, req, res);
  })();
});

router.get('/reminders/mine', authenticateToken, authorizeRoles('operatore'), (req, res) => {
  (async () => {
    try {
      const ctx = await loadContext();
      const reminders = ctx.quote_reminders
        .filter((r) => Number(r.operatore_id) === Number(req.user.id))
        .map((r) => ({
          ...r,
          quote_numero: ctx.quotesById.get(Number(r.quote_id))?.numero,
          created_by_role: ctx.usersById.get(Number(r.created_by))?.role,
          created_by_nome: ctx.usersById.get(Number(r.created_by))?.nome,
          created_by_cognome: ctx.usersById.get(Number(r.created_by))?.cognome,
          created_by_denominazione: ctx.usersById.get(Number(r.created_by))?.denominazione,
        }))
        .sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')))
        .slice(0, 50);
      res.json(reminders);
    } catch (err) {
      console.error('Error fetching operator reminders:', err);
      res.status(500).json({ error: 'Errore nel recupero solleciti' });
    }
  })();
});

router.put('/reminders/:id/read', authenticateToken, authorizeRoles('operatore'), (req, res) => {
  (async () => {
    try {
      const reminder = await getById('quote_reminders', req.params.id);
      if (!reminder) return res.status(404).json({ error: 'Sollecito non trovato' });
      if (Number(reminder.operatore_id) !== Number(req.user.id)) return res.status(403).json({ error: 'Accesso non autorizzato' });
      if (reminder.read_at) return res.json({ message: 'Sollecito già letto' });
      await upsertById('quote_reminders', reminder.id, { read_at: new Date().toISOString().slice(0, 19).replace('T', ' ') });
      res.json({ message: 'Sollecito segnato come letto' });
    } catch (err) {
      console.error('Error marking reminder as read:', err);
      res.status(500).json({ error: 'Errore nell\'aggiornamento del sollecito' });
    }
  })();
});

router.get('/:id', authenticateToken, (req, res) => {
  (async () => {
    try {
      const ctx = await loadContext();
      const row = await getById('quotes', req.params.id);
      if (!row) return res.status(404).json({ error: 'Preventivo non trovato' });
      const quote = enrichQuote(row, ctx);
      if (req.user.role === 'struttura' && Number(quote.struttura_id) !== Number(req.user.id)) return res.status(403).json({ error: 'Accesso non autorizzato' });
      if (req.user.role === 'operatore' && Number(quote.operatore_id) !== Number(req.user.id)) return res.status(403).json({ error: 'Accesso non autorizzato' });
      const history = ctx.quote_status_history
        .filter((h) => Number(h.quote_id) === Number(row.id))
        .map((h) => ({ ...h, ...ctx.usersById.get(Number(h.utente_id)) }))
        .sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')));
      const notes = ctx.quote_notes
        .filter((n) => Number(n.quote_id) === Number(row.id))
        .map((n) => ({ ...n, ...ctx.usersById.get(Number(n.utente_id)) }))
        .sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')));
      const attachments = ctx.attachments
        .filter((a) => a.entity_type === 'quote' && Number(a.entity_id) === Number(row.id))
        .map((a) => ({ ...a, caricato_nome: ctx.usersById.get(Number(a.caricato_da))?.nome, caricato_cognome: ctx.usersById.get(Number(a.caricato_da))?.cognome, caricato_denominazione: ctx.usersById.get(Number(a.caricato_da))?.denominazione }))
        .sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')));
      const policy = ctx.policies.find((p) => Number(p.quote_id) === Number(row.id));
      res.json({ ...quote, history, notes, attachments, policy: policy ? { id: policy.id, numero: policy.numero, stato: policy.stato } : null });
    } catch (err) {
      console.error('Error fetching quote:', err);
      res.status(500).json({ error: 'Errore nel recupero preventivo' });
    }
  })();
});

router.post('/', authenticateToken, authorizeRoles('struttura', 'admin'), (req, res) => {
  (async () => {
    const { tipo_assicurazione_id, assistito, dati_specifici, data_decorrenza, note_struttura } = req.body;

    if (!tipo_assicurazione_id || !assistito) {
      return res.status(400).json({ error: 'Dati obbligatori mancanti' });
    }

    const struttura_id = req.user.role === 'struttura' ? req.user.id : req.body.struttura_id;

    let assistito_id;
    if (assistito.id) {
      assistito_id = assistito.id;
      await upsertById('assisted_people', assistito.id, { nome: assistito.nome, cognome: assistito.cognome, data_nascita: assistito.data_nascita, codice_fiscale: assistito.codice_fiscale, cellulare: assistito.cellulare, email: assistito.email, indirizzo: assistito.indirizzo, cap: assistito.cap, citta: assistito.citta });
    } else {
      if (assistito.codice_fiscale) {
        const existing = await findOne('assisted_people', (a) => a.codice_fiscale === assistito.codice_fiscale);
        if (existing) {
          assistito_id = existing.id;
          await upsertById('assisted_people', existing.id, { nome: assistito.nome, cognome: assistito.cognome, data_nascita: assistito.data_nascita, cellulare: assistito.cellulare, email: assistito.email, indirizzo: assistito.indirizzo, cap: assistito.cap, citta: assistito.citta });
        }
      }
      if (!assistito_id) {
        const result = await insert('assisted_people', { nome: assistito.nome, cognome: assistito.cognome, data_nascita: assistito.data_nascita, codice_fiscale: assistito.codice_fiscale, cellulare: assistito.cellulare, email: assistito.email, indirizzo: assistito.indirizzo, cap: assistito.cap, citta: assistito.citta, created_by: req.user.id });
        assistito_id = result.id;
      }
    }

    const numero = await generateQuoteNumber();
    const result = await insert('quotes', { numero, assistito_id, tipo_assicurazione_id, struttura_id, stato: 'PRESENTATA', data_decorrenza, note_struttura, dati_specifici: dati_specifici || null, has_policy: 0 });
    const quoteId = result.id;
    await insert('quote_status_history', { quote_id: quoteId, stato_nuovo: 'PRESENTATA', utente_id: req.user.id });
    await logActivity({
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
  })().catch((err) => {
    console.error('Error creating quote:', err);
    res.status(500).json({ error: 'Errore nella creazione del preventivo' });
  });
});

router.put('/:id/assign', authenticateToken, authorizeRoles('supervisore', 'admin'), (req, res) => {
  (async () => {
    const { operatore_id } = req.body;
    if (!operatore_id) return res.status(400).json({ error: 'Operatore richiesto' });

    const quote = await getById('quotes', req.params.id);
    if (!quote) return res.status(404).json({ error: 'Preventivo non trovato' });

    const prevStato = quote.stato;
    const newStato = prevStato === 'PRESENTATA' ? 'ASSEGNATA' : prevStato;

    await upsertById('quotes', req.params.id, { operatore_id, stato: newStato });

    if (prevStato !== newStato) {
      await insert('quote_status_history', { quote_id: Number(req.params.id), stato_precedente: prevStato, stato_nuovo: newStato, utente_id: req.user.id });
    }

    const op = await getById('users', operatore_id);
    await logActivity({
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
  })().catch((err) => {
    console.error('Error assigning quote:', err);
    res.status(500).json({ error: 'Errore nell\'assegnazione' });
  });
});

router.put('/:id/status', authenticateToken, (req, res) => {
  (async () => {
    const { stato, motivo } = req.body;
    if (!stato) return res.status(400).json({ error: 'Stato richiesto' });

    const quote = await getById('quotes', req.params.id);
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

    await upsertById('quotes', req.params.id, { stato });
    await insert('quote_status_history', { quote_id: Number(req.params.id), stato_precedente: quote.stato, stato_nuovo: stato, motivo: motivo || null, utente_id: req.user.id });
    await logActivity({
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
  })().catch((err) => {
    console.error('Error updating quote status:', err);
    res.status(500).json({ error: 'Errore nell\'aggiornamento stato' });
  });
});

router.put('/:id', authenticateToken, (req, res) => {
  (async () => {
    const { dati_specifici, dati_preventivo, note_struttura } = req.body;
    const quote = await getById('quotes', req.params.id);
    if (!quote) return res.status(404).json({ error: 'Preventivo non trovato' });

    const patch = {};
    if (dati_specifici !== undefined) patch.dati_specifici = dati_specifici;
    if (dati_preventivo !== undefined) patch.dati_preventivo = dati_preventivo;
    if (note_struttura !== undefined) patch.note_struttura = note_struttura;
    if (Object.keys(patch).length > 0) await upsertById('quotes', req.params.id, patch);
    await logActivity({
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
  })().catch((err) => {
    console.error('Error updating quote:', err);
    res.status(500).json({ error: 'Errore nell\'aggiornamento preventivo' });
  });
});

router.post('/:id/notes', authenticateToken, (req, res) => {
  (async () => {
    const { testo, tipo } = req.body;
    if (!testo) return res.status(400).json({ error: 'Testo nota richiesto' });

    const quote = await getById('quotes', req.params.id);
    if (!quote) return res.status(404).json({ error: 'Preventivo non trovato' });

    const result = await insert('quote_notes', { quote_id: Number(req.params.id), utente_id: req.user.id, tipo: tipo || 'interna', testo });
    res.status(201).json({ id: result.id, message: 'Nota aggiunta con successo' });
  })().catch((err) => {
    console.error('Error adding note:', err);
    res.status(500).json({ error: 'Errore nell\'aggiunta nota' });
  });
});

module.exports = router;
