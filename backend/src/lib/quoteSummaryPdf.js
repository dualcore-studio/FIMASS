const fs = require('fs');
const path = require('path');
const PDFDocument = require('pdfkit');

const COL = {
  ink: '#0f172a',
  body: '#334155',
  muted: '#64748b',
  label: '#475569',
  section: '#1e3a5f',
  rule: '#cbd5e1',
  footer: '#94a3b8',
};

function parseMaybeJson(value) {
  if (value == null) return null;
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function humanizeKey(key) {
  return String(key)
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function dash(val) {
  if (val === null || val === undefined) return '—';
  const s = String(val).trim();
  return s === '' ? '—' : s;
}

function formatValue(val) {
  if (val === null || val === undefined) return '—';
  if (typeof val === 'boolean') return val ? 'Sì' : 'No';
  if (Array.isArray(val)) return val.map((v) => formatValue(v)).join(', ');
  if (typeof val === 'object') {
    try {
      return JSON.stringify(val, null, 2);
    } catch {
      return String(val);
    }
  }
  return String(val);
}

function formatDateTimeIt(val) {
  if (val == null || val === '') return '—';
  const d = new Date(val);
  if (!Number.isNaN(d.getTime())) {
    return d.toLocaleString('it-IT', { dateStyle: 'short', timeStyle: 'short' });
  }
  return String(val);
}

function formatDateIt(val) {
  if (val == null || val === '') return '—';
  const d = new Date(val);
  if (!Number.isNaN(d.getTime())) {
    return d.toLocaleDateString('it-IT');
  }
  return String(val);
}

function labelForCampo(typeRow, key) {
  const raw = typeRow?.campi_specifici;
  const campi = parseMaybeJson(raw) || raw;
  if (!Array.isArray(campi)) return humanizeKey(key);
  const found = campi.find((c) => c && c.nome === key);
  return (found && found.label) || humanizeKey(key);
}

function pngDisplayHeight(pngPath, targetWidth) {
  try {
    const buf = fs.readFileSync(pngPath);
    if (buf.length < 24 || buf.toString('ascii', 1, 4) !== 'PNG') return targetWidth * 0.28;
    const w = buf.readUInt32BE(16);
    const h = buf.readUInt32BE(20);
    if (!w || !h) return targetWidth * 0.28;
    return (targetWidth * h) / w;
  } catch {
    return targetWidth * 0.28;
  }
}

function pageContentWidth(doc) {
  return doc.page.width - doc.page.margins.left - doc.page.margins.right;
}

function footerReserve(doc) {
  return 44;
}

function ensureVerticalSpace(doc, minHeight) {
  const limit = doc.page.height - doc.page.margins.bottom - footerReserve(doc);
  if (doc.y + minHeight > limit) {
    doc.addPage();
    doc.y = doc.page.margins.top;
  }
}

function drawRule(doc) {
  const x0 = doc.page.margins.left;
  const x1 = doc.page.width - doc.page.margins.right;
  const y = doc.y;
  doc.save();
  doc.strokeColor(COL.rule).lineWidth(0.35).moveTo(x0, y).lineTo(x1, y).stroke();
  doc.restore();
  doc.moveDown(0.55);
}

function writeSectionTitle(doc, title) {
  ensureVerticalSpace(doc, 56);
  doc.moveDown(0.65);
  doc.fontSize(11).font('Helvetica-Bold').fillColor(COL.section).text(title, {
    align: 'left',
  });
  doc.moveDown(0.22);
  drawRule(doc);
  doc.font('Helvetica').fillColor(COL.body);
}

/** @param {{ label: string; value: string; prominent?: boolean }[]} items */
function stackLabeledFields(doc, items, x, colW, startY) {
  let y = startY;
  const gapAfterBlock = 11;
  for (const it of items) {
    doc.font('Helvetica-Bold').fontSize(9).fillColor(COL.label);
    const labelH = doc.heightOfString(it.label, { width: colW });
    doc.text(it.label, x, y, { width: colW });
    y += labelH + 3;
    const valStr = it.value || '—';
    const valOpts = { width: colW, lineGap: 1 };
    if (it.prominent) {
      doc.font('Helvetica-Bold').fontSize(10.5).fillColor(COL.ink);
    } else {
      doc.font('Helvetica').fontSize(10).fillColor(COL.body);
    }
    const valH = doc.heightOfString(valStr, valOpts);
    doc.text(valStr, x, y, valOpts);
    y += valH + gapAfterBlock;
  }
  return y;
}

function isProminentField(key, label) {
  const s = `${String(key)} ${String(label)}`.toLowerCase();
  return /massimale|capitale|franchigia|mq\b|metr|quadri|superficie|uso\b|tipologia|abitazione|immobile|rendita/i.test(
    s,
  );
}

function objectToEntries(obj, skipInternalKeys) {
  if (!obj || typeof obj !== 'object') return [];
  return Object.entries(obj).filter(([k]) => !(skipInternalKeys && String(k).startsWith('_')));
}

function writeDynamicFieldsGrid(doc, obj, labelFn, options = {}) {
  const skipInternalKeys = !!options.skipInternalKeys;
  const entries = objectToEntries(obj, skipInternalKeys);
  if (entries.length === 0) {
    doc.fontSize(10).font('Helvetica').fillColor(COL.muted).text('Nessun dato caricato.', { lineGap: 2 });
    doc.moveDown(0.4);
    return;
  }

  const margin = doc.page.margins.left;
  const contentW = pageContentWidth(doc);
  const gutter = 28;
  const colW = (contentW - gutter) / 2;
  const leftX = margin;
  const rightX = margin + colW + gutter;

  for (let i = 0; i < entries.length; i += 2) {
    ensureVerticalSpace(doc, 96);
    const pair = [entries[i], entries[i + 1]].filter(Boolean);
    const rowStart = doc.y;
    let maxY = rowStart;

    for (let j = 0; j < pair.length; j += 1) {
      const [k, v] = pair[j];
      const label = labelFn(k);
      const prominent = isProminentField(k, label);
      const val = formatValue(v);
      const x = j === 0 ? leftX : rightX;
      const endY = stackLabeledFields(doc, [{ label, value: val, prominent }], x, colW, rowStart);
      maxY = Math.max(maxY, endY);
    }

    doc.y = maxY;
    doc.moveDown(0.15);
  }
}

function writeFooterOnAllPages(doc, line) {
  const range = doc.bufferedPageRange();
  for (let i = 0; i < range.count; i += 1) {
    doc.switchToPage(range.start + i);
    const x = doc.page.margins.left;
    const w = pageContentWidth(doc);
    const y = doc.page.height - doc.page.margins.bottom - 12;
    doc.save();
    doc.fontSize(7).font('Helvetica').fillColor(COL.footer).text(line, x, y, { width: w, align: 'center' });
    doc.restore();
  }
}

/**
 * Genera il PDF e lo invia sullo stream (es. risposta Express).
 * @param {object} quote — risultato enrichQuote
 * @param {object} ctx — loadContext()
 * @param {import('http').ServerResponse} res
 */
function pipeQuoteSummaryPdf(quote, ctx, res) {
  const typeRow = ctx.typesById.get(Number(quote.tipo_assicurazione_id)) || {};
  const attachments = (ctx.attachments || [])
    .filter((a) => a.entity_type === 'quote' && Number(a.entity_id) === Number(quote.id))
    .sort((a, b) => String(a.created_at || '').localeCompare(String(b.created_at || '')));

  const generatedAt = new Date().toLocaleString('it-IT', { dateStyle: 'short', timeStyle: 'short' });
  const logoPath = path.join(__dirname, '..', 'assets', 'fimass-logo.png');
  const logoOk = fs.existsSync(logoPath);

  const doc = new PDFDocument({
    margin: 48,
    size: 'A4',
    bufferPages: true,
    info: {
      Title: `Pratica ${quote.numero}`,
      Author: 'FIMASS',
    },
  });

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="preventivo-${quote.id}.pdf"`);
  doc.pipe(res);

  const contentW = pageContentWidth(doc);
  const pageMidX = doc.page.width / 2;

  if (logoOk) {
    const logoW = 168;
    const logoH = pngDisplayHeight(logoPath, logoW);
    const logoX = pageMidX - logoW / 2;
    const topY = doc.y;
    doc.image(logoPath, logoX, topY, { width: logoW });
    doc.y = topY + logoH + 18;
  } else {
    doc.moveDown(0.3);
  }

  doc.fontSize(20).font('Helvetica-Bold').fillColor(COL.ink).text('Riepilogo richiesta preventivo', {
    align: 'center',
  });
  doc.moveDown(0.55);

  const metaLine = [
    `Numero pratica: ${dash(quote.numero)}`,
    `Stato: ${dash(quote.stato)}`,
    `Generato: ${generatedAt}`,
  ].join(' ·     ');
  doc.fontSize(9.5).font('Helvetica').fillColor(COL.muted).text(metaLine, {
    align: 'center',
    lineGap: 2,
    width: contentW,
  });
  doc.moveDown(0.85);
  drawRule(doc);

  /* --- Assistito --- */
  writeSectionTitle(doc, 'Assistito');
  const assistitoNome = [quote.assistito_nome, quote.assistito_cognome].filter(Boolean).join(' ').trim();
  const indirizzoLine = [quote.assistito_indirizzo, quote.assistito_cap, quote.assistito_citta]
    .filter(Boolean)
    .join(' — ');

  const leftAssist = [
    { label: 'Nome e cognome', value: assistitoNome || '—' },
    { label: 'Codice fiscale', value: dash(quote.assistito_cf) },
    { label: 'Data di nascita', value: dash(quote.assistito_data_nascita) },
  ];
  if (indirizzoLine) {
    leftAssist.push({ label: 'Indirizzo', value: indirizzoLine });
  }
  const rightAssist = [
    { label: 'Cellulare', value: dash(quote.assistito_cellulare) },
    { label: 'Email', value: dash(quote.assistito_email) },
  ];

  ensureVerticalSpace(doc, 120);
  const rowTop = doc.y;
  const gutter = 28;
  const colW = (contentW - gutter) / 2;
  const margin = doc.page.margins.left;
  const leftEnd = stackLabeledFields(doc, leftAssist, margin, colW, rowTop);
  const rightEnd = stackLabeledFields(doc, rightAssist, margin + colW + gutter, colW, rowTop);
  doc.y = Math.max(leftEnd, rightEnd);
  doc.moveDown(0.35);

  /* --- Dettagli pratica --- */
  writeSectionTitle(doc, 'Dettagli pratica');
  const tipoLabel = quote.tipo_nome
    ? quote.tipo_codice
      ? `${quote.tipo_nome} (${quote.tipo_codice})`
      : String(quote.tipo_nome)
    : '—';
  const operatoreNome = quote.operatore_id
    ? [quote.operatore_nome, quote.operatore_cognome].filter(Boolean).join(' ').trim() || '—'
    : '—';

  const leftPratica = [
    { label: 'Tipologia', value: tipoLabel },
    { label: 'Struttura', value: dash(quote.struttura_nome) },
    { label: 'Operatore assegnato', value: operatoreNome },
  ];
  const rightPratica = [
    { label: 'Data creazione', value: formatDateTimeIt(quote.created_at) },
    { label: 'Ultimo aggiornamento', value: formatDateTimeIt(quote.updated_at) },
    { label: 'Data decorrenza richiesta', value: formatDateIt(quote.data_decorrenza) },
  ];

  ensureVerticalSpace(doc, 130);
  const praticaTop = doc.y;
  const pLeftEnd = stackLabeledFields(doc, leftPratica, margin, colW, praticaTop);
  const pRightEnd = stackLabeledFields(doc, rightPratica, margin + colW + gutter, colW, praticaTop);
  doc.y = Math.max(pLeftEnd, pRightEnd);
  doc.moveDown(0.35);

  /* --- Dati specifici --- */
  writeSectionTitle(doc, 'Dati specifici per il preventivo');
  writeDynamicFieldsGrid(doc, quote.dati_specifici, (k) => labelForCampo(typeRow, k), { skipInternalKeys: true });

  /* --- Dati preventivo (sistema) --- */
  writeSectionTitle(doc, 'Dati preventivo');
  writeDynamicFieldsGrid(doc, quote.dati_preventivo, humanizeKey, { skipInternalKeys: false });

  /* --- Note --- */
  writeSectionTitle(doc, 'Note');
  ensureVerticalSpace(doc, 72);
  doc.font('Helvetica-Bold').fontSize(9).fillColor(COL.label).text('Note della struttura');
  doc.moveDown(0.25);
  const ns = quote.note_struttura && String(quote.note_struttura).trim();
  doc.font('Helvetica').fontSize(10).fillColor(ns ? COL.body : COL.muted);
  doc.text(ns || 'Nessuna nota inserita.', { lineGap: 4, align: 'left' });
  doc.moveDown(0.65);

  doc.font('Helvetica-Bold').fontSize(9).fillColor(COL.label).text('Note sugli allegati');
  doc.moveDown(0.25);
  const na = quote.note_allegati && String(quote.note_allegati).trim();
  doc.font('Helvetica').fontSize(10).fillColor(na ? COL.body : COL.muted);
  doc.text(na || 'Nessuna nota inserita.', { lineGap: 4, align: 'left' });
  doc.moveDown(0.45);

  /* --- Allegati --- */
  writeSectionTitle(doc, 'Allegati');
  if (attachments.length === 0) {
    doc.fontSize(10).font('Helvetica').fillColor(COL.muted).text('Nessun allegato registrato.', { lineGap: 2 });
  } else {
    attachments.forEach((a, i) => {
      ensureVerticalSpace(doc, 36);
      const tipo = a.tipo || 'documento';
      const nome = a.nome_originale || a.nome_file || 'file';
      const dim = a.dimensione != null ? `${Math.round(a.dimensione / 1024)} KB` : 'n/d';
      const data = formatDateTimeIt(a.created_at);
      doc.fontSize(10).font('Helvetica-Bold').fillColor(COL.body).text(`${i + 1}. ${nome}`, { lineGap: 2 });
      doc.fontSize(9).font('Helvetica').fillColor(COL.muted).text(`Tipo: ${tipo}   ·   Dimensione: ${dim}   ·   Caricato: ${data}`, {
        lineGap: 2,
      });
      doc.moveDown(0.45);
    });
  }

  writeFooterOnAllPages(doc, `Documento operativo interno generato da FIMASS — ${generatedAt}`);

  doc.end();
}

module.exports = { pipeQuoteSummaryPdf };
