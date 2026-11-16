import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { AdminPriceList } from '../price-admin';
import { PRETURI_TO } from '../../admin/pages/routes';
import { PRETURI_PATH, preturiTo, readPreturiQuery, sectionOfList } from '../preturi-routes';

const src = (p: string) => readFileSync(join(__dirname, '../../admin', p), 'utf8');
const list = (documentId: string, sectionId: string | null): AdminPriceList => ({ documentId, name: documentId, sectionId, items: [], groups: [] });

describe('Prețuri address', () => {
  it('names one list in the query', () => {
    expect(preturiTo('abc 1')).toBe('/plugins/edusport-preturi?lista=abc%201');
    expect(PRETURI_PATH).toBe(PRETURI_TO);
  });

  it('reads the list back', () => {
    expect(readPreturiQuery('?lista=abc')).toEqual({ lista: 'abc' });
    expect(readPreturiQuery('')).toEqual({ lista: null });
    expect(readPreturiQuery('?lista=')).toEqual({ lista: null });
  });

  it('finds the section tab holding a list', () => {
    const lists = [list('a', 's1'), list('b', 's2'), list('c', null)];
    expect(sectionOfList(lists, 'b')).toBe('s2');
    expect(sectionOfList(lists, 'c')).toBeNull();
    expect(sectionOfList(lists, 'nope')).toBeNull();
    expect(sectionOfList(lists, null)).toBeNull();
  });
});

describe('links both ways (wiring)', () => {
  it('Grupe list and group page open Prețuri', () => {
    expect(src('dashboard/grupe/GrupeList.tsx')).toContain('preturiTo(');
    expect(src('dashboard/grupe/GroupPage.tsx')).toContain('preturiTo(');
  });

  it('each price list card links its groups, only when it has some', () => {
    const card = src('pages/preturi/PriceListCard.tsx');
    expect(card).toContain('groupPageTo(');
    expect(card).toMatch(/list\.groups\.length > 0 && <ListGroups/);
  });

  it('Prețuri reads ?lista= and opens that list\'s section tab', () => {
    const page = src('pages/PreturiPage.tsx');
    expect(page).toContain('readPreturiQuery(');
    expect(page).toContain('sectionOfList(');
  });
});
