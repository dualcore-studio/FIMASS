const express = require('express');
const { list, getById, upsertById, like, sortBy, paginate } = require('../data/store');
const { loadContext } = require('../data/views');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');

const router = express.Router();

router.get('/', authenticateToken, (req, res) => {
  (async () => {
    const { page = 1, limit = 25, search, sort_by: sortBy, sort_dir: sortDir } = req.query;
    try {
      const ctx = await loadContext();
      let assisted = [...ctx.assisted_people];
      if (req.user.role === 'struttura') {
        const allowedIds = new Set(
          ctx.quotes.filter((q) => Number(q.struttura_id) === Number(req.user.id)).map((q) => Number(q.assistito_id))
        );
        assisted = assisted.filter((a) => allowedIds.has(Number(a.id)));
      }
      if (search) {
        assisted = assisted.filter((a) =>
          like(a.nome, search) || like(a.cognome, search) || like(a.codice_fiscale, search) || like(a.cellulare, search) || like(a.email, search)
        );
      }
      assisted = assisted.map((ap) => ({
        ...ap,
        num_preventivi: ctx.quotes.filter((q) => Number(q.assistito_id) === Number(ap.id)).length,
        num_polizze: ctx.policies.filter((p) => Number(p.assistito_id) === Number(ap.id)).length,
      }));
      const sortMap = { nome_cognome: 'cognome', cognome: 'cognome', nome: 'nome', codice_fiscale: 'codice_fiscale', cellulare: 'cellulare', email: 'email', num_preventivi: 'num_preventivi', num_polizze: 'num_polizze', created_at: 'created_at' };
      assisted = sortBy(assisted, sortMap[sortBy] || 'cognome', sortDir || 'asc');
      res.json(paginate(assisted, page, limit));
    } catch (err) {
      console.error('Error fetching assisted:', err);
      res.status(500).json({ error: 'Errore nel recupero assistiti' });
    }
  })();
});

router.get('/:id', authenticateToken, (req, res) => {
  (async () => {
    try {
      const ctx = await loadContext();
      const person = await getById('assisted_people', req.params.id);
      if (!person) return res.status(404).json({ error: 'Assistito non trovato' });

      let quotes = ctx.quotes.filter((q) => Number(q.assistito_id) === Number(req.params.id));
      let policies = ctx.policies.filter((p) => Number(p.assistito_id) === Number(req.params.id));
      if (req.user.role === 'struttura') {
        quotes = quotes.filter((q) => Number(q.struttura_id) === Number(req.user.id));
        policies = policies.filter((p) => Number(p.struttura_id) === Number(req.user.id));
      }
      quotes = quotes
        .map((q) => ({
          id: q.id,
          numero: q.numero,
          stato: q.stato,
          created_at: q.created_at,
          tipo_nome: ctx.typesById.get(Number(q.tipo_assicurazione_id))?.nome,
          struttura_nome: ctx.usersById.get(Number(q.struttura_id))?.denominazione,
        }))
        .sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')));
      policies = policies
        .map((p) => ({
          id: p.id,
          numero: p.numero,
          stato: p.stato,
          created_at: p.created_at,
          tipo_nome: ctx.typesById.get(Number(p.tipo_assicurazione_id))?.nome,
          struttura_nome: ctx.usersById.get(Number(p.struttura_id))?.denominazione,
        }))
        .sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')));
      const attachments = ctx.attachments
        .filter((a) => a.entity_type === 'assisted' && Number(a.entity_id) === Number(req.params.id))
        .sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')));
      res.json({ ...person, quotes, policies, attachments });
    } catch (err) {
      console.error('Error fetching assisted detail:', err);
      res.status(500).json({ error: 'Errore nel recupero dettaglio assistito' });
    }
  })();
});

router.put('/:id', authenticateToken, (req, res) => {
  (async () => {
    const { nome, cognome, data_nascita, codice_fiscale, cellulare, email, indirizzo, cap, citta } = req.body;
    try {
      const person = await getById('assisted_people', req.params.id);
      if (!person) return res.status(404).json({ error: 'Assistito non trovato' });
      await upsertById('assisted_people', req.params.id, { nome, cognome, data_nascita, codice_fiscale, cellulare, email, indirizzo, cap, citta });
      res.json({ message: 'Assistito aggiornato con successo' });
    } catch (err) {
      console.error('Error updating assisted:', err);
      res.status(500).json({ error: 'Errore nell\'aggiornamento assistito' });
    }
  })();
});

router.get('/search/cf/:cf', authenticateToken, (req, res) => {
  (async () => {
    const people = await list('assisted_people', (p) => p.codice_fiscale === req.params.cf);
    res.json(people[0] || null);
  })();
});

module.exports = router;
