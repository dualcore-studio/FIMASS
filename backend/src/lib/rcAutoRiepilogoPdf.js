const path = require('path');
const PDFDocument = require('pdfkit');

// eslint-disable-next-line import/no-dynamic-require, global-require
const RC_AUTO_GUARANTEE_FIELDS = require(path.join(__dirname, '..', '..', '..', 'shared', 'rcAutoGuaranteeFields.json'));
const RC_AUTO_GUARANTEE_KEY_SET = new Set(Object.keys(RC_AUTO_GUARANTEE_FIELDS));

/** Incrementare quando cambia il layout del PDF: consente rigenerazione automatica su download. */
const RC_AUTO_RIEPILOGO_PDF_TEMPLATE_VERSION = 4;

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
  'telaio',
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

/** Blocco legale in fondo pagina (equivalente a footer con margin-top: auto; non spezzare). */
const INFORM = {
  /** Spazio minimo tra ultimo contenuto e area footer. */
  minGapAfterMain: 8,
  /** Padding sopra la linea (come padding-top sul footer). */
  footerPadTop: 10,
  footerBorderWidth: 0.55,
  footerBorderColor: '#dddddd',
  /** Fascia sotto la linea prima del box arrotondato (evita sovrapposizione al tratto). */
  footerBelowRuleBand: 3,
  pad: 8,
  titleSize: 8,
  bodySize: 6.8,
  lineGap: 2.5,
  titleToBody: 4,
  betweenTexts: 7,
};

/** Chiavi veicolo impaginate nella griglia 3×3 (il resto va in coda su 2 colonne). */
const VEHICLE_GRID_KEYS = new Set([
  'targa',
  'telaio',
  'marca',
  'modello',
  'tipo_veicolo',
  'alimentazione',
  'anno_immatricolazione',
  'tipo_guida',
  'classe_cu',
  'massimale_rc',
]);

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

function isEmptyField(v) {
  return v === undefined || v === null || String(v).trim() === '';
}

function targaTelaioCell(ds, typeRow) {
  const targa = !isEmptyField(ds.targa) ? formatValue(ds.targa) : null;
  const telaio = !isEmptyField(ds.telaio) ? formatValue(ds.telaio) : null;
  const lt = labelForCampo(typeRow, 'targa');
  const ln = labelForCampo(typeRow, 'telaio');
  if (targa && telaio) return `${lt}: ${targa} · ${ln}: ${telaio}`;
  if (targa) return `${lt}: ${targa}`;
  if (telaio) return `${ln}: ${telaio}`;
  return '';
}

