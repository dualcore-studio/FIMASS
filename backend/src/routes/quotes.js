const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const { del, put } = require('@vercel/blob');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');
const { logActivity } = require('./logs');
const { list, getById, findOne, insert, upsertById, removeById, like, paginate } = require('../data/store');
const { loadContext, enrichQuote, parseMaybeJson } = require('../data/views');
const { sortQuotesForList } = require('../utils/practiceListSort');
const { isQuoteClosedForAssignment, normalizeQuoteStato } = require('../utils/quoteStato');
const {
  sendQuoteAssignedToOperatorMail,
  sendQuoteStatusChangeToStructureMail,
  sendQuotePresentedByStructureToAdminMail,
} = require('../lib/resend');
const { pipeQuoteSummaryPdf } = require('../lib/quoteSummaryPdf');
const { sendAttachmentDownload } = require('../lib/attachmentDownload');
const { isInsuranceTypeActive, strutturaCanUseInsuranceType } = require('../lib/insuranceTypes');
const { quoteAssigneeUserId, userIsAssignedToQuote, practiceHasAssignee } = require('../utils/practiceAssignee');
const { syncConversationsForQuoteAssignment, syncConversationsForPolicyAssignment } = require('../services/messagingSync');
const {
  getRcGaranzieSelezionate,
  isRcAutoTipoCodice,
  validateRcPricingForGaranzie,
  totalFromBreakdown,
} = require('../lib/rcAutoGaranzie');
const { pipeRcAutoRiepilogoPdf } = require('../lib/rcAutoRiepilogoPdf');
const { persistQuoteAttachmentFromDisk, tempPdfPath } = require('../lib/persistQuoteAttachmentFromDisk');

const ALLOWED_QUOTE_STATI = new Set(['PRESENTATA', 'ASSEGNATA', 'IN LAVORAZIONE', 'STANDBY', 'ELABORATA']);

const router = express.Router();

const isVercelEnv = Boolean(process.env.VERCEL);
function getUploadsDir() {
  return process.env.UPLOADS_DIR || (isVercelEnv ? '/tmp/uploads' : path.join(__dirname, '..', '..', 'uploads'));
}

const elaborazioneUploadDir = getUploadsDir();
if (!fs.existsSync(elaborazioneUploadDir)) {
  fs.mkdirSync(elaborazioneUploadDir, { recursive: true });
}

const elaborazioneUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, elaborazioneUploadDir),
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname);
      cb(null, `${uuidv4()}${ext}`);
    },
  }),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ['.pdf', '.doc', '.docx', '.xls', '.xlsx'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) cb(null, true);
    else cb(new Error('Tipo file non consentito'));
  },
});

function latestQuoteAttachment(ctx, quoteId, tipo) {
  const rows = ctx.attachments.filter(
    (a) => a.entity_type === 'quote' && Number(a.entity_id) === Number(quoteId) && a.tipo === tipo,
  );
  return rows.sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')))[0];
}

async function purgeAttachmentsForEntity(entityType, entityId) {
  const uploadsDir = getUploadsDir();
  const attachments = await list('attachments');
  const rows = attachments.filter(
    (a) => a.entity_type === entityType && Number(a.entity_id) === Number(entityId),
  );
  for (const att of rows) {
    if (att.url && process.env.BLOB_READ_WRITE_TOKEN) {
      try {
        await del(att.url, { token: process.env.BLOB_READ_WRITE_TOKEN });
      } catch (e) {
        console.warn('Blob delete failed:', e.message);
      }
    } else {
      const filePath = path.join(uploadsDir, att.nome_file);
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    }
    await removeById('attachments', att.id);
  }
}

