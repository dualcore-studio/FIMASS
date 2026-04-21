const PDFDocument = require('pdfkit');

/** Incrementare quando cambia il layout del PDF (rigenerazione snapshot pratiche). */
const CASA_RIEPILOGO_PDF_VERSION = 2;

const PAGE_W = 595.28;
const PAGE_H = 841.89;
const MARGIN = 32;
/** Spazio minimo tra ultimo contenuto e linea del footer. */
const GAP_BEFORE_FOOTER = 10;
const COL_GUTTER = 10;

const FOOTER_TITLE_FS = 8;
const FOOTER_BODY_FS = 6.5;
const FOOTER_GAP_AFTER_LINE = 8;

const INTRO =
  'Di seguito il riepilogo delle garanzie incluse nel pacchetto selezionato.';

const INFO_BOX =
  'Le garanzie e i massimali sopra indicati sono quelli previsti dal pacchetto selezionato. Per maggiori dettagli si rimanda alle condizioni di assicurazione.';

const PRIVACY_TITLE = 'Note Privacy';
const PRIVACY_BODY =
  'I dati personali raccolti saranno trattati nel rispetto del Regolamento (UE) 2016/679 (GDPR), esclusivamente per finalità connesse alla presente richiesta e alla successiva gestione del rapporto assicurativo.';

const INTER_TITLE = 'Note sull’intermediazione';
const INTER_BODY =
  "Il servizio di intermediazione assicurativa di FIMASS by Sportello Amico è gestito da Tuo Broker srls, Broker Assicurativo regolamentato dall'IVASS ed iscritto al RUI in data 16/02/2021 con numero B000677151 consultabile sul Registro Unico Intermediari • P.IVA 16028461008 • PEC pectuobroker@pec.it";

function formatPremioIt(euro) {
  const n = Number(euro);
  if (!Number.isFinite(n)) return '—';
  return new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(n);
}

/**
 * Altezza totale footer: linea + titoli + testi (dal bordo inferiore pagina).
 * @param {PDFKit.PDFDocument} doc
 */
function measureFooterTotalHeight(doc, innerW, scale) {
  const colW = (innerW - COL_GUTTER) / 2;
  const titleFs = FOOTER_TITLE_FS * scale;
  const bodyFs = FOOTER_BODY_FS * scale;
  const lineH = 1;
  const gapAfterLine = FOOTER_GAP_AFTER_LINE * scale;
  const gapTitleBody = 4 * scale;

  doc.font('Helvetica-Bold').fontSize(titleFs);
  const hTitle = Math.max(
    doc.heightOfString(PRIVACY_TITLE, { width: colW }),
    doc.heightOfString(INTER_TITLE, { width: colW }),
  );
  doc.font('Helvetica').fontSize(bodyFs);
  const hLeft = doc.heightOfString(PRIVACY_BODY, { width: colW, lineGap: 0.5 });
  const hRight = doc.heightOfString(INTER_BODY, { width: colW, lineGap: 0.5 });
  const hBody = Math.max(hLeft, hRight);

  return lineH + gapAfterLine + hTitle + gapTitleBody + hBody;
}

/**
 * Altezza stimata del corpo principale (da MARGIN in giù), allineata al rendering.
 * @param {PDFKit.PDFDocument} doc
 */
