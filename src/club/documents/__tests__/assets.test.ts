import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import PDFDocument from 'pdfkit';
import { expect, it } from 'vitest';

const FONTS = path.resolve(__dirname, '..', '..', '..', '..', 'assets', 'fonts');
const FILES = ['Inter-Regular.ttf', 'Inter-Bold.ttf', 'Inter-BoldItalic.ttf', 'Inter-ExtraBold.ttf', 'ClimateCrisis-Variable.ttf'];

it('bundles the fonts with their OFL licences', () => {
  for (const file of FILES) expect(existsSync(path.join(FONTS, file))).toBe(true);
  expect(readFileSync(path.join(FONTS, 'Inter-OFL.txt'), 'utf8')).toContain('SIL Open Font License, Version 1.1');
  expect(readFileSync(path.join(FONTS, 'ClimateCrisis-OFL.txt'), 'utf8')).toContain('SIL Open Font License, Version 1.1');
});

it('pdfkit loads every bundled font', () => {
  const doc = new PDFDocument();
  for (const file of FILES) expect(() => doc.font(path.join(FONTS, file))).not.toThrow();
});
