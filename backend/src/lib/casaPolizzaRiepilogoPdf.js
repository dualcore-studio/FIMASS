const PDFDocument = require('pdfkit');

/** Incrementare quando cambia il layout del PDF (rigenerazione snapshot pratiche). */
const CASA_RIEPILOGO_PDF_VERSION = 3;

const PAGE_W = 595.28;
const PAGE_H = 841.89;
const MARGIN = 36;
/** Spazio minimo tra ultimo contenuto e linea del footer. */
const GAP_BEFORE_FOOTER = 14;
const COL_GUTTER = 12;
/** Più respiro tra le due colonne del footer (privacy / intermediazione). */
const FOOTER_COL_GUTTER = 16;

const FOOTER_TITLE_FS = 8;
const FOOTER_BODY_FS = 6.5;
const FOOTER_GAP_AFTER_LINE = 12;
/** Spazio titolo → corpo nei blocchi footer. */
const FOOTER_TITLE_BODY_GAP = 5;

/** Padding box pacchetto (moltiplicato per scale nel rendering). */
const BOX_PAD_BASE = 13;
/** Inizio colonna destra (premio): più a destra = più aria tra nome e premio. */
const PACKAGE_RIGHT_COL_START = 0.61;
/** Spazio esplicito tra le due colonne nel box pacchetto. */
const PACKAGE_MIDDLE_GAP = 10;

const FS_BRAND = 10;
const FS_DOC_TITLE = 12;
const FS_INTRO = 9;
const FS_PKG_LABEL = 7.5;
const FS_PKG_NAME = 15;
const FS_PKG_DESC = 8;
const FS_PREMIO_LABEL = 8;
const FS_PREMIO_VALUE = 19;
const FS_PREMIO_NOTE = 7.5;
const FS_SECTION_GARANZIE = 10.5;
const FS_TABLE_HEAD = 8.5;
const FS_TABLE_ROW = 8.5;
const FS_INFO = 8;
const FS_SIGN_TITLE = 9.5;
const FS_SIGN_LINE = 9;

