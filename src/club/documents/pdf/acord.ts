import { ACORD_TITLE, acordContent, type AcordContent, type Clause } from '../acord-content';
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
import { drawLabel, drawParagraph, hLine, paragraphHeight } from './draw';
import { drawFooter, drawHeader, footerTop } from './frame';
import { BODY, COLOR, FONT, px } from './style';

type Doc = PDFKit.PDFDocument;

function drawClause(doc: Doc, clause: Clause, col: Col, y: number): number {
  const top = y + px(2);
  drawLabel(doc, clause.letter, col.x, bodyGlyphTop(top), { font: FONT.extraBold, size: BODY.size, color: COLOR.letter });
  return drawParagraph(doc, clause.runs, { x: col.x + px(19), y: top, width: col.width - px(19) }) + px(2);
}

function drawClauses(doc: Doc, clauses: Clause[], col: Col, y: number): number {
  let bottom = y + px(6);
  for (const clause of clauses) bottom = drawClause(doc, clause, col, bottom);
  return bottom + px(8);
}

/** Marketing consent in a frame: real Da / Nu boxes, left empty for paper (mockup .cons). */
function drawMarketing(doc: Doc, runs: Run[], col: Col, y: number): number {
  const top = y + px(4);
  const inner = top + px(1) + px(6);
  const textX = drawTicks(doc, ['Da', 'Nu'], col.x + px(1) + px(8), inner, { box: 10, inner: 4, gap: 8 });
  const width = col.x + col.width - px(1) - px(8) - textX;
  drawParagraph(doc, runs, { x: textX, y: inner, width });
  const bottom = inner + paragraphHeight(doc, runs, width) + px(6) + px(1);
  frameBox(doc, col.x, top, col.width, bottom - top);
  return bottom + px(8);
}

/** Data (filled, or a blank line on the blank form) and Semnătura with its line (mockup .sig). */
function drawSignature(doc: Doc, date: string | null, col: Col, y: number): number {
  const top = y + px(10);
  const right = col.x + (col.width - px(30)) / 2.6 + px(30);
  const below = top + SIG_LABEL_LINE;
  drawLabel(doc, 'DATA', col.x, top, SIG_LABEL);
  drawLabel(doc, 'SEMNĂTURA', right, top, SIG_LABEL);
  if (date) drawLabel(doc, date, col.x, below + px(1), { font: FONT.bold, size: px(11), color: COLOR.navy });
  else hLine(doc, col.x, col.x + px(60), below + px(10));
  hLine(doc, right, col.x + col.width, below + px(22) - px(0.5));
  return below + px(22);
}

function acordBody(doc: Doc, content: AcordContent, date: string | null, col: Col): number {
  let y = drawParagraph(doc, content.intro, { ...col, y: 0 }) + px(5);
  y = drawParagraph(doc, content.consent, { ...col, y }) + px(5);
  y = drawClauses(doc, content.clauses, col, y);
  y = drawMarketing(doc, content.marketing, col, y);
  y = drawParagraph(doc, content.closing, { ...col, y }) + px(5);
  return drawSignature(doc, date, col, y);
}

/** The Acord (document-v4 layout, 4-column footer); `scale` shrinks the body when it would not fit one page. */
export function drawAcord(doc: Doc, values: DocumentValues, scale: number): void {
  const content = acordContent(values);
  const top = drawTitle(doc, ACORD_TITLE, drawHeader(doc, values), px(8));
  const bottom = drawScaledBody(doc, top, scale, (col) => acordBody(doc, content, values.date, col));
  if (bottom > footerTop(doc)) throw new DocumentOverflowError('acord');
  drawFooter(doc);
}
