import { describe, expect, it } from 'vitest';
import type { EventRecord, Recurrence } from '../groups/types';
import type { HistoryInput } from '../history';
import { SEASON_ERRORS, seasonExistsError, type RawAdminSeason, type SeasonWriteData } from '../season-admin';
import { createSeason, listAdminSeasons, updateSeason, type SeasonStore } from '../season-admin-service';

const fields = { label: '2026-2027', startMonth: '2026-10', endMonth: '2027-05', membershipFee: 270 };

const rec = (over: Partial<Recurrence>): Recurrence => ({
  freq: 'weekly', days: ['mon'], weekOfMonth: null, startTime: '17:00', endTime: '18:00', singleDate: null, seasonStart: '2026-10-01', seasonEnd: '2027-05-31', ...over,
});
const series = (id: string, over: Partial<Recurrence> = {}): EventRecord => ({ id, title: 'Grupa A', type: 'curs', description: null, groupId: 'g1', recurrence: rec(over), exceptions: [] });
const oneClass = (id: string, date: string): EventRecord => series(id, { freq: 'none', singleDate: date, seasonStart: null, seasonEnd: null });

function fakeStore(registrations = 0, extra: { memberships?: number; events?: EventRecord[] } = {}) {
  const events: EventRecord[] = extra.events ?? [];
  const locks: string[] = [];
  const order: string[] = [];
  const rows: RawAdminSeason[] = [
    { documentId: 'old', label: '2025-2026', startMonth: '2025-10-04', endMonth: '2026-05-31', membershipFee: 250, isCurrent: false },
    { documentId: 'cur', label: '2026-2027', startMonth: '2026-10-01', endMonth: '2027-05-31', membershipFee: 270, isCurrent: true },
  ];
  const history: HistoryInput[] = [];
  const writes: { documentId: string; data: SeasonWriteData }[] = [];
  const store: SeasonStore = {
    all: async () => rows,
    find: async (id) => rows.find((r) => r.documentId === id) ?? null,
    labelTaken: async (label, exceptId) => rows.some((r) => r.label === label && r.documentId !== exceptId),
    registrations: async (id) => (id === 'cur' ? registrations : 0),
    create: async (data) => {
      rows.push({ ...data, documentId: 'new' });
      return 'new';
    },
    update: async (documentId, data) => {
      writes.push({ documentId, data });
      Object.assign(rows.find((r) => r.documentId === documentId)!, data);
    },
    transaction: async (work) => {
      order.push('begin');
      return work();
    },
    lockSeason: async (id) => {
      locks.push(`season:${id}`);
    },
    lockEvent: async (id) => {
      locks.push(`event:${id}`);
    },
    memberships: async (id) => (id === 'cur' ? extra.memberships ?? 0 : 0),
    groupEvents: async () => events,
    updateSeries: async (id, recurrence) => {
      order.push(`series:${id}`);
      events.find((e) => e.id === id)!.recurrence = recurrence;
    },
    record: async (entry) => {
      history.push(entry);
    },
  };
  return { store, history, writes, rows, events, locks, order };
}

describe('listAdminSeasons', () => {
  it('newest first, with months and registration counts', async () => {
    const list = await listAdminSeasons(fakeStore(3).store);
    expect(list.map((s) => [s.label, s.startMonth, s.isCurrent, s.registrations])).toEqual([
      ['2026-2027', '2026-10', true, 3],
      ['2025-2026', '2025-10', false, 0],
    ]);
  });
});

