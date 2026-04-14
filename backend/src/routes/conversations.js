const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const { list, getById, insert, upsertById, findOne } = require('../data/store');
const { loadContext, enrichQuote, enrichPolicy } = require('../data/views');
const {
  quoteAssigneeUserId,
  quoteAssigneeRole,
  practiceHasAssignee,
} = require('../utils/practiceAssignee');
const { sendPortalMessageNotificationMail } = require('../lib/resend');
const { findConversationByEntity } = require('../services/messagingSync');

const router = express.Router();

function getUserDisplayName(user) {
  if (user.role === 'struttura') return user.denominazione || user.email || 'Struttura';
  return `${user.nome || ''} ${user.cognome || ''}`.trim() || user.username || 'Utente';
}

function previewText(s, max = 180) {
  const t = String(s || '').replace(/\s+/g, ' ').trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max)}…`;
}

function normRole(r) {
  return String(r == null ? '' : r)
    .trim()
    .toLowerCase();
}

/** Allinea ID assegnatario anche se `assignee_role` ha maiuscole/spazi o manca (dati legacy / Instant). */
function assigneeMatchesViewer(conv, user) {
  if (!conv || !user) return false;
  if (user.role !== 'operatore' && user.role !== 'fornitore') return false;
  if (Number(conv.assignee_id) !== Number(user.id)) return false;
  const cr = normRole(conv.assignee_role);
  if (!cr) return true;
  return cr === normRole(user.role);
}

function canAccessConversation(user, conv) {
  if (!user || !conv) return false;
  if (user.role === 'admin' || user.role === 'supervisore') return true;
  if (user.role === 'struttura' && Number(conv.struttura_id) === Number(user.id)) return true;
  if (user.role === 'operatore' || user.role === 'fornitore') {
    return assigneeMatchesViewer(conv, user);
  }
  return false;
}

async function resolveQuoteAssignee(quote) {
  const uid = quoteAssigneeUserId(quote);
  const role = quoteAssigneeRole(quote);
  if (!uid || !role) return null;
  const u = await getById('users', uid);
  if (!u || u.stato !== 'attivo') return null;
  if (role === 'operatore' && u.role !== 'operatore') return null;
  if (role === 'fornitore' && u.role !== 'fornitore') return null;
  return { user: u, assigneeId: uid, assigneeRole: role };
}

async function resolvePolicyAssignee(policy) {
  return resolveQuoteAssignee(policy);
}

function nowSqlite() {
  return new Date().toISOString().slice(0, 19).replace('T', ' ');
}

function normTs(t) {
  const s = String(t || '')
    .trim()
    .replace('T', ' ');
  return s.length >= 19 ? s.slice(0, 19) : s;
}

function messagesForConversation(allMessages, conversationId) {
  return allMessages.filter((m) => Number(m.conversation_id) === Number(conversationId));
}

function unreadCountForUser(messages, userId, lastReadAt) {
  const uid = Number(userId);
  const threshold = lastReadAt ? normTs(lastReadAt) : '';
  return messages.filter((m) => {
    if (Number(m.author_id) === uid) return false;
    const t = normTs(m.created_at);
    if (!t) return true;
    if (!threshold) return true;
    return t.localeCompare(threshold) > 0;
  }).length;
}

async function readStateRow(conversationId, userId) {
  return findOne(
    'conversation_reads',
    (r) =>
      Number(r.conversation_id) === Number(conversationId) && Number(r.user_id) === Number(userId),
  );
}

async function markConversationReadForUser(conversationId, userId) {
  const all = await list('conversation_messages');
  const msgs = messagesForConversation(all, conversationId);
  let lastReadAt = nowSqlite();
  if (msgs.length > 0) {
    lastReadAt = msgs.reduce((best, m) => {
      const t = normTs(m.created_at);
      return t.localeCompare(normTs(best)) > 0 ? t : normTs(best);
    }, normTs(msgs[0].created_at));
  }
  const existing = await readStateRow(conversationId, userId);
  if (existing) {
    await upsertById('conversation_reads', existing.id, { last_read_at: lastReadAt });
  } else {
    await insert('conversation_reads', {
      conversation_id: Number(conversationId),
      user_id: Number(userId),
      last_read_at: lastReadAt,
    });
  }
}

function conversationsVisibleToUser(rows, u) {
  if (u.role === 'struttura') {
    return rows.filter((c) => Number(c.struttura_id) === Number(u.id));
  }
  if (u.role === 'operatore' || u.role === 'fornitore') {
    return rows.filter((c) => assigneeMatchesViewer(c, u));
  }
  if (u.role === 'admin' || u.role === 'supervisore') {
    return rows;
  }
  return [];
}

async function totalUnreadForUser(u) {
  const rows = conversationsVisibleToUser(await list('conversations'), u);
  if (rows.length === 0) return 0;
  const allMessages = await list('conversation_messages');
  let reads = [];
  try {
    reads = await list('conversation_reads');
  } catch (e) {
    console.warn('conversation_reads:', e?.message || e);
  }
  let total = 0;
  for (const c of rows) {
    const msgs = messagesForConversation(allMessages, c.id);
    const readRow = reads.find(
      (r) => Number(r.conversation_id) === Number(c.id) && Number(r.user_id) === Number(u.id),
    );
    total += unreadCountForUser(msgs, u.id, readRow?.last_read_at);
  }
  return total;
}

function enrichConversationRow(conv, ctx) {
  let practiceNumero = '—';
  let practiceLabel = '';
  let strutturaNome = '';
  if (conv.entity_type === 'quote') {
    const q = ctx.quotesById.get(Number(conv.entity_id));
    if (q) {
      const eq = enrichQuote(q, ctx);
      practiceNumero = eq.numero;
      practiceLabel = 'Preventivo';
      strutturaNome = eq.struttura_nome || '';
    }
  } else {
    const p = ctx.policiesById.get(Number(conv.entity_id));
    if (p) {
      const ep = enrichPolicy(p, ctx);
      practiceNumero = ep.numero;
      practiceLabel = 'Polizza';
      strutturaNome = ep.struttura_nome || '';
    }
  }
  const strutturaUser = ctx.usersById.get(Number(conv.struttura_id));
  const assigneeUser = ctx.usersById.get(Number(conv.assignee_id));
  const assigneeNome = assigneeUser ? getUserDisplayName(assigneeUser) : '—';
  const counterpartFor = (viewerRole, viewerId) => {
    if (viewerRole === 'struttura' && Number(viewerId) === Number(conv.struttura_id)) {
      return assigneeNome || 'Assegnatario';
    }
    if (
      (viewerRole === 'operatore' || viewerRole === 'fornitore') &&
      Number(viewerId) === Number(conv.assignee_id)
    ) {
      return strutturaUser ? getUserDisplayName(strutturaUser) : strutturaNome || 'Struttura';
    }
    if (viewerRole === 'admin' || viewerRole === 'supervisore') {
      return `${strutturaNome || 'Struttura'} ↔ ${assigneeNome}`;
    }
    return '—';
  };
  return {
    ...conv,
    practice_numero: practiceNumero,
    practice_kind: practiceLabel,
    struttura_nome: strutturaNome,
    assignee_display: assigneeNome,
    counterpart_label: counterpartFor,
  };
}

/** GET /api/conversations/unread-total — prima di /:id (altrimenti "unread-total" viene interpretato come id). */
router.get('/unread-total', authenticateToken, (req, res) => {
  (async () => {
    try {
      const u = req.user;
      if (
        u.role !== 'admin' &&
        u.role !== 'supervisore' &&
        u.role !== 'struttura' &&
        u.role !== 'operatore' &&
        u.role !== 'fornitore'
      ) {
        return res.status(403).json({ error: 'Accesso non autorizzato' });
      }
      const total = await totalUnreadForUser(u);
      res.json({ total });
    } catch (err) {
      console.error('conversations unread-total:', err);
      res.status(500).json({ error: 'Errore nel conteggio messaggi' });
    }
  })();
});

/** GET /api/conversations */
router.get('/', authenticateToken, (req, res) => {
  (async () => {
    try {
      const ctx = await loadContext();
      let rows = await list('conversations');
      const u = req.user;
      if (u.role === 'struttura') {
        rows = rows.filter((c) => Number(c.struttura_id) === Number(u.id));
      } else if (u.role === 'operatore' || u.role === 'fornitore') {
        rows = rows.filter((c) => assigneeMatchesViewer(c, u));
      } else if (u.role !== 'admin' && u.role !== 'supervisore') {
        return res.status(403).json({ error: 'Accesso non autorizzato' });
      }
      const enriched = rows
        .map((c) => enrichConversationRow(c, ctx))
        .map((c) => ({
          ...c,
          counterpart: c.counterpart_label(u.role, u.id),
        }));
      enriched.sort((a, b) =>
        String(b.last_message_at || b.updated_at || '').localeCompare(
          String(a.last_message_at || a.updated_at || ''),
        ),
      );
      res.json(enriched);
    } catch (err) {
      console.error('conversations list:', err);
      res.status(500).json({ error: 'Errore nel recupero conversazioni' });
    }
  })();
});

/** GET /api/conversations/:id */
router.get('/:id', authenticateToken, (req, res) => {
  (async () => {
    try {
      const id = Number(req.params.id);
      if (!Number.isFinite(id)) return res.status(400).json({ error: 'ID non valido' });
      const conv = await getById('conversations', id);
      if (!conv) return res.status(404).json({ error: 'Conversazione non trovata' });
      if (!canAccessConversation(req.user, conv)) {
        return res.status(403).json({ error: 'Accesso non autorizzato' });
      }
      const ctx = await loadContext();
      const meta = enrichConversationRow(conv, ctx);
      let messages = (await list('conversation_messages')).filter(
        (m) => Number(m.conversation_id) === Number(id),
      );
      messages = messages
        .map((m) => {
          const author = ctx.usersById.get(Number(m.author_id)) || {};
          return {
            ...m,
            author_display: getUserDisplayName(author),
            author_role: m.author_role || author.role,
          };
        })
        .sort((a, b) => String(a.created_at || '').localeCompare(String(b.created_at || '')));
      let practice = null;
      if (conv.entity_type === 'quote') {
        const q = await getById('quotes', conv.entity_id);
        practice = q ? enrichQuote(q, ctx) : null;
      } else {
        const p = await getById('policies', conv.entity_id);
        practice = p ? enrichPolicy(p, ctx) : null;
      }
      await markConversationReadForUser(id, req.user.id);
      res.json({
        conversation: {
          ...meta,
          counterpart: meta.counterpart_label(req.user.role, req.user.id),
        },
        practice,
        messages,
      });
    } catch (err) {
      console.error('conversation get:', err);
      res.status(500).json({ error: 'Errore nel recupero conversazione' });
    }
  })();
});

/** POST /api/conversations — crea thread (se assente) e primo messaggio; solo struttura. */
router.post('/', authenticateToken, (req, res) => {
  (async () => {
    try {
      if (req.user.role !== 'struttura') {
        return res.status(403).json({ error: 'Solo le strutture possono avviare una nuova conversazione da qui' });
      }
      const { entity_type: entityType, entity_id: entityIdRaw, content } = req.body || {};
      const text = content != null ? String(content).trim() : '';
      if (!text) return res.status(400).json({ error: 'Messaggio obbligatorio' });
      if (entityType !== 'quote' && entityType !== 'policy') {
        return res.status(400).json({ error: 'Tipo pratica non valido (quote o policy)' });
      }
      const entityId = Number(entityIdRaw);
      if (!Number.isFinite(entityId)) return res.status(400).json({ error: 'Pratica non valida' });

      let quote = null;
      let policy = null;
      if (entityType === 'quote') {
        quote = await getById('quotes', entityId);
        if (!quote) return res.status(404).json({ error: 'Preventivo non trovato' });
        if (Number(quote.struttura_id) !== Number(req.user.id)) {
          return res.status(403).json({ error: 'Accesso non autorizzato' });
        }
        if (!practiceHasAssignee(quote)) {
          return res.status(400).json({
            error: 'Non è possibile inviare un messaggio perché la pratica non è ancora assegnata.',
          });
        }
      } else {
        policy = await getById('policies', entityId);
        if (!policy) return res.status(404).json({ error: 'Polizza non trovata' });
        if (Number(policy.struttura_id) !== Number(req.user.id)) {
          return res.status(403).json({ error: 'Accesso non autorizzato' });
        }
        if (!practiceHasAssignee(policy)) {
          return res.status(400).json({
            error: 'Non è possibile inviare un messaggio perché la pratica non è ancora assegnata.',
          });
        }
      }

      const row = entityType === 'quote' ? quote : policy;
      const resolved = await (entityType === 'quote' ? resolveQuoteAssignee(row) : resolvePolicyAssignee(row));
      if (!resolved) {
        return res.status(400).json({
          error: 'Non è possibile inviare un messaggio perché la pratica non è ancora assegnata.',
        });
      }

      const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
      let conv = await findConversationByEntity(entityType, entityId);
      if (!conv) {
        const ins = await insert('conversations', {
          entity_type: entityType,
          entity_id: entityId,
          struttura_id: Number(row.struttura_id),
          assignee_id: resolved.assigneeId,
          assignee_role: resolved.assigneeRole,
          last_message_preview: previewText(text),
          last_message_at: now,
        });
        conv = await getById('conversations', ins.id);
      } else {
        if (!canAccessConversation(req.user, conv)) {
          return res.status(403).json({ error: 'Accesso non autorizzato' });
        }
        await upsertById('conversations', conv.id, {
          assignee_id: resolved.assigneeId,
          assignee_role: resolved.assigneeRole,
          struttura_id: Number(row.struttura_id),
          last_message_preview: previewText(text),
          last_message_at: now,
        });
        conv = await getById('conversations', conv.id);
      }

      await insert('conversation_messages', {
        conversation_id: conv.id,
        author_id: req.user.id,
        author_role: req.user.role,
        content: text,
      });

      const practiceKindIt = entityType === 'quote' ? 'Preventivo' : 'Polizza';
      const practiceNumero = row.numero;
      const assigneeMail = resolved.user.email && String(resolved.user.email).trim();
      if (assigneeMail) {
        await sendPortalMessageNotificationMail({
          to: assigneeMail,
          recipientName: getUserDisplayName(resolved.user),
          senderName: getUserDisplayName(req.user),
          practiceKindIt,
          practiceNumero,
          practiceId: entityId,
          entityType,
          conversationId: conv.id,
          preview: previewText(text, 400),
        });
      }

      await markConversationReadForUser(conv.id, req.user.id);
      res.status(201).json({ id: conv.id, message: 'Messaggio inviato' });
    } catch (err) {
      console.error('conversations create:', err);
      res.status(500).json({ error: 'Errore nell\'invio del messaggio' });
    }
  })();
});

/** POST /api/conversations/:id/messages */
router.post('/:id/messages', authenticateToken, (req, res) => {
  (async () => {
    try {
      const id = Number(req.params.id);
      if (!Number.isFinite(id)) return res.status(400).json({ error: 'ID non valido' });
      const conv = await getById('conversations', id);
      if (!conv) return res.status(404).json({ error: 'Conversazione non trovata' });
      if (!canAccessConversation(req.user, conv)) {
        return res.status(403).json({ error: 'Accesso non autorizzato' });
      }
      const text = req.body?.content != null ? String(req.body.content).trim() : '';
      if (!text) return res.status(400).json({ error: 'Messaggio obbligatorio' });

      const ctx = await loadContext();
      let quote = null;
      let policy = null;
      if (conv.entity_type === 'quote') {
        quote = await getById('quotes', conv.entity_id);
        if (!quote) return res.status(404).json({ error: 'Pratica non trovata' });
      } else {
        policy = await getById('policies', conv.entity_id);
        if (!policy) return res.status(404).json({ error: 'Pratica non trovata' });
      }
      const row = conv.entity_type === 'quote' ? quote : policy;
      const resolved = await (conv.entity_type === 'quote' ? resolveQuoteAssignee(row) : resolvePolicyAssignee(row));

      if (req.user.role === 'struttura') {
        if (!practiceHasAssignee(row)) {
          return res.status(400).json({
            error: 'Non è possibile inviare un messaggio perché la pratica non è ancora assegnata.',
          });
        }
      }

      if (resolved) {
        await upsertById('conversations', conv.id, {
          assignee_id: resolved.assigneeId,
          assignee_role: resolved.assigneeRole,
          struttura_id: Number(row.struttura_id),
        });
      }

      const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
      await insert('conversation_messages', {
        conversation_id: conv.id,
        author_id: req.user.id,
        author_role: req.user.role,
        content: text,
      });
      await upsertById('conversations', conv.id, {
        last_message_preview: previewText(text),
        last_message_at: now,
      });
      await markConversationReadForUser(conv.id, req.user.id);

      const practiceKindIt = conv.entity_type === 'quote' ? 'Preventivo' : 'Polizza';
      const practiceNumero = row.numero;

      if (req.user.role === 'struttura') {
        if (resolved) {
          const assigneeMail = resolved.user.email && String(resolved.user.email).trim();
          if (assigneeMail) {
            await sendPortalMessageNotificationMail({
              to: assigneeMail,
              recipientName: getUserDisplayName(resolved.user),
              senderName: getUserDisplayName(req.user),
              practiceKindIt,
              practiceNumero,
              practiceId: Number(conv.entity_id),
              entityType: conv.entity_type,
              conversationId: conv.id,
              preview: previewText(text, 400),
            });
          }
        }
      } else if (req.user.role === 'operatore' || req.user.role === 'fornitore') {
        const struttura = await getById('users', conv.struttura_id);
        const smail = struttura?.email && String(struttura.email).trim();
        if (smail) {
          await sendPortalMessageNotificationMail({
            to: smail,
            recipientName: getUserDisplayName(struttura),
            senderName: getUserDisplayName(req.user),
            practiceKindIt,
            practiceNumero,
            practiceId: Number(conv.entity_id),
            entityType: conv.entity_type,
            conversationId: conv.id,
            preview: previewText(text, 400),
          });
        }
      }

      res.status(201).json({ message: 'Messaggio inviato' });
    } catch (err) {
      console.error('conversation message:', err);
      res.status(500).json({ error: 'Errore nell\'invio del messaggio' });
    }
  })();
});

module.exports = router;
