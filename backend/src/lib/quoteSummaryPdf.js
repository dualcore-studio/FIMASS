const PDFDocument = require('pdfkit');

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

function labelForCampo(typeRow, key) {
  const raw = typeRow?.campi_specifici;
  const campi = parseMaybeJson(raw) || raw;
  if (!Array.isArray(campi)) return humanizeKey(key);
  const found = campi.find((c) => c && c.nome === key);
  return (found && found.label) || humanizeKey(key);
}

function writeHeading(doc, text) {
  doc.moveDown(0.6);
  doc.fontSize(12).font('Helvetica-Bold').fillColor('#0f172a').text(text);
  doc.font('Helvetica').fontSize(10).fillColor('#1e293b');
}

function writeParagraph(doc, text) {
  doc.fontSize(10).font('Helvetica').fillColor('#334155').text(text || '—', {
    align: 'left',
    lineGap: 2,
  });
}

function writeRowsFromObject(doc, obj, labelFn) {
  if (!obj || typeof obj !== 'object' || Object.keys(obj).length === 0) {
    writeParagraph(doc, 'Nessun dato.');
    return;
  }
  for (const [k, v] of Object.entries(obj)) {
    const label = labelFn(k);
    doc.fontSize(9).font('Helvetica-Bold').fillColor('#475569').text(`${label}:`, { continued: true });
    doc.font('Helvetica').text(` ${formatValue(v)}`, { lineGap: 1 });
    doc.moveDown(0.15);
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

  const doc = new PDFDocument({
    margin: 48,
    size: 'A4',
    info: {
      Title: `Pratica ${quote.numero}`,
      Author: 'FIMASS',
    },
  });

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="preventivo-${quote.id}.pdf"`);
  doc.pipe(res);

  doc.fontSize(18).font('Helvetica-Bold').fillColor('#0f172a').text('Riepilogo pratica preventivo', { align: 'center' });
  doc.moveDown(0.3);
  doc.fontSize(11).font('Helvetica').fillColor('#64748b').text(`Documento generato il ${new Date().toLocaleString('it-IT')}`, { align: 'center' });
  doc.moveDown(1);

  writeHeading(doc, 'Identificativi');
  writeParagraph(doc, `Numero pratica: ${quote.numero || '—'}`);
  doc.moveDown(0.2);
  writeParagraph(doc, `Stato: ${quote.stato || '—'}`);
  doc.moveDown(0.2);
  writeParagraph(doc, `Data creazione: ${quote.created_at || '—'}`);
  doc.moveDown(0.2);
  writeParagraph(doc, `Ultimo aggiornamento: ${quote.updated_at || '—'}`);
  doc.moveDown(0.2);
  writeParagraph(doc, `Data decorrenza richiesta: ${quote.data_decorrenza || '—'}`);

  writeHeading(doc, 'Assistito');
  writeParagraph(
    doc,
    [
      [quote.assistito_nome, quote.assistito_cognome].filter(Boolean).join(' ') || '—',
      quote.assistito_cf ? `Codice fiscale: ${quote.assistito_cf}` : null,
      quote.assistito_data_nascita ? `Data di nascita: ${quote.assistito_data_nascita}` : null,
      quote.assistito_cellulare ? `Cellulare: ${quote.assistito_cellulare}` : null,
      quote.assistito_email ? `Email: ${quote.assistito_email}` : null,
      [quote.assistito_indirizzo, quote.assistito_cap, quote.assistito_citta].filter(Boolean).join(' — ') || null,
    ]
      .filter(Boolean)
      .join('\n'),
  );

  writeHeading(doc, 'Tipologia e soggetti');
  writeParagraph(
    doc,
    [
      `Tipologia: ${quote.tipo_nome || '—'} (${quote.tipo_codice || '—'})`,
      `Struttura: ${quote.struttura_nome || '—'}`,
      quote.operatore_id
        ? `Operatore assegnato: ${[quote.operatore_nome, quote.operatore_cognome].filter(Boolean).join(' ') || '—'}`
        : 'Operatore assegnato: —',
    ].join('\n'),
  );

  writeHeading(doc, 'Note della struttura');
  writeParagraph(doc, quote.note_struttura || 'Nessuna nota.');

  writeHeading(doc, 'Note sugli allegati');
  writeParagraph(
    doc,
    quote.note_allegati && String(quote.note_allegati).trim()
      ? String(quote.note_allegati).trim()
      : 'Nessuna nota.',
  );

  writeHeading(doc, 'Dati specifici (caricati con la richiesta)');
  writeRowsFromObject(doc, quote.dati_specifici, (k) => labelForCampo(typeRow, k));

  writeHeading(doc, 'Dati preventivo');
  writeRowsFromObject(doc, quote.dati_preventivo, humanizeKey);

  writeHeading(doc, 'Allegati e documenti');
  if (attachments.length === 0) {
    writeParagraph(doc, 'Nessun allegato registrato.');
  } else {
    attachments.forEach((a, i) => {
      const tipo = a.tipo || 'documento';
      const nome = a.nome_originale || a.nome_file || 'file';
      const dim = a.dimensione != null ? `${Math.round(a.dimensione / 1024)} KB` : 'n/d';
      const data = a.created_at || '—';
      doc
        .fontSize(9)
        .font('Helvetica')
        .fillColor('#334155')
        .text(`${i + 1}. ${nome}`, { continued: false });
      doc.fontSize(8).fillColor('#64748b').text(`   Tipo: ${tipo} · Dimensione: ${dim} · Caricato: ${data}`);
      doc.moveDown(0.25);
    });
  }

  doc.moveDown(1.5);
  doc.fontSize(8).fillColor('#94a3b8').text('Documento informativo generato automaticamente da FIMASS.', { align: 'center' });

  doc.end();
}

module.exports = { pipeQuoteSummaryPdf };
