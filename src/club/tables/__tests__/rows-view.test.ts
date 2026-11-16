import { describe, expect, it } from 'vitest';
import { CATALOG } from '../catalog';
import { badgeTone, columnMatches, emptyRow, moveColumnTo, showTotals, tableLines, totalLabels } from '../rows-view';
import type { TableDefinition, TableResult } from '../types';

const plati = CATALOG.plati.columns;
const c = (k: string) => plati.find((x) => x.key === k)!;
const def: TableDefinition = { subject: 'plati', scope: { seasonId: 's1', sectionId: null, groupId: null, period: null }, columns: ['data', 'sportiv', 'suma'], filters: [], groupBy: null, sort: null };

describe('totals', () => {
  it('show only with a money column', () => {
    expect(showTotals([c('sportiv'), CATALOG.sportivi.columns.find((x) => x.key === 'varsta')!, c('data')])).toBe(false);
    expect(showTotals([c('sportiv'), c('suma')])).toBe(true);
  });
  it('are called Total, and Total general only for several groups', () => {
    expect(totalLabels(true, 3)).toEqual({ group: 'Total', grand: 'Total general' });
    expect(totalLabels(true, 1).grand).toBeNull();
    expect(totalLabels(false, 0).grand).toBeNull();
  });
});

describe('columns', () => {
  it('match by label without case or diacritics', () => {
    expect(columnMatches({ label: 'Sumă' }, 'suma')).toBe(true);
    expect(columnMatches({ label: 'Sumă' }, 'SUM')).toBe(true);
    expect(columnMatches({ label: 'Sumă' }, 'telefon')).toBe(false);
  });
  it('move up and down, and stay put at the ends and for an unknown key', () => {
    expect(moveColumnTo(def, 'suma', -1).columns).toEqual(['data', 'suma', 'sportiv']);
    expect(moveColumnTo(def, 'data', 1).columns).toEqual(['sportiv', 'data', 'suma']);
    expect(moveColumnTo(def, 'data', -1)).toBe(def);
    expect(moveColumnTo(def, 'suma', 1)).toBe(def);
    expect(moveColumnTo(def, 'nope', 1)).toBe(def);
  });
  it('the empty row says Nimic.', () => expect(emptyRow()).toBe('Nimic.'));
  it('status columns get a tone, others none', () => {
    const stare = CATALOG.abonamente.columns.find((x) => x.key === 'stare')!;
    expect(badgeTone(stare, 'activ')).toBe('success');
    expect(badgeTone(stare, 'expirat')).toBe('danger');
    expect(badgeTone(c('sportiv'), 'Ana')).toBeNull();
  });
});

const result = (columns: typeof plati, groups: number): TableResult => {
  const row = { athleteId: 'a', groupKeys: {}, cells: { sportiv: 'Ana', suma: 10 } };
  return {
    subject: 'plati', groupBy: groups > 0 ? 'grupa' : null, columns, count: Math.max(groups, 1), notices: [], total: { suma: 10 }, rows: [row],
    groups: groups > 0 ? Array.from({ length: groups }, (_, i) => ({ key: `g${i}`, label: `G${i}`, count: 1, subtotal: { suma: 10 }, rows: [row] })) : null,
  };
};
describe('tableLines', () => {
  const labels = (r: TableResult) => tableLines(r, new Set()).flatMap((l) => (l.kind === 'subtotal' || l.kind === 'total' ? [l.label] : []));
  it('has no total lines without a money column', () => expect(labels(result([c('sportiv')], 2))).toEqual([]));
  it('labels each group Total and closes several groups with Total general', () => expect(labels(result([c('suma')], 2))).toEqual(['Total', 'Total', 'Total general']));
  it('one group has no grand total, no grouping has a single Total', () => {
    expect(labels(result([c('suma')], 1))).toEqual(['Total']);
    expect(labels(result([c('suma')], 0))).toEqual(['Total']);
  });
});
