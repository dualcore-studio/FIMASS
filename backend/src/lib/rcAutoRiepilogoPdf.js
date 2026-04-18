const path = require('path');
const PDFDocument = require('pdfkit');

// eslint-disable-next-line import/no-dynamic-require, global-require
const RC_AUTO_GUARANTEE_FIELDS = require(path.join(__dirname, '..', '..', '..', 'shared', 'rcAutoGuaranteeFields.json'));
const RC_AUTO_GUARANTEE_KEY_SET = new Set(Object.keys(RC_AUTO_GUARANTEE_FIELDS));

/** Incrementare quando cambia il layout del PDF: consente rigenerazione automatica su download. */
const RC_AUTO_RIEPILOGO_PDF_TEMPLATE_VERSION = 2;

const COL = {
  ink: '#0f172a',
  body: '#334155',
  muted: '#64748b',
  rule: '#cbd5e1',
  ruleStrong: '#94a3b8',
  totalBg: '#e8f0fe',
  totalBorder: '#64748b',
  tableHeaderBg: '#e2e8f0',
  tableRowAlt: '#f8fafc',
  noteBoxFill: '#f8fafc',
  noteBoxStroke: '#cbd5e1',
};

const PRIVACY =
  'Il presente documento ha finalità informativa e riepilogativa dei dati trasmessi e delle garanzie selezionate. Il trattamento dei dati personali avviene nel rispetto della normativa vigente in materia di protezione dei dati personali.';

const INTERMEDIATION =
  "Il servizio di intermediazione assicurativa di FIMASS by Sportello Amico è gestito da Tuo Broker srls, Broker Assicurativo regolamentato dall'IVASS ed iscritto al RUI in data 16/02/2021 con numero B000677151 consultabile sul Registro Unico Intermediari • P.IVA 16028461008 • PEC pectuobroker@pec.it";

const VEICOLO_KEYS = [
  'targa',
  'tipo_veicolo',
  'marca',
  'modello',
  'alimentazione',
  'kw',
  'anno_immatricolazione',
  'valore_veicolo',
  'tipo_guida',
  'classe_cu',
  'attestato_rischio',
  'massimale_rc',
  'tipologia_preventivo_rc',
  'proprietario_diverso',
];

/** Parametri condivisi tra misura e disegno del blocco “Note informative” (stesso flusso, niente ancoraggio al fondo pagina). */
const INFORM = {
  marginTop: 20,
  pad: 12,
  titleSize: 9,
  bodySize: 7.5,
  lineGap: 5,
  titleToBody: 7,
  betweenTexts: 11,
};

function formatValue(val) {
  if (val === null || val === undefined) return '—';
  if (typeof val === 'boolean') return val ? 'Sì' : 'No';
  if (Array.isArray(val)) return val.map((v) => formatValue(v)).join(', ');
  return String(val);
}

function formatEuro(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return '—';
  return new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(x);
}

function formatDateTimeIt(val) {
  if (val == null || val === '') return '—';
  const d = new Date(val);
  if (!Number.isNaN(d.getTime())) {
    return d.toLocaleString('it-IT', { dateStyle: 'short', timeStyle: 'short' });
  }
  return String(val);
}

