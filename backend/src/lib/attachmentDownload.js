const path = require('path');
const fs = require('fs');
const http = require('http');
const https = require('https');
const { URL } = require('url');

const isVercel = Boolean(process.env.VERCEL);

function getUploadsDir() {
  return process.env.UPLOADS_DIR || (isVercel ? '/tmp/uploads' : path.join(__dirname, '..', '..', 'uploads'));
}

function isHttpUrl(s) {
  if (s == null || typeof s !== 'string') return false;
  return /^https?:\/\//i.test(s.trim());
}

function isPathInsideDir(dir, candidate) {
  const base = path.resolve(dir);
  const resolved = path.resolve(candidate);
  return resolved === base || resolved.startsWith(base + path.sep);
}

/**
 * Risolve il percorso locale per un allegato (fallback per nomi file storici / path blob).
 * @returns {{ path: string } | { missing: true, debug: object }}
 */
function resolveLocalDiskPath(attachment) {
  const uploadsDir = path.resolve(getUploadsDir());
  const raw = attachment.nome_file != null ? String(attachment.nome_file).trim() : '';
  if (!raw) {
    return { missing: true, debug: { reason: 'nome_file_vuoto' } };
  }

  const candidates = [];

  const relative = raw.replace(/^[/\\]+/, '');
  if (relative && !relative.includes('..')) {
    candidates.push(path.join(uploadsDir, relative));
  }

  const baseName = path.basename(raw.replace(/\\/g, '/'));
  if (baseName && baseName !== relative) {
    candidates.push(path.join(uploadsDir, baseName));
  }

  if (path.isAbsolute(raw)) {
    candidates.unshift(raw);
  }

  const tried = [];
  for (const filePath of candidates) {
    tried.push(filePath);
    let ok = isPathInsideDir(uploadsDir, filePath);
    if (path.isAbsolute(raw) && filePath === raw) {
      ok = true;
    }
    if (!ok) continue;
    try {
      if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
        return { path: filePath };
      }
    } catch {
      /* ignore */
    }
  }

  return {
    missing: true,
    debug: {
      attachment_id: attachment.id,
      nome_file: raw,
      url_present: Boolean(attachment.url && String(attachment.url).trim()),
      uploadsDir,
      tried,
    },
  };
}

const MAX_REDIRECTS = 10;

function pipeRemoteUrlToResponse(urlString, res, downloadFilename, redirectCount, onFail) {
  if (redirectCount > MAX_REDIRECTS) {
    onFail('troppi_redirect');
    return;
  }
  let parsed;
  try {
    parsed = new URL(urlString);
  } catch {
    onFail('url_non_valida');
    return;
  }
  const lib = parsed.protocol === 'https:' ? https : http;
  const req = lib.request(
    urlString,
    {
      method: 'GET',
      headers: { 'User-Agent': 'FIMASS-attachment-download/1' },
      timeout: 60000,
    },
    (upstream) => {
      const code = upstream.statusCode || 0;
      if (code >= 300 && code < 400 && upstream.headers.location) {
        upstream.resume();
        let nextUrl;
        try {
          nextUrl = new URL(upstream.headers.location, urlString).href;
        } catch {
          onFail('redirect_non_valido');
          return;
        }
        pipeRemoteUrlToResponse(nextUrl, res, downloadFilename, redirectCount + 1, onFail);
        return;
      }
      if (code !== 200) {
        upstream.resume();
        onFail(`http_${code}`);
        return;
      }
      const ct = upstream.headers['content-type'] || 'application/octet-stream';
      const safeName = String(downloadFilename || 'allegato').replace(/[\r\n"]/g, '_');
      res.setHeader('Content-Type', ct);
      res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(safeName)}`);
      upstream.pipe(res);
    },
  );
  req.on('timeout', () => {
    req.destroy();
    onFail('timeout');
  });
  req.on('error', (err) => onFail(err.message || 'network_error'));
  req.end();
}

/**
 * Invia il file (locale o remoto) come download. In caso di errore risponde con JSON e non lancia.
 * @param {object} attachment — riga tabella attachments
 * @param {import('express').Response} res
 * @param {{ downloadFilename?: string, logPrefix?: string }} [opts]
 */
function sendAttachmentDownload(attachment, res, opts = {}) {
  const downloadName = opts.downloadFilename || attachment.nome_originale || 'file';
  const logPrefix = opts.logPrefix || '[attachment-download]';

  const urlVal = attachment.url != null ? String(attachment.url).trim() : '';

  if (isHttpUrl(urlVal)) {
    pipeRemoteUrlToResponse(
      urlVal,
      res,
      downloadName,
      0,
      (reason) => {
        console.warn(`${logPrefix} fallito proxy URL id=${attachment.id}`, reason);
        if (!res.headersSent) {
          res.status(502).json({
            error:
              'Impossibile recuperare il file dall\'archivio remoto. Se il problema persiste, contattare l\'amministratore.',
          });
        }
      },
    );
    return;
  }

  const disk = resolveLocalDiskPath(attachment);
  if (disk.path) {
    res.download(disk.path, downloadName, (err) => {
      if (err && !res.headersSent) {
        console.error(`${logPrefix} res.download`, err);
        res.status(500).json({ error: 'Errore nell\'invio del file' });
      }
    });
    return;
  }

  console.warn(`${logPrefix} file non trovato in locale`, disk.debug);
  if (!res.headersSent) {
    res.status(404).json({
      error:
        'File non disponibile sul server. Su ambienti cloud senza storage persistente è necessario il blob storage; in caso contrario ricaricare il documento.',
    });
  }
}

module.exports = { getUploadsDir, sendAttachmentDownload, resolveLocalDiskPath, isHttpUrl };
