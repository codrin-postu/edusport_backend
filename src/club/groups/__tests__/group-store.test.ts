import type { Core } from '@strapi/strapi';
import { describe, expect, it } from 'vitest';
import type { GroupStore } from '../types';
import { exceptionData, recurrenceData, strapiGroupStore, toEventRecord, toGroupRecord, toRecurrence } from '../strapi-store';
import { athleteRow, event, fakeContext, fakeGroupStore, member, registrationRow } from './fake-group-store';

describe('the in-memory group store', () => {
  it('has exactly the methods of the Strapi store', () => {
    const real = Object.keys(strapiGroupStore({} as Core.Strapi)).sort();
    expect(Object.keys(fakeGroupStore().store).sort()).toEqual(real);
  });

  it('rolls a failed transaction back completely', async () => {
    const { store, state, failOn } = fakeGroupStore({ athletes: [athleteRow({ id: 'a1' })] });
    failOn('record');
    await expect(store.transaction(async () => {
      await store.createMembership({ athleteId: 'a1', groupId: 'g-ib', seasonId: 's26', isMain: true, from: '2026-11-20' });
      await store.record({ subjectType: 'group', subjectId: 'g-ib', action: 'member-allocated', actor: 'x' });
    })).rejects.toThrow('fake failure in record');
    expect(state.memberships).toEqual([]);
  });

  it('filters memberships by season, group and athlete', async () => {
    const { store } = fakeGroupStore({ memberships: [member({ id: 'm1', athleteId: 'a1', groupId: 'g-ib' }), member({ id: 'm2', athleteId: 'a2', groupId: 'g-pp', seasonId: 's25' })] });
    expect((await store.memberships({ seasonId: 's26' })).map((m) => m.id)).toEqual(['m1']);
    expect((await store.memberships({ groupId: 'g-pp' })).map((m) => m.id)).toEqual(['m2']);
    expect((await store.memberships({ athleteId: 'a1', groupId: 'g-ib' })).map((m) => m.id)).toEqual(['m1']);
  });

  it('answers an action id and finds later lines on the same subjects', async () => {
    const { store } = fakeGroupStore();
    const ref = await store.recordAction({ subjectType: 'group', subjectId: 'g-ib', action: 'member-allocated', changes: { athleteId: 'a1' }, actor: 'x' });
    await store.record({ subjectType: 'athlete', subjectId: 'a1', action: 'group-added', changes: { actionId: ref.id }, actor: 'x' });
    await store.record({ subjectType: 'group', subjectId: 'g-pp', action: 'member-added', actor: 'x' });
    expect((await store.historyEntry(ref.id))?.seq).toBe(ref.seq);
    const later = await store.historyAfter(ref.seq, [{ type: 'athlete', id: 'a1' }, { type: 'group', id: 'g-ib' }]);
    expect(later.map((h) => h.action)).toEqual(['group-added']);
  });

  it('cancels only the queued e-mail jobs of one change', async () => {
    const { store, state } = fakeGroupStore();
    const job = { recipient: 'p@example.com', subject: 's', groupId: 'g-ib', notBefore: '2026-11-20T10:00:15.000Z', payload: { groupName: 'Intermediari Bronze', date: '2026-11-21', startTime: '11:00', mode: 'cancel' as const, newDate: null, newStartTime: null, nextDate: null, nextStartTime: null, reason: null } };
    await store.createEmailJobs([{ ...job, changeKey: 'h1' }, { ...job, changeKey: 'h1' }, { ...job, changeKey: 'h2' }]);
    state.jobs[1].status = 'sent';
    expect(await store.cancelEmailJobs('h1')).toBe(1);
    expect(state.jobs.map((j) => j.status)).toEqual(['cancelled', 'sent', 'queued']);
  });
});

