import { describe, expect, it, vi } from 'vitest';
import { CONFIRM_ERRORS } from '../errors';
import { confirmRegistration } from '../confirm-service';
import type { ConfirmRequest } from '../../confirm/plan';
import { planUndo } from '../../confirm/undo-plan';
import { athleteRow, fakeClubStore, registrationRow, type Fake } from './fake-store';

const ctx = (fake: Fake) => ({ store: fake.store, actor: 'ana@club.ro', today: { year: 2026, month: 10, day: 26 }, log: vi.fn() });
const existing = (over: Partial<ConfirmRequest> = {}): ConfirmRequest => ({ choice: 'existing', athleteId: 'a1', groupId: 'g-pp', makeMain: false, updateFields: null, ...over });
const seed = () => ({
  athletes: [athleteRow({ id: 'a1', name: 'Maria Pop', birthDate: '2016-03-14', phone: '0711', status: 'inactiv', profileId: 'sp1' })],
  registrations: [registrationRow({ id: 'r1', status: 'Contactat' })],
  profiles: [{ id: 'sp1', name: 'Maria Pop', slug: 'maria-pop', previousSlugs: [], showPublicPage: true, published: true }],
});

describe('Sportiv existent (spec 4.5)', () => {
  it('links, applies the default ticks, reactivates, adds the group and A.C.S., writes both histories', async () => {
    const fake = fakeClubStore(seed());
    const result = await confirmRegistration(ctx(fake), 'r1', existing());
    expect(result).toEqual({ ok: true, data: { athleteId: 'a1', athleteName: 'Maria Pop', registrationId: 'r1' } });
    const reg = fake.state.registrations[0];
    expect([reg.athleteId, reg.status, reg.matchAthleteId, reg.confirmation?.previousStatus]).toEqual(['a1', 'Confirmat', null, 'Contactat']);
    expect(fake.state.athletes[0]).toMatchObject({ phone: '0722111222', contactName: 'Ana Pop', email: 'ana@example.com', status: 'activ', dataIncomplete: false });
    expect(fake.state.memberships).toEqual([{ id: expect.any(String), athleteId: 'a1', groupId: 'g-pp', seasonId: 's26', isMain: true, from: '2026-10-26', to: null }]);
    expect(fake.state.acs).toEqual([{ id: expect.any(String), athleteId: 'a1', seasonId: 's26', state: 'in_asteptare' }]);
    expect(fake.state.history.map((h) => h.action)).toEqual(['confirmed', 'registration-confirmed', 'updated', 'group-added', 'acs-changed', 'reactivated']);
    expect(fake.state.locks).toEqual(['r1', 'athlete:a1']);
  });

  it('a new main group replacing the old one is noted on the athlete (polish 10)', async () => {
    const memberships = [{ id: 'm0', athleteId: 'a1', groupId: 'g-pro', seasonId: 's26', isMain: true, from: '2026-10-01' }];
    const fake = fakeClubStore({ ...seed(), memberships });
    await confirmRegistration(ctx(fake), 'r1', existing({ makeMain: true }));
    const line = fake.state.history.filter((h) => h.action === 'main-group-changed');
    expect(line.map((h) => [h.subjectId, h.changes])).toEqual([['a1', { from: 'Profesioniști', to: 'Primii Pași' }]]);
  });

  it('no main group line for the first main group or a group added beside the main one', async () => {
    const first = fakeClubStore(seed());
    await confirmRegistration(ctx(first), 'r1', existing({ makeMain: true }));
    const beside = fakeClubStore({ ...seed(), memberships: [{ id: 'm0', athleteId: 'a1', groupId: 'g-pro', seasonId: 's26', isMain: true, from: null }] });
    await confirmRegistration(ctx(beside), 'r1', existing());
    expect([...first.state.history, ...beside.state.history].map((h) => h.action)).not.toContain('main-group-changed');
  });

  it('"Sportiv nou" locks only the registration (no athlete row yet)', async () => {
    const fake = fakeClubStore(seed());
    await confirmRegistration(ctx(fake), 'r1', { choice: 'new', athleteId: null, groupId: null, makeMain: false, updateFields: null });
    expect(fake.state.locks).toEqual(['r1']);
  });

  it('renames the public profile when the name is ticked; the slug stays', async () => {
    const fake = fakeClubStore({ ...seed(), registrations: [registrationRow({ id: 'r1', childName: 'Maria Ioana Pop' })] });
    await confirmRegistration(ctx(fake), 'r1', existing({ updateFields: ['name'] }));
    expect(fake.state.profiles[0]).toMatchObject({ name: 'Maria Ioana Pop', slug: 'maria-pop' });
  });

  it('a second registration of the same child adds nothing twice (r4 e5)', async () => {
    const fake = fakeClubStore({ ...seed(), registrations: [registrationRow({ id: 'r1' }), registrationRow({ id: 'r2', number: '2026-0150' })] });
    await confirmRegistration(ctx(fake), 'r1', existing());
    await confirmRegistration(ctx(fake), 'r2', existing());
    expect([fake.state.memberships.length, fake.state.acs.length]).toEqual([1, 1]);
    expect(fake.state.locks).toEqual(['r1', 'athlete:a1', 'r2', 'athlete:a1']);
  });

  it('the athlete row is locked before the athlete, its groups and A.C.S. are read (polish 12)', async () => {
    const fake = fakeClubStore(seed());
    const order: string[] = [];
    const athlete = fake.store.athlete.bind(fake.store);
    const lockAthlete = fake.store.lockAthlete.bind(fake.store);
    fake.store.athlete = async (id: string) => {
      order.push(`read:${id}`);
      return athlete(id);
    };
    fake.store.lockAthlete = async (id: string) => {
      order.push(`lock:${id}`);
      await lockAthlete(id);
    };
    await confirmRegistration(ctx(fake), 'r1', existing());
    expect(order.slice(0, 2)).toEqual(['lock:a1', 'read:a1']);
  });
});

