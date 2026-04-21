const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { put } = require('@vercel/blob');
const { insert } = require('../data/store');
const { getUploadsDir } = require('./attachmentDownload');

/**
 * Salva un file locale come allegato di pratica (stessa logica di POST /attachments/upload).
 */
async function persistQuoteAttachmentFromDisk({
  localPath,
  originalName,
  quoteId,
  tipo,
  userId,
  mimeType = 'application/pdf',
}) {
  const abs = path.resolve(localPath);
  if (!fs.existsSync(abs)) {
    throw new Error('persistQuoteAttachmentFromDisk: file mancante');
  }
  const stat = fs.statSync(abs);

  let downloadUrl = null;
  let storageKey = path.basename(abs);

  if (process.env.BLOB_READ_WRITE_TOKEN) {
    const blob = await put(`attachments/${storageKey}`, fs.createReadStream(abs), {
      access: 'public',
      addRandomSuffix: false,
      token: process.env.BLOB_READ_WRITE_TOKEN,
    });
    downloadUrl = blob.url;
    storageKey = blob.pathname;
    try {
      fs.unlinkSync(abs);
    } catch {
      /* ignore */
    }
  }

  return insert('attachments', {
    entity_type: 'quote',
    entity_id: Number(quoteId),
    tipo,
    nome_file: storageKey,
    nome_originale: originalName,
    mime_type: mimeType,
    dimensione: stat.size,
    caricato_da: userId,
    url: downloadUrl,
  });
}

function tempPdfPath() {
  const dir = getUploadsDir();
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return path.join(dir, `${uuidv4()}.pdf`);
}

module.exports = { persistQuoteAttachmentFromDisk, tempPdfPath };