describe('the rest of the in-memory store', () => {
  it('serves copies, so a caller cannot edit the state by accident', async () => {
    const { store, state } = fakeGroupStore({ athletes: [athleteRow({ id: 'a1' })], registrations: [registrationRow({ id: 'r1' })] });
    (await store.groups())[0].name = 'changed';
    (await store.athletes())[0].name = 'changed';
    expect(state.groups[0].name).toBe('Primii Pași');
    expect(state.athletes[0].name).not.toBe('changed');
    expect((await store.seasons()).map((s) => s.id)).toEqual(['s25', 's26', 's27']);
    expect((await store.sections()).map((s) => s.id)).toEqual(['afi', 'club']);
    expect((await store.teamMembers()).map((m) => m.id)).toEqual(['tm-andreea', 'tm-virgil']);
    expect((await store.priceLists()).map((p) => p.id)).toEqual(['pl-std', 'pl-club']);
    expect((await store.registrations()).map((r) => r.id)).toEqual(['r1']);
    expect((await store.athlete('a1'))?.id).toBe('a1');
    expect(await store.athlete('nope')).toBeNull();
    expect((await store.group('g-ib'))?.name).toBe('Intermediari Bronze');
    expect(await store.group('nope')).toBeNull();
  });

  it('answers admin names and the filed-after count', async () => {
    const { store } = fakeGroupStore({ admins: { 'a@x.ro': 'Ana' }, filedAfter: 3 });
    expect(await store.adminNames(['a@x.ro', 'b@x.ro'])).toEqual({ 'a@x.ro': 'Ana' });
    expect(await store.registrationsFiledAfter('s26', '2026-11-20T00:00:00.000Z')).toBe(3);
  });

  it('records the locks taken, in call order', async () => {
    const { store, state } = fakeGroupStore();
    await store.transaction(async () => {
      await store.lockSeason('s26');
      await store.lockAthlete('a1');
      await store.lockGroup('g-ib');
      await store.lockEvent('ev1');
      await store.lockHistoryEntry('h1');
    });
    expect(state.locks).toEqual(['season:s26', 'athlete:a1', 'group:g-ib', 'event:ev1', 'history:h1']);
  });

  it('creates, updates and deletes groups', async () => {
    const { store } = fakeGroupStore();
    const id = await store.createGroup({ name: 'Nou', sectionId: 'afi', priceListId: null, coachIds: ['tm-virgil'], programPublic: true, order: 9 });
    expect(await store.group(id)).toMatchObject({ name: 'Nou', sectionId: 'afi', order: 9, active: true, coachIds: ['tm-virgil'] });
    await store.updateGroup(id, { name: 'Nou 2', programPublic: false });
    expect(await store.group(id)).toMatchObject({ name: 'Nou 2', programPublic: false, coachIds: ['tm-virgil'] });
    await store.deleteGroup(id);
    expect(await store.group(id)).toBeNull();
  });

  it('creates, updates and deletes memberships', async () => {
    const { store } = fakeGroupStore({ athletes: [athleteRow({ id: 'a1' })] });
    const id = await store.createMembership({ athleteId: 'a1', groupId: 'g-ib', seasonId: 's26', isMain: true, from: '2026-11-20' });
    expect(await store.membership(id)).toMatchObject({ athleteId: 'a1', isMain: true, from: '2026-11-20', to: null });
    await store.updateMembership(id, { isMain: false, to: '2026-12-01' });
    expect(await store.membership(id)).toMatchObject({ isMain: false, to: '2026-12-01' });
    await store.deleteMembership(id);
    expect(await store.membership(id)).toBeNull();
  });

  it('sets an athlete status and the current season', async () => {
    const { store } = fakeGroupStore({ athletes: [athleteRow({ id: 'a1' })] });
    await store.setAthleteStatus('a1', 'inactiv');
    expect((await store.athlete('a1'))?.status).toBe('inactiv');
    await store.setSeasonCurrent('s27', true);
    expect((await store.seasons()).find((s) => s.id === 's27')?.isCurrent).toBe(true);
  });

  it('creates, updates, filters and deletes events', async () => {
    const { store } = fakeGroupStore({ events: [event({ id: 'e1', groupId: 'g-pp' })] });
    const { id: _id, ...write } = event({ id: 'x' });
    const id = await store.createEvent(write);
    expect((await store.events({ groupId: 'g-ib' })).map((e) => e.id)).toEqual([id]);
    expect((await store.events()).length).toBe(2);
    await store.updateEvent(id, { title: 'Alt titlu', exceptions: [{ date: '2026-11-21', kind: 'cancel', newDate: null, newStartTime: null, newEndTime: null, newTitle: null, reason: 'x' }] });
    expect(await store.event(id)).toMatchObject({ title: 'Alt titlu', groupId: 'g-ib' });
    expect((await store.event(id))?.exceptions).toHaveLength(1);
    await store.deleteEvent(id);
    expect(await store.event(id)).toBeNull();
  });

  it('keeps breaks ordered by start date', async () => {
    const { store } = fakeGroupStore();
    const late = await store.createBreak({ label: 'Vacanta', startDate: '2026-12-22', endDate: '2027-01-04' });
    const early = await store.createBreak({ label: 'Toamna', startDate: '2026-10-26', endDate: '2026-11-01' });
    expect((await store.breaks()).map((b) => b.id)).toEqual([early, late]);
    await store.updateBreak(early, { label: 'Toamna 2', startDate: '2026-10-26', endDate: '2026-11-02' });
    expect((await store.breaks())[0].label).toBe('Toamna 2');
    await store.deleteBreak(early);
    expect((await store.breaks()).map((b) => b.id)).toEqual([late]);
  });

  it('lists history by subject and rewrites the changes of one line', async () => {
    const { store } = fakeGroupStore();
    const ref = await store.recordAction({ subjectType: 'group', subjectId: 'g-ib', action: 'member-allocated', actor: 'x' });
    await store.record({ subjectType: 'group', subjectId: 'g-pp', action: 'member-added', actor: 'x' });
    expect((await store.history('group', 'g-ib')).map((h) => h.id)).toEqual([ref.id]);
    await store.setHistoryChanges(ref.id, { undone: true });
    expect((await store.historyEntry(ref.id))?.changes).toEqual({ undone: true });
    expect(await store.historyEntry('nope')).toBeNull();
    expect((await store.historyAfter(0, null)).length).toBe(2);
    expect(await store.historyAfter(0, [])).toEqual([]);
  });
});

