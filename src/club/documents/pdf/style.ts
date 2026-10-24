import path from 'node:path';
import type { TextStyle } from '../runs';

/**
 * Page geometry and type from the approved mockups (.d2 in document-v4.html, gen_legal3.py):
 * the mockup page is 560 px wide, A4 is 595.28 pt, so 1 mockup px = S pt.
 */
export const PAGE = { width: 595.28, height: 841.89 } as const;
export const S = PAGE.width / 560;
export const px = (n: number) => n * S;

export const MARGIN = { top: px(28), side: px(40), bottom: px(18) } as const;
export const CONTENT_WIDTH = PAGE.width - 2 * MARGIN.side;

export const COLOR = {
  text: '#1f2430',
  navy: '#0e1a3c',
  meta: '#4b5263',
  label: '#6b6f7d',
  rule: '#c0c4ce',
  tint: '#eef1f8',
  link: '#1a5fd0',
  letter: '#be3330',
} as const;

export const BODY = { size: px(8.3), lineHeight: 1.4 } as const;

export const FONT = {
  regular: 'Inter',
  bold: 'Inter-Bold',
  boldItalic: 'Inter-BoldItalic',
  extraBold: 'Inter-ExtraBold',
  wordmark: 'ClimateCrisis',
} as const;

const FONT_FILES: Record<string, string> = {
  [FONT.regular]: 'Inter-Regular.ttf',
  [FONT.bold]: 'Inter-Bold.ttf',
  [FONT.boldItalic]: 'Inter-BoldItalic.ttf',
  [FONT.extraBold]: 'Inter-ExtraBold.ttf',
  [FONT.wordmark]: 'ClimateCrisis-Variable.ttf',
};

/** Fonts are bundled in the repo (OFL, licences next to them); the app runs from the repo root. */
export function fontsDir(): string {
  return path.resolve(process.cwd(), 'assets', 'fonts');
}

export function registerFonts(doc: PDFKit.PDFDocument, dir: string = fontsDir()): void {
  for (const [name, file] of Object.entries(FONT_FILES)) doc.registerFont(name, path.join(dir, file));
}

export const STYLE_FONT: Record<TextStyle, string> = {
  regular: FONT.regular,
  bold: FONT.bold,
  boldItalic: FONT.boldItalic,
  value: FONT.bold,
  link: FONT.regular,
};

export const STYLE_COLOR: Record<TextStyle, string> = {
  regular: COLOR.text,
  bold: COLOR.text,
  boldItalic: COLOR.text,
  value: COLOR.navy,
  link: COLOR.link,
};
