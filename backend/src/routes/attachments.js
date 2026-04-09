const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const { db } = require('../config/database');
const { authenticateToken } = require('../middleware/auth');
const { logActivity } = require('./logs');

const router = express.Router();

const isVercel = Boolean(process.env.VERCEL);
const uploadsDir = process.env.UPLOADS_DIR || (isVercel ? '/tmp/uploads' : path.join(__dirname, '..', '..', 'uploads'));
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
  try {
    const { entity_type, entity_id, tipo } = req.body;

    if (!entity_type || !entity_id || !req.file) {
      return res.status(400).json({ error: 'Dati mancanti' });
    }

    const result = db.prepare(`
      INSERT INTO attachments (entity_type, entity_id, tipo, nome_file, nome_originale, mime_type, dimensione, caricato_da)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(entity_type, entity_id, tipo || 'altro', req.file.filename, req.file.originalname, req.file.mimetype, req.file.size, req.user.id);

    const displayName = req.user.role === 'struttura' ? req.user.denominazione : `${req.user.nome} ${req.user.cognome}`;
    logActivity({
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
      id: result.lastInsertRowid,
      nome_file: req.file.filename,
      nome_originale: req.file.originalname,
      message: 'File caricato con successo'
    });
  } catch (err) {
    console.error('Error uploading file:', err);
    res.status(500).json({ error: 'Errore nel caricamento file' });
  }
});

router.get('/download/:id', authenticateToken, (req, res) => {
  try {
    const attachment = db.prepare('SELECT * FROM attachments WHERE id = ?').get(req.params.id);
    if (!attachment) return res.status(404).json({ error: 'Allegato non trovato' });

    const filePath = path.join(uploadsDir, attachment.nome_file);
    if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'File non trovato sul server' });

    res.download(filePath, attachment.nome_originale);
  } catch (err) {
    console.error('Error downloading file:', err);
    res.status(500).json({ error: 'Errore nel download file' });
  }
});

router.delete('/:id', authenticateToken, (req, res) => {
  try {
    const attachment = db.prepare('SELECT * FROM attachments WHERE id = ?').get(req.params.id);
    if (!attachment) return res.status(404).json({ error: 'Allegato non trovato' });

    const filePath = path.join(uploadsDir, attachment.nome_file);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    db.prepare('DELETE FROM attachments WHERE id = ?').run(req.params.id);
    res.json({ message: 'Allegato eliminato con successo' });
  } catch (err) {
    console.error('Error deleting attachment:', err);
    res.status(500).json({ error: 'Errore nell\'eliminazione allegato' });
  }
});

module.exports = router;
