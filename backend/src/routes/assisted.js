const express = require('express');
const { list, getById, upsertById, like, sortBy: sortRecords, paginate } = require('../data/store');
const { loadContext } = require('../data/views');
const { sortQuotesForList, sortPoliciesForList } = require('../utils/practiceListSort');
const { normalizePolicyStato } = require('../utils/policyStato');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');
const { sanitizeAttachmentsList } = require('../lib/attachmentPublicJson');

const router = express.Router();

router.get('/', authenticateToken, (req, res) => {
  (async () => {
    const { page = 1, limit = 25, search, sort_by: sortByParam, sort_dir: sortDir } = req.query;
    try {
      const ctx = await loadContext();
      let assisted = [...ctx.assisted_people];
      if (req.user.role === 'struttura') {
        const allowedIds = new Set(
          ctx.quotes.filter((q) => Number(q.struttura_id) === Number(req.user.id)).map((q) => Number(q.assistito_id))
        );
        assisted = assisted.filter((a) => allowedIds.has(Number(a.id)));
      } else if (req.user.role === 'operatore' || req.user.role === 'fornitore') {
        const allowedIds = new Set();
        const uid = Number(req.user.id);
        ctx.quotes.forEach((q) => {
          if (req.user.role === 'operatore' && Number(q.operatore_id) === uid) allowedIds.add(Number(q.assistito_id));
          if (req.user.role === 'fornitore' && Number(q.fornitore_id) === uid) allowedIds.add(Number(q.assistito_id));
        });
        ctx.policies.forEach((p) => {
          if (req.user.role === 'operatore' && Number(p.operatore_id) === uid) allowedIds.add(Number(p.assistito_id));
          if (req.user.role === 'fornitore' && Number(p.fornitore_id) === uid) allowedIds.add(Number(p.assistito_id));
        });
        assisted = assisted.filter((a) => allowedIds.has(Number(a.id)));
      }
      if (search) {
        assisted = assisted.filter((a) =>
          like(a.nome, search) || like(a.cognome, search) || like(a.codice_fiscale, search) || like(a.cellulare, search) || like(a.email, search)
        );
      }
      assisted = assisted.map((ap) => {
        const aid = Number(ap.id);
        const quoteRows = ctx.quotes.filter((q) => Number(q.assistito_id) === aid);
        const polRows = ctx.policies.filter((p) => Number(p.assistito_id) === aid);
        let num_preventivi = quoteRows.length;
        let num_polizze = polRows.length;
        if (req.user.role === 'struttura') {
          num_preventivi = quoteRows.filter((q) => Number(q.struttura_id) === Number(req.user.id)).length;
          num_polizze = polRows.filter((p) => Number(p.struttura_id) === Number(req.user.id)).length;
        } else if (req.user.role === 'operatore') {
          num_preventivi = quoteRows.filter((q) => Number(q.operatore_id) === Number(req.user.id)).length;
          num_polizze = polRows.filter((p) => Number(p.operatore_id) === Number(req.user.id)).length;
        } else if (req.user.role === 'fornitore') {
          num_preventivi = quoteRows.filter((q) => Number(q.fornitore_id) === Number(req.user.id)).length;
          num_polizze = polRows.filter((p) => Number(p.fornitore_id) === Number(req.user.id)).length;
        }
        return { ...ap, num_preventivi, num_polizze };
      });
      const sortMap = { nome_cognome: 'cognome', cognome: 'cognome', nome: 'nome', codice_fiscale: 'codice_fiscale', cellulare: 'cellulare', email: 'email', num_preventivi: 'num_preventivi', num_polizze: 'num_polizze', created_at: 'created_at' };
      assisted = sortRecords(assisted, sortMap[sortByParam] || 'cognome', sortDir || 'asc');
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
      } else if (req.user.role === 'operatore') {
        quotes = quotes.filter((q) => Number(q.operatore_id) === Number(req.user.id));
        policies = policies.filter((p) => Number(p.operatore_id) === Number(req.user.id));
      } else if (req.user.role === 'fornitore') {
        quotes = quotes.filter((q) => Number(q.fornitore_id) === Number(req.user.id));
        policies = policies.filter((p) => Number(p.fornitore_id) === Number(req.user.id));
      }
      if (
        (req.user.role === 'operatore' || req.user.role === 'fornitore') &&
        quotes.length === 0 &&
        policies.length === 0
      ) {
        return res.status(403).json({ error: 'Accesso non autorizzato' });
      }
      quotes = sortQuotesForList(
        quotes.map((q) => ({
          id: q.id,
          numero: q.numero,
          stato: q.stato,
          created_at: q.created_at,
          tipo_nome: ctx.typesById.get(Number(q.tipo_assicurazione_id))?.nome,
          struttura_nome: ctx.usersById.get(Number(q.struttura_id))?.denominazione,
        })),
        undefined,
        'desc',
        {},
      );
      policies = sortPoliciesForList(
        policies.map((p) => ({
          id: p.id,
          numero: p.numero,
          stato: normalizePolicyStato(p.stato),
          created_at: p.created_at,
          tipo_nome: ctx.typesById.get(Number(p.tipo_assicurazione_id))?.nome,
          struttura_nome: ctx.usersById.get(Number(p.struttura_id))?.denominazione,
        })),
        undefined,
        'desc',
        {},
      );
      const attachments = sanitizeAttachmentsList(
        ctx.attachments
          .filter((a) => a.entity_type === 'assisted' && Number(a.entity_id) === Number(req.params.id))
          .sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || ''))),
      );
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
      if (req.user.role === 'operatore' || req.user.role === 'fornitore') {
        const ctx = await loadContext();
        const aid = Number(req.params.id);
        const uid = Number(req.user.id);
        const hasQ =
          req.user.role === 'operatore'
            ? ctx.quotes.some((q) => Number(q.assistito_id) === aid && Number(q.operatore_id) === uid)
            : ctx.quotes.some((q) => Number(q.assistito_id) === aid && Number(q.fornitore_id) === uid);
        const hasP =
          req.user.role === 'operatore'
            ? ctx.policies.some((p) => Number(p.assistito_id) === aid && Number(p.operatore_id) === uid)
            : ctx.policies.some((p) => Number(p.assistito_id) === aid && Number(p.fornitore_id) === uid);
        if (!hasQ && !hasP) return res.status(403).json({ error: 'Accesso non autorizzato' });
      }
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