function measureMainBodyHeight(doc, pkg, innerW, scale) {
  const righe = Array.isArray(pkg.righe) ? pkg.righe : [];
  const s = scale;
  const colLabelW = innerW * 0.52;
  const colValW = innerW - colLabelW;
  const halfW = (innerW - COL_GUTTER) / 2;
  const boxPad = 10 * s;
  const leftW = innerW * 0.55 - boxPad;
  const rightW = innerW * 0.42 - boxPad;

  let y = 0;

  doc.font('Helvetica-Bold').fontSize(11 * s);
  y +=
    Math.max(
      doc.heightOfString('FIMASS by Sportello Amico', { width: halfW }),
      doc.heightOfString('Riepilogo Pacchetto Polizza Casa', { width: halfW, align: 'right' }),
    ) +
    6 * s;

  y += 2 * s + 1;

  doc.font('Helvetica').fontSize(9 * s);
  y += doc.heightOfString(INTRO, { width: innerW, lineGap: 1 }) + 8 * s;

  const nome = pkg.nome != null ? String(pkg.nome) : '—';
  const desc =
    pkg.descrizione_breve != null && String(pkg.descrizione_breve).trim()
      ? String(pkg.descrizione_breve).trim()
      : '';

  doc.font('Helvetica').fontSize(8 * s);
  const subH = doc.heightOfString('Pacchetto selezionato', { width: leftW });
  doc.font('Helvetica-Bold').fontSize(14 * s);
  const nameH = doc.heightOfString(nome, { width: leftW });
  doc.font('Helvetica').fontSize(8 * s);
  const descH = desc ? doc.heightOfString(desc, { width: leftW, lineGap: 0.5 }) + 3 * s : 0;

  doc.font('Helvetica').fontSize(8 * s);
  const premioLabelH = doc.heightOfString('Premio finale', { width: rightW, align: 'right' });
  doc.font('Helvetica-Bold').fontSize(18 * s);
  const premioValH = doc.heightOfString(formatPremioIt(pkg.premio_finale_euro), {
    width: rightW,
    align: 'right',
  });
  doc.font('Helvetica').fontSize(7.5 * s);
  const imposteH = doc.heightOfString('(imposte incluse)', { width: rightW, align: 'right' });

  const rightBlockH = subH + 4 * s + premioLabelH + 2 * s + premioValH + 4 * s + imposteH;
  const leftBlockH = subH + 4 * s + nameH + descH;
  y += Math.max(leftBlockH, rightBlockH) + boxPad * 2 + 10 * s;

  doc.font('Helvetica-Bold').fontSize(10 * s);
  y += doc.heightOfString('GARANZIE INCLUSE NEL PACCHETTO', { width: innerW }) + 6 * s;

  const headerFs = 8.5 * s;
  const rowFs = 8.5 * s;
  doc.font('Helvetica-Bold').fontSize(headerFs);
  const headH = Math.max(
    doc.heightOfString('Garanzia', { width: colLabelW - 6 }),
    doc.heightOfString('Massimale / Importo', { width: colValW - 6, align: 'right' }),
  );
  const headBgH = headH + 8 * s;
  y += headBgH;

  const rowPad = 4 * s;
  doc.font('Helvetica').fontSize(rowFs);
  for (const r of righe) {
    const label = r.label != null ? String(r.label) : '';
    const valore = r.valore != null ? String(r.valore) : '';
    const hLabel = doc.heightOfString(label, { width: colLabelW - 8 });
    const hVal = doc.heightOfString(valore, { width: colValW - 8, align: 'right' });
    const rowInner = Math.max(hLabel, hVal, 12 * s);
    y += rowInner + rowPad * 2;
  }

  y += 8 * s;

  doc.font('Helvetica').fontSize(8 * s);
  y += doc.heightOfString(INFO_BOX, { width: innerW, lineGap: 1 }) + 12 * s;

  doc.font('Helvetica-Bold').fontSize(9.5 * s);
  y += doc.heightOfString('Per accettazione', { width: innerW }) + 6 * s;
  doc.font('Helvetica').fontSize(9 * s);
  y += doc.heightOfString('Firma cliente ____________________________', { width: innerW }) + 5 * s;
  y += doc.heightOfString('Data ____________________________', { width: innerW });

  return y;
}

/**
 * Trova scale ∈ [minScale, 1] così che corpo + footer stiano in una pagina.
 * @returns {{ scale: number, footerSeparatorY: number }}
 */
function computeLayoutScale(pkg) {
  const innerW = PAGE_W - 2 * MARGIN;
  let scale = 1;
  const minScale = 0.62;
  const measureDoc = () =>
    new PDFDocument({
      size: 'A4',
      margin: 0,
      bufferPages: false,
    });

  while (scale >= minScale - 1e-6) {
    const doc = measureDoc();
    const footerH = measureFooterTotalHeight(doc, innerW, scale);
    const mainH = measureMainBodyHeight(doc, pkg, innerW, scale);
    const footerSeparatorY = PAGE_H - MARGIN - footerH;
    const maxMainBottom = footerSeparatorY - GAP_BEFORE_FOOTER;
    if (MARGIN + mainH <= maxMainBottom - 2) {
      return { scale, footerSeparatorY };
    }
    scale -= 0.025;
  }

  const doc = measureDoc();
  const footerH = measureFooterTotalHeight(doc, innerW, minScale);
  return { scale: minScale, footerSeparatorY: PAGE_H - MARGIN - footerH };
}