async function deleteQuoteWithDependencies(quoteId) {
  const qid = Number(quoteId);
  const policies = (await list('policies')).filter((p) => Number(p.quote_id) === qid);
  for (const pol of policies) {
    const pid = pol.id;
    const polHistory = (await list('policy_status_history')).filter((h) => Number(h.policy_id) === Number(pid));
    for (const h of polHistory) await removeById('policy_status_history', h.id);
    await purgeAttachmentsForEntity('policy', pid);
    await removeById('policies', pid);
  }

  const qHistory = (await list('quote_status_history')).filter((h) => Number(h.quote_id) === qid);
  for (const h of qHistory) await removeById('quote_status_history', h.id);

  const qNotes = (await list('quote_notes')).filter((n) => Number(n.quote_id) === qid);
  for (const n of qNotes) await removeById('quote_notes', n.id);

  const qReminders = (await list('quote_reminders')).filter((r) => Number(r.quote_id) === qid);
  for (const r of qReminders) await removeById('quote_reminders', r.id);

  await purgeAttachmentsForEntity('quote', qid);
  await removeById('quotes', qid);
}

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
      assegnatario_id,
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
      const assegnatarioIdNum = assegnatario_id != null && assegnatario_id !== '' ? Number(assegnatario_id) : null;
      if (Number.isFinite(assegnatarioIdNum)) {
        quotes = quotes.filter((q) => quoteAssigneeUserId(q) === assegnatarioIdNum);
      }
      if (data_da) quotes = quotes.filter((q) => String(q.created_at || '') >= String(data_da));
      if (data_a) quotes = quotes.filter((q) => String(q.created_at || '') <= `${data_a} 23:59:59`);
      if (assegnata === 'si') quotes = quotes.filter((q) => practiceHasAssignee(q));
      if (assegnata === 'no') quotes = quotes.filter((q) => !practiceHasAssignee(q));
      const daysAgo = (d) => new Date(Date.now() - d * 86400000).toISOString().slice(0, 19).replace('T', ' ');
      if (alert === 'unassigned') {
        quotes = quotes.filter((q) => q.stato === 'PRESENTATA' && !practiceHasAssignee(q));
      }
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
      const sortMap = {
        numero: 'numero',
        assistito: 'assistito_cognome',
        tipo: 'tipo_nome',
        struttura: 'struttura_nome',
        operatore: 'incaricato_cognome',
        stato: 'stato',
        created_at: 'created_at',
        data_decorrenza: 'data_decorrenza',
      };
      quotes = sortQuotesForList(quotes, sortByParam, sortDir || 'desc', sortMap);
      quotes = quotes.map((q) => {
        const latestPrev = latestQuoteAttachment(ctx, q.id, 'preventivo_elaborato');
        const latestRiep = latestQuoteAttachment(ctx, q.id, 'preventivo_riepilogo_rc');
        return {
          ...q,
          preventivo_finale_attachment_id: latestPrev?.id ?? null,
          preventivo_finale_nome: latestPrev?.nome_originale ?? null,
          preventivo_riepilogo_attachment_id: latestRiep?.id ?? null,
          preventivo_riepilogo_nome: latestRiep?.nome_originale ?? null,
        };
      });
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
      else if (req.user.role === 'fornitore') quotes = quotes.filter((q) => Number(q.fornitore_id) === Number(req.user.id));
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
  const targetId = quoteAssigneeUserId(quote);
  if (!targetId) return res.status(400).json({ error: 'La pratica non ha un incaricato assegnato' });
  try {
    await insert('quote_reminders', { quote_id: quote.id, operatore_id: targetId, created_by: req.user.id, read_at: null });
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

router.get('/reminders/mine', authenticateToken, authorizeRoles('operatore', 'fornitore'), (req, res) => {
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

router.put('/reminders/:id/read', authenticateToken, authorizeRoles('operatore', 'fornitore'), (req, res) => {
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

/** Preventivi elaborati senza polizza: per flusso "nuova polizza" lato struttura. */
router.get('/eligible-for-policy', authenticateToken, authorizeRoles('struttura'), (req, res) => {
  (async () => {
    try {
      const ctx = await loadContext();
      const quotes = ctx.quotes
        .filter((q) => Number(q.struttura_id) === Number(req.user.id))
        .filter((q) => normalizeQuoteStato(q.stato) === 'ELABORATA')
        .filter((q) => !Number(q.has_policy))
        .map((q) => enrichQuote(q, ctx))
        .sort((a, b) => String(b.updated_at || '').localeCompare(String(a.updated_at || '')));
      res.json(quotes);
    } catch (err) {
      console.error('Error fetching quotes eligible for policy:', err);
      res.status(500).json({ error: 'Errore nel recupero preventivi' });
    }
  })();
});

router.get('/:id/summary-pdf', authenticateToken, (req, res) => {
  (async () => {
    const quoteId = parseInt(req.params.id, 10);
    if (Number.isNaN(quoteId)) {
      return res.status(400).json({ error: 'ID preventivo non valido' });
    }
    try {
      const ctx = await loadContext();
      const row = await getById('quotes', quoteId);
      if (!row) return res.status(404).json({ error: 'Preventivo non trovato' });
      const quote = enrichQuote(row, ctx);
      if (req.user.role === 'operatore') {
        if (Number(quote.operatore_id) !== Number(req.user.id)) {
          return res.status(403).json({ error: 'Accesso non autorizzato' });
        }
      } else if (req.user.role === 'fornitore') {
        /* stesso accesso analitico del supervisore al PDF riepilogo */
      } else if (req.user.role !== 'admin' && req.user.role !== 'supervisore') {
        return res.status(403).json({ error: 'Accesso non autorizzato' });
      }
      pipeQuoteSummaryPdf(quote, ctx, res);
    } catch (err) {
      console.error('Error generating quote summary PDF:', err);
      if (!res.headersSent) res.status(500).json({ error: 'Errore nella generazione del PDF' });
    }
  })();
});

/** Download del PDF preventivo elaborato (stessa logica per tabella admin e dettaglio). */
router.get('/:id/preventivo-finale', authenticateToken, (req, res) => {
  (async () => {
    const quoteId = parseInt(req.params.id, 10);
    if (Number.isNaN(quoteId)) {
      return res.status(400).json({ error: 'ID preventivo non valido' });
    }
    try {
      const ctx = await loadContext();
      const row = await getById('quotes', quoteId);
      if (!row) return res.status(404).json({ error: 'Preventivo non trovato' });
      const quote = enrichQuote(row, ctx);
      if (req.user.role === 'struttura' && Number(quote.struttura_id) !== Number(req.user.id)) {
        return res.status(403).json({ error: 'Accesso non autorizzato' });
      }
      if (req.user.role === 'operatore' && Number(quote.operatore_id) !== Number(req.user.id)) {
        return res.status(403).json({ error: 'Accesso non autorizzato' });
      }
      if (req.user.role === 'fornitore' && Number(quote.fornitore_id) !== Number(req.user.id)) {
        return res.status(403).json({ error: 'Accesso non autorizzato' });
      }
      if (req.user.role === 'struttura' && quote.stato !== 'ELABORATA') {
        return res.status(403).json({ error: 'Download disponibile solo per preventivi elaborati' });
      }

      const isRc = isRcAutoTipoCodice(quote.tipo_codice);
      if (isRc && quote.stato === 'ELABORATA') {
        const latestRiep = latestQuoteAttachment(ctx, quoteId, 'preventivo_riepilogo_rc');
        if (latestRiep) {
          sendAttachmentDownload(latestRiep, res, {
            downloadFilename: latestRiep.nome_originale || `Riepilogo-${quote.numero || quoteId}.pdf`,
            logPrefix: `[preventivo-finale riepilogo-rc quote=${quoteId} attachment=${latestRiep.id}]`,
          });
          return;
        }
      }

      const latest = latestQuoteAttachment(ctx, quoteId, 'preventivo_elaborato');
      if (!latest) {
        return res.status(404).json({ error: 'Nessun documento preventivo disponibile per questa pratica' });
      }

      sendAttachmentDownload(latest, res, {
        downloadFilename: latest.nome_originale || `preventivo-${quote.numero || quoteId}.pdf`,
        logPrefix: `[preventivo-finale quote=${quoteId} attachment=${latest.id}]`,
      });
    } catch (err) {
      console.error('Error downloading preventivo finale:', err);
      if (!res.headersSent) res.status(500).json({ error: 'Errore nel download del preventivo' });
    }
  })();
});

/**
 * Elaborazione RC Auto: prezzi garanzie, note facoltative, PDF riepilogo, allegato operatore facoltativo, stato ELABORATA.
 */
router.post(
  '/:id/elaborazione-rc-auto',
  authenticateToken,
  elaborazioneUpload.single('file'),
  (req, res) => {
    (async () => {
      const quoteId = parseInt(req.params.id, 10);
      if (Number.isNaN(quoteId)) {
        return res.status(400).json({ error: 'ID preventivo non valido' });
      }
      try {
        const ctx = await loadContext();
        const row = await getById('quotes', quoteId);
        if (!row) return res.status(404).json({ error: 'Preventivo non trovato' });

        if (req.user.role !== 'operatore' && req.user.role !== 'fornitore') {
          return res.status(403).json({ error: 'Operazione riservata all\'incaricato' });
        }
        if (!userIsAssignedToQuote(req.user, row)) {
          return res.status(403).json({ error: 'Non sei l\'incaricato assegnato a questa pratica' });
        }

        const quote = enrichQuote(row, ctx);
        if (!isRcAutoTipoCodice(quote.tipo_codice)) {
          return res.status(400).json({ error: 'Questa operazione è disponibile solo per pratiche RC Auto' });
        }

        const statoCur = normalizeQuoteStato(quote.stato);
        if (statoCur === 'ELABORATA') {
          return res.status(400).json({ error: 'Il preventivo risulta già elaborato' });
        }
        const allowedFrom = new Set(['IN LAVORAZIONE', 'STANDBY']);
        if (!allowedFrom.has(statoCur)) {
          return res.status(400).json({ error: 'Stato pratica non compatibile con l\'elaborazione' });
        }

        let payload;
        try {
          payload = JSON.parse(req.body.payload || '{}');
        } catch {
          return res.status(400).json({ error: 'Payload non valido' });
        }

        const garanzie = getRcGaranzieSelezionate(quote.dati_specifici);
        const pricingBreakdown = Array.isArray(payload.pricingBreakdown) ? payload.pricingBreakdown : [];
        const valid = validateRcPricingForGaranzie(pricingBreakdown, garanzie);
        if (!valid.ok) {
          return res.status(400).json({ error: valid.error });
        }

        let notes = payload.notes != null ? String(payload.notes) : '';
        if (notes.length > 1000) notes = notes.slice(0, 1000);
        const notesTrim = notes.trim() || null;

        const totalPrice = Math.round(totalFromBreakdown(pricingBreakdown) * 100) / 100;
        const elaboratedAt = new Date().toISOString().slice(0, 19).replace('T', ' ');
        const typeRow = ctx.typesById.get(Number(quote.tipo_assicurazione_id)) || {};

        if (req.file) {
          let downloadUrl = null;
          let storageKey = req.file.filename;
          if (process.env.BLOB_READ_WRITE_TOKEN) {
            const blob = await put(`attachments/${req.file.filename}`, fs.createReadStream(req.file.path), {
              access: 'public',
              addRandomSuffix: false,
              token: process.env.BLOB_READ_WRITE_TOKEN,
            });
            downloadUrl = blob.url;
            storageKey = blob.pathname;
            if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
          }
          await insert('attachments', {
            entity_type: 'quote',
            entity_id: quoteId,
            tipo: 'preventivo_elaborato',
            nome_file: storageKey,
            nome_originale: req.file.originalname,
            mime_type: req.file.mimetype,
            dimensione: req.file.size,
            caricato_da: req.user.id,
            url: downloadUrl,
          });
        }

        const pdfPath = tempPdfPath();
        const pdfBuffer = await pipeRcAutoRiepilogoPdf({
          quote,
          typeRow,
          elaborazione: {
            pricingBreakdown,
            totalPrice,
            notes: notesTrim,
            elaboratedAt,
          },
          dest: null,
        });
        fs.writeFileSync(pdfPath, pdfBuffer);
        const pdfOriginalName = `Riepilogo-preventivo-RC-${quote.numero || quoteId}.pdf`;
        const pdfIns = await persistQuoteAttachmentFromDisk({
          localPath: pdfPath,
          originalName: pdfOriginalName,
          quoteId,
          tipo: 'preventivo_riepilogo_rc',
          userId: req.user.id,
        });

        const prevDp = parseMaybeJson(row.dati_preventivo) || {};
        const elaborazioneBlock = {
          pricingBreakdown,
          totalPrice,
          notes: notesTrim,
          elaboratedAt,
          riepilogo_attachment_id: pdfIns.id,
          generatedPdfPath: pdfIns.nome_file,
        };
        const prevStato = quote.stato;
        await upsertById('quotes', quoteId, {
          stato: 'ELABORATA',
          dati_preventivo: { ...prevDp, elaborazione_rc_auto: elaborazioneBlock },
        });

        await insert('quote_status_history', {
          quote_id: quoteId,
          stato_precedente: prevStato,
          stato_nuovo: 'ELABORATA',
          motivo: null,
          utente_id: req.user.id,
        });

        await logActivity({
          utente_id: req.user.id,
          utente_nome: getUserDisplayName(req.user),
          ruolo: req.user.role,
          azione: 'CAMBIO_STATO',
          modulo: 'preventivi',
          riferimento_id: quoteId,
          riferimento_tipo: 'quote',
          dettaglio: `Preventivo ${quote.numero}: ${prevStato} → ELABORATA (elaborazione RC Auto, PDF riepilogo)`,
        });

        const ctxAfter = await loadContext();
        const enrichedAfter = enrichQuote(await getById('quotes', quoteId), ctxAfter);
        const assistitoLabel = [enrichedAfter.assistito_nome, enrichedAfter.assistito_cognome].filter(Boolean).join(' ').trim() || '—';
        const dataAggiornamento = enrichedAfter.updated_at || elaboratedAt;
        const strutturaMail = enrichedAfter.struttura_email && String(enrichedAfter.struttura_email).trim();
        if (strutturaMail) {
          await sendQuoteStatusChangeToStructureMail({
            to: strutturaMail,
            strutturaNome: enrichedAfter.struttura_nome || 'Struttura',
            quoteId: enrichedAfter.id,
            quoteNumero: enrichedAfter.numero,
            assistitoLabel,
            tipoNome: enrichedAfter.tipo_nome || '—',
            statoPrecedente: prevStato,
            statoNuovo: 'ELABORATA',
            dataAggiornamento,
            motivoStandby: null,
          });
        }

        res.json({ message: 'Elaborazione RC Auto completata', riepilogo_attachment_id: pdfIns.id });
      } catch (err) {
        console.error('Error elaborazione RC Auto:', err);
        if (!res.headersSent) res.status(500).json({ error: 'Errore durante l\'elaborazione RC Auto' });
      }
    })();
  },
);

router.get('/:id', authenticateToken, (req, res) => {
  (async () => {
    try {
      const ctx = await loadContext();
      const row = await getById('quotes', req.params.id);
      if (!row) return res.status(404).json({ error: 'Preventivo non trovato' });
      const quote = enrichQuote(row, ctx);
      if (req.user.role === 'struttura' && Number(quote.struttura_id) !== Number(req.user.id)) return res.status(403).json({ error: 'Accesso non autorizzato' });
      if (req.user.role === 'operatore' && Number(quote.operatore_id) !== Number(req.user.id)) return res.status(403).json({ error: 'Accesso non autorizzato' });
      /* fornitore: visibilità elenco completa, dettaglio su tutte le pratiche */
      const history = ctx.quote_status_history
        .filter((h) => Number(h.quote_id) === Number(row.id))
        .map((h) => {
          const u = ctx.usersById.get(Number(h.utente_id)) || {};
          return {
            ...h,
            nome: u.nome,
            cognome: u.cognome,
            denominazione: u.denominazione,
            role: u.role,
          };
        })
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
      const latestPrev = latestQuoteAttachment(ctx, row.id, 'preventivo_elaborato');
      const latestRiep = latestQuoteAttachment(ctx, row.id, 'preventivo_riepilogo_rc');
      res.json({
        ...quote,
        history,
        notes,
        attachments,
        policy: policy ? { id: policy.id, numero: policy.numero, stato: policy.stato } : null,
        preventivo_finale_attachment_id: latestPrev?.id ?? null,
        preventivo_finale_nome: latestPrev?.nome_originale ?? null,
        preventivo_riepilogo_attachment_id: latestRiep?.id ?? null,
        preventivo_riepilogo_nome: latestRiep?.nome_originale ?? null,
      });
    } catch (err) {
      console.error('Error fetching quote:', err);
      res.status(500).json({ error: 'Errore nel recupero preventivo' });
    }
  })();
});

router.post('/', authenticateToken, authorizeRoles('struttura'), (req, res) => {
  (async () => {
    const {
      tipo_assicurazione_id, assistito, dati_specifici, data_decorrenza, note_struttura, note_allegati,
    } = req.body;

    if (!tipo_assicurazione_id || !assistito) {
      return res.status(400).json({ error: 'Dati obbligatori mancanti' });
    }
    if (!assistito.email || !String(assistito.email).trim()) {
      return res.status(400).json({ error: 'Email assistito obbligatoria' });
    }
    const indirizzoAss = assistito.indirizzo != null ? String(assistito.indirizzo).trim() : '';
    const capAss = assistito.cap != null ? String(assistito.cap).trim() : '';
    const cittaAss = assistito.citta != null ? String(assistito.citta).trim() : '';
    if (!indirizzoAss) {
      return res.status(400).json({ error: 'Indirizzo di residenza assistito obbligatorio' });
    }
    if (!capAss) {
      return res.status(400).json({ error: 'CAP assistito obbligatorio' });
    }
    if (!/^\d{5}$/.test(capAss)) {
      return res.status(400).json({ error: 'CAP assistito non valido (5 cifre)' });
    }
    if (!cittaAss) {
      return res.status(400).json({ error: 'Città assistito obbligatoria' });
    }
    Object.assign(assistito, { indirizzo: indirizzoAss, cap: capAss, citta: cittaAss });

    const insType = await getById('insurance_types', tipo_assicurazione_id);
    if (!insType) {
      return res.status(400).json({ error: 'Tipologia assicurativa non valida' });
    }
    if (!isInsuranceTypeActive(insType)) {
      return res.status(400).json({ error: 'Questa tipologia non è più attiva per nuove richieste' });
    }
    if (!strutturaCanUseInsuranceType(req.user, insType.codice)) {
      return res.status(403).json({ error: 'Tipologia non abilitata per la tua struttura' });
    }

    const struttura_id = req.user.id;

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
    const noteAllegatiVal = note_allegati != null && String(note_allegati).trim() !== ''
      ? String(note_allegati).trim()
      : null;
    const result = await insert('quotes', {
      numero,
      assistito_id,
      tipo_assicurazione_id,
      struttura_id,
      stato: 'PRESENTATA',
      data_decorrenza,
      note_struttura,
      note_allegati: noteAllegatiVal,
      dati_specifici: dati_specifici || null,
      has_policy: 0,
    });
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

    const ctxPresented = await loadContext();
    const enrichedPresented = enrichQuote(await getById('quotes', quoteId), ctxPresented);
    const assistitoLabelPresented = [enrichedPresented.assistito_nome, enrichedPresented.assistito_cognome]
      .filter(Boolean)
      .join(' ')
      .trim() || '—';
    const dataPresentazione =
      enrichedPresented.created_at
      || enrichedPresented.updated_at
      || new Date().toISOString().slice(0, 19).replace('T', ' ');
    const strutturaNomePresented = enrichedPresented.struttura_nome || getUserDisplayName(req.user);
    const admins = (await list('users')).filter((u) => u.role === 'admin');
    const adminEmailsSeen = new Set();
    for (const u of admins) {
      const adminMail = u.email && String(u.email).trim();
      if (!adminMail) {
        console.warn(`[FIMASS email] Admin id=${u.id} senza email in DB: notifica nuova pratica presentata saltata.`);
        continue;
      }
      if (adminEmailsSeen.has(adminMail)) continue;
      adminEmailsSeen.add(adminMail);
      const adminName = [u.nome, u.cognome].filter(Boolean).join(' ').trim() || u.username || 'Amministratore';
      console.log(
        `[FIMASS email] Nuova pratica ${numero} (id ${quoteId}) presentata da struttura → admin id ${u.id}, invio a ${adminMail}`,
      );
      await sendQuotePresentedByStructureToAdminMail({
        to: adminMail,
        adminName,
        quoteId,
        quoteNumero: numero,
        assistitoLabel: assistitoLabelPresented,
        tipoNome: enrichedPresented.tipo_nome || insType.nome || '—',
        strutturaNome: strutturaNomePresented,
        dataPresentazione,
      });
    }

    res.status(201).json({ id: quoteId, numero, message: 'Preventivo creato con successo' });
  })().catch((err) => {
    console.error('Error creating quote:', err);
    res.status(500).json({ error: 'Errore nella creazione del preventivo' });
  });
});

router.put('/:id/assign', authenticateToken, authorizeRoles('supervisore', 'admin', 'fornitore'), (req, res) => {
  (async () => {
    let assigneeIdNum =
      req.body.assigned_user_id != null && req.body.assigned_user_id !== ''
        ? Number(req.body.assigned_user_id)
        : NaN;
    if (!Number.isFinite(assigneeIdNum)) {
      assigneeIdNum =
        req.body.operatore_id != null && req.body.operatore_id !== ''
          ? Number(req.body.operatore_id)
          : NaN;
    }
    if (!Number.isFinite(assigneeIdNum)) return res.status(400).json({ error: 'Utente assegnatario richiesto' });

    const quote = await getById('quotes', req.params.id);
    if (!quote) return res.status(404).json({ error: 'Preventivo non trovato' });
    if (isQuoteClosedForAssignment(quote.stato)) {
      return res.status(400).json({ error: 'Non è possibile assegnare una pratica già elaborata' });
    }
    if (quote.stato !== 'PRESENTATA' && quote.stato !== 'ASSEGNATA') {
      return res.status(400).json({
        error: 'Operazione non consentita: l’assegnazione è consentita solo da stato Presentata; la riassegnazione solo da stato Assegnata.',
      });
    }

    const assignUser = await getById('users', assigneeIdNum);
    if (!assignUser || assignUser.stato !== 'attivo') return res.status(400).json({ error: 'Utente non valido' });
    if (assignUser.role !== 'operatore' && assignUser.role !== 'fornitore') {
      return res.status(400).json({ error: 'L\'assegnatario deve essere un operatore o un fornitore' });
    }
    if (req.user.role === 'fornitore') {
      if (assignUser.role === 'fornitore' && Number(assignUser.id) !== Number(req.user.id)) {
        return res.status(403).json({ error: 'Puoi assegnare solo a te stesso o a un operatore' });
      }
    }

    const prevStato = quote.stato;
    const newStato = prevStato === 'PRESENTATA' ? 'ASSEGNATA' : prevStato;

    const assignPatch = { operatore_id: null, fornitore_id: null };
    if (assignUser.role === 'operatore') assignPatch.operatore_id = assignUser.id;
    else assignPatch.fornitore_id = assignUser.id;

    await upsertById('quotes', req.params.id, { ...assignPatch, stato: newStato });

    if (prevStato !== newStato) {
      await insert('quote_status_history', { quote_id: Number(req.params.id), stato_precedente: prevStato, stato_nuovo: newStato, utente_id: req.user.id });
    }

    const linkedPolicies = await list('policies', (p) => Number(p.quote_id) === Number(req.params.id));
    for (const pol of linkedPolicies) {
      await upsertById('policies', pol.id, {
        operatore_id: assignPatch.operatore_id,
        fornitore_id: assignPatch.fornitore_id,
      });
      const polFresh = await getById('policies', pol.id);
      await syncConversationsForPolicyAssignment(polFresh);
    }

    const quoteFresh = await getById('quotes', req.params.id);
    await syncConversationsForQuoteAssignment(quoteFresh);

    const assigneeLabel = `${assignUser.nome || ''} ${assignUser.cognome || ''}`.trim() || assignUser.username || 'Utente';
    await logActivity({
      utente_id: req.user.id,
      utente_nome: getUserDisplayName(req.user),
      ruolo: req.user.role,
      azione: prevStato === newStato ? 'RIASSEGNAZIONE' : 'ASSEGNAZIONE',
      modulo: 'preventivi',
      riferimento_id: parseInt(req.params.id),
      riferimento_tipo: 'quote',
      dettaglio: `Preventivo ${quote.numero} ${prevStato === newStato ? 'riassegnato' : 'assegnato'} a ${assigneeLabel}`,
    });

    const ctxAssign = await loadContext();
    const enrichedAssign = enrichQuote(await getById('quotes', req.params.id), ctxAssign);
    const assistitoLabelAssign = [enrichedAssign.assistito_nome, enrichedAssign.assistito_cognome].filter(Boolean).join(' ').trim() || '—';
    const dataAssegnazione = enrichedAssign.updated_at || new Date().toISOString().slice(0, 19).replace('T', ' ');
    const opMail = assignUser.email && String(assignUser.email).trim();
    if (!opMail) {
      console.warn(`[FIMASS email] Assegnatario id=${assigneeIdNum} senza email in DB: notifica assegnazione saltata.`);
    } else {
      console.log(
        `[FIMASS email] Assegnazione preventivo ${enrichedAssign.numero} (id ${enrichedAssign.id}) → utente id ${assigneeIdNum}, invio a ${opMail}`,
      );
      // Su Vercel le serverless function si congelano subito dopo res.json: await obbligatorio affinché Resend completi.
      await sendQuoteAssignedToOperatorMail({
        to: opMail,
        operatorName: assigneeLabel,
        quoteId: enrichedAssign.id,
        quoteNumero: enrichedAssign.numero,
        assistitoLabel: assistitoLabelAssign,
        tipoNome: enrichedAssign.tipo_nome || '—',
        strutturaNome: enrichedAssign.struttura_nome || '—',
        statoCorrente: enrichedAssign.stato,
        dataAssegnazione,
      });
    }
    if (prevStato !== newStato) {
      const strutturaMail = enrichedAssign.struttura_email && String(enrichedAssign.struttura_email).trim();
      if (!strutturaMail) {
        console.warn(`[FIMASS email] Struttura id=${enrichedAssign.struttura_id} senza email: notifica cambio stato (assegnazione) saltata.`);
      } else {
        await sendQuoteStatusChangeToStructureMail({
          to: strutturaMail,
          strutturaNome: enrichedAssign.struttura_nome || 'Struttura',
          quoteId: enrichedAssign.id,
          quoteNumero: enrichedAssign.numero,
          assistitoLabel: assistitoLabelAssign,
          tipoNome: enrichedAssign.tipo_nome || '—',
          statoPrecedente: prevStato,
          statoNuovo: newStato,
          dataAggiornamento: dataAssegnazione,
          motivoStandby: null,
        });
      }
    }

    res.json({ message: 'Preventivo assegnato con successo' });
  })().catch((err) => {
    console.error('Error assigning quote:', err);
    res.status(500).json({ error: 'Errore nell\'assegnazione' });
  });
});

router.put('/:id/status', authenticateToken, (req, res) => {
  (async () => {
    const { stato: statoRaw, motivo } = req.body;
    if (!statoRaw) return res.status(400).json({ error: 'Stato richiesto' });

    const quote = await getById('quotes', req.params.id);
    if (!quote) return res.status(404).json({ error: 'Preventivo non trovato' });

    const statoNormalized = normalizeQuoteStato(statoRaw);
    if (!ALLOWED_QUOTE_STATI.has(statoNormalized)) {
      return res.status(400).json({ error: 'Stato non valido' });
    }

    if (normalizeQuoteStato(quote.stato) === statoNormalized) {
      return res.json({ message: 'Stato invariato' });
    }

    const operatorValidTransitions = {
      ASSEGNATA: ['IN LAVORAZIONE', 'STANDBY'],
      'IN LAVORAZIONE': ['STANDBY', 'ELABORATA'],
      STANDBY: ['IN LAVORAZIONE', 'ELABORATA'],
    };

    if (req.user.role === 'operatore' || req.user.role === 'fornitore') {
      if (!userIsAssignedToQuote(req.user, quote)) {
        return res.status(403).json({ error: 'Non sei l\'incaricato assegnato a questa pratica' });
      }
      const allowed = operatorValidTransitions[quote.stato];
      if (!allowed || !allowed.includes(statoNormalized)) {
        return res.status(400).json({ error: `Transizione da ${quote.stato} a ${statoNormalized} non consentita` });
      }
      if (statoNormalized === 'ELABORATA') {
        const ctxPre = await loadContext();
        const enrichedPre = enrichQuote(quote, ctxPre);
        const isRc = isRcAutoTipoCodice(enrichedPre.tipo_codice);
        if (isRc) {
          const hasRiepilogo = ctxPre.attachments.some(
            (a) => a.entity_type === 'quote'
              && Number(a.entity_id) === Number(req.params.id)
              && a.tipo === 'preventivo_riepilogo_rc',
          );
          if (!hasRiepilogo) {
            return res.status(400).json({
              error:
                'Per le pratiche RC Auto completa l\'elaborazione dal modale dedicato: verrà generato il PDF riepilogativo obbligatorio.',
            });
          }
        } else {
          const hasFinale = ctxPre.attachments.some(
            (a) => a.entity_type === 'quote'
              && Number(a.entity_id) === Number(req.params.id)
              && a.tipo === 'preventivo_elaborato',
          );
          if (!hasFinale) {
            return res.status(400).json({ error: 'Per passare a Elaborata è necessario caricare il file finale del preventivo' });
          }
        }
      }
    }

    if (statoNormalized === 'STANDBY' && !String(motivo || '').trim()) {
      return res.status(400).json({ error: 'Motivo standby obbligatorio' });
    }

    const prevStato = quote.stato;
    const motivoToStore =
      statoNormalized === 'STANDBY' ? String(motivo).trim() : motivo ? String(motivo).trim() : null;

    await upsertById('quotes', req.params.id, { stato: statoNormalized });
    await insert('quote_status_history', {
      quote_id: Number(req.params.id),
      stato_precedente: prevStato,
      stato_nuovo: statoNormalized,
      motivo: motivoToStore,
      utente_id: req.user.id,
    });
    await logActivity({
      utente_id: req.user.id,
      utente_nome: getUserDisplayName(req.user),
      ruolo: req.user.role,
      azione: statoNormalized === 'STANDBY' ? 'STANDBY' : 'CAMBIO_STATO',
      modulo: 'preventivi',
      riferimento_id: parseInt(req.params.id),
      riferimento_tipo: 'quote',
      dettaglio: `Preventivo ${quote.numero}: ${prevStato} → ${statoNormalized}${motivoToStore ? ` (Motivo: ${motivoToStore})` : ''}`
    });

    const ctxStatus = await loadContext();
    const enrichedStatus = enrichQuote(await getById('quotes', req.params.id), ctxStatus);
    const assistitoLabelStatus = [enrichedStatus.assistito_nome, enrichedStatus.assistito_cognome].filter(Boolean).join(' ').trim() || '—';
    const dataAggiornamento = enrichedStatus.updated_at || new Date().toISOString().slice(0, 19).replace('T', ' ');
    const strutturaMailStatus = enrichedStatus.struttura_email && String(enrichedStatus.struttura_email).trim();
    if (!strutturaMailStatus) {
      console.warn(`[FIMASS email] Struttura id=${enrichedStatus.struttura_id} senza email: notifica cambio stato saltata.`);
    } else {
      await sendQuoteStatusChangeToStructureMail({
        to: strutturaMailStatus,
        strutturaNome: enrichedStatus.struttura_nome || 'Struttura',
        quoteId: enrichedStatus.id,
        quoteNumero: enrichedStatus.numero,
        assistitoLabel: assistitoLabelStatus,
        tipoNome: enrichedStatus.tipo_nome || '—',
        statoPrecedente: prevStato,
        statoNuovo: statoNormalized,
        dataAggiornamento,
        motivoStandby: statoNormalized === 'STANDBY' ? motivoToStore : null,
      });
    }

    res.json({ message: 'Stato aggiornato con successo' });
  })().catch((err) => {
    console.error('Error updating quote status:', err);
    res.status(500).json({ error: 'Errore nell\'aggiornamento stato' });
  });
});

router.put('/:id', authenticateToken, (req, res) => {
  (async () => {
    const { dati_specifici, dati_preventivo, note_struttura, note_allegati } = req.body;
    const quote = await getById('quotes', req.params.id);
    if (!quote) return res.status(404).json({ error: 'Preventivo non trovato' });
    if (req.user.role === 'struttura' && Number(quote.struttura_id) !== Number(req.user.id)) {
      return res.status(403).json({ error: 'Accesso non autorizzato' });
    }
    if (req.user.role === 'operatore' || req.user.role === 'fornitore') {
      if (!userIsAssignedToQuote(req.user, quote)) return res.status(403).json({ error: 'Accesso non autorizzato' });
    } else if (req.user.role !== 'admin' && req.user.role !== 'supervisore') {
      return res.status(403).json({ error: 'Accesso non autorizzato' });
    }

    const patch = {};
    if (dati_specifici !== undefined) patch.dati_specifici = dati_specifici;
    if (dati_preventivo !== undefined) patch.dati_preventivo = dati_preventivo;
    if (note_struttura !== undefined) patch.note_struttura = note_struttura;
    if (note_allegati !== undefined) {
      patch.note_allegati = note_allegati != null && String(note_allegati).trim() !== ''
        ? String(note_allegati).trim()
        : null;
    }
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
    if (req.user.role === 'struttura' && Number(quote.struttura_id) !== Number(req.user.id)) {
      return res.status(403).json({ error: 'Accesso non autorizzato' });
    }
    if (req.user.role === 'operatore' || req.user.role === 'fornitore') {
      if (!userIsAssignedToQuote(req.user, quote)) return res.status(403).json({ error: 'Accesso non autorizzato' });
    } else if (req.user.role !== 'admin' && req.user.role !== 'supervisore') {
      return res.status(403).json({ error: 'Accesso non autorizzato' });
    }

    const result = await insert('quote_notes', { quote_id: Number(req.params.id), utente_id: req.user.id, tipo: tipo || 'interna', testo });
    res.status(201).json({ id: result.id, message: 'Nota aggiunta con successo' });
  })().catch((err) => {
    console.error('Error adding note:', err);
    res.status(500).json({ error: 'Errore nell\'aggiunta nota' });
  });
});

router.delete('/:id', authenticateToken, authorizeRoles('admin'), (req, res) => {
  (async () => {
    const quoteId = Number(req.params.id);
    if (!Number.isFinite(quoteId)) {
      return res.status(400).json({ error: 'ID preventivo non valido' });
    }
    const quote = await getById('quotes', quoteId);
    if (!quote) return res.status(404).json({ error: 'Preventivo non trovato' });

    const numero = quote.numero;
    await deleteQuoteWithDependencies(quoteId);

    await logActivity({
      utente_id: req.user.id,
      utente_nome: getUserDisplayName(req.user),
      ruolo: req.user.role,
      azione: 'ELIMINAZIONE_PREVENTIVO',
      modulo: 'preventivi',
      riferimento_id: quoteId,
      riferimento_tipo: 'quote',
      dettaglio: `Eliminato preventivo ${numero}`,
    });

    res.json({ message: 'Preventivo eliminato con successo' });
  })().catch((err) => {
    console.error('Error deleting quote:', err);
    res.status(500).json({ error: 'Errore nell\'eliminazione del preventivo' });
  });
});

module.exports = router;