describe('locks and writes to a missing row', () => {
  it('refuses a lock outside a transaction', async () => {
    const { store } = fakeGroupStore();
    await expect(store.lockGroup('g-ib')).rejects.toThrow('outside a transaction');
    await expect(store.lockHistoryEntry('h1')).rejects.toThrow('outside a transaction');
  });

  const calls: [string, (s: GroupStore) => Promise<unknown>][] = [
    ['updateGroup', (s) => s.updateGroup('nope', { name: 'x' })],
    ['deleteGroup', (s) => s.deleteGroup('nope')],
    ['setAthleteStatus', (s) => s.setAthleteStatus('nope', 'inactiv')],
    ['setSeasonCurrent', (s) => s.setSeasonCurrent('nope', true)],
    ['updateMembership', (s) => s.updateMembership('nope', { isMain: false })],
    ['deleteMembership', (s) => s.deleteMembership('nope')],
    ['updateEvent', (s) => s.updateEvent('nope', { title: 'x' })],
    ['deleteEvent', (s) => s.deleteEvent('nope')],
    ['updateBreak', (s) => s.updateBreak('nope', { label: 'x', startDate: '2026-12-01', endDate: '2026-12-02' })],
    ['deleteBreak', (s) => s.deleteBreak('nope')],
    ['setHistoryChanges', (s) => s.setHistoryChanges('nope', {})],
  ];

  it.each(calls)('the fake %s throws for a missing id', async (_name, call) => {
    await expect(call(fakeGroupStore().store)).rejects.toThrow();
  });

  const empty = { update: async () => null, delete: async () => ({ documentId: 'x', entries: [] }) };
  const strapiOfMissing = {
    documents: () => empty,
    db: { query: () => ({ update: async () => null }) },
  } as unknown as Core.Strapi;

  it.each(calls)('the Strapi %s throws for a missing id', async (_name, call) => {
    await expect(call(strapiGroupStore(strapiOfMissing))).rejects.toThrow('the row does not exist');
  });
});

describe('the fake context', () => {
  it('counts revalidation pings and collects log lines', () => {
    const f = fakeContext({}, '2026-12-01');
    f.ctx.revalidate();
    f.ctx.log('boom');
    expect(f.ctx.today).toBe('2026-12-01');
    expect(f.revalidated()).toBe(1);
    expect(f.logs).toEqual(['boom']);
  });
});

describe('the Strapi row mappers', () => {
  it('maps a group document with its relations', () => {
    expect(toGroupRecord({ documentId: 'g1', name: 'G', section: { documentId: 's' }, order: 2, priceList: { documentId: 'p' }, coaches: [{ documentId: 'c1' }], programPublic: false }))
      .toEqual({ id: 'g1', name: 'G', sectionId: 's', order: 2, active: true, priceListId: 'p', coachIds: ['c1'], programPublic: false });
  });

  it('round-trips a recurrence through the stored shape', () => {
    const r = event({ id: 'e' }).recurrence;
    const stored = recurrenceData(r);
    expect(stored).toMatchObject({ freq: 'weekly', sat: true, sun: true, mon: false, startTime: '11:00:00.000', endTime: '11:50:00.000' });
    expect(toRecurrence(stored)).toEqual(r);
  });

  it('round-trips an exception and reads an event without a recurrence', () => {
    const x = { date: '2026-11-21', kind: 'override' as const, newDate: '2026-11-22', newStartTime: '12:00', newEndTime: '12:50', newTitle: null, reason: 'sala' };
    const stored = exceptionData(x);
    expect(stored.newStartTime).toBe('12:00:00.000');
    expect(toEventRecord({ documentId: 'e', title: 'T', type: 'scoala', exceptions: [stored] }).exceptions).toEqual([x]);
    expect(toEventRecord({ documentId: 'e', title: 'T', type: 'scoala' }).recurrence.freq).toBe('weekly');
  });
});
