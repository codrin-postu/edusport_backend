import { describe, expect, it } from 'vitest';
import type { AthleteListPage } from '../../athletes/api-types';
import { INACTIVE, INITIAL_LIST_STATE, filterSections, inactiveShown, listQueryString, showInactive, withSection } from '../list-view';
import type { BulkAnonymizeResult } from '../../personal-data/anonymize-plan';
import {
  addResults, allSelected, anonymizeInTurns, bulkToast, chunks, runToast, selectionOn, toggled, toggledAll, withoutIds,
} from '../personal-data-view';

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

describe('fix round 1 (controller rulings)', () => {
  const ids = Array.from({ length: 450 }, (_, i) => `id${i}`);
  const fakeApi = (fail: unknown) => {
    const calls: string[][] = [];
    const send = async (part: string[]): Promise<BulkAnonymizeResult> => {
      calls.push(part);
      if (calls.length === 2) throw fail;
      return { anonymized: part.length - 1, skipped: 1, failed: 0 };
    };
    return { calls, send };
  };

  it('a later chunk failing stops the run and keeps what the earlier ones did', async () => {
    const api = fakeApi({ response: { status: 500, data: { error: { status: 500, message: 'Internal Server Error' } } } });
    const run = await anonymizeInTurns(api.send, ids);
    expect(api.calls.map((c) => c.length)).toEqual([200, 200]);
    expect(run.stopped).toBe(true);
    expect(run.doneIds).toEqual(ids.slice(0, 200));
    expect(run.result).toEqual({ anonymized: 199, skipped: 1, failed: 0 });
    expect(runToast(run)).toEqual({ warning: true, text: 'Oprit după 199 de sportivi anonimizați. Sărite: 1.' });
    expect([...withoutIds(new Set(ids), run.doneIds)]).toEqual(ids.slice(200));
  });

  it('a 409 adds the server text; the first chunk failing does nothing', async () => {
    const stale = { response: { status: 409, data: { error: { status: 409, message: 'Datele s-au schimbat.' } } } };
    const run = await anonymizeInTurns(fakeApi(stale).send, ids);
    expect(runToast(run).text).toBe('Oprit după 199 de sportivi anonimizați. Sărite: 1. Datele s-au schimbat.');
    const none = await anonymizeInTurns(async () => { throw stale; }, ids);
    expect(none.doneIds).toEqual([]);
    expect(none.stopped).toBe(true);
  });

  it('a full run: one toast, warning only when some failed', async () => {
    const run = await anonymizeInTurns(async (part) => ({ anonymized: part.length, skipped: 0, failed: 0 }), ids.slice(0, 3));
    expect(run).toMatchObject({ stopped: false, doneIds: ids.slice(0, 3) });
    expect(runToast(run)).toEqual({ warning: false, text: '3 sportivi anonimizați.' });
    expect(runToast({ ...run, result: { anonymized: 1, skipped: 0, failed: 2 } }).warning).toBe(true);
  });
});
