import { describe, expect, it } from 'vitest';
import { BudgetError, startBudget } from '../limit';
import { tableCsv } from '../export';
import { readCatalog, readExportRequest, runTable } from '../service';
import { definition, TODAY, tablesSeed } from './tables-seed';

const noBudget = { check: () => undefined };
const store = () => tablesSeed().store;
const body = (over: Partial<ReturnType<typeof definition>> = {}) => ({ definition: definition({ subject: 'plati', columns: ['data', 'sportiv', 'suma'], ...over }) });

describe('runTable', () => {
  it('runs a valid definition over the real row builders and answers a TableResult', async () => {
    const res = await runTable(store(), body(), { today: TODAY, budget: noBudget });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.data.subject).toBe('plati');
    expect(res.data.count).toBe(3);
    expect(res.data.columns.map((c) => c.key)).toEqual(['data', 'sportiv', 'suma']);
  });

  it('orders the columns as chosen, not as the catalog has them', async () => {
    const res = await runTable(store(), body({ columns: ['suma', 'data'] }), { today: TODAY, budget: noBudget });
    expect(res.ok && res.data.columns.map((c) => c.key)).toEqual(['suma', 'data']);
  });

  it('refuses anything the validator refuses, before any read', async () => {
    let reads = 0;
    const s = new Proxy(store(), { get: (t, k) => { reads += 1; return (t as never)[k]; } });
    for (const b of [null, {}, { definition: { subject: 'users' } }, body({ columns: ['athlete.email'] })]) {
      expect(await runTable(s, b, { today: TODAY, budget: noBudget })).toEqual({ ok: false, status: 400, error: 'Cerere invalidă.' });
    }
    expect(reads).toBe(0);
  });

  it('refuses a Plăți or Prezență period over 12 months and allows the season', async () => {
    const f = tablesSeed();
    f.group.seasons.push?.({ id: 'long', label: 'lung', startMonth: '2026-01-01', endMonth: '2027-12-31', isCurrent: false, membershipFee: null });
    const long = body({ scope: { seasonId: 'long', sectionId: null, groupId: null, period: null } });
    expect(await runTable(f.store, long, { today: TODAY, budget: noBudget })).toEqual({ ok: false, status: 400, error: 'Perioada e prea lungă.' });
    const ok = await runTable(store(), body({ scope: { seasonId: 's26', sectionId: null, groupId: null, period: null } }), { today: TODAY, budget: noBudget });
    expect(ok.ok).toBe(true);
  });

  it('passes today to relative dates, the group order to grouping, and the repair notices to the result', async () => {
    const d = definition({ subject: 'sportivi', columns: ['sportiv', 'grupa'], groupBy: 'grupa', scope: { seasonId: 's26', sectionId: 'gone-section', groupId: null, period: null } });
    const res = await runTable(store(), { definition: d }, { today: TODAY, budget: noBudget });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.data.notices).toHaveLength(1);
    expect(res.data.groups?.length).toBeGreaterThan(1);
    const rel = definition({ subject: 'abonamente', columns: ['cod', 'expira'], filters: [{ column: 'expira', op: 'lt', value: '+14d' }], scope: { seasonId: 's26', sectionId: null, groupId: null, period: null } });
    const soon = await runTable(store(), { definition: rel }, { today: '2026-11-20', budget: noBudget });
    expect(soon.ok && soon.data.rows.map((r) => r.cells.cod)).toEqual(['A-0000', 'A-0001', 'A-0002', 'A-0003', 'A-0004']);
    const later = await runTable(store(), { definition: rel }, { today: '2026-11-05', budget: noBudget });
    expect(later.ok && later.data.rows.map((r) => r.cells.cod)).toEqual(['A-0000']);
  });

  it('a season that is gone becomes the current one with a notice, it never blocks', async () => {
    const d = definition({ subject: 'plati', columns: ['data'], scope: { seasonId: 'deleted', sectionId: null, groupId: null, period: { kind: 'month', month: '2026-11' } } });
    const res = await runTable(store(), { definition: d }, { today: TODAY, budget: noBudget });
    expect(res.ok && res.data.notices).toHaveLength(1);
    expect(res.ok && res.data.count).toBe(3);
  });

  it('lets a spent budget throw BudgetError for the caller to turn into 503', async () => {
    let t = 0;
    const budget = startBudget(10, () => (t += 100));
    await expect(runTable(store(), body(), { today: TODAY, budget })).rejects.toBeInstanceOf(BudgetError);
  });
});