function lvLine(typeRow, key, ds) {
  if (!key || isEmptyField(ds[key])) return '';
  return `${labelForCampo(typeRow, key)}: ${formatValue(ds[key])}`;
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

function sectionTitle(doc, title, contentW) {
  const left = doc.page.margins.left;
  doc.moveDown(0.32);
  doc.fontSize(10).font('Helvetica-Bold').fillColor(COL.ink).text(title, left, doc.y, { width: contentW, align: 'left' });
  doc.moveDown(0.1);
  drawRule(doc, { width: 0.4, gapAfter: 0.22 });
  doc.font('Helvetica').fillColor(COL.body);
  doc.x = left;
}

/**
 * Box anagrafica contraente: griglia 2 colonne + indirizzo a tutta larghezza.
 */
function drawAssistitoDataBox(doc, quote, contentW) {
  const pad = 8;
  const colGap = 10;
  const fs = 9;
  const lineGap = 1.25;
  const nome = [quote.assistito_nome, quote.assistito_cognome].filter(Boolean).join(' ').trim() || '—';

  const rows = [
    [`Nome: ${nome}`, `Codice fiscale: ${formatValue(quote.assistito_cf)}`],
    [`Data di nascita: ${formatValue(quote.assistito_data_nascita)}`, `Cellulare: ${formatValue(quote.assistito_cellulare)}`],
    [`Email: ${formatValue(quote.assistito_email)}`, ''],
  ];
  const indLineParts = [quote.assistito_indirizzo, quote.assistito_cap, quote.assistito_citta].filter(Boolean);
  const indLine = indLineParts.length ? `Indirizzo: ${indLineParts.join(' — ')}` : '';

  const innerW = contentW - 2 * pad;
  const colW = (innerW - colGap) / 2;
  const leftX = doc.page.margins.left + pad;

  doc.save();
  doc.font('Helvetica').fontSize(fs);
  let contentH = pad;
  for (const [l, r] of rows) {
    const hL = doc.heightOfString(l, { width: colW, lineGap });
    const hR = r && r.trim() ? doc.heightOfString(r, { width: colW, lineGap }) : 0;
    contentH += Math.max(hL, hR) + 3;
  }
  if (indLine) contentH += doc.heightOfString(indLine, { width: innerW, lineGap }) + 1;
  contentH += pad;
  doc.restore();

  if (doc.y + contentH > pageBottomY(doc)) doc.addPage();

  const boxTop = doc.y;
  doc.save();
  doc
    .roundedRect(doc.page.margins.left, boxTop, contentW, contentH, 3)
    .fill(COL.noteBoxFill)
    .strokeColor(COL.noteBoxStroke)
    .lineWidth(0.45)
    .stroke();
  doc.restore();

  let ty = boxTop + pad;
  doc.font('Helvetica').fontSize(fs).fillColor(COL.body);
  for (const [l, r] of rows) {
    const hL = doc.heightOfString(l, { width: colW, lineGap });
    const hR = r && r.trim() ? doc.heightOfString(r, { width: colW, lineGap }) : 0;
    const rh = Math.max(hL, hR);
    doc.text(l, leftX, ty, { width: colW, lineGap });
    if (r && r.trim()) doc.text(r, leftX + colW + colGap, ty, { width: colW, lineGap });
    ty += rh + 3;
  }
  if (indLine) doc.text(indLine, leftX, ty, { width: innerW, lineGap });

  doc.y = boxTop + contentH + 5;
}

function vehicleGridRowHeight(doc, trip, w3, fs, lineGap) {
  const [a, b, c] = trip;
  const colH = (s) => {
    if (!s || !String(s).trim()) return 0;
    return doc.heightOfString(s, { width: w3, lineGap });
  };
  return Math.max(colH(a), colH(b), colH(c), fs * 0.85);
}

/**
 * Dati veicolo: fino a 3 righe da 3 colonne + eventuali campi extra su 2 colonne.
 */
function drawVehicleDataBox(doc, ds, typeRow, contentW) {
  const pad = 8;
  const g = 6;
  const pairGap = 10;
  const fs = 9;
  const lineGap = 1.2;
  const innerW = contentW - 2 * pad;
  const w3 = (innerW - 2 * g) / 3;
  const leftX = doc.page.margins.left + pad;

  const gridRows = [
    [targaTelaioCell(ds, typeRow), lvLine(typeRow, 'marca', ds), lvLine(typeRow, 'modello', ds)],
    [lvLine(typeRow, 'tipo_veicolo', ds), lvLine(typeRow, 'alimentazione', ds), lvLine(typeRow, 'anno_immatricolazione', ds)],
    [lvLine(typeRow, 'tipo_guida', ds), lvLine(typeRow, 'classe_cu', ds), lvLine(typeRow, 'massimale_rc', ds)],
  ];
  const activeGrid = gridRows.filter((r) => r.some((c) => c && String(c).trim()));

  const remainder = [];
  for (const k of VEICOLO_KEYS) {
    if (k === 'garanzie_selezionate' || k === 'garanzie_richieste') continue;
    if (RC_AUTO_GUARANTEE_KEY_SET.has(k)) continue;
    if (VEHICLE_GRID_KEYS.has(k)) continue;
    if (ds[k] !== undefined && ds[k] !== null && String(ds[k]).trim() !== '') {
      remainder.push({ k, v: ds[k] });
    }
  }

  const colW2 = (innerW - pairGap) / 2;

  doc.save();
  doc.font('Helvetica').fontSize(fs);
  let contentH = pad;
  for (const row of activeGrid) {
    contentH += vehicleGridRowHeight(doc, row, w3, fs, lineGap) + 3;
  }
  for (let i = 0; i < remainder.length; i += 2) {
    const labL = `${labelForCampo(typeRow, remainder[i].k)}: ${formatValue(remainder[i].v)}`;
    const labR = remainder[i + 1] ? `${labelForCampo(typeRow, remainder[i + 1].k)}: ${formatValue(remainder[i + 1].v)}` : '';
    const hL = doc.heightOfString(labL, { width: colW2, lineGap });
    const hR = labR ? doc.heightOfString(labR, { width: colW2, lineGap }) : 0;
    contentH += Math.max(hL, hR) + 3;
  }
  contentH += pad;
  doc.restore();

  if (doc.y + contentH > pageBottomY(doc)) doc.addPage();

  const boxTop = doc.y;
  doc.save();
  doc
    .roundedRect(doc.page.margins.left, boxTop, contentW, contentH, 3)
    .fill(COL.noteBoxFill)
    .strokeColor(COL.noteBoxStroke)
    .lineWidth(0.45)
    .stroke();
  doc.restore();

  let ty = boxTop + pad;
  doc.font('Helvetica').fontSize(fs).fillColor(COL.body);
  for (const row of activeGrid) {
    const [a, b, c] = row;
    const rh = vehicleGridRowHeight(doc, row, w3, fs, lineGap);
    if (a && String(a).trim()) doc.text(a, leftX, ty, { width: w3, lineGap });
    if (b && String(b).trim()) doc.text(b, leftX + w3 + g, ty, { width: w3, lineGap });
    if (c && String(c).trim()) doc.text(c, leftX + 2 * (w3 + g), ty, { width: w3, lineGap });
    ty += rh + 3;
  }
  for (let i = 0; i < remainder.length; i += 2) {
    const labL = `${labelForCampo(typeRow, remainder[i].k)}: ${formatValue(remainder[i].v)}`;
    const labR = remainder[i + 1] ? `${labelForCampo(typeRow, remainder[i + 1].k)}: ${formatValue(remainder[i + 1].v)}` : '';
    const hL = doc.heightOfString(labL, { width: colW2, lineGap });
    const hR = labR ? doc.heightOfString(labR, { width: colW2, lineGap }) : 0;
    const rh = Math.max(hL, hR);
    doc.text(labL, leftX, ty, { width: colW2, lineGap });
    if (labR) doc.text(labR, leftX + colW2 + pairGap, ty, { width: colW2, lineGap });
    ty += rh + 3;
  }

  doc.y = boxTop + contentH + 5;
}

/**
 * Altezza del blocco informativo (privacy + intermediazione), identica al rendering.
 * @param {PDFKit.PDFDocument} doc
 * @param {number} contentW
 */
function informativeInnerBoxHeight(doc, contentW) {
  const innerW = contentW - 2 * INFORM.pad;
  doc.save();
  doc.font('Helvetica-Bold').fontSize(INFORM.titleSize);
  const titleH = doc.heightOfString('Note informative', { width: innerW });
  doc.font('Helvetica').fontSize(INFORM.bodySize);
  const privacyH = doc.heightOfString(PRIVACY, { width: innerW, lineGap: INFORM.lineGap, align: 'justify' });
  const interH = doc.heightOfString(INTERMEDIATION, { width: innerW, lineGap: INFORM.lineGap, align: 'justify' });
  doc.restore();
  return INFORM.pad + titleH + INFORM.titleToBody + privacyH + INFORM.betweenTexts + interH + INFORM.pad;
}

/** Altezza totale footer: padding sopra + bordo + box arrotondato (blocco atomico, page-break-inside: avoid). */
function informativeBlockHeight(doc, contentW) {
  const innerH = informativeInnerBoxHeight(doc, contentW);
  return INFORM.footerPadTop + INFORM.footerBelowRuleBand + innerH;
}

/**
 * Note informative: blocco unico ancorato al fondo pagina (come flex + margin-top: auto); mai spezzato.
 */
function drawInformativeBlock(doc, contentW) {
  const left = doc.page.margins.left;
  const innerW = contentW - 2 * INFORM.pad;
  const totalH = informativeBlockHeight(doc, contentW);

  let footerTop = pageBottomY(doc) - totalH;
  const minTop = doc.y + INFORM.minGapAfterMain;
  if (footerTop < minTop) {
    doc.addPage();
    footerTop = pageBottomY(doc) - totalH;
  }

  doc.save();
  doc.font('Helvetica-Bold').fontSize(INFORM.titleSize);
  const titleH = doc.heightOfString('Note informative', { width: innerW });
  doc.font('Helvetica').fontSize(INFORM.bodySize);
  const privacyH = doc.heightOfString(PRIVACY, { width: innerW, lineGap: INFORM.lineGap, align: 'justify' });
  const interH = doc.heightOfString(INTERMEDIATION, { width: innerW, lineGap: INFORM.lineGap, align: 'justify' });
  doc.restore();

  const innerH = INFORM.pad + titleH + INFORM.titleToBody + privacyH + INFORM.betweenTexts + interH + INFORM.pad;

  const borderY = footerTop + INFORM.footerPadTop;
  doc.save();
  doc.strokeColor(INFORM.footerBorderColor).lineWidth(INFORM.footerBorderWidth);
  doc.moveTo(left, borderY).lineTo(left + contentW, borderY).stroke();
  doc.restore();

  const boxTop = borderY + INFORM.footerBelowRuleBand;

  doc.save();
  doc.roundedRect(left, boxTop, contentW, innerH, 4).fill(COL.noteBoxFill).strokeColor(COL.noteBoxStroke).lineWidth(0.55).stroke();
  doc.restore();

  let ty = boxTop + INFORM.pad;
  doc.font('Helvetica-Bold').fontSize(INFORM.titleSize).fillColor(COL.muted);
  doc.text('Note informative', left + INFORM.pad, ty, { width: innerW, align: 'left' });
  ty += titleH + INFORM.titleToBody;

  doc.font('Helvetica').fontSize(INFORM.bodySize).fillColor(COL.body);
  doc.text(PRIVACY, left + INFORM.pad, ty, { width: innerW, lineGap: INFORM.lineGap, align: 'justify' });
  ty += privacyH + INFORM.betweenTexts;
  doc.text(INTERMEDIATION, left + INFORM.pad, ty, { width: innerW, lineGap: INFORM.lineGap, align: 'justify' });

  doc.y = footerTop + totalH;
  doc.x = left;
}

function notesBoxHeight(doc, contentW, notesText) {
  const marginTop = 8;
  const pad = 8;
  const titleToBody = 5;
  const innerW = contentW - 2 * pad;
  doc.save();
  doc.font('Helvetica-Bold').fontSize(9.5);
  const titleH = doc.heightOfString('Note', { width: innerW });
  doc.font('Helvetica').fontSize(9);
  const bodyH = doc.heightOfString(notesText, { width: innerW, lineGap: 2.5 });
  doc.restore();
  const innerH = pad + titleH + titleToBody + bodyH + pad;
  return marginTop + innerH;
}

function drawNotesBox(doc, contentW, notesText) {
  const marginTop = 8;
  const pad = 8;
  const titleToBody = 5;
  const left = doc.page.margins.left;
  const innerW = contentW - 2 * pad;
  const totalH = notesBoxHeight(doc, contentW, notesText);
  if (doc.y + totalH > pageBottomY(doc)) {
    doc.addPage();
  }

  const boxTop = doc.y + marginTop;
  doc.save();
  doc.font('Helvetica-Bold').fontSize(9.5);
  const titleH = doc.heightOfString('Note', { width: innerW });
  doc.font('Helvetica').fontSize(9);
  const bodyH = doc.heightOfString(notesText, { width: innerW, lineGap: 2.5 });
  doc.restore();
  const innerH = pad + titleH + titleToBody + bodyH + pad;

  doc.save();
  doc.roundedRect(left, boxTop, contentW, innerH, 3).fill(COL.noteBoxFill).strokeColor(COL.noteBoxStroke).lineWidth(0.45).stroke();
  doc.restore();

  let ty = boxTop + pad;
  doc.font('Helvetica-Bold').fontSize(9.5).fillColor(COL.ink);
  doc.text('Note', left + pad, ty, { width: innerW });
  ty += titleH + titleToBody;
  doc.font('Helvetica').fontSize(9).fillColor(COL.body);
  doc.text(notesText, left + pad, ty, { width: innerW, lineGap: 2.5 });

  doc.y = boxTop + innerH + 8;
}

/**
 * Tabella garanzie con header evidenziato, righe leggibili, importi a destra.
 */
function drawGuaranteeTable(doc, rows, contentW) {
  const left = doc.page.margins.left;
  const wName = contentW * 0.68;
  const wPrice = contentW - wName;
  const headerH = 22;
  const rowPadX = 8;
  const rowPadY = 5;
  const minRowH = 19;
  const bodyFs = 9;

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
  doc.font('Helvetica-Bold').fontSize(9).fillColor(COL.ink);
  doc.text('Garanzia', left + rowPadX, y + 7, { width: wName - rowPadX });
  doc.text('Premio', left + wName, y + 7, { width: wPrice - rowPadX, align: 'right' });
  y += headerH;

  doc.font('Helvetica').fontSize(bodyFs).fillColor(COL.body);
  rows.forEach((r, i) => {
    const nome = String(r.nome || '—');
    const nameH = doc.heightOfString(nome, { width: wName - rowPadX, lineGap: 1 });
    const rowH = Math.max(nameH + rowPadY * 2, minRowH);

    ensureSpace(rowH);
    if (i % 2 === 1) {
      doc.save();
      doc.rect(left, y, contentW, rowH).fill(COL.tableRowAlt);
      doc.restore();
    }

    doc.text(nome, left + rowPadX, y + rowPadY, { width: wName - rowPadX, lineGap: 1 });
    doc.font('Helvetica').fontSize(bodyFs).fillColor(COL.body);
    doc.text(formatEuro(r.prezzo), left + wName, y + rowPadY, { width: wPrice - rowPadX, align: 'right' });

    doc.save();
    doc.strokeColor('#e5e7eb').lineWidth(0.35).moveTo(left, y + rowH).lineTo(left + contentW, y + rowH).stroke();
    doc.restore();

    y += rowH;
  });

  doc.y = y + 4;
}

/**
 * Totale in box dedicato, più visibile della tabella.
 */
function drawTotalBox(doc, contentW, totalPrice) {
  doc.moveDown(0.25);
  const pageLeft = doc.page.margins.left;
  const boxW = Math.min(228, Math.floor(contentW * 0.48));
  const boxH = 34;
  const boxLeft = pageLeft + contentW - boxW;
  if (doc.y + boxH > pageBottomY(doc)) {
    doc.addPage();
  }
  const top = doc.y;

  doc.save();
  doc.roundedRect(boxLeft, top, boxW, boxH, 4).fill(COL.totalBg).strokeColor(COL.totalBorder).lineWidth(0.85).stroke();
  doc.restore();

  const textTop = top + 11;
  doc.font('Helvetica-Bold').fontSize(10).fillColor(COL.ink);
  doc.text('Totale', boxLeft + 10, textTop, { width: 72 });
  doc.font('Helvetica-Bold').fontSize(12.5).fillColor(COL.ink);
  doc.text(formatEuro(totalPrice), boxLeft + 10, textTop - 0.5, { width: boxW - 20, align: 'right' });

  doc.y = top + boxH + 8;
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
      margin: 40,
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

    /* Intestazione compatta */
    doc.fontSize(17).font('Helvetica-Bold').fillColor(COL.ink).text('Preventivo RC Auto', { align: 'center', width: contentW });
    doc.moveDown(0.22);
    doc.fontSize(10).font('Helvetica').fillColor(COL.body);
    doc.text(`Pratica / preventivo n. ${quote.numero || quote.id}`, { align: 'center', width: contentW });
    doc.moveDown(0.12);
    doc.fontSize(9).fillColor(COL.muted);
    doc.text(`Data elaborazione: ${formatDateTimeIt(elaborazione.elaboratedAt)}`, { align: 'center', width: contentW });
    doc.moveDown(0.38);
    drawRule(doc, { color: COL.ruleStrong, width: 0.5, gapAfter: 0.28 });

    sectionTitle(doc, 'Contraente / assistito', contentW);
    drawAssistitoDataBox(doc, quote, contentW);

    const ds = quote.dati_specifici && typeof quote.dati_specifici === 'object' ? quote.dati_specifici : {};
    let hasVehicle = false;
    for (const k of VEICOLO_KEYS) {
      if (k === 'garanzie_selezionate' || k === 'garanzie_richieste') continue;
      if (RC_AUTO_GUARANTEE_KEY_SET.has(k)) continue;
      if (ds[k] !== undefined && ds[k] !== null && String(ds[k]).trim() !== '') {
        hasVehicle = true;
        break;
      }
    }
    if (hasVehicle) {
      sectionTitle(doc, 'Dati veicolo e coperture richieste', contentW);
      drawVehicleDataBox(doc, ds, typeRow, contentW);
    }

    sectionTitle(doc, 'Garanzie e premi', contentW);
    const rows = Array.isArray(elaborazione.pricingBreakdown) ? elaborazione.pricingBreakdown : [];
    if (rows.length === 0) {
      doc.fontSize(9).font('Helvetica-Oblique').fillColor(COL.muted).text('Nessuna garanzia selezionata nella richiesta.', {
        lineGap: 2,
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
