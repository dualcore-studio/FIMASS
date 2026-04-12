const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const { put, del } = require('@vercel/blob');
const { insert, getById, removeById } = require('../data/store');
const { authenticateToken } = require('../middleware/auth');
const { logActivity } = require('./logs');
const { getUploadsDir, sendAttachmentDownload } = require('../lib/attachmentDownload');

const router = express.Router();

const uploadsDir = getUploadsDir();
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${uuidv4()}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['.pdf', '.jpg', '.jpeg', '.png', '.doc', '.docx', '.xls', '.xlsx', '.zip'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Tipo file non consentito'));
    }
  }
});

router.post('/upload', authenticateToken, upload.single('file'), (req, res) => {
  (async () => {
    try {
    const { entity_type, entity_id, tipo } = req.body;

    if (!entity_type || !entity_id || !req.file) {
      return res.status(400).json({ error: 'Dati mancanti' });
    }

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

    const result = await insert('attachments', {
      entity_type,
      entity_id: Number(entity_id),
      tipo: tipo || 'altro',
      nome_file: storageKey,
      nome_originale: req.file.originalname,
      mime_type: req.file.mimetype,
      dimensione: req.file.size,
      caricato_da: req.user.id,
      url: downloadUrl,
    });

    const displayName = req.user.role === 'struttura' ? req.user.denominazione : `${req.user.nome} ${req.user.cognome}`;
    await logActivity({
      utente_id: req.user.id,
      utente_nome: displayName,
      ruolo: req.user.role,
      azione: 'CARICAMENTO_ALLEGATO',
      modulo: entity_type === 'quote' ? 'preventivi' : entity_type === 'policy' ? 'polizze' : 'assistiti',
      riferimento_id: parseInt(entity_id),
      riferimento_tipo: entity_type,
      dettaglio: `Caricato file: ${req.file.originalname}`
    });

    res.status(201).json({
      id: result.id,
      nome_file: storageKey,
      nome_originale: req.file.originalname,
      url: downloadUrl,
      message: 'File caricato con successo'
    });
    } catch (err) {
      console.error('Error uploading file:', err);
      res.status(500).json({ error: 'Errore nel caricamento file' });
    }
  })();
});

router.get('/download/:id', authenticateToken, (req, res) => {
  (async () => {
    try {
    const attachment = await getById('attachments', req.params.id);
    if (!attachment) return res.status(404).json({ error: 'Allegato non trovato' });

    sendAttachmentDownload(attachment, res, {
      downloadFilename: attachment.nome_originale,
      logPrefix: `[attachments/download id=${req.params.id}]`,
    });
    } catch (err) {
      console.error('Error downloading file:', err);
      if (!res.headersSent) res.status(500).json({ error: 'Errore nel download file' });
    }
  })();
});

router.delete('/:id', authenticateToken, (req, res) => {
  (async () => {
    try {
    const attachment = await getById('attachments', req.params.id);
    if (!attachment) return res.status(404).json({ error: 'Allegato non trovato' });

    if (attachment.url && process.env.BLOB_READ_WRITE_TOKEN) {
      try {
        await del(attachment.url, { token: process.env.BLOB_READ_WRITE_TOKEN });
      } catch (e) {
        console.warn('Blob delete failed:', e.message);
      }
    } else {
      const filePath = path.join(uploadsDir, attachment.nome_file);
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    }
    await removeById('attachments', req.params.id);
    res.json({ message: 'Allegato eliminato con successo' });
    } catch (err) {
      console.error('Error deleting attachment:', err);
      res.status(500).json({ error: 'Errore nell\'eliminazione allegato' });
    }
  })();
});

module.exports = router;
