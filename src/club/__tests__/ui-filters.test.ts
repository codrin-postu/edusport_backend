import { describe, expect, it } from 'vitest';
import { activeSections, matchOptions, needsSearch, sectionSummary, toggleChoice } from '../ui-filters';

const grupa = {
  options: [
    { value: 'pp', label: 'Primii Pași' },
    { value: 'inc', label: 'Începători' },
    { value: 'ab', label: 'Avansați Bronze' },
  ],
  selected: [] as string[],
};

describe('sectionSummary', () => {
  it('shows "Toate" when nothing is chosen', () => {
    expect(sectionSummary(grupa)).toBe('Toate');
  });

  it('shows the chosen labels in option order', () => {
    expect(sectionSummary({ ...grupa, selected: ['ab', 'pp'] })).toBe('Primii Pași, Avansați Bronze');
  });

  it('uses the section own summary when given', () => {
    expect(sectionSummary({ ...grupa, selected: ['ab'], summary: 'Avansați' })).toBe('Avansați');
  });
});

describe('toggleChoice', () => {
  it('adds and removes values in a multi section', () => {
    expect(toggleChoice({ selected: ['pp'] }, 'inc')).toEqual(['pp', 'inc']);
    expect(toggleChoice({ selected: ['pp', 'inc'] }, 'pp')).toEqual(['inc']);
  });

  it('keeps one value in a single section', () => {
    expect(toggleChoice({ selected: ['pp'], single: true }, 'inc')).toEqual(['inc']);
    expect(toggleChoice({ selected: ['pp'], single: true }, 'pp')).toEqual(['pp']);
  });
});

describe('search and count', () => {
  it('a search box only above 8 options', () => {
    expect(needsSearch(8)).toBe(false);
    expect(needsSearch(9)).toBe(true);
  });

  it('matchOptions ignores case and diacritics; blank text keeps everything', () => {
    expect(matchOptions(grupa.options, 'INCEP').map((o) => o.value)).toEqual(['inc']);
    expect(matchOptions(grupa.options, '  ')).toHaveLength(3);
  });

  it('activeSections counts the sections with something chosen', () => {
    expect(activeSections([{ selected: [] }, { selected: ['a'] }, { selected: ['b', 'c'] }])).toBe(2);
  });
});
