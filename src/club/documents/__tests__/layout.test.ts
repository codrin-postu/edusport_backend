import { describe, expect, it } from 'vitest';
import { layoutParagraph, lineRuns, toWords } from '../pdf/layout';
import { blank, t, v } from '../runs';

/** 1 pt per character, so widths are easy to reason about. */
const o = { width: 20, measure: (text: string) => text.length, align: 'justify' as const, valuePad: 0, scale: 1 };

describe('paragraph layout', () => {
  it('keeps a value and the punctuation after it in one word', () => {
    const words = toWords([t('de '), v('Ana Pop', 60), t(', telefon')]);
    expect(words.map((w) => w.map((f) => ('blank' in f ? '_' : f.text)).join(''))).toEqual(['de', 'Ana', 'Pop,', 'telefon']);
  });

  it('ends each run with the space after it and never starts one with a space', () => {
    const runs = lineRuns(toWords([t('copilul '), v('Ana Pop', 60), t(' la '), blank(20), t(' Bl')]));
    expect(runs).toEqual([
      { kind: 'text', text: 'copilul ', style: 'regular' },
      { kind: 'text', text: 'Ana Pop ', style: 'value' },
      { kind: 'text', text: 'la ', style: 'regular' },
      { kind: 'blank', px: 20 },
      { kind: 'text', text: ' Bl', style: 'regular' },
    ]);
  });

  it('wraps and stretches every line but the last to the full width', () => {
    const lines = layoutParagraph([t('aaaa bbbb cccc dddd eeee ffff')], o);
    expect(lines).toHaveLength(2);
    const first = lines[0][lines[0].length - 1];
    expect(first.x + first.width).toBeCloseTo(20);
    expect(lines[1][0]).toMatchObject({ kind: 'text', text: 'eeee ffff', wordSpacing: 0 });
  });

  it('draws a blank as a line of the mockup width plus its margins', () => {
    const [line] = layoutParagraph([t('CNP '), blank(10)], { ...o, align: 'left', width: 100 });
    expect(line[1]).toEqual({ kind: 'blank', x: 4, width: 14 });
  });
});
