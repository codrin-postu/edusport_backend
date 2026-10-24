import { extractText, getDocumentProxy } from 'unpdf';

/** The text of a PDF as one string: whitespace collapsed, no space before punctuation (pdf.js splits runs). */
export async function pdfText(pdf: Buffer): Promise<{ pages: number; text: string }> {
  const proxy = await getDocumentProxy(new Uint8Array(pdf));
  const { totalPages, text } = await extractText(proxy, { mergePages: true });
  const clean = text
    .replace(/\s+/g, ' ')
    .replace(/ ([,.;:)])/g, '$1')
    .replace(/\( /g, '(');
  return { pages: totalPages, text: clean };
}