describe('createSeason', () => {
  it('creates a season that is not current and records it', async () => {
    const { store, history, rows } = fakeStore();
    const r = await createSeason(store, { ...fields, label: '2027-2028', startMonth: '2027-10', endMonth: '2028-05' }, 'ana@club.ro');
    expect(r.ok && r.data[0]).toMatchObject({ label: '2027-2028', isCurrent: false });
    expect(rows[rows.length - 1]).toMatchObject({ isCurrent: false, startMonth: '2027-10-01', endMonth: '2028-05-31' });
    expect(history[0]).toMatchObject({ subjectType: 'season', subjectId: 'new', action: 'created', actor: 'ana@club.ro', changes: { label: { from: null, to: '2027-2028' } } });
  });

  it('refuses a label that exists', async () => {
    await expect(createSeason(fakeStore().store, fields, 'a')).resolves.toEqual({ ok: false, status: 409, error: seasonExistsError('2026-2027') });
  });
});

describe('updateSeason', () => {
  it('changes the fee, keeps the stored dates and records old -> new', async () => {
    const { store, history, writes } = fakeStore(5);
    await expect(updateSeason(store, 'old', { ...fields, label: '2025-2026', startMonth: '2025-10', endMonth: '2026-05', membershipFee: 260 }, 'a')).resolves.toMatchObject({ ok: true });
    expect(writes[0].data).toEqual({ label: '2025-2026', startMonth: '2025-10-04', endMonth: '2026-05-31', membershipFee: 260 });
    expect(history[0]).toMatchObject({ action: 'updated', changes: { membershipFee: { from: 250, to: 260 } } });
  });

  it('writes nothing when nothing changed', async () => {
    const { store, history, writes } = fakeStore();
    await updateSeason(store, 'cur', fields, 'a');
    expect(writes).toEqual([]);
    expect(history).toEqual([]);
  });

  it('locks the label of a season with registrations', async () => {
    const { store, writes } = fakeStore(2);
    await expect(updateSeason(store, 'cur', { ...fields, label: '2027-2028' }, 'a')).resolves.toEqual({ ok: false, status: 409, error: SEASON_ERRORS.locked });
    expect(writes).toEqual([]);
  });

  it('locks the label of a season with a group membership, 409 with the stale text', async () => {
    const { store, writes } = fakeStore(0, { memberships: 1 });
    await expect(updateSeason(store, 'cur', { ...fields, label: '2027-2028' }, 'a')).resolves.toEqual({ ok: false, status: 409, error: 'Datele s-au schimbat. Reîncarcă pagina.' });
    expect(writes).toEqual([]);
  });

  it('locks the label of a season with a group class (series or single), not one with another season\'s events', async () => {
    for (const e of [series('s1'), oneClass('c1', '2026-11-04')]) {
      const used = fakeStore(0, { events: [e] });
      expect((await updateSeason(used.store, 'cur', { ...fields, label: '2027-2028' }, 'a')).ok, e.id).toBe(false);
    }
    const other = fakeStore(0, { events: [series('old1', { seasonStart: '2025-10-01', seasonEnd: '2026-05-31' }), { ...series('x'), groupId: null }] });
    expect((await updateSeason(other.store, 'cur', { ...fields, label: '2027-2028' }, 'a')).ok).toBe(true);
  });

  it('a used season still takes a new fee, and the list marks it in use', async () => {
    const { store, writes } = fakeStore(0, { memberships: 2 });
    expect((await updateSeason(store, 'cur', { ...fields, membershipFee: 300 }, 'a')).ok).toBe(true);
    expect(writes[0].data.membershipFee).toBe(300);
    expect((await listAdminSeasons(store)).map((s) => [s.label, s.inUse])).toEqual([['2026-2027', true], ['2025-2026', false]]);
  });

  it('refuses a label used by another season, and a missing season', async () => {
    const { store } = fakeStore();
    await expect(updateSeason(store, 'cur', { ...fields, label: '2025-2026' }, 'a')).resolves.toEqual({ ok: false, status: 409, error: seasonExistsError('2025-2026') });
    await expect(updateSeason(store, 'nope', fields, 'a')).resolves.toEqual({ ok: false, status: 404, error: SEASON_ERRORS.missing });
  });
});

