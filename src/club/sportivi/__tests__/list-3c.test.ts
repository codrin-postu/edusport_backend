import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { AthleteListPage } from '../../athletes/api-types';
import { INACTIVE, INITIAL_LIST_STATE, filterSections, inactiveShown, listQueryString, showInactive, withSection } from '../list-view';
import { addResults, allSelected, bulkToast, chunks, selectionOn, toggled, toggledAll } from '../personal-data-view';

const read = (p: string) => readFileSync(join(__dirname, '..', '..', '..', 'admin', 'dashboard', p), 'utf8');
const page = (retentionYears: number) => ({ retentionYears, options: { sections: [], groups: [] } }) as unknown as AthleteListPage;

describe('list filters (3C spec 5)', () => {
  it('"Date personale" with "Inactivi de peste N ani", N from the page; status gains "Anonimizat"', () => {
    const sections = filterSections(INITIAL_LIST_STATE, page(7));
    const personal = sections.find((s) => s.key === 'personal');
    expect(personal).toMatchObject({ label: 'Date personale', options: [{ value: INACTIVE, label: 'Inactivi de peste 7 ani' }] });
    expect(sections.find((s) => s.key === 'status')?.options.map((o) => o.label)).toEqual(['Nou', 'Activ', 'Inactiv', 'Anonimizat']);
    expect(filterSections(INITIAL_LIST_STATE, null).find((s) => s.key === 'personal')?.options[0].label).toBe('Inactivi de peste 5 ani');
  });

  it('asks the server for inactive=true and status=anonimizat', () => {
    const s = withSection(withSection(INITIAL_LIST_STATE, 'personal', [INACTIVE]), 'status', ['anonimizat']);
    const q = new URLSearchParams(listQueryString(s, 50));
    expect(q.get('inactive')).toBe('true');
    expect(q.get('status')).toBe('anonimizat');
    expect(new URLSearchParams(listQueryString(INITIAL_LIST_STATE, 50)).get('inactive')).toBeNull();
  });

  it('the dashboard link turns on only the inactivity filter', () => {
    const busy = withSection(INITIAL_LIST_STATE, 'acs', ['da']);
    const s = showInactive(busy);
    expect(inactiveShown(s)).toBe(true);
    expect(s.filters.acs).toEqual([]);
    expect(inactiveShown(INITIAL_LIST_STATE)).toBe(false);
  });
});

describe('selection and bulk (3C spec 5)', () => {
  it('checkboxes only for a Super Admin with the inactivity filter on', () => {
    expect(selectionOn(true, true)).toBe(true);
    expect(selectionOn(true, false)).toBe(false);
    expect(selectionOn(false, true)).toBe(false);
  });

  it('ticks one, ticks all on the page, unticks all', () => {
    const one = toggled(new Set(), 'a');
    expect([...one]).toEqual(['a']);
    expect([...toggled(one, 'a')]).toEqual([]);
    const all = toggledAll(one, ['a', 'b']);
    expect([...all].sort()).toEqual(['a', 'b']);
    expect(allSelected(all, ['a', 'b'])).toBe(true);
    expect([...toggledAll(all, ['a', 'b'])]).toEqual([]);
    expect(allSelected(new Set(), [])).toBe(false);
  });

  it('sends at most 200 ids per request and adds the answers', () => {
    const ids = Array.from({ length: 450 }, (_, i) => `id${i}`);
    expect(chunks(ids).map((c) => c.length)).toEqual([200, 200, 50]);
    expect(addResults({ anonymized: 2, skipped: 1, failed: 0 }, { anonymized: 3, skipped: 0, failed: 1 })).toEqual({ anonymized: 5, skipped: 1, failed: 1 });
  });

  it('one toast with the counts that are not zero', () => {
    expect(bulkToast({ anonymized: 3, skipped: 0, failed: 0 })).toBe('3 sportivi anonimizați.');
    expect(bulkToast({ anonymized: 1, skipped: 2, failed: 1 })).toBe('1 sportiv anonimizat. Sărite: 2. Nereușite: 1.');
  });
});

describe('list wiring (source, 3C spec 8)', () => {
  it('the list mounts the selection, the bulk bar and the dashboard link', () => {
    const list = read('sportivi/SportiviList.tsx');
    for (const s of [
      'const selection = useSelection(list, useIsSuperAdmin());', 'useInactiveLink(list, search);',
      '{selection && selection.ids.size > 0 && <BulkAnonymizeBar ids={[...selection.ids]} api={api} done={selection.done} />}',
      '{phone ? <AthleteCards list={list} onOpen={open} selection={selection} /> : <AthleteTable list={list} onOpen={open} selection={selection} />}',
    ]) expect(list, s).toContain(s);
  });

  it('the selection only for a Super Admin with the filter on, cleared on every list change', () => {
    const hook = read('sportivi/useSelection.ts');
    for (const s of ['selectionOn(inactiveShown(list.state), superAdmin)', 'listQueryString(withPage(list.state, 1), 0)', 'wantsInactiveList(search)', 'showInactive(']) {
      expect(hook, s).toContain(s);
    }
  });

  it('the bar: "Anonimizează (k)", the shared confirmation with k, chunks of 200, one toast', () => {
    const bar = read('sportivi/BulkAnonymizeBar.tsx');
    for (const s of ['PERSONAL_DATA_COPY.bulkButton(ids.length)', '<AnonymizeDialog', 'count={ids.length}', 'chunks(ids)', 'bulkToast(result)', 'api.anonymizeMany(part)']) {
      expect(bar, s).toContain(s);
    }
  });

  it('table and cards: square checkboxes, the row click still opens the record', () => {
    const table = read('sportivi/AthleteTable.tsx');
    for (const s of ['<Checkbox', 'aria-label={PERSONAL_DATA_COPY.selectAll}', 'selection.toggleAll(ids)', 'onClick={(e) => e.stopPropagation()}', '<div className="ui-table-wrap">', '<div className="spv-foot">', 'withHeaderSort(state, sortKey)']) {
      expect(table, s).toContain(s);
    }
    const cards = read('sportivi/AthleteCards.tsx');
    for (const s of ['<Checkbox', 'selection.toggle(r.documentId)', '<MissingMarker row={r} card />', 'LIST_COPY.more']) expect(cards, s).toContain(s);
  });
});
