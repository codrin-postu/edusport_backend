import { ASSOCIATION_FOOTER, FOOTER_TITLES } from '../association';
import { t, v, type Run } from '../runs';
import type { DocumentValues } from '../types';
import type { Col } from './blocks';
import { drawLabel, drawParagraph, hLine, measureWith, paragraphHeight, type ParagraphStyle } from './draw';
import { layoutParagraph } from './layout';
import { COLOR, CONTENT_WIDTH, FONT, MARGIN, PAGE, S, px } from './style';

type Doc = PDFKit.PDFDocument;

const META: ParagraphStyle = { size: px(8.5), lineHeight: 1.6, align: 'left', color: COLOR.meta };
const PRE_LINE = px(7.5 * 1.4);
const WORDMARK = px(20);
const HEADER_BLOCK = PRE_LINE + px(3) + WORDMARK;

function lineWidth(doc: Doc, runs: Run[], p: ParagraphStyle): number {
  const line = layoutParagraph(runs, { width: 1e4, measure: measureWith(doc, p.size), align: 'left', valuePad: px(3), scale: S })[0];
  return line.reduce((w, r) => Math.max(w, r.x + r.width), 0);
}

function metaLine(doc: Doc, runs: Run[], lineTop: number): void {
  const width = lineWidth(doc, runs, META);
  drawParagraph(doc, runs, { x: PAGE.width - MARGIN.side - width, y: lineTop, width: width + 1 }, META);
}

/** CLUBUL SPORTIV / EDUSPORT on the left, Sezonul and Nr. înscriere on the right, navy rule below. Returns the y below. */
export function drawHeader(doc: Doc, values: DocumentValues): number {
  const top = MARGIN.top;
  drawLabel(doc, 'CLUBUL SPORTIV', MARGIN.side, top, { font: FONT.bold, size: px(7.5), color: COLOR.navy, spacing: px(7.5 * 0.34) });
  drawLabel(doc, 'EDUSPORT', MARGIN.side, top + PRE_LINE + px(3), { font: FONT.wordmark, size: WORDMARK, color: COLOR.navy, spacing: px(0.8) });
  const metaTop = top + HEADER_BLOCK - 2 * META.size * META.lineHeight;
  metaLine(doc, [t('Sezonul '), v(values.season, 60)], metaTop);
  metaLine(doc, [t('Nr. înscriere '), v(values.registrationNumber, 60)], metaTop + META.size * META.lineHeight);
  const rule = top + HEADER_BLOCK + px(10) + px(1);
  hLine(doc, MARGIN.side, PAGE.width - MARGIN.side, rule, px(2), COLOR.navy);
  return rule + px(1);
}

const COLUMN = { size: px(7.2), lineHeight: 1.5, align: 'left' } as const satisfies ParagraphStyle;
const TITLE_LINE = px(6.6 * 1.4) + px(3);
const LEGAL: ParagraphStyle = { size: px(7), lineHeight: 1.45, align: 'left', color: COLOR.label };
const GAP = px(14);
const FRACTIONS = [1, 1.05, 1, 1.35];

const contactLabelWidth = (doc: Doc) =>
  Math.max(...ASSOCIATION_FOOTER.contact.map(([label]) => doc.font(FONT.bold).fontSize(COLUMN.size).widthOfString(label)));

/** Like CSS grid `1fr 1.05fr 1fr 1.35fr`: Contact never narrower than its longest label + value; the rest share what is left. */
function columnXs(doc: Doc): Col[] {
  const total = FRACTIONS.reduce((a, f) => a + f, 0);
  const free = CONTENT_WIDTH - 3 * GAP;
  const longest = Math.max(...ASSOCIATION_FOOTER.contact.map(([, value]) => doc.font(FONT.regular).fontSize(COLUMN.size).widthOfString(value)));
  const contact = Math.max((FRACTIONS[3] * free) / total, contactLabelWidth(doc) + px(6) + longest);
  const unit = (free - contact) / (total - FRACTIONS[3]);
  const widths = [FRACTIONS[0] * unit, FRACTIONS[1] * unit, FRACTIONS[2] * unit, contact];
  let x = MARGIN.side;
  return widths.map((width) => {
    const col = { x, width };
    x += width + GAP;
    return col;
  });
}

/** Text lines of the first three columns; the fourth (Contact) is label / value rows. */
const TEXT_COLUMNS: string[][] = [[ASSOCIATION_FOOTER.seat], [...ASSOCIATION_FOOTER.registration], [...ASSOCIATION_FOOTER.account]];

function textColumn(doc: Doc, lines: string[], col: Col, top: number, draw: boolean): number {
  let y = top;
  for (const line of lines) {
    y = draw ? drawParagraph(doc, [t(line)], { ...col, y }, COLUMN) : y + paragraphHeight(doc, [t(line)], col.width, COLUMN);
  }
  return y - top;
}

function contactColumn(doc: Doc, col: Col, top: number, draw: boolean): number {
  const labelWidth = contactLabelWidth(doc);
  const valueBox = { x: col.x + labelWidth + px(6), width: col.width - labelWidth - px(6) };
  let y = top;
  for (const [label, value] of ASSOCIATION_FOOTER.contact) {
    if (draw) drawLabel(doc, label, col.x, y + (COLUMN.size * COLUMN.lineHeight - COLUMN.size * 1.21) / 2, { font: FONT.bold, size: COLUMN.size, color: COLOR.navy });
    y = (draw ? drawParagraph(doc, [t(value)], { ...valueBox, y }, COLUMN) : y + paragraphHeight(doc, [t(value)], valueBox.width, COLUMN)) + px(1);
  }
  return y - px(1) - top;
}

function columnsHeight(doc: Doc, top: number, draw: boolean): number {
  const cols = columnXs(doc);
  const heights = TEXT_COLUMNS.map((lines, i) => textColumn(doc, lines, cols[i], top, draw));
  return Math.max(...heights, contactColumn(doc, cols[3], top, draw));
}

function footerHeight(doc: Doc): number {
  const legal = paragraphHeight(doc, [t(ASSOCIATION_FOOTER.legal)], CONTENT_WIDTH, LEGAL);
  return px(10) + px(10) + px(1) + px(8) + TITLE_LINE + columnsHeight(doc, 0, false) + px(8) + legal;
}

/** Top edge of the footer: the body must end above it to keep the page to one A4 sheet. */
export function footerTop(doc: Doc): number {
  return PAGE.height - MARGIN.bottom - footerHeight(doc);
}

/** The 4-column association footer and the O.G. 26/2000 sentence, at the bottom of the page. */
export function drawFooter(doc: Doc): void {
  const rule = footerTop(doc) + px(20);
  hLine(doc, MARGIN.side, PAGE.width - MARGIN.side, rule + px(0.5), px(1), COLOR.rule);
  const titles = rule + px(1) + px(8);
  columnXs(doc).forEach((col, i) =>
    drawLabel(doc, FOOTER_TITLES[i].toUpperCase(), col.x, titles, { font: FONT.bold, size: px(6.6), color: COLOR.label, spacing: px(6.6 * 0.12) }),
  );
  const bottom = titles + TITLE_LINE + columnsHeight(doc, titles + TITLE_LINE, true);
  drawParagraph(doc, [t(ASSOCIATION_FOOTER.legal)], { x: MARGIN.side, y: bottom + px(8), width: CONTENT_WIDTH }, LEGAL);
}
