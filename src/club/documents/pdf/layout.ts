import type { Run, TextStyle } from '../runs';

/** Width in pt of `text` in `style` at the paragraph's size. */
export type Measure = (text: string, style: TextStyle) => number;

export type LayoutOptions = {
  width: number;
  measure: Measure;
  align: 'justify' | 'left';
  /** Horizontal padding of a filled value's tint, pt (mockup: padding 0 3px). */
  valuePad: number;
  /** pt per mockup px, for blank lines. */
  scale: number;
};

/** A run placed on a line: x from the paragraph's left edge, width in pt. */
export type PlacedRun =
  | { kind: 'text'; x: number; width: number; text: string; style: TextStyle; wordSpacing: number }
  | { kind: 'blank'; x: number; width: number };

type Frag = { text: string; style: TextStyle } | { blank: number };
type Word = Frag[];
type RawRun = { kind: 'text'; text: string; style: TextStyle } | { kind: 'blank'; px: number };

const BLANK_MARGIN_PX = 2; // mockup .bl: margin 0 2px

/** Split runs into words; pieces not separated by whitespace stay one word ("Dumitrescu,"). */
export function toWords(runs: Run[]): Word[] {
  const words: Word[] = [];
  let current: Word = [];
  const flush = () => {
    if (current.length) words.push(current);
    current = [];
  };
  for (const run of runs) {
    if ('blank' in run) current.push(run);
    else
      for (const part of run.text.split(/(\s+)/)) {
        if (/^\s+$/.test(part)) flush();
        else if (part) current.push({ text: part, style: run.style });
      }
  }
  flush();
  return words;
}

function fragWidth(frag: Frag, o: LayoutOptions): number {
  if ('blank' in frag) return (frag.blank + 2 * BLANK_MARGIN_PX) * o.scale;
  return o.measure(frag.text, frag.style) + (frag.style === 'value' ? 2 * o.valuePad : 0);
}

/** Greedy line breaking: as many words per line as fit `o.width`. */
export function wrapWords(words: Word[], o: LayoutOptions): Word[][] {
  const space = o.measure(' ', 'regular');
  const lines: Word[][] = [];
  let line: Word[] = [];
  let used = 0;
  for (const word of words) {
    const w = word.reduce((sum, f) => sum + fragWidth(f, o), 0);
    if (line.length && used + space + w > o.width) {
      lines.push(line);
      line = [];
      used = 0;
    }
    used += (line.length ? space : 0) + w;
    line.push(word);
  }
  if (line.length) lines.push(line);
  return lines;
}

/**
 * The space between two words ends the run before it; a run never starts with a space, since pdf.js
 * drops such a space when the text is copied. A tint or underline stops at the trimmed text (draw.ts).
 */
function addGap(runs: RawRun[]): void {
  const last = runs[runs.length - 1];
  if (last?.kind === 'text') last.text += ' ';
  else runs.push({ kind: 'text', text: ' ', style: 'regular' });
}

/** Appends a text fragment to the last run when it has the same style; false when it cannot. */
function appendSame(runs: RawRun[], frag: Frag, sep: string): boolean {
  const last = runs[runs.length - 1];
  if ('blank' in frag || last?.kind !== 'text' || last.style !== frag.style) return false;
  last.text += sep + frag.text;
  return true;
}

/** Joins a fragment to the line's runs; `gap` is true before the first fragment of every word but the first. */
function pushFrag(runs: RawRun[], frag: Frag, gap: boolean): void {
  if (appendSame(runs, frag, gap ? ' ' : '')) return;
  if (gap) addGap(runs);
  if (appendSame(runs, frag, '')) return;
  runs.push('blank' in frag ? { kind: 'blank', px: frag.blank } : { kind: 'text', text: frag.text, style: frag.style });
}

/** One line's words as runs of one style each (spaces kept, so copied text reads naturally). */
export function lineRuns(line: Word[]): RawRun[] {
  const runs: RawRun[] = [];
  line.forEach((word, wi) => word.forEach((frag, fi) => pushFrag(runs, frag, wi > 0 && fi === 0)));
  return runs;
}

const spacesIn = (text: string) => text.split(' ').length - 1;

function runWidth(run: RawRun, wordSpacing: number, o: LayoutOptions): number {
  if (run.kind === 'blank') return (run.px + 2 * BLANK_MARGIN_PX) * o.scale;
  const pad = run.style === 'value' ? 2 * o.valuePad : 0;
  return o.measure(run.text, run.style) + spacesIn(run.text) * wordSpacing + pad;
}

/** Positions the runs of a line; justified lines (all but the last) stretch their spaces to the full width. */
export function placeLine(runs: RawRun[], o: LayoutOptions, last: boolean): PlacedRun[] {
  const natural = runs.reduce((sum, r) => sum + runWidth(r, 0, o), 0);
  const spaces = runs.reduce((sum, r) => sum + (r.kind === 'text' ? spacesIn(r.text) : 0), 0);
  const stretch = o.align === 'justify' && !last && spaces > 0;
  const wordSpacing = stretch ? Math.max(0, (o.width - natural) / spaces) : 0;
  let x = 0;
  return runs.map((run) => {
    const width = runWidth(run, wordSpacing, o);
    const placed: PlacedRun =
      run.kind === 'blank' ? { kind: 'blank', x, width } : { kind: 'text', x, width, text: run.text, style: run.style, wordSpacing };
    x += width;
    return placed;
  });
}

/** Lays a paragraph out into lines of placed runs. */
export function layoutParagraph(runs: Run[], o: LayoutOptions): PlacedRun[][] {
  const lines = wrapWords(toWords(runs), o);
  return lines.map((line, i) => placeLine(lineRuns(line), o, i === lines.length - 1));
}