function humanizeKey(key) {
  return String(key)
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function labelForCampo(typeRow, key) {
  const raw = typeRow?.campi_specifici;
  let campi = raw;
  if (typeof raw === 'string') {
    try {
      campi = JSON.parse(raw);
    } catch {
      campi = null;
    }
  }
  if (!Array.isArray(campi)) return humanizeKey(key);
  const found = campi.find((c) => c && c.nome === key);
  return (found && found.label) || humanizeKey(key);
}

function pageContentWidth(doc) {
  return doc.page.width - doc.page.margins.left - doc.page.margins.right;
}

function pageBottomY(doc) {
  return doc.page.height - doc.page.margins.bottom;
}

function drawRule(doc, opts = {}) {
  const color = opts.color ?? COL.rule;
  const x0 = doc.page.margins.left;
  const x1 = doc.page.width - doc.page.margins.right;
  const y = doc.y;
  doc.save();
  doc.strokeColor(color).lineWidth(opts.width ?? 0.45).moveTo(x0, y).lineTo(x1, y).stroke();
  doc.restore();
  doc.moveDown(opts.gapAfter ?? 0.4);
}

function sectionTitle(doc, title) {
  doc.moveDown(0.55);
  doc.fontSize(11).font('Helvetica-Bold').fillColor(COL.ink).text(title, { align: 'left' });
  doc.moveDown(0.22);
  drawRule(doc, { gapAfter: 0.38 });
  doc.font('Helvetica').fillColor(COL.body);
}

/**
 * Altezza del blocco informativo (privacy + intermediazione), identica al rendering.
 * @param {PDFKit.PDFDocument} doc
 * @param {number} contentW
 */
function informativeBlockHeight(doc, contentW) {
  const innerW = contentW - 2 * INFORM.pad;
  doc.save();
  doc.font('Helvetica-Bold').fontSize(INFORM.titleSize);
  const titleH = doc.heightOfString('Note informative', { width: innerW });
  doc.font('Helvetica').fontSize(INFORM.bodySize);
  const privacyH = doc.heightOfString(PRIVACY, { width: innerW, lineGap: INFORM.lineGap, align: 'justify' });
  const interH = doc.heightOfString(INTERMEDIATION, { width: innerW, lineGap: INFORM.lineGap, align: 'justify' });
  doc.restore();
  const innerH = INFORM.pad + titleH + INFORM.titleToBody + privacyH + INFORM.betweenTexts + interH + INFORM.pad;
  return INFORM.marginTop + innerH;
}

/**
 * Note informative: sempre un unico blocco non spezzato (page break prima se non c’è spazio).
 */
function drawInformativeBlock(doc, contentW) {
  const totalH = informativeBlockHeight(doc, contentW);
  if (doc.y + totalH > pageBottomY(doc)) {
    doc.addPage();
  }

  const left = doc.page.margins.left;
  const innerW = contentW - 2 * INFORM.pad;
  const boxTop = doc.y + INFORM.marginTop;

  doc.save();
  doc.font('Helvetica-Bold').fontSize(INFORM.titleSize);
  const titleH = doc.heightOfString('Note informative', { width: innerW });
  doc.font('Helvetica').fontSize(INFORM.bodySize);
  const privacyH = doc.heightOfString(PRIVACY, { width: innerW, lineGap: INFORM.lineGap, align: 'justify' });
  const interH = doc.heightOfString(INTERMEDIATION, { width: innerW, lineGap: INFORM.lineGap, align: 'justify' });
  doc.restore();

  const innerH = INFORM.pad + titleH + INFORM.titleToBody + privacyH + INFORM.betweenTexts + interH + INFORM.pad;

  doc.save();
  doc.roundedRect(left, boxTop, contentW, innerH, 4).fill(COL.noteBoxFill).strokeColor(COL.noteBoxStroke).lineWidth(0.55).stroke();
  doc.restore();

  let ty = boxTop + INFORM.pad;
  doc.font('Helvetica-Bold').fontSize(INFORM.titleSize).fillColor(COL.muted);
  doc.text('Note informative', left + INFORM.pad, ty, { width: innerW });
  ty += titleH + INFORM.titleToBody;

  doc.font('Helvetica').fontSize(INFORM.bodySize).fillColor(COL.body);
  doc.text(PRIVACY, left + INFORM.pad, ty, { width: innerW, lineGap: INFORM.lineGap, align: 'justify' });
  ty += privacyH + INFORM.betweenTexts;
  doc.text(INTERMEDIATION, left + INFORM.pad, ty, { width: innerW, lineGap: INFORM.lineGap, align: 'justify' });

  doc.y = boxTop + innerH + 10;
}

function notesBoxHeight(doc, contentW, notesText) {
  const marginTop = 16;
  const pad = 12;
  const innerW = contentW - 2 * pad;
  doc.save();
  doc.font('Helvetica-Bold').fontSize(10);
  const titleH = doc.heightOfString('Note', { width: innerW });
  doc.font('Helvetica').fontSize(10);
  const bodyH = doc.heightOfString(notesText, { width: innerW, lineGap: 4 });
  doc.restore();
  const innerH = pad + titleH + 8 + bodyH + pad;
  return marginTop + innerH;
}

function drawNotesBox(doc, contentW, notesText) {
  const marginTop = 16;
  const pad = 12;
  const left = doc.page.margins.left;
  const innerW = contentW - 2 * pad;
  const totalH = notesBoxHeight(doc, contentW, notesText);
  if (doc.y + totalH > pageBottomY(doc)) {
    doc.addPage();
  }

  const boxTop = doc.y + marginTop;
  doc.save();
  doc.font('Helvetica-Bold').fontSize(10);
  const titleH = doc.heightOfString('Note', { width: innerW });
  doc.font('Helvetica').fontSize(10);
  const bodyH = doc.heightOfString(notesText, { width: innerW, lineGap: 4 });
  doc.restore();
  const innerH = pad + titleH + 8 + bodyH + pad;

  doc.save();
  doc.roundedRect(left, boxTop, contentW, innerH, 4).fill(COL.noteBoxFill).strokeColor(COL.noteBoxStroke).lineWidth(0.5).stroke();
  doc.restore();

  let ty = boxTop + pad;
  doc.font('Helvetica-Bold').fontSize(10).fillColor(COL.ink);
  doc.text('Note', left + pad, ty, { width: innerW });
  ty += titleH + 8;
  doc.font('Helvetica').fontSize(10).fillColor(COL.body);
  doc.text(notesText, left + pad, ty, { width: innerW, lineGap: 4 });

  doc.y = boxTop + innerH + 14;
}

/**
 * Tabella garanzie con header evidenziato, righe leggibili, importi a destra.
 */
function drawGuaranteeTable(doc, rows, contentW) {
  const left = doc.page.margins.left;
  const wName = contentW * 0.67;
  const wPrice = contentW - wName;
  const headerH = 28;
  const rowPadX = 12;
  const rowPadY = 9;
  const minRowH = 24;

  let y = doc.y;

  const ensureSpace = (needH) => {
    if (y + needH > pageBottomY(doc)) {
      doc.addPage();
      y = doc.y;
    }
  };

  ensureSpace(headerH);
  doc.save();
  doc.rect(left, y, contentW, headerH).fill(COL.tableHeaderBg);
  doc.restore();
  doc.font('Helvetica-Bold').fontSize(9.5).fillColor(COL.ink);
  doc.text('Garanzia', left + rowPadX, y + 9, { width: wName - rowPadX });
  doc.text('Premio', left + wName, y + 9, { width: wPrice - rowPadX, align: 'right' });
  y += headerH;

  doc.font('Helvetica').fontSize(10).fillColor(COL.body);
  rows.forEach((r, i) => {
    const nome = String(r.nome || '—');
    const nameH = doc.heightOfString(nome, { width: wName - rowPadX });
    const rowH = Math.max(nameH + rowPadY * 2, minRowH);

    ensureSpace(rowH);
    if (i % 2 === 1) {
      doc.save();
      doc.rect(left, y, contentW, rowH).fill(COL.tableRowAlt);
      doc.restore();
    }

    doc.text(nome, left + rowPadX, y + rowPadY, { width: wName - rowPadX });
    doc.font('Helvetica').fontSize(10).fillColor(COL.body);
    doc.text(formatEuro(r.prezzo), left + wName, y + rowPadY, { width: wPrice - rowPadX, align: 'right' });

    doc.save();
    doc.strokeColor('#e5e7eb').lineWidth(0.35).moveTo(left, y + rowH).lineTo(left + contentW, y + rowH).stroke();
    doc.restore();

    y += rowH;
  });

  doc.y = y + 6;
}

/**
 * Totale in box dedicato, più visibile della tabella.
 */
function drawTotalBox(doc, contentW, totalPrice) {
  doc.moveDown(0.45);
  const left = doc.page.margins.left;
  const boxH = 48;
  if (doc.y + boxH > pageBottomY(doc)) {
    doc.addPage();
  }
  const top = doc.y;

  doc.save();
  doc.roundedRect(left, top, contentW, boxH, 5).fill(COL.totalBg).strokeColor(COL.totalBorder).lineWidth(1).stroke();
  doc.restore();

  const textTop = top + 15;
  doc.font('Helvetica-Bold').fontSize(12).fillColor(COL.ink);
  doc.text('Totale', left + 16, textTop, { width: contentW * 0.5 });
  doc.font('Helvetica-Bold').fontSize(15).fillColor(COL.ink);
  doc.text(formatEuro(totalPrice), left + 16, textTop - 1, { width: contentW - 32, align: 'right' });

  doc.y = top + boxH + 14;
}

/**
 * Genera PDF riepilogo RC Auto (senza logo) su stream Writable o Buffer callback.
 * @param {object} params
 * @param {object} params.quote — enrichQuote
 * @param {object} params.typeRow — riga insurance_types da ctx
 * @param {{ pricingBreakdown: { nome: string; prezzo: number }[]; totalPrice: number; notes: string | null; elaboratedAt: string }} params.elaborazione
 * @param {import('stream').Writable | null} params.dest — se null, raccoglie in Buffer
 * @returns {Promise<Buffer | void>}
 */
function pipeRcAutoRiepilogoPdf({ quote, typeRow, elaborazione, dest }) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      margin: 44,
      size: 'A4',
      info: {
        Title: `Preventivo RC Auto — ${quote.numero || quote.id}`,
        Author: 'Portale preventivi',
      },
    });

    const chunks = [];
    if (dest) {
      doc.pipe(dest);
    } else {
      doc.on('data', (c) => chunks.push(c));
    }

    doc.on('error', reject);
    doc.on('end', () => {
      if (!dest) resolve(Buffer.concat(chunks));
      else resolve();
    });

    const contentW = pageContentWidth(doc);

    /* Intestazione */
    doc.fontSize(22).font('Helvetica-Bold').fillColor(COL.ink).text('Preventivo RC Auto', { align: 'center' });
    doc.moveDown(0.5);
    doc.fontSize(11).font('Helvetica').fillColor(COL.body);
    doc.text(`Pratica / preventivo n. ${quote.numero || quote.id}`, { align: 'center', width: contentW });
    doc.moveDown(0.28);
    doc.fontSize(10).fillColor(COL.muted);
    doc.text(`Data elaborazione: ${formatDateTimeIt(elaborazione.elaboratedAt)}`, { align: 'center', width: contentW });
    doc.moveDown(0.65);
    drawRule(doc, { color: COL.ruleStrong, width: 0.55, gapAfter: 0.45 });

    sectionTitle(doc, 'Contraente / assistito');
    const nome = [quote.assistito_nome, quote.assistito_cognome].filter(Boolean).join(' ').trim() || '—';
    doc.fontSize(10).text(`Nome: ${nome}`, { lineGap: 5 });
    doc.text(`Codice fiscale: ${formatValue(quote.assistito_cf)}`, { lineGap: 5 });
    doc.text(`Data di nascita: ${formatValue(quote.assistito_data_nascita)}`, { lineGap: 5 });
    const indirizzo = [quote.assistito_indirizzo, quote.assistito_cap, quote.assistito_citta].filter(Boolean).join(' — ');
    if (indirizzo) doc.text(`Indirizzo: ${indirizzo}`, { lineGap: 5 });
    doc.text(`Cellulare: ${formatValue(quote.assistito_cellulare)}`, { lineGap: 5 });
    doc.text(`Email: ${formatValue(quote.assistito_email)}`, { lineGap: 5 });
    doc.moveDown(0.35);

    const ds = quote.dati_specifici && typeof quote.dati_specifici === 'object' ? quote.dati_specifici : {};
    const veicoloLines = [];
    for (const k of VEICOLO_KEYS) {
      if (k === 'garanzie_selezionate' || k === 'garanzie_richieste') continue;
      if (RC_AUTO_GUARANTEE_KEY_SET.has(k)) continue;
      if (ds[k] !== undefined && ds[k] !== null && String(ds[k]).trim() !== '') {
        veicoloLines.push({ k, v: ds[k] });
      }
    }
    if (veicoloLines.length > 0) {
      sectionTitle(doc, 'Dati veicolo e coperture richieste');
      for (const { k, v } of veicoloLines) {
        const lab = labelForCampo(typeRow, k);
        doc.fontSize(10).text(`${lab}: ${formatValue(v)}`, { lineGap: 4 });
      }
      doc.moveDown(0.35);
    }

    doc.moveDown(0.25);
    sectionTitle(doc, 'Garanzie e premi');
    doc.moveDown(0.15);
    const rows = Array.isArray(elaborazione.pricingBreakdown) ? elaborazione.pricingBreakdown : [];
    if (rows.length === 0) {
      doc.fontSize(10).font('Helvetica-Oblique').fillColor(COL.muted).text('Nessuna garanzia selezionata nella richiesta.', {
        lineGap: 4,
      });
      doc.fillColor(COL.body).font('Helvetica');
    } else {
      drawGuaranteeTable(doc, rows, contentW);
    }

    drawTotalBox(doc, contentW, elaborazione.totalPrice);

    if (elaborazione.notes && String(elaborazione.notes).trim()) {
      drawNotesBox(doc, contentW, String(elaborazione.notes).trim());
    }

    drawInformativeBlock(doc, contentW);

    doc.end();
  });
}

module.exports = {
  pipeRcAutoRiepilogoPdf,
  PRIVACY,
  INTERMEDIATION,
  RC_AUTO_RIEPILOGO_PDF_TEMPLATE_VERSION,
};