describe('Sportiv nou (spec 4.5)', () => {
  it('creates the athlete from the registration, activ, linked', async () => {
    const fake = fakeClubStore(seed());
    const result = await confirmRegistration(ctx(fake), 'r1', { choice: 'new', athleteId: null, groupId: null, makeMain: false, updateFields: null });
    const created = fake.state.athletes[1];
    expect(result.ok && result.data.athleteId).toBe(created.id);
    expect(created).toMatchObject({ name: 'Maria Pop', birthDate: '2016-03-14', contactName: 'Ana Pop', status: 'activ', dataIncomplete: false });
    expect(fake.state.registrations[0].confirmation?.createdAthlete).toBe(true);
  });
});

describe('errors and concurrency (spec 4.7)', () => {
  it('the second confirmation is refused and nothing is doubled', async () => {
    const fake = fakeClubStore(seed());
    await confirmRegistration(ctx(fake), 'r1', existing());
    const second = await confirmRegistration(ctx(fake), 'r1', { choice: 'new', athleteId: null, groupId: null, makeMain: false, updateFields: null });
    expect(second).toEqual({ ok: false, status: 409, error: CONFIRM_ERRORS.taken });
    expect(fake.state.athletes).toHaveLength(1);
  });

  it('all or nothing: a failing write leaves no athlete, link, group, A.C.S. or history', async () => {
    const fake = fakeClubStore(seed());
    fake.failOn('createAcs');
    const result = await confirmRegistration(ctx(fake), 'r1', { choice: 'new', athleteId: null, groupId: 'g-pp', makeMain: false, updateFields: null });
    expect(result).toEqual({ ok: false, status: 500, error: CONFIRM_ERRORS.failed });
    expect([fake.state.athletes.length, fake.state.memberships.length, fake.state.acs.length, fake.state.history.length]).toEqual([1, 0, 0, 0]);
    expect(fake.state.registrations[0]).toMatchObject({ athleteId: null, status: 'Contactat', confirmation: null });
  });

  it('refuses an unreadable birth date, an unknown athlete or a group outside the picker', async () => {
    const fake = fakeClubStore({ ...seed(), registrations: [registrationRow({ id: 'r1', childBirthDate: 'martie' }), registrationRow({ id: 'r2' })] });
    expect(await confirmRegistration(ctx(fake), 'r1', existing())).toEqual({ ok: false, status: 400, error: CONFIRM_ERRORS.birthDate });
    expect(await confirmRegistration(ctx(fake), 'r2', existing({ athleteId: 'nope' }))).toEqual({ ok: false, status: 400, error: CONFIRM_ERRORS.failed });
    expect(await confirmRegistration(ctx(fake), 'r2', existing({ groupId: 'g-nope' }))).toEqual({ ok: false, status: 400, error: CONFIRM_ERRORS.failed });
  });

  it('refreshes the saved matches after a confirmation', async () => {
    const fake = fakeClubStore({ ...seed(), registrations: [registrationRow({ id: 'r1' }), registrationRow({ id: 'r2', number: '2026-0150' })] });
    await confirmRegistration(ctx(fake), 'r1', existing());
    expect(fake.state.registrations[1]).toMatchObject({ matchAthleteId: 'a1', matchLevel: 'sigur' });
  });

  it('a failing match refresh after the commit still returns ok and keeps the writes (M3)', async () => {
    const fake = fakeClubStore(seed());
    fake.failOn('athletes');
    const result = await confirmRegistration(ctx(fake), 'r1', existing());
    expect(result.ok).toBe(true);
    expect(fake.state.registrations[0].athleteId).toBe('a1');
    expect(fake.state.memberships).toHaveLength(1);
  });
});

