import PDFDocument from 'pdfkit';
import { drawLabel, drawParagraph, hLine, paragraphHeight, type ParagraphStyle } from '../documents/pdf/draw';
import { drawFooter, footerTop } from '../documents/pdf/frame';
import { COLOR, CONTENT_WIDTH, FONT, MARGIN, PAGE, px, registerFonts } from '../documents/pdf/style';
import { b, t } from '../documents/runs';
import type { SummaryBlock, SummaryModel, SummaryRow, SummarySection } from './summary-model';

type Doc = PDFKit.PDFDocument;
type Cursor = { doc: Doc; y: number };

const TEXT: ParagraphStyle = { size: px(8.5), lineHeight: 1.45, align: 'left' };
const LABEL_WIDTH = px(150);
const GAP = px(12);
const VALUE_WIDTH = CONTENT_WIDTH - LABEL_WIDTH - GAP;
const ROW_GAP = px(3);

/** CLUBUL SPORTIV / EDUSPORT and the navy rule, placed as on the Acord (documents/pdf/frame.ts); returns the y below. */
function drawBrand(doc: Doc): number {
  const top = MARGIN.top;
  drawLabel(doc, 'CLUBUL SPORTIV', MARGIN.side, top, { font: FONT.bold, size: px(7.5), color: COLOR.navy, spacing: px(7.5 * 0.34) });
  drawLabel(doc, 'EDUSPORT', MARGIN.side, top + px(13.5), { font: FONT.wordmark, size: px(20), color: COLOR.navy, spacing: px(0.8) });
  const rule = top + px(44.5);
  hLine(doc, MARGIN.side, PAGE.width - MARGIN.side, rule, px(2), COLOR.navy);
  return rule + px(14);
}

function startPage(doc: Doc): Cursor {
  drawFooter(doc);
  return { doc, y: drawBrand(doc) };
}

/** `height` must fit above the footer; otherwise a new page with the same frame. */
function room(c: Cursor, height: number): Cursor {
  if (c.y + height <= footerTop(c.doc)) return c;
  c.doc.addPage({ size: [PAGE.width, PAGE.height], margin: 0 });
  return startPage(c.doc);
}

const rowHeight = (doc: Doc, r: SummaryRow): number =>
  Math.max(paragraphHeight(doc, [b(r.label)], LABEL_WIDTH, TEXT), paragraphHeight(doc, [t(r.value)], VALUE_WIDTH, TEXT)) + ROW_GAP;

function drawRow(c: Cursor, r: SummaryRow): Cursor {
  const height = rowHeight(c.doc, r);
  const at = room(c, height);
  drawParagraph(at.doc, [b(r.label)], { x: MARGIN.side, y: at.y, width: LABEL_WIDTH }, TEXT);
  drawParagraph(at.doc, [t(r.value)], { x: MARGIN.side + LABEL_WIDTH + GAP, y: at.y, width: VALUE_WIDTH }, TEXT);
  return { ...at, y: at.y + height };
}

/** A heading is never left alone at the foot of a page: it needs room for one more row. */
function drawHeading(c: Cursor, text: string, size: number): Cursor {
  const height = size * 1.4 + px(6);
  const at = room(c, height + px(16));
  drawLabel(at.doc, text, MARGIN.side, at.y + px(4), { font: FONT.bold, size, color: COLOR.navy });
  return { ...at, y: at.y + height };
}

function drawBlock(c: Cursor, block: SummaryBlock): Cursor {
  let at = block.heading ? drawHeading(c, block.heading, px(9)) : c;
  for (const r of block.rows) at = drawRow(at, r);
  return at;
}

function drawSection(c: Cursor, section: SummarySection): Cursor {
  let at = drawHeading(c, section.title, px(11));
  for (const block of section.blocks) at = drawBlock(at, block);
  return { ...at, y: at.y + px(6) };
}

function drawSummary(doc: Doc, model: SummaryModel): void {
  let c = drawHeading(startPage(doc), `${model.title}: ${model.name}`, px(13.5));
  for (const section of model.sections) c = drawSection(c, section);
  drawRow(c, { label: '', value: model.footer });
}

/** "rezumat.pdf" (spec 3): the Acord's fonts, wordmark and association footer, on as many A4 pages as needed. */
export function renderSummaryPdf(model: SummaryModel): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: [PAGE.width, PAGE.height], margin: 0, info: { Title: `${model.title}: ${model.name}`, Author: 'Asociația Clubul Sportiv EduSport' } });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
    try {
      registerFonts(doc);
      drawSummary(doc, model);
      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}