describe('readExportRequest', () => {
  it('takes a definition and a format, nothing else', () => {
    const d = body().definition;
    expect(readExportRequest({ ...body(), format: 'csv' })).toEqual({ ok: true, data: { definition: d, format: 'csv' } });
    expect(readExportRequest({ ...body(), format: 'xlsx' })).toMatchObject({ ok: true });
    for (const b of [body(), { ...body(), format: 'pdf' }, { ...body(), format: ['csv'] }, { ...body(), format: 'csv', sql: 'x' }, { format: 'csv' }, null, 'x']) {
      expect(readExportRequest(b), JSON.stringify(b)?.slice(-30)).toEqual({ ok: false, status: 400, error: 'Cerere invalidă.' });
    }
  });

  it('takes an optional view name of 1 to 80 characters, trimmed', () => {
    const d = body().definition;
    expect(readExportRequest({ ...body(), format: 'csv', name: '  Plăți pe grupă ' })).toEqual({ ok: true, data: { definition: d, format: 'csv', name: 'Plăți pe grupă' } });
    expect(readExportRequest({ ...body(), format: 'csv', name: 'x'.repeat(80) })).toMatchObject({ ok: true });
    for (const name of ['', '   ', 'x'.repeat(81), 5, null, ['a']]) {
      expect(readExportRequest({ ...body(), format: 'csv', name }), String(name).slice(0, 10)).toEqual({ ok: false, status: 400, error: 'Cerere invalidă.' });
    }
  });

  it('the CSV of a result is the screen result, one line per record', async () => {
    const res = await runTable(store(), body(), { today: TODAY, budget: noBudget });
    if (!res.ok) throw new Error('setup');
    const lines = tableCsv(res.data).split('\r\n').filter(Boolean);
    expect(lines[0]).toBe('\uFEFFData;Sportiv;Sumă');
    expect(lines).toHaveLength(1 + res.data.count);
  });

  it('too many rows: 422 and nothing to send', async () => {
    expect(await runTable(store(), body(), { today: TODAY, budget: noBudget, maxRows: 2 })).toMatchObject({ ok: false, status: 422 });
    expect((await runTable(store(), body(), { today: TODAY, budget: noBudget, maxRows: 3 })).ok).toBe(true);
  });
});

describe('readCatalog', () => {
  it('lists subjects, the seasons (current first), sections, groups, the ready-made views for the current season and the default view', async () => {
    const res = await readCatalog(store(), TODAY);
    expect(Object.keys(res.subjects)).toEqual(['sportivi', 'plati', 'abonamente', 'prezenta']);
    expect(res.subjects.plati.columns.map((c) => c.key)).toContain('nrChitanta');
    expect(res.seasons[0]).toMatchObject({ id: 's26', isCurrent: true });
    expect(res.readyMade.map((v) => v.id)).toEqual(['rm-plati-grupa', 'rm-prezenta-grupa', 'rm-ramas', 'rm-expira', 'rm-contacte', 'rm-sportivi-activi', 'rm-sportivi-plati']);
    expect(res.readyMade.every((v) => v.definition?.scope.seasonId === 's26')).toBe(true);
    expect(res.defaultViewId).toBe('rm-plati-grupa');
    expect(res.groups.map((g) => g.name)).toContain('Intermediari Bronze');
    expect(res.today).toBe(TODAY);
  });
});
