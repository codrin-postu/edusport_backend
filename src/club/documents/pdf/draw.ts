import type { Run, TextStyle } from '../runs';
import { layoutParagraph, type Measure, type PlacedRun } from './layout';
import { BODY, COLOR, S, STYLE_COLOR, STYLE_FONT, px } from './style';

type Doc = PDFKit.PDFDocument;

/** Inter's vertical metrics (units per em 2048: ascender 1984, descender -494). */
const ASCENT = 1984 / 2048;
const CONTENT = (1984 + 494) / 2048;

export type Box = { x: number; y: number; width: number };
export type ParagraphStyle = { size: number; lineHeight: number; align: 'justify' | 'left'; color?: string };

export const BODY_STYLE: ParagraphStyle = { size: BODY.size, lineHeight: BODY.lineHeight, align: 'justify' };

export function measureWith(doc: Doc, size: number): Measure {
  return (text: string, style: TextStyle) => doc.font(STYLE_FONT[style]).fontSize(size).widthOfString(text);
}

/** Top of the glyph box inside a CSS line box of `lineHeight` (half-leading above). */
export function glyphTop(lineTop: number, p: ParagraphStyle): number {
  return lineTop + (p.size * p.lineHeight - p.size * CONTENT) / 2;
}

export function baseline(lineTop: number, p: ParagraphStyle): number {
  return glyphTop(lineTop, p) + p.size * ASCENT;
}

export function hLine(doc: Doc, x1: number, x2: number, y: number, width = px(1), color: string = COLOR.text): void {
  doc.save().moveTo(x1, y).lineTo(x2, y).lineWidth(width).strokeColor(color).stroke().restore();
}

function drawText(doc: Doc, run: Extract<PlacedRun, { kind: 'text' }>, x: number, lineTop: number, p: ParagraphStyle): void {
  const pad = run.style === 'value' ? px(3) : 0;
  const trimmed = run.text.trimEnd();
  doc.font(STYLE_FONT[run.style]).fontSize(p.size);
  const inked = doc.widthOfString(trimmed) + (trimmed.split(' ').length - 1) * run.wordSpacing;
  if (run.style === 'value') doc.rect(x, glyphTop(lineTop, p), inked + 2 * pad, p.size * CONTENT).fill(COLOR.tint);
  doc.fillColor(run.style === 'regular' && p.color ? p.color : STYLE_COLOR[run.style]);
  doc.text(run.text, x + pad, glyphTop(lineTop, p), { lineBreak: false, wordSpacing: run.wordSpacing });
  if (run.style === 'link') hLine(doc, x, x + inked, baseline(lineTop, p) + px(1), px(0.6), COLOR.link);
}

function drawRun(doc: Doc, run: PlacedRun, left: number, lineTop: number, p: ParagraphStyle): void {
  const x = left + run.x;
  if (run.kind === 'text') drawText(doc, run, x, lineTop, p);
  else hLine(doc, x + px(2), x + run.width - px(2), baseline(lineTop, p) - px(0.5));
}

/** Draws a paragraph of runs and returns the y below its last line. */
export function drawParagraph(doc: Doc, runs: Run[], box: Box, p: ParagraphStyle = BODY_STYLE): number {
  const lines = layoutParagraph(runs, { width: box.width, measure: measureWith(doc, p.size), align: p.align, valuePad: px(3), scale: S });
  const lineHeight = p.size * p.lineHeight;
  lines.forEach((line, i) => line.forEach((run) => drawRun(doc, run, box.x, box.y + i * lineHeight, p)));
  return box.y + lines.length * lineHeight;
}

/** Height a paragraph would take, without drawing it. */
export function paragraphHeight(doc: Doc, runs: Run[], width: number, p: ParagraphStyle = BODY_STYLE): number {
  const lines = layoutParagraph(runs, { width, measure: measureWith(doc, p.size), align: p.align, valuePad: px(3), scale: S });
  return lines.length * p.size * p.lineHeight;
}

/** One line of single-style text at (x, lineTop); returns its width. */
export function drawLabel(doc: Doc, text: string, x: number, lineTop: number, o: { font: string; size: number; color: string; spacing?: number }): number {
  doc.font(o.font).fontSize(o.size).fillColor(o.color);
  doc.text(text, x, lineTop, { lineBreak: false, characterSpacing: o.spacing ?? 0 });
  return doc.widthOfString(text, { characterSpacing: o.spacing ?? 0 });
}

/** An empty tick box with its border, like the mockups' `.ck:before`. */
export function tickBox(doc: Doc, x: number, y: number, sizePx: number): void {
  doc.save().rect(x, y, px(sizePx), px(sizePx)).lineWidth(px(1.2)).strokeColor(COLOR.navy).stroke().restore();
}