/** Moltiplicatori di scale: coerenti tra misura e disegno. */
const GAP = {
  afterHeader: 10,
  afterHeaderRule: 10,
  afterIntro: 14,
  afterPackageBox: 16,
  afterGaranzieTitle: 10,
  tableHeaderPadV: 5,
  tableRowPad: 5.5,
  afterTableRule: 14,
  infoPadX: 11,
  infoPadY: 10,
  afterInfoBox: 18,
  signAfterTitle: 8,
  signBetweenLines: 7,
};

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
  const colW = (innerW - FOOTER_COL_GUTTER) / 2;
  const titleFs = FOOTER_TITLE_FS * scale;
  const bodyFs = FOOTER_BODY_FS * scale;
  const lineH = 1;
  const gapAfterLine = FOOTER_GAP_AFTER_LINE * scale;
  const gapTitleBody = FOOTER_TITLE_BODY_GAP * scale;

  doc.font('Helvetica-Bold').fontSize(titleFs);
  const hTitle = Math.max(
    doc.heightOfString(PRIVACY_TITLE, { width: colW }),
    doc.heightOfString(INTER_TITLE, { width: colW }),
  );
  doc.font('Helvetica').fontSize(bodyFs);
  const hLeft = doc.heightOfString(PRIVACY_BODY, { width: colW, lineGap: 0.75 });
  const hRight = doc.heightOfString(INTER_BODY, { width: colW, lineGap: 0.75 });
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
  const colLabelW = innerW * 0.53;
  const colValW = innerW - colLabelW;
  const halfW = (innerW - COL_GUTTER) / 2;
  const boxPad = BOX_PAD_BASE * s;
  const rightXOff = innerW * PACKAGE_RIGHT_COL_START;
  const leftW = rightXOff - PACKAGE_MIDDLE_GAP * s - boxPad;
  const rightW = innerW - boxPad - rightXOff;
  const gapLabelToName = 5 * s;
  const gapAfterPremioLabel = 5 * s;
  const gapBeforeImposte = 6 * s;
  const gapBeforeDesc = 4 * s;

  let y = 0;

  doc.font('Helvetica-Bold').fontSize(FS_BRAND * s);
  const hBrand = doc.heightOfString('FIMASS by Sportello Amico', { width: halfW });
  doc.font('Helvetica-Bold').fontSize(FS_DOC_TITLE * s);
  const hDocTitle = doc.heightOfString('Riepilogo Pacchetto Polizza Casa', {
    width: halfW,
    align: 'right',
    characterSpacing: 0.15,
  });
  y += Math.max(hBrand, hDocTitle) + GAP.afterHeader * s;

  y += 2 * s + 1;

  doc.font('Helvetica').fontSize(FS_INTRO * s);
  y += doc.heightOfString(INTRO, { width: innerW, lineGap: 1.25 }) + GAP.afterIntro * s;

  const nome = pkg.nome != null ? String(pkg.nome) : '—';
  const desc =
    pkg.descrizione_breve != null && String(pkg.descrizione_breve).trim()
      ? String(pkg.descrizione_breve).trim()
      : '';

  doc.font('Helvetica').fontSize(FS_PKG_LABEL * s);
  const subH = doc.heightOfString('Pacchetto selezionato', { width: leftW });
  doc.font('Helvetica-Bold').fontSize(FS_PKG_NAME * s);
  const nameH = doc.heightOfString(nome, { width: leftW });
  doc.font('Helvetica').fontSize(FS_PKG_DESC * s);
  const descH = desc
    ? gapBeforeDesc + doc.heightOfString(desc, { width: leftW, lineGap: 0.75 })
    : 0;

  doc.font('Helvetica').fontSize(FS_PREMIO_LABEL * s);
  const premioLabelH = doc.heightOfString('Premio finale', { width: rightW, align: 'right' });
  doc.font('Helvetica-Bold').fontSize(FS_PREMIO_VALUE * s);
  const premioValH = doc.heightOfString(formatPremioIt(pkg.premio_finale_euro), {
    width: rightW,
    align: 'right',
  });
  doc.font('Helvetica').fontSize(FS_PREMIO_NOTE * s);
  const imposteH = doc.heightOfString('(imposte incluse)', { width: rightW, align: 'right' });

  const leftBlockH = subH + gapLabelToName + nameH + descH;
  const rightBlockH =
    premioLabelH + gapAfterPremioLabel + premioValH + gapBeforeImposte + imposteH;
  y += Math.max(leftBlockH, rightBlockH) + boxPad * 2 + GAP.afterPackageBox * s;

  doc.font('Helvetica-Bold').fontSize(FS_SECTION_GARANZIE * s);
  y +=
    doc.heightOfString('GARANZIE INCLUSE NEL PACCHETTO', {
      width: innerW,
      characterSpacing: 0.35,
    }) + GAP.afterGaranzieTitle * s;

  const headerFs = FS_TABLE_HEAD * s;
  const rowFs = FS_TABLE_ROW * s;
  doc.font('Helvetica-Bold').fontSize(headerFs);
  const headH = Math.max(
    doc.heightOfString('Garanzia', { width: colLabelW - 10 }),
    doc.heightOfString('Massimale / Importo', { width: colValW - 10, align: 'right' }),
  );
  const headBgH = headH + 2 * GAP.tableHeaderPadV * s;
  y += headBgH;

  const rowPad = GAP.tableRowPad * s;
  doc.font('Helvetica').fontSize(rowFs);
  for (const r of righe) {
    const label = r.label != null ? String(r.label) : '';
    const valore = r.valore != null ? String(r.valore) : '';
    const hLabel = doc.heightOfString(label, { width: colLabelW - 10 });
    const hVal = doc.heightOfString(valore, { width: colValW - 10, align: 'right' });
    const rowInner = Math.max(hLabel, hVal, 12 * s);
    y += rowInner + rowPad * 2;
  }

  y += GAP.afterTableRule * s;

  const infoPadX = GAP.infoPadX * s;
  const infoTextW = innerW - 2 * infoPadX;
  doc.font('Helvetica').fontSize(FS_INFO * s);
  y +=
    GAP.infoPadY * s +
    doc.heightOfString(INFO_BOX, { width: infoTextW, lineGap: 1.15 }) +
    GAP.infoPadY * s +
    GAP.afterInfoBox * s;

  doc.font('Helvetica-Bold').fontSize(FS_SIGN_TITLE * s);
  y += doc.heightOfString('Per accettazione', { width: innerW }) + GAP.signAfterTitle * s;
  doc.font('Helvetica').fontSize(FS_SIGN_LINE * s);
  y +=
    doc.heightOfString('Firma cliente ____________________________', { width: innerW }) +
    GAP.signBetweenLines * s;
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
    const colLabelW = innerW * 0.53;
    const colValW = innerW - colLabelW;
    const righe = Array.isArray(pkg.righe) ? pkg.righe : [];
    const s = scale;
    const boxPad = BOX_PAD_BASE * s;
    const rightX = MARGIN + innerW * PACKAGE_RIGHT_COL_START;
    const leftX = MARGIN + boxPad;
    const leftW = rightX - leftX - PACKAGE_MIDDLE_GAP * s;
    const rightW = MARGIN + innerW - boxPad - rightX;
    const gapLabelToName = 5 * s;
    const gapAfterPremioLabel = 5 * s;
    const gapBeforeImposte = 6 * s;
    const gapBeforeDesc = 4 * s;

    let y = MARGIN;

    doc.font('Helvetica-Bold').fontSize(FS_BRAND * s).fillColor('#334155');
    doc.text('FIMASS by Sportello Amico', MARGIN, y, { width: halfW, align: 'left' });
    doc.font('Helvetica-Bold')
      .fontSize(FS_DOC_TITLE * s)
      .fillColor('#0f172a')
      .text('Riepilogo Pacchetto Polizza Casa', MARGIN + halfW + COL_GUTTER, y, {
        width: halfW,
        align: 'right',
        characterSpacing: 0.15,
      });
    const headH = Math.max(
      doc.heightOfString('FIMASS by Sportello Amico', { width: halfW }),
      doc.heightOfString('Riepilogo Pacchetto Polizza Casa', {
        width: halfW,
        align: 'right',
        characterSpacing: 0.15,
      }),
    );
    y += headH + GAP.afterHeader * s;

    doc.moveTo(MARGIN, y).lineTo(MARGIN + innerW, y).strokeColor('#94a3b8').lineWidth(0.55).stroke();
    y += GAP.afterHeaderRule * s;

    doc.font('Helvetica').fontSize(FS_INTRO * s).fillColor('#1e293b');
    doc.text(INTRO, MARGIN, y, { width: innerW, lineGap: 1.25 });
    y += doc.heightOfString(INTRO, { width: innerW, lineGap: 1.25 }) + GAP.afterIntro * s;

    const boxTop = y;
    const nome = pkg.nome != null ? String(pkg.nome) : '—';
    const desc =
      pkg.descrizione_breve != null && String(pkg.descrizione_breve).trim()
        ? String(pkg.descrizione_breve).trim()
        : '';

    let yL = boxTop + boxPad;
    doc.font('Helvetica').fontSize(FS_PKG_LABEL * s).fillColor('#64748b');
    yL += doc.heightOfString('Pacchetto selezionato', { width: leftW }) + gapLabelToName;
    doc.font('Helvetica-Bold').fontSize(FS_PKG_NAME * s).fillColor('#0f172a');
    yL += doc.heightOfString(nome, { width: leftW });
    if (desc) {
      yL += gapBeforeDesc;
      doc.font('Helvetica').fontSize(FS_PKG_DESC * s);
      yL += doc.heightOfString(desc, { width: leftW, lineGap: 0.75 });
    }

    let yR = boxTop + boxPad;
    doc.font('Helvetica').fontSize(FS_PREMIO_LABEL * s).fillColor('#64748b');
    yR += doc.heightOfString('Premio finale', { width: rightW, align: 'right' }) + gapAfterPremioLabel;
    doc.font('Helvetica-Bold').fontSize(FS_PREMIO_VALUE * s).fillColor('#0B4EA2');
    const premioStr = formatPremioIt(pkg.premio_finale_euro);
    yR += doc.heightOfString(premioStr, { width: rightW, align: 'right' }) + gapBeforeImposte;
    doc.font('Helvetica').fontSize(FS_PREMIO_NOTE * s).fillColor('#64748b');
    yR += doc.heightOfString('(imposte incluse)', { width: rightW, align: 'right' });

    const boxInnerBottom = Math.max(yL, yR);
    const boxH = boxInnerBottom - boxTop + boxPad;

    doc.save();
    doc.roundedRect(MARGIN, boxTop, innerW, boxH, 4).fill('#f8fafc');
    doc.restore();
    doc.roundedRect(MARGIN, boxTop, innerW, boxH, 4).strokeColor('#cbd5e1').lineWidth(0.85).stroke();

    yL = boxTop + boxPad;
    doc.font('Helvetica').fontSize(FS_PKG_LABEL * s).fillColor('#64748b');
    doc.text('Pacchetto selezionato', leftX, yL, { width: leftW });
    yL += doc.heightOfString('Pacchetto selezionato', { width: leftW }) + gapLabelToName;

    doc.font('Helvetica-Bold').fontSize(FS_PKG_NAME * s).fillColor('#0f172a');
    doc.text(nome, leftX, yL, { width: leftW });
    yL += doc.heightOfString(nome, { width: leftW });
    if (desc) {
      yL += gapBeforeDesc;
      doc.font('Helvetica').fontSize(FS_PKG_DESC * s).fillColor('#475569');
      doc.text(desc, leftX, yL, { width: leftW, lineGap: 0.75 });
    }

    yR = boxTop + boxPad;
    doc.font('Helvetica').fontSize(FS_PREMIO_LABEL * s).fillColor('#64748b');
    doc.text('Premio finale', rightX, yR, { width: rightW, align: 'right' });
    yR += doc.heightOfString('Premio finale', { width: rightW, align: 'right' }) + gapAfterPremioLabel;

    doc.font('Helvetica-Bold').fontSize(FS_PREMIO_VALUE * s).fillColor('#0B4EA2');
    doc.text(premioStr, rightX, yR, { width: rightW, align: 'right' });
    yR += doc.heightOfString(premioStr, { width: rightW, align: 'right' }) + gapBeforeImposte;

    doc.font('Helvetica').fontSize(FS_PREMIO_NOTE * s).fillColor('#64748b');
    doc.text('(imposte incluse)', rightX, yR, { width: rightW, align: 'right' });

    y = boxTop + boxH + GAP.afterPackageBox * s;

    doc.font('Helvetica-Bold').fontSize(FS_SECTION_GARANZIE * s).fillColor('#0f172a');
    doc.text('GARANZIE INCLUSE NEL PACCHETTO', MARGIN, y, {
      width: innerW,
      characterSpacing: 0.35,
    });
    y +=
      doc.heightOfString('GARANZIE INCLUSE NEL PACCHETTO', {
        width: innerW,
        characterSpacing: 0.35,
      }) + GAP.afterGaranzieTitle * s;

    const tableTop = y;
    const headerFs = FS_TABLE_HEAD * s;
    const rowFs = FS_TABLE_ROW * s;

    doc.font('Helvetica-Bold').fontSize(headerFs);
    const tableHeadH = Math.max(
      doc.heightOfString('Garanzia', { width: colLabelW - 10 }),
      doc.heightOfString('Massimale / Importo', { width: colValW - 10, align: 'right' }),
    );
    const headBgH = tableHeadH + 2 * GAP.tableHeaderPadV * s;
    const headerTextY = tableTop + GAP.tableHeaderPadV * s;

    doc.save();
    doc.rect(MARGIN, tableTop, innerW, headBgH).fill('#1e293b');
    doc.restore();

    doc.fillColor('#f8fafc').font('Helvetica-Bold').fontSize(headerFs);
    doc.text('Garanzia', MARGIN + 10, headerTextY, { width: colLabelW - 12 });
    doc.text('Massimale / Importo', MARGIN + colLabelW, headerTextY, {
      width: colValW - 12,
      align: 'right',
    });

    y = tableTop + headBgH;
    doc.fillColor('#0f172a').font('Helvetica').fontSize(rowFs);
    const rowPad = GAP.tableRowPad * s;
    const cellPadL = 10;

    righe.forEach((r, i) => {
      const label = r.label != null ? String(r.label) : '';
      const valore = r.valore != null ? String(r.valore) : '';
      const hLabel = doc.heightOfString(label, { width: colLabelW - 12 });
      const hVal = doc.heightOfString(valore, { width: colValW - 12, align: 'right' });
      const rowInner = Math.max(hLabel, hVal, 12 * s);
      const rowH = rowInner + rowPad * 2;
      const bg = i % 2 === 0 ? '#f8fafc' : '#ffffff';
      doc.save();
      doc.rect(MARGIN, y, innerW, rowH).fill(bg);
      doc.restore();
      doc.fillColor('#0f172a');
      doc.text(label, MARGIN + cellPadL, y + rowPad, { width: colLabelW - 12 });
      doc.text(valore, MARGIN + colLabelW, y + rowPad, { width: colValW - 12, align: 'right' });
      y += rowH;
    });

    doc.moveTo(MARGIN, y).lineTo(MARGIN + innerW, y).strokeColor('#cbd5e1').lineWidth(0.5).stroke();
    y += GAP.afterTableRule * s;

    const infoPadX = GAP.infoPadX * s;
    const infoPadY = GAP.infoPadY * s;
    const infoTextW = innerW - 2 * infoPadX;
    doc.font('Helvetica').fontSize(FS_INFO * s);
    const infoTextH = doc.heightOfString(INFO_BOX, { width: infoTextW, lineGap: 1.15 });
    const infoH = infoPadY + infoTextH + infoPadY;
    const infoTop = y;
    doc.save();
    doc.roundedRect(MARGIN, infoTop, innerW, infoH, 4).fill('#f1f5f9');
    doc.restore();
    doc.roundedRect(MARGIN, infoTop, innerW, infoH, 4).strokeColor('#e2e8f0').lineWidth(0.55).stroke();
    doc.fillColor('#334155');
    doc.text(INFO_BOX, MARGIN + infoPadX, infoTop + infoPadY, { width: infoTextW, lineGap: 1.15 });
    y = infoTop + infoH + GAP.afterInfoBox * s;

    doc.font('Helvetica-Bold').fontSize(FS_SIGN_TITLE * s).fillColor('#0f172a');
    doc.text('Per accettazione', MARGIN, y, { width: innerW });
    y += doc.heightOfString('Per accettazione', { width: innerW }) + GAP.signAfterTitle * s;

    doc.font('Helvetica').fontSize(FS_SIGN_LINE * s).fillColor('#1e293b');
    doc.text('Firma cliente ____________________________', MARGIN, y, { width: innerW });
    y +=
      doc.heightOfString('Firma cliente ____________________________', { width: innerW }) +
      GAP.signBetweenLines * s;
    doc.text('Data ____________________________', MARGIN, y, { width: innerW });
    y += doc.heightOfString('Data ____________________________', { width: innerW });

    if (y > footerSeparatorY - GAP_BEFORE_FOOTER) {
      console.warn(
        '[casaPolizzaRiepilogoPdf] Layout overflow: contenuto oltre area riservata al footer. Ridurre dati o aumentare scale min.',
      );
    }

    const colW = (innerW - FOOTER_COL_GUTTER) / 2;
    const titleFs = FOOTER_TITLE_FS * s;
    const bodyFs = FOOTER_BODY_FS * s;
    const gapAfterLine = FOOTER_GAP_AFTER_LINE * s;
    const gapTitleBody = FOOTER_TITLE_BODY_GAP * s;

    doc.font('Helvetica-Bold').fontSize(titleFs);
    const hTitle = Math.max(
      doc.heightOfString(PRIVACY_TITLE, { width: colW }),
      doc.heightOfString(INTER_TITLE, { width: colW }),
    );
    doc.font('Helvetica').fontSize(bodyFs);
    const hBody = Math.max(
      doc.heightOfString(PRIVACY_BODY, { width: colW, lineGap: 0.75 }),
      doc.heightOfString(INTER_BODY, { width: colW, lineGap: 0.75 }),
    );

    doc.moveTo(MARGIN, footerSeparatorY)
      .lineTo(MARGIN + innerW, footerSeparatorY)
      .strokeColor('#64748b')
      .lineWidth(0.9)
      .stroke();

    const yTitles = footerSeparatorY + 1 + gapAfterLine;
    const yBody = yTitles + hTitle + gapTitleBody;

    doc.font('Helvetica-Bold').fontSize(titleFs).fillColor('#475569');
    doc.text(PRIVACY_TITLE, MARGIN, yTitles, { width: colW });
    doc.text(INTER_TITLE, MARGIN + colW + FOOTER_COL_GUTTER, yTitles, { width: colW });

    doc.font('Helvetica').fontSize(bodyFs).fillColor('#64748b');
    doc.text(PRIVACY_BODY, MARGIN, yBody, { width: colW, lineGap: 0.75, align: 'left' });
    doc.text(INTER_BODY, MARGIN + colW + FOOTER_COL_GUTTER, yBody, {
      width: colW,
      lineGap: 0.75,
      align: 'left',
    });

    const footerBottom = yBody + hBody;
    const pageBottomLimit = PAGE_H - MARGIN;
    if (footerBottom > pageBottomLimit + 0.5) {
      console.warn('[casaPolizzaRiepilogoPdf] Footer overflow oltre margine inferiore.');
    }

    doc.end();
  });
}

module.exports = { buildCasaPolizzaRiepilogoPdfBuffer, CASA_RIEPILOGO_PDF_VERSION };
