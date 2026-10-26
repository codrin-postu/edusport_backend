import { describe, expect, it } from 'vitest';
import { edgeIndex, foldText, scrollTopFor, selectKeyAction, stepIndex, typeaheadIndex } from '../ui-select';

const rows = [
  { label: 'Primii Pași' },
  { label: 'Începători' },
  { label: 'Intermediari Bronze' },
  { label: 'Intermediari Silver', disabled: true },
  { label: 'Avansați Gold' },
];

describe('foldText', () => {
  it('drops case and diacritics, comma-below and cedilla forms alike', () => {
    expect(foldText('Școala Ștefan Țepeș')).toBe('scoala stefan tepes');
    expect(foldText('Şcoala')).toBe('scoala');
    expect(foldText('Începători')).toBe('incepatori');
  });
});

describe('stepIndex and edgeIndex', () => {
  it('moves to the next enabled option and stops at the ends', () => {
    expect(stepIndex(rows, 2, 1)).toBe(4);
    expect(stepIndex(rows, 4, 1)).toBe(4);
    expect(stepIndex(rows, 0, -1)).toBe(0);
    expect(stepIndex(rows, -1, 1)).toBe(0);
  });

  it('finds the first and the last enabled option', () => {
    expect(edgeIndex(rows, 'first')).toBe(0);
    expect(edgeIndex([{ label: 'a', disabled: true }, { label: 'b' }], 'first')).toBe(1);
    expect(edgeIndex(rows, 'last')).toBe(4);
    expect(edgeIndex([], 'first')).toBe(-1);
  });
});

describe('typeaheadIndex', () => {
  it('ignores case and diacritics', () => {
    expect(typeaheadIndex(rows, -1, 'i')).toBe(1);
    expect(typeaheadIndex(rows, -1, 'av')).toBe(4);
    expect(typeaheadIndex([{ label: 'Club' }, { label: 'Școala de patinaj' }], 0, 's')).toBe(1);
  });

  it('the same letter again cycles through the matches, skipping disabled options', () => {
    expect(typeaheadIndex(rows, 1, 'ii')).toBe(2);
    expect(typeaheadIndex(rows, 2, 'iii')).toBe(1);
  });

  it('a longer word keeps the current option while it still fits', () => {
    expect(typeaheadIndex(rows, 2, 'inter')).toBe(2);
  });

  it('returns -1 when nothing matches', () => {
    expect(typeaheadIndex(rows, 0, 'z')).toBe(-1);
    expect(typeaheadIndex(rows, 0, '')).toBe(-1);
    expect(typeaheadIndex([], 0, 'a')).toBe(-1);
  });
});

describe('selectKeyAction', () => {
  it('opens on ArrowDown, ArrowUp, Enter and Space, on the selected option', () => {
    expect(selectKeyAction('ArrowDown', false, rows, 2)).toEqual({ type: 'open', index: 2 });
    expect(selectKeyAction(' ', false, rows, -1)).toEqual({ type: 'open', index: 0 });
    expect(selectKeyAction('a', false, rows, 2)).toEqual({ type: 'none' });
    expect(selectKeyAction('Escape', false, rows, 2)).toEqual({ type: 'none' });
  });

  it('moves, picks and closes while open', () => {
    expect(selectKeyAction('ArrowDown', true, rows, 2)).toEqual({ type: 'move', index: 4 });
    expect(selectKeyAction('ArrowUp', true, rows, 4)).toEqual({ type: 'move', index: 2 });
    expect(selectKeyAction('Home', true, rows, 4)).toEqual({ type: 'move', index: 0 });
    expect(selectKeyAction('End', true, rows, 0)).toEqual({ type: 'move', index: 4 });
    expect(selectKeyAction('Enter', true, rows, 1)).toEqual({ type: 'pick', index: 1 });
    expect(selectKeyAction(' ', true, rows, 1)).toEqual({ type: 'pick', index: 1 });
    expect(selectKeyAction('Enter', true, rows, -1)).toEqual({ type: 'close' });
    expect(selectKeyAction('Escape', true, rows, 1)).toEqual({ type: 'close' });
    expect(selectKeyAction('Tab', true, rows, 1)).toEqual({ type: 'close' });
  });
});

describe('scrollTopFor', () => {
  it('scrolls only as far as needed to show the highlighted option', () => {
    expect(scrollTopFor(0, 30, 60, 280)).toBe(0);
    expect(scrollTopFor(300, 30, 0, 280)).toBe(50);
    expect(scrollTopFor(100, 30, 0, 280)).toBe(0);
  });
});