/**
 * PDF riepilogo per il cliente: solo garanzie, massimali e premio finale (nessun logo, brokeraggio, compensi).
 * @param {{ nome: string, premio_finale_euro: number, descrizione_breve?: string, righe: { label: string, valore: string }[] }} pkg
 * @returns {Promise<Buffer>}
 */
function buildCasaPolizzaRiepilogoPdfBuffer(pkg) {
  return new Promise((resolve, reject) => {
    const { scale, footerSeparatorY } = computeLayoutScale(pkg);

    const doc = new PDFDocument({
      size: 'A4',
      margin: MARGIN,
      info: { Title: 'Riepilogo Pacchetto Polizza Casa' },
      autoFirstPage: true,
    });
    const chunks = [];
    doc.on('data', (c) => chunks.push(c));
    doc.on('error', reject);
    doc.on('end', () => resolve(Buffer.concat(chunks)));

    const innerW = PAGE_W - 2 * MARGIN;
    const halfW = (innerW - COL_GUTTER) / 2;
    const colLabelW = innerW * 0.52;
    const colValW = innerW - colLabelW;
    const righe = Array.isArray(pkg.righe) ? pkg.righe : [];
    const s = scale;
    const boxPad = 10 * s;
    const leftW = innerW * 0.55 - boxPad;
    const rightW = innerW * 0.42 - boxPad;

    let y = MARGIN;

    doc.font('Helvetica-Bold').fontSize(11 * s).fillColor('#111827');
    doc.text('FIMASS by Sportello Amico', MARGIN, y, { width: halfW, align: 'left' });
    doc.text('Riepilogo Pacchetto Polizza Casa', MARGIN + halfW + COL_GUTTER, y, {
      width: halfW,
      align: 'right',
    });
    const headH = Math.max(
      doc.heightOfString('FIMASS by Sportello Amico', { width: halfW }),
      doc.heightOfString('Riepilogo Pacchetto Polizza Casa', { width: halfW, align: 'right' }),
    );
    y += headH + 6 * s;

    doc.moveTo(MARGIN, y).lineTo(MARGIN + innerW, y).strokeColor('#cbd5e1').lineWidth(0.45).stroke();
    y += 8 * s;

    doc.font('Helvetica').fontSize(9 * s).fillColor('#1e293b');
    doc.text(INTRO, MARGIN, y, { width: innerW, lineGap: 1 });
    y += doc.heightOfString(INTRO, { width: innerW, lineGap: 1 }) + 8 * s;

    const boxTop = y;
    const leftX = MARGIN + boxPad;
    const rightX = MARGIN + innerW * 0.58;
    const nome = pkg.nome != null ? String(pkg.nome) : '—';
    const desc =
      pkg.descrizione_breve != null && String(pkg.descrizione_breve).trim()
        ? String(pkg.descrizione_breve).trim()
        : '';

    let yL = boxTop + boxPad;
    doc.font('Helvetica').fontSize(8 * s).fillColor('#64748b');
    yL += doc.heightOfString('Pacchetto selezionato', { width: leftW }) + 4 * s;
    doc.font('Helvetica-Bold').fontSize(14 * s).fillColor('#0f172a');
    yL += doc.heightOfString(nome, { width: leftW });
    if (desc) {
      yL += 3 * s;
      doc.font('Helvetica').fontSize(8 * s);
      yL += doc.heightOfString(desc, { width: leftW, lineGap: 0.5 });
    }

    let yR = boxTop + boxPad;
    doc.font('Helvetica').fontSize(8 * s).fillColor('#64748b');
    yR += doc.heightOfString('Premio finale', { width: rightW, align: 'right' }) + 2 * s;
    doc.font('Helvetica-Bold').fontSize(18 * s).fillColor('#0f172a');
    const premioStr = formatPremioIt(pkg.premio_finale_euro);
    yR += doc.heightOfString(premioStr, { width: rightW, align: 'right' }) + 4 * s;
    doc.font('Helvetica').fontSize(7.5 * s).fillColor('#64748b');
    yR += doc.heightOfString('(imposte incluse)', { width: rightW, align: 'right' });

    const boxInnerBottom = Math.max(yL, yR);
    const boxH = boxInnerBottom - boxTop + boxPad;

    doc.roundedRect(MARGIN, boxTop, innerW, boxH, 3).strokeColor('#cbd5e1').lineWidth(0.85).stroke();

    yL = boxTop + boxPad;
    doc.font('Helvetica').fontSize(8 * s).fillColor('#64748b');
    doc.text('Pacchetto selezionato', leftX, yL, { width: leftW });
    yL += doc.heightOfString('Pacchetto selezionato', { width: leftW }) + 4 * s;

    doc.font('Helvetica-Bold').fontSize(14 * s).fillColor('#0f172a');
    doc.text(nome, leftX, yL, { width: leftW });
    yL += doc.heightOfString(nome, { width: leftW });
    if (desc) {
      yL += 3 * s;
      doc.font('Helvetica').fontSize(8 * s).fillColor('#475569');
      doc.text(desc, leftX, yL, { width: leftW, lineGap: 0.5 });
    }

    yR = boxTop + boxPad;
    doc.font('Helvetica').fontSize(8 * s).fillColor('#64748b');
    doc.text('Premio finale', rightX, yR, { width: rightW, align: 'right' });
    yR += doc.heightOfString('Premio finale', { width: rightW, align: 'right' }) + 2 * s;

    doc.font('Helvetica-Bold').fontSize(18 * s).fillColor('#0f172a');
    doc.text(premioStr, rightX, yR, { width: rightW, align: 'right' });
    yR += doc.heightOfString(premioStr, { width: rightW, align: 'right' }) + 4 * s;

    doc.font('Helvetica').fontSize(7.5 * s).fillColor('#64748b');
    doc.text('(imposte incluse)', rightX, yR, { width: rightW, align: 'right' });

    y = boxTop + boxH + 10 * s;

    doc.font('Helvetica-Bold').fontSize(10 * s).fillColor('#0f172a');
    doc.text('GARANZIE INCLUSE NEL PACCHETTO', MARGIN, y, { width: innerW });
    y += doc.heightOfString('GARANZIE INCLUSE NEL PACCHETTO', { width: innerW }) + 6 * s;

    const tableTop = y;
    const headerFs = 8.5 * s;
    const rowFs = 8.5 * s;

    doc.font('Helvetica-Bold').fontSize(headerFs);
    const tableHeadH = Math.max(
      doc.heightOfString('Garanzia', { width: colLabelW - 6 }),
      doc.heightOfString('Massimale / Importo', { width: colValW - 6, align: 'right' }),
    );
    const headBgH = tableHeadH + 8 * s;

    doc.save();
    doc.rect(MARGIN, tableTop, innerW, headBgH).fill('#334155');
    doc.restore();

    doc.fillColor('#f8fafc').font('Helvetica-Bold').fontSize(headerFs);
    doc.text('Garanzia', MARGIN + 6, tableTop + 4 * s, { width: colLabelW - 8 });
    doc.text('Massimale / Importo', MARGIN + colLabelW, tableTop + 4 * s, {
      width: colValW - 8,
      align: 'right',
    });

    y = tableTop + headBgH;
    doc.fillColor('#0f172a').font('Helvetica').fontSize(rowFs);
    const rowPad = 4 * s;

    righe.forEach((r, i) => {
      const label = r.label != null ? String(r.label) : '';
      const valore = r.valore != null ? String(r.valore) : '';
      const hLabel = doc.heightOfString(label, { width: colLabelW - 8 });
      const hVal = doc.heightOfString(valore, { width: colValW - 8, align: 'right' });
      const rowInner = Math.max(hLabel, hVal, 12 * s);
      const rowH = rowInner + rowPad * 2;
      const bg = i % 2 === 0 ? '#f8fafc' : '#ffffff';
      doc.save();
      doc.rect(MARGIN, y, innerW, rowH).fill(bg);
      doc.restore();
      doc.fillColor('#0f172a');
      doc.text(label, MARGIN + 6, y + rowPad, { width: colLabelW - 8 });
      doc.text(valore, MARGIN + colLabelW, y + rowPad, { width: colValW - 8, align: 'right' });
      y += rowH;
    });

    doc.moveTo(MARGIN, y).lineTo(MARGIN + innerW, y).strokeColor('#e2e8f0').lineWidth(0.35).stroke();
    y += 8 * s;

    doc.font('Helvetica').fontSize(8 * s).fillColor('#334155');
    doc.text(INFO_BOX, MARGIN, y, { width: innerW, lineGap: 1 });
    y += doc.heightOfString(INFO_BOX, { width: innerW, lineGap: 1 }) + 12 * s;

    doc.font('Helvetica-Bold').fontSize(9.5 * s).fillColor('#0f172a');
    doc.text('Per accettazione', MARGIN, y, { width: innerW });
    y += doc.heightOfString('Per accettazione', { width: innerW }) + 6 * s;

    doc.font('Helvetica').fontSize(9 * s);
    doc.text('Firma cliente ____________________________', MARGIN, y, { width: innerW });
    y += doc.heightOfString('Firma cliente ____________________________', { width: innerW }) + 5 * s;
    doc.text('Data ____________________________', MARGIN, y, { width: innerW });
    y += doc.heightOfString('Data ____________________________', { width: innerW });

    if (y > footerSeparatorY - GAP_BEFORE_FOOTER) {
      console.warn(
        '[casaPolizzaRiepilogoPdf] Layout overflow: contenuto oltre area riservata al footer. Ridurre dati o aumentare scale min.',
      );
    }

    const colW = (innerW - COL_GUTTER) / 2;
    const titleFs = FOOTER_TITLE_FS * s;
    const bodyFs = FOOTER_BODY_FS * s;
    const gapAfterLine = FOOTER_GAP_AFTER_LINE * s;
    const gapTitleBody = 4 * s;

    doc.font('Helvetica-Bold').fontSize(titleFs);
    const hTitle = Math.max(
      doc.heightOfString(PRIVACY_TITLE, { width: colW }),
      doc.heightOfString(INTER_TITLE, { width: colW }),
    );
    doc.font('Helvetica').fontSize(bodyFs);
    const hBody = Math.max(
      doc.heightOfString(PRIVACY_BODY, { width: colW, lineGap: 0.5 }),
      doc.heightOfString(INTER_BODY, { width: colW, lineGap: 0.5 }),
    );

    doc.moveTo(MARGIN, footerSeparatorY)
      .lineTo(MARGIN + innerW, footerSeparatorY)
      .strokeColor('#cbd5e1')
      .lineWidth(0.45)
      .stroke();

    const yTitles = footerSeparatorY + 1 + gapAfterLine;
    const yBody = yTitles + hTitle + gapTitleBody;

    doc.font('Helvetica-Bold').fontSize(titleFs).fillColor('#334155');
    doc.text(PRIVACY_TITLE, MARGIN, yTitles, { width: colW });
    doc.text(INTER_TITLE, MARGIN + colW + COL_GUTTER, yTitles, { width: colW });

    doc.font('Helvetica').fontSize(bodyFs).fillColor('#475569');
    doc.text(PRIVACY_BODY, MARGIN, yBody, { width: colW, lineGap: 0.5, align: 'left' });
    doc.text(INTER_BODY, MARGIN + colW + COL_GUTTER, yBody, { width: colW, lineGap: 0.5, align: 'left' });

    const footerBottom = yBody + hBody;
    const pageBottomLimit = PAGE_H - MARGIN;
    if (footerBottom > pageBottomLimit + 0.5) {
      console.warn('[casaPolizzaRiepilogoPdf] Footer overflow oltre margine inferiore.');
    }

    doc.end();
  });
}

module.exports = { buildCasaPolizzaRiepilogoPdfBuffer, CASA_RIEPILOGO_PDF_VERSION };