describe('fix round 1: review findings', () => {
  it('promotes an existing non-main membership to main, demoting the old one; undo reverses both (I1)', async () => {
    const fake = fakeClubStore({
      athletes: [athleteRow({ id: 'a1', name: 'Maria Pop', birthDate: '2016-03-14', phone: '0722111222', contactName: 'Ana Pop', email: 'ana@example.com', status: 'activ' })],
      registrations: [registrationRow({ id: 'r1', membershipAnswer: 'nu' })],
      memberships: [
        { id: 'm0', athleteId: 'a1', groupId: 'g-ib', seasonId: 's26', isMain: true, from: '2026-10-01' },
        { id: 'm9', athleteId: 'a1', groupId: 'g-pp', seasonId: 's26', isMain: false, from: '2026-10-01' },
      ],
    });
    const result = await confirmRegistration(ctx(fake), 'r1', existing({ makeMain: true, updateFields: [] }));
    expect(result.ok).toBe(true);
    expect(fake.state.memberships).toHaveLength(2);
    expect(fake.state.memberships.find((m) => m.id === 'm0')?.isMain).toBe(false);
    expect(fake.state.memberships.find((m) => m.id === 'm9')?.isMain).toBe(true);
    const record = fake.state.registrations[0].confirmation;
    expect(record).toMatchObject({ demotedMainId: 'm0', promotedMainId: 'm9' });
    const undo = planUndo({
      record: record!,
      linkedAthleteId: 'a1',
      athlete: { id: 'a1', status: 'activ', profileId: null, ...fake.state.athletes[0] },
      membershipIds: fake.state.memberships.map((m) => m.id),
      mainMembershipId: fake.state.memberships.find((m) => m.isMain)?.id ?? null,
      acsRows: fake.state.acs.map(({ id, state }) => ({ id, state })),
      otherRegistrations: 0,
    });
    expect([undo.demoteMembershipId, undo.restoreMainId]).toEqual(['m9', 'm0']);
  });

  it('an ended season ignores a stale groupId: links only, writes no membership and no A.C.S. (deviation 2, M2)', async () => {
    const fake = fakeClubStore({ ...seed(), registrations: [registrationRow({ id: 'r1', season: '2025-2026', seasonId: 's25' })] });
    const result = await confirmRegistration(ctx(fake), 'r1', existing({ groupId: 'g-nope' }));
    expect(result.ok).toBe(true);
    expect(fake.state.registrations[0]).toMatchObject({ athleteId: 'a1', status: 'Confirmat' });
    expect(fake.state.memberships).toHaveLength(0);
    expect(fake.state.acs).toHaveLength(0);
  });
});
