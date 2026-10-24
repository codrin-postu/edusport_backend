/** Inline text styles of the mockups: plain, <b>, <b><i>, filled value (<b class="v">), link (<span class="u">). */
export type TextStyle = 'regular' | 'bold' | 'boldItalic' | 'value' | 'link';

/** A piece of a paragraph: styled text, or a blank line of `blank` mockup px for writing by hand. */
export type Run = { text: string; style: TextStyle } | { blank: number };

export const t = (text: string): Run => ({ text, style: 'regular' });
export const b = (text: string): Run => ({ text, style: 'bold' });
export const bi = (text: string): Run => ({ text, style: 'boldItalic' });
export const link = (text: string): Run => ({ text, style: 'link' });

/** A filled value, or a blank line of the mockup's width when there is no value. */
export const v = (value: string | null, blankPx: number): Run =>
  value ? { text: value, style: 'value' } : { blank: blankPx };

export const blank = (px: number): Run => ({ blank: px });

/** The plain text of a paragraph (blank lines left out), for tests and checks. */
export function runsText(runs: Run[]): string {
  return runs.map((r) => ('blank' in r ? '' : r.text)).join('');
}
