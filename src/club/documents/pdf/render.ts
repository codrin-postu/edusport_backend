import PDFDocument from 'pdfkit';
import type { DocumentKind, DocumentValues } from '../types';
import { drawAcord } from './acord';
import { drawAdeziune } from './adeziune';
import { DocumentOverflowError } from './blocks';
import { PAGE, registerFonts } from './style';

const TITLES: Record<DocumentKind, string> = { acord: 'Acord', adeziune: 'Cerere de adeziune' };

const DRAW: Record<DocumentKind, (doc: PDFKit.PDFDocument, values: DocumentValues, scale: number) => void> = {
  acord: drawAcord,
  adeziune: drawAdeziune,
};

/** Body sizes tried in turn, largest first: 1 is the mockup's size; the first that fits one page wins. */
export const BODY_SCALES = [1, 0.96, 0.92, 0.88, 0.85, 0.82, 0.8] as const;

function renderOnce(kind: DocumentKind, values: DocumentValues, scale: number): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: [PAGE.width, PAGE.height], margin: 0, info: { Title: TITLES[kind], Author: 'Asociația Clubul Sportiv EduSport' } });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
    try {
      registerFonts(doc);
      DRAW[kind](doc, values, scale);
      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

/** Renders one document as a one-page A4 PDF. Null values print blank lines (blank forms, missing answers). */
export async function renderDocument(kind: DocumentKind, values: DocumentValues): Promise<Buffer> {
  for (const scale of BODY_SCALES) {
    try {
      return await renderOnce(kind, values, scale);
    } catch (err) {
      if (!(err instanceof DocumentOverflowError)) throw err;
    }
  }
  throw new DocumentOverflowError(kind);
}
