import { drawLabel, tickBox } from './draw';
import { BODY, COLOR, CONTENT_WIDTH, FONT, MARGIN, px } from './style';

type Doc = PDFKit.PDFDocument;

/** A text column in the current drawing space: left edge and width, pt. */
export type Col = { x: number; width: number };

/** CSS `line-height: normal` for Inter (ascender + descender). */
export const NORMAL_LINE = 1.21;
const TITLE_SIZE = px(13.5);

/** Small uppercase labels above signature lines (mockup .sig small). */
export const SIG_LABEL = { font: FONT.bold, size: px(8), color: COLOR.label, spacing: px(8 * 0.08) };
export const SIG_LABEL_LINE = px(8 * 1.4) + px(6);

/** Top of the glyphs of a one-line body label on a body line starting at `lineTop`. */
export const bodyGlyphTop = (lineTop: number) => lineTop + (BODY.size * BODY.lineHeight - BODY.size * NORMAL_LINE) / 2;

/** Thrown when the body would run into the footer (each document must stay one A4 page). */
export class DocumentOverflowError extends Error {
  constructor(kind: string) {
    super(`The ${kind} does not fit on one page`);
    this.name = 'DocumentOverflowError';
  }
}

/** Title in Inter bold 13.5px, navy, 14px below `y` (mockup .d2t); returns the y below `marginBottom`. */
export function drawTitle(doc: Doc, text: string, y: number, marginBottom: number): number {
  const top = y + px(14);
  drawLabel(doc, text, MARGIN.side, top, { font: FONT.bold, size: TITLE_SIZE, color: COLOR.navy, spacing: -TITLE_SIZE * 0.01 });
  return top + TITLE_SIZE * NORMAL_LINE + marginBottom;
}

/**
 * Draws the body below `top`, shrunk by `scale` (1 = the mockup's sizes) so a long text still fits one page.
 * The body draws in its own space: a column from x 0, as wide as the page column divided by `scale`.
 * Returns the page y below the body.
 */
export function drawScaledBody(doc: Doc, top: number, scale: number, body: (col: Col) => number): number {
  doc.save();
  doc.translate(MARGIN.side, top);
  doc.scale(scale);
  const height = body({ x: 0, width: CONTENT_WIDTH / scale });
  doc.restore();
  return top + height * scale;
}

export type TickRow = { box: number; inner: number; gap: number };

/** Empty tick boxes with bold labels ("□ Da  □ Nu") on one body line from `x`; returns the x after them. */
export function drawTicks(doc: Doc, labels: string[], x: number, lineTop: number, o: TickRow): number {
  const glyph = bodyGlyphTop(lineTop);
  let at = x;
  for (const label of labels) {
    tickBox(doc, at, glyph + (BODY.size * NORMAL_LINE - px(o.box)) / 2, o.box);
    at += px(o.box) + px(o.inner);
    at += drawLabel(doc, label, at, glyph, { font: FONT.bold, size: BODY.size, color: COLOR.text }) + px(o.gap);
  }
  return at;
}

/** A thin rectangle border (mockup: 1px solid #c0c4ce) around a box. */
export function frameBox(doc: Doc, x: number, y: number, width: number, height: number): void {
  doc.save().rect(x + px(0.5), y + px(0.5), width - px(1), height - px(1)).lineWidth(px(1)).strokeColor(COLOR.rule).stroke().restore();
}