describe('updateSeason, a changed period moves the group programs', () => {
  const period = (over: Partial<typeof fields>) => ({ ...fields, ...over });
  const run = (events: EventRecord[], over: Partial<typeof fields>) => {
    const f = fakeStore(0, { events, memberships: 1 });
    return { f, result: updateSeason(f.store, 'cur', period(over), 'a') };
  };

  it('a shortened season clamps series that followed the end; the season is locked first, in one transaction', async () => {
    const { f, result } = run([series('s2'), series('s1', { seasonEnd: '2027-03-31' })], { endMonth: '2027-04' });
    const r = await result;
    expect(r).toMatchObject({ ok: true, meta: { moved: 1, outside: 0 } });
    expect(f.events.map((e) => [e.id, e.recurrence.seasonStart, e.recurrence.seasonEnd])).toEqual([['s2', '2026-10-01', '2027-04-30'], ['s1', '2026-10-01', '2027-03-31']]);
    expect(f.order).toEqual(['begin', 'series:s2']);
    expect(f.locks).toEqual(['season:cur', 'event:s2']);
  });

  it('an extended season carries series that ended on the old end, not ones ended earlier', async () => {
    const { f, result } = run([series('s1'), series('s2', { seasonEnd: '2027-03-31' })], { endMonth: '2027-06' });
    await result;
    expect(f.events.map((e) => e.recurrence.seasonEnd)).toEqual(['2027-06-30', '2027-03-31']);
  });

  it('moves the start both ways: series on the old start follow it, earlier ones are clamped', async () => {
    const { f, result } = run([series('s1'), series('s2', { seasonStart: '2026-10-15' }), series('s3', { seasonStart: '2026-10-01' })], { startMonth: '2026-11' });
    await result;
    expect(f.events.map((e) => e.recurrence.seasonStart)).toEqual(['2026-11-01', '2026-11-01', '2026-11-01']);
    const earlier = run([series('s1'), series('s2', { seasonStart: '2026-12-01' })], { startMonth: '2026-09' });
    await earlier.result;
    expect(earlier.f.events.map((e) => e.recurrence.seasonStart)).toEqual(['2026-09-01', '2026-12-01']);
  });

  it('leaves single classes where they are and counts those outside the new period', async () => {
    const { f, result } = run([oneClass('c1', '2027-05-10'), oneClass('c2', '2027-02-02'), oneClass('c3', '2025-12-01')], { endMonth: '2027-04' });
    expect(await result).toMatchObject({ ok: true, meta: { moved: 0, outside: 1 } });
    expect(f.events.map((e) => e.recurrence.singleDate)).toEqual(['2027-05-10', '2027-02-02', '2025-12-01']);
  });

  it('leaves a series that would end up empty, other seasons\' series and a group-less event alone', async () => {
    const { f, result } = run([series('gone', { seasonStart: '2026-10-01', seasonEnd: '2026-10-20' }), series('old', { seasonStart: '2025-10-01', seasonEnd: '2026-05-31' }), { ...series('free'), groupId: null }], { startMonth: '2026-11' });
    expect(await result).toMatchObject({ ok: true, meta: { moved: 0, outside: 0 } });
    expect(f.events.map((e) => [e.recurrence.seasonStart, e.recurrence.seasonEnd])).toEqual([['2026-10-01', '2026-10-20'], ['2025-10-01', '2026-05-31'], ['2026-10-01', '2027-05-31']]);
  });

  it('a name-only or fee-only edit moves nothing and sends no counts; the period change is the season\'s Istoric line', async () => {
    const same = fakeStore(0, { events: [series('s1')] });
    const r = await updateSeason(same.store, 'cur', period({ membershipFee: 300 }), 'a');
    expect(r).not.toHaveProperty('meta');
    expect(same.order).toEqual(['begin']);
    const moved = run([series('s1')], { endMonth: '2027-04' });
    await moved.result;
    expect(moved.f.history).toEqual([expect.objectContaining({ action: 'updated', changes: { endMonth: { from: '2027-05', to: '2027-04' } } })]);
  });
});
