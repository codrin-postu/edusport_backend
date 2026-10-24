import { ADEZIUNE_SUBTITLE, ADEZIUNE_TITLE, OFFICE, adeziuneContent, type AdeziuneContent } from '../adeziune-content';
import type { Run } from '../runs';
import type { DocumentValues } from '../types';
import {
  DocumentOverflowError,
  SIG_LABEL,
  SIG_LABEL_LINE,
  bodyGlyphTop,
  drawScaledBody,
  drawTicks,
  drawTitle,
  frameBox,
  type Col,
} from './blocks';
import { drawLabel, drawParagraph, hLine } from './draw';
import { drawFooter, drawHeader, footerTop } from './frame';
import { BODY, COLOR, FONT, MARGIN, px } from './style';

type Doc = PDFKit.PDFDocument;

const BODY_LINE = BODY.size * BODY.lineHeight;
const TEXT = { font: FONT.regular, size: BODY.size, color: COLOR.text };

/** One declaration: empty Da / Nu boxes in a 62px column, the text beside it (mockup .dn). */
function drawDeclaration(doc: Doc, runs: Run[], col: Col, y: number): number {
  const top = y + px(3);
  drawTicks(doc, ['Da', 'Nu'], col.x, top, { box: 9, inner: 3, gap: 8 });
  return drawParagraph(doc, runs, { x: col.x + px(70), y: top, width: col.width - px(70) }) + px(3);
}

/** A small label with a line under it, `space` below the label; returns the y under the line. */
function signatureLine(doc: Doc, label: string, col: Col, y: number, space: number): number {
  drawLabel(doc, label, col.x, y, SIG_LABEL);
  const bottom = y + SIG_LABEL_LINE + space;
  hLine(doc, col.x, col.x + col.width, bottom - px(0.5));
  return bottom;
}

/** Nume (prefilled from the form, or empty), Semnătura and Data, each with its line (mockup .off .sig). */
function drawSignatures(doc: Doc, name: string | null, col: Col, y: number): number {
  if (name) drawLabel(doc, name, col.x, y + SIG_LABEL_LINE + px(1), { font: FONT.bold, size: px(11), color: COLOR.navy });
  let at = signatureLine(doc, 'NUME', col, y, name ? px(11 * 1.4) + px(4) : px(16));
  at = signatureLine(doc, 'SEMNĂTURA', col, at + px(8), px(22));
  return signatureLine(doc, 'DATA', col, at + px(8), px(16));
}

/** "Cererea a fost înregistrată cu nr ___ / ___" across the box's inner width. */
function drawRegisteredRow(doc: Doc, inner: Col, line: number): void {
  const label = drawLabel(doc, OFFICE.registered, inner.x, bodyGlyphTop(line), TEXT);
  const slash = doc.font(FONT.regular).fontSize(BODY.size).widthOfString('/');
  const blank = (inner.width - label - slash - 3 * px(6)) / 2;
  const start = inner.x + label + px(6);
  hLine(doc, start, start + blank, line + px(10));
  drawLabel(doc, '/', start + blank + px(6), bodyGlyphTop(line), TEXT);
  hLine(doc, inner.x + inner.width - blank, inner.x + inner.width, line + px(10));
}

/** The president's box contents, left empty: number, admis / respins, Președinte and a line (mockup .ob). */
function drawOffice(doc: Doc, box: Col, y: number): number {
  const inner = { x: box.x + px(11), width: box.width - px(22) };
  let line = y + px(1) + px(8);
  drawRegisteredRow(doc, inner, line);
  line += BODY_LINE + px(8);
  drawLabel(doc, OFFICE.member, inner.x, bodyGlyphTop(line), TEXT);
  drawTicks(doc, [OFFICE.admitted, OFFICE.rejected], inner.x + px(50), line, { box: 9, inner: 5, gap: 18 });
  line += BODY_LINE + px(8) + px(4);
  drawLabel(doc, OFFICE.president, inner.x, bodyGlyphTop(line), TEXT);
  line += BODY_LINE + px(8) + px(18);
  hLine(doc, inner.x, inner.x + inner.width, line - px(0.5));
  return line + px(8) + px(1);
}

function drawClosing(doc: Doc, name: string | null, col: Col, y: number): number {
  const top = y + px(12);
  const width = (col.width - px(26)) / 2;
  const box = { x: col.x + width + px(26), width };
  const bottom = Math.max(drawSignatures(doc, name, { x: col.x, width }, top), drawOffice(doc, box, top));
  frameBox(doc, box.x, top, box.width, bottom - top); // the box stretches to the signatures' height (CSS grid)
  return bottom;
}

function adeziuneBody(doc: Doc, content: AdeziuneContent, name: string | null, col: Col): number {
  let y = drawParagraph(doc, content.intro, { ...col, y: 0 }) + px(5);
  for (const declaration of content.declarations) y = drawDeclaration(doc, declaration, col, y);
  y = drawParagraph(doc, content.data, { ...col, y: y + px(6) }) + px(5);
  return drawClosing(doc, name, col, y);
}

/** The Cerere de adeziune (adeziune-v2 layout, 4-column footer); `scale` shrinks the body when needed. */
export function drawAdeziune(doc: Doc, values: DocumentValues, scale: number): void {
  const content = adeziuneContent(values);
  const subtitle = drawTitle(doc, ADEZIUNE_TITLE, drawHeader(doc, values), px(2));
  drawLabel(doc, ADEZIUNE_SUBTITLE, MARGIN.side, bodyGlyphTop(subtitle), { font: FONT.bold, size: BODY.size, color: COLOR.navy });
  const top = subtitle + BODY_LINE + px(8);
  const bottom = drawScaledBody(doc, top, scale, (col) => adeziuneBody(doc, content, values.parentName, col));
  if (bottom > footerTop(doc)) throw new DocumentOverflowError('adeziune');
  drawFooter(doc);
}
