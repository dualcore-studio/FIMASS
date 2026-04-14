const fs = require('fs');
const path = require('path');
const PDFDocument = require('pdfkit');

const COL = {
  ink: '#0f172a',
  body: '#334155',
  muted: '#64748b',
  faint: '#9ca3af',
  whisper: '#a8b0ba',
  label: '#64748b',
  section: '#1e3a5f',
  hero: '#0c2744',
  rule: '#d1d5db',
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

/** Spazio riservato in basso al contenuto prima del footer fisso */
function footerReserve(doc) {
  return 30;
}

function ensureVerticalSpace(doc, minHeight) {
  const limit = doc.page.height - doc.page.margins.bottom - footerReserve(doc);
  if (doc.y + minHeight > limit) {
    doc.addPage();
    doc.y = doc.page.margins.top;
  }
}

function drawRule(doc, afterGap = 0.32) {
  const x0 = doc.page.margins.left;
  const x1 = doc.page.width - doc.page.margins.right;
  const y = doc.y;
  doc.save();
  doc.strokeColor(COL.rule).lineWidth(0.35).moveTo(x0, y).lineTo(x1, y).stroke();
  doc.restore();
  doc.moveDown(afterGap);
}

function writeSectionTitle(doc, title, compact = true) {
  ensureVerticalSpace(doc, 38);
  doc.moveDown(compact ? 0.28 : 0.45);
  doc.fontSize(12).font('Helvetica-Bold').fillColor(COL.section).text(title, { align: 'left' });
  doc.moveDown(0.1);
  drawRule(doc, 0.28);
  doc.font('Helvetica').fillColor(COL.body);
}

function isProminentField(key, label) {
  const s = `${String(key)} ${String(label)}`.toLowerCase();
  return /massimale|rct\b|capitale|franchigia|mq\b|metr|quadri|superficie|uso\b|tipologia|abitazione|immobile|rendita|propriet|affitto/i.test(
    s,
  );
}

/**
 * @param {{ label: string; value: string; prominent?: boolean }[]} items
 * @param {{ compact?: boolean }} opts
 */
function stackLabeledFields(doc, items, x, colW, startY, opts = {}) {
  const compact = !!opts.compact;
  const gapAfterBlock = compact ? 6 : 8;
  let y = startY;
  for (const it of items) {
    doc.font('Helvetica').fontSize(8).fillColor(COL.label);
    const labelH = doc.heightOfString(it.label, { width: colW });
    doc.text(it.label, x, y, { width: colW });
    y += labelH + (compact ? 1 : 2);
    const valStr = it.value || '—';
    const valOpts = { width: colW, lineGap: compact ? 0 : 1 };
    if (it.prominent) {
      doc.font('Helvetica-Bold').fontSize(compact ? 11 : 11.5).fillColor(COL.hero);
    } else {
      doc.font('Helvetica').fontSize(compact ? 10 : 10.5).fillColor(COL.ink);
    }
    const valH = doc.heightOfString(valStr, valOpts);
    doc.text(valStr, x, y, valOpts);
    y += valH + gapAfterBlock;
  }
  return y;
}

function objectToEntries(obj, skipInternalKeys) {
  if (!obj || typeof obj !== 'object') return [];
  return Object.entries(obj).filter(([k]) => !(skipInternalKeys && String(k).startsWith('_')));
}

function sortEntriesProminentFirst(entries, labelFn) {
  const decorated = entries.map(([k, v]) => {
    const label = labelFn(k);
    return { k, v, label, prominent: isProminentField(k, label) };
  });
  decorated.sort((a, b) => {
    if (a.prominent !== b.prominent) return a.prominent ? -1 : 1;
    return a.label.localeCompare(b.label, 'it', { sensitivity: 'base' });
  });
  return decorated.map(({ k, v }) => [k, v]);
}

function writeDynamicFieldsGrid(doc, obj, labelFn, options = {}) {
  const skipInternalKeys = !!options.skipInternalKeys;
  const compact = !!options.compact;
  const sortProminent = !!options.sortProminentFirst;
  const emptySubtle = !!options.emptySubtle;

  let entries = objectToEntries(obj, skipInternalKeys);
  if (sortProminent) entries = sortEntriesProminentFirst(entries, labelFn);

  if (entries.length === 0) {
    if (emptySubtle) {
      doc.fontSize(8).font('Helvetica-Oblique').fillColor(COL.whisper).text('Nessun dato caricato.', {
        lineGap: 1,
      });
    } else {
      doc.fontSize(10).font('Helvetica').fillColor(COL.muted).text('Nessun dato caricato.', { lineGap: 2 });
    }
    doc.moveDown(0.22);
    return;
  }

  const margin = doc.page.margins.left;
  const contentW = pageContentWidth(doc);
  const gutter = compact ? 22 : 28;
  const colW = (contentW - gutter) / 2;
  const leftX = margin;
  const rightX = margin + colW + gutter;
  const rowGap = compact ? 0.06 : 0.12;
  const minRowH = compact ? 52 : 72;

  for (let i = 0; i < entries.length; i += 2) {
    ensureVerticalSpace(doc, minRowH);
    const pair = [entries[i], entries[i + 1]].filter(Boolean);
    const rowStart = doc.y;
    let maxY = rowStart;

    for (let j = 0; j < pair.length; j += 1) {
      const [k, v] = pair[j];
      const label = labelFn(k);
      const prominent = isProminentField(k, label);
      const val = formatValue(v);
      const x = j === 0 ? leftX : rightX;
      const endY = stackLabeledFields(doc, [{ label, value: val, prominent }], x, colW, rowStart, { compact });
      maxY = Math.max(maxY, endY);
    }

    doc.y = maxY;
    doc.moveDown(rowGap);
  }
}

function writeFooterOnce(doc, line) {
  const x = doc.page.margins.left;
  const w = pageContentWidth(doc);
  const y = doc.page.height - doc.page.margins.bottom - 9;
  doc.save();
  doc.fontSize(6.5).font('Helvetica').fillColor(COL.footer).text(line, x, y, { width: w, align: 'center' });
  doc.restore();
}

function placeFooterIfRoom(doc, line) {
  const y = doc.page.height - doc.page.margins.bottom - 9;
  if (doc.y + 16 > y) {
    doc.addPage();
  }
  writeFooterOnce(doc, line);
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
    margin: 44,
    size: 'A4',
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
    const logoW = 118;
    const logoH = pngDisplayHeight(logoPath, logoW);
    const logoX = pageMidX - logoW / 2;
    const topY = doc.y;
    doc.image(logoPath, logoX, topY, { width: logoW });
    doc.y = topY + logoH + 10;
  } else {
    doc.moveDown(0.15);
  }

  doc.fontSize(17).font('Helvetica-Bold').fillColor(COL.ink).text('Riepilogo richiesta preventivo', {
    align: 'center',
  });
  doc.moveDown(0.38);

  doc.fontSize(15).font('Helvetica-Bold').fillColor(COL.hero).text(dash(quote.numero), { align: 'center' });
  doc.moveDown(0.28);

  doc.fontSize(8)
    .font('Helvetica')
    .fillColor(COL.muted)
    .text(`Stato: ${dash(quote.stato)}`, { align: 'center', width: contentW });
  doc.moveDown(0.12);
  doc.fontSize(7.5).fillColor(COL.faint).text(`Documento generato: ${generatedAt}`, { align: 'center', width: contentW });
  doc.moveDown(0.42);
  drawRule(doc, 0.26);

  const gutter = 22;
  const colW = (contentW - gutter) / 2;
  const margin = doc.page.margins.left;

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

  ensureVerticalSpace(doc, 88);
  const rowTop = doc.y;
  const leftEnd = stackLabeledFields(doc, leftAssist, margin, colW, rowTop, { compact: true });
  const rightEnd = stackLabeledFields(doc, rightAssist, margin + colW + gutter, colW, rowTop, { compact: true });
  doc.y = Math.max(leftEnd, rightEnd);
  doc.moveDown(0.18);

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

  ensureVerticalSpace(doc, 96);
  const praticaTop = doc.y;
  const pLeftEnd = stackLabeledFields(doc, leftPratica, margin, colW, praticaTop, { compact: true });
  const pRightEnd = stackLabeledFields(doc, rightPratica, margin + colW + gutter, colW, praticaTop, { compact: true });
  doc.y = Math.max(pLeftEnd, pRightEnd);
  doc.moveDown(0.18);

  /* --- Dati specifici --- */
  writeSectionTitle(doc, 'Dati specifici per il preventivo');
  writeDynamicFieldsGrid(doc, quote.dati_specifici, (k) => labelForCampo(typeRow, k), {
    skipInternalKeys: true,
    compact: true,
    sortProminentFirst: true,
  });

  /* --- Dati preventivo (sistema) --- */
  writeSectionTitle(doc, 'Dati preventivo');
  writeDynamicFieldsGrid(doc, quote.dati_preventivo, humanizeKey, {
    skipInternalKeys: false,
    compact: true,
    emptySubtle: true,
  });

  /* --- Note --- */
  const ns = quote.note_struttura && String(quote.note_struttura).trim();
  const na = quote.note_allegati && String(quote.note_allegati).trim();
  const bothNotesEmpty = !ns && !na;

  writeSectionTitle(doc, 'Note');
  if (bothNotesEmpty) {
    doc.font('Helvetica-Oblique').fontSize(7.5).fillColor(COL.whisper).text('Nessuna nota inserita.', { lineGap: 1 });
    doc.moveDown(0.12);
  } else {
    doc.font('Helvetica').fontSize(8).fillColor(COL.label).text('Note della struttura');
    doc.moveDown(0.08);
    doc.font('Helvetica').fontSize(10).fillColor(ns ? COL.body : COL.whisper);
    if (!ns) doc.font('Helvetica-Oblique');
    doc.text(ns || 'Nessuna nota inserita.', { lineGap: 2 });
    doc.font('Helvetica');
    doc.moveDown(0.28);

    doc.fontSize(8).fillColor(COL.label).text('Note sugli allegati');
    doc.moveDown(0.08);
    doc.font('Helvetica').fontSize(10).fillColor(na ? COL.body : COL.whisper);
    if (!na) doc.font('Helvetica-Oblique');
    doc.text(na || 'Nessuna nota inserita.', { lineGap: 2 });
    doc.font('Helvetica');
    doc.moveDown(0.18);
  }

  /* --- Allegati --- */
  writeSectionTitle(doc, 'Allegati');
  if (attachments.length === 0) {
    doc.font('Helvetica-Oblique').fontSize(7.5).fillColor(COL.whisper).text('Nessun allegato registrato.', { lineGap: 1 });
    doc.moveDown(0.12);
  } else {
    attachments.forEach((a, i) => {
      ensureVerticalSpace(doc, 32);
      const tipo = a.tipo || 'documento';
      const nome = a.nome_originale || a.nome_file || 'file';
      const dim = a.dimensione != null ? `${Math.round(a.dimensione / 1024)} KB` : 'n/d';
      const data = formatDateTimeIt(a.created_at);
      doc.fontSize(10).font('Helvetica-Bold').fillColor(COL.body).text(`${i + 1}. ${nome}`, { lineGap: 1 });
      doc.fontSize(8.5).font('Helvetica').fillColor(COL.muted).text(`Tipo: ${tipo} ·   Dimensione: ${dim}   ·   Caricato: ${data}`, {
        lineGap: 1,
      });
      doc.moveDown(0.28);
    });
  }

  const footerLine = `Documento operativo interno generato da FIMASS — ${generatedAt}`;
  placeFooterIfRoom(doc, footerLine);

  doc.end();
}

module.exports = { pipeQuoteSummaryPdf };
