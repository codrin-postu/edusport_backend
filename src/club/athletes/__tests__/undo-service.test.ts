import { describe, expect, it, vi } from 'vitest';
import { confirmRegistration } from '../confirm-service';
import { ADMIN_ERRORS } from '../errors';
import { undoConfirmation } from '../undo-service';
import { athleteRow, fakeClubStore, registrationRow, type Fake } from './fake-store';

const ctx = (fake: Fake) => ({ store: fake.store, actor: 'ana@club.ro', today: { year: 2026, month: 10, day: 26 }, log: vi.fn() });
const seed = () => ({
  athletes: [athleteRow({ id: 'a1', name: 'Maria Pop', birthDate: '2016-03-14', phone: '0711', status: 'inactiv' })],
  registrations: [registrationRow({ id: 'r1', status: 'Contactat' })],
  memberships: [{ id: 'm0', athleteId: 'a1', groupId: 'g-pro', seasonId: 's26', isMain: true, from: '2026-10-01' }],
});

async function confirmed(fake: Fake, choice: 'existing' | 'new' = 'existing') {
  const athleteId = choice === 'existing' ? 'a1' : null;
  await confirmRegistration(ctx(fake), 'r1', { choice, athleteId, groupId: 'g-pp', makeMain: true, updateFields: null });
}

describe('Anulează confirmarea (spec 4.6)', () => {
  it('reverts the link, status, group, main group, A.C.S., fields and reactivation; logs on both records', async () => {
    const fake = fakeClubStore(seed());
    await confirmed(fake);
    expect(await undoConfirmation(ctx(fake), 'r1')).toEqual({ ok: true, data: { status: 'Contactat', athleteDeleted: false } });
    expect(fake.state.registrations[0]).toMatchObject({ athleteId: null, status: 'Contactat', confirmation: null, matchAthleteId: 'a1', matchLevel: 'sigur' });
    expect(fake.state.athletes[0]).toMatchObject({ phone: '0711', contactName: null, status: 'inactiv' });
    expect(fake.state.memberships).toEqual([{ id: 'm0', athleteId: 'a1', groupId: 'g-pro', seasonId: 's26', isMain: true, from: '2026-10-01' }]);
    expect(fake.state.acs).toEqual([]);
    expect(fake.state.history.filter((h) => h.action === 'confirmation-undone').map((h) => h.subjectId)).toEqual(['r1', 'a1']);
  });

  it('the main group given back is noted in reverse: "<new> → <old>" (polish 10)', async () => {
    const fake = fakeClubStore(seed());
    await confirmed(fake);
    await undoConfirmation(ctx(fake), 'r1');
    const lines = fake.state.history.filter((h) => h.action === 'main-group-changed');
    expect(lines.map((h) => [h.subjectId, h.changes])).toEqual([
      ['a1', { from: 'Profesioniști', to: 'Primii Pași' }],
      ['a1', { from: 'Primii Pași', to: 'Profesioniști' }],
    ]);
  });

  it('no reverse line when the undo gives no main group back', async () => {
    const fake = fakeClubStore({ ...seed(), memberships: [] });
    await confirmed(fake);
    await undoConfirmation(ctx(fake), 'r1');
    expect(fake.state.history.map((h) => h.action)).not.toContain('main-group-changed');
  });

  it('locks the registration, then the confirmation\'s athlete (polish 12)', async () => {
    const fake = fakeClubStore(seed());
    await confirmed(fake);
    fake.state.locks = [];
    await undoConfirmation(ctx(fake), 'r1');
    expect(fake.state.locks).toEqual(['r1', 'athlete:a1']);
  });

  it('keeps an edit made after the confirmation', async () => {
    const fake = fakeClubStore(seed());
    await confirmed(fake);
    await fake.store.updateAthlete('a1', { phone: '0799' });
    await undoConfirmation(ctx(fake), 'r1');
    expect(fake.state.athletes[0].phone).toBe('0799');
  });

  it('removes a new athlete that has nothing else', async () => {
    const fake = fakeClubStore(seed());
    await confirmed(fake, 'new');
    expect(fake.state.athletes).toHaveLength(2);
    expect(await undoConfirmation(ctx(fake), 'r1')).toEqual({ ok: true, data: { status: 'Contactat', athleteDeleted: true } });
    expect(fake.state.athletes.map((a) => a.id)).toEqual(['a1']);
    expect(fake.state.history.filter((h) => h.action === 'confirmation-undone').map((h) => h.subjectId)).toEqual(['r1']);
  });

  it('keeps a new athlete that already has another linked registration (Minor 1)', async () => {
    const fake = fakeClubStore({ ...seed(), registrations: [...seed().registrations, registrationRow({ id: 'r2', number: '2026-0150' })] });
    await confirmed(fake, 'new');
    const created = fake.state.athletes[1];
    await fake.store.updateRegistration('r2', { athleteId: created.id });
    expect(await undoConfirmation(ctx(fake), 'r1')).toEqual({ ok: true, data: { status: 'Contactat', athleteDeleted: false } });
    expect(fake.state.athletes.map((a) => a.id)).toContain(created.id);
  });

  it('refuses when the registration link changed after the confirmation (Minor 1)', async () => {
    const fake = fakeClubStore(seed());
    await confirmed(fake);
    await fake.store.updateRegistration('r1', { athleteId: 'a2' });
    expect(await undoConfirmation(ctx(fake), 'r1')).toEqual({ ok: false, status: 409, error: ADMIN_ERRORS.stale });
  });

  it('sets a raised A.C.S. back to what it was before the confirmation (Minor 1)', async () => {
    const fake = fakeClubStore({ ...seed(), acs: [{ id: 'c1', athleteId: 'a1', seasonId: 's26', state: 'nu' }] });
    await confirmed(fake);
    expect(fake.state.acs).toEqual([{ id: 'c1', athleteId: 'a1', seasonId: 's26', state: 'in_asteptare' }]);
    await undoConfirmation(ctx(fake), 'r1');
    expect(fake.state.acs).toEqual([{ id: 'c1', athleteId: 'a1', seasonId: 's26', state: 'nu' }]);
  });

  it('refuses a registration not confirmed through the window', async () => {
    const fake = fakeClubStore({ ...seed(), registrations: [registrationRow({ id: 'r1', status: 'Confirmat' })] });
    expect(await undoConfirmation(ctx(fake), 'r1')).toEqual({ ok: false, status: 409, error: ADMIN_ERRORS.stale });
  });

  it('rolls back on a failure', async () => {
    const fake = fakeClubStore(seed());
    await confirmed(fake);
    fake.failOn('updateAthlete');
    expect(await undoConfirmation(ctx(fake), 'r1')).toEqual({ ok: false, status: 500, error: ADMIN_ERRORS.failed });
    expect(fake.state.registrations[0]).toMatchObject({ athleteId: 'a1', status: 'Confirmat' });
  });

  it('reverses a promotion: the newly-main membership demoted back, the old main restored (Task 8)', async () => {
    const fake = fakeClubStore({
      athletes: [athleteRow({ id: 'a1', name: 'Maria Pop', birthDate: '2016-03-14', phone: '0722111222', contactName: 'Ana Pop', email: 'ana@example.com', status: 'activ' })],
      registrations: [registrationRow({ id: 'r1', status: 'Contactat', membershipAnswer: 'nu' })],
      memberships: [
        { id: 'm0', athleteId: 'a1', groupId: 'g-ib', seasonId: 's26', isMain: true, from: '2026-10-01' },
        { id: 'm9', athleteId: 'a1', groupId: 'g-pp', seasonId: 's26', isMain: false, from: '2026-10-01' },
      ],
    });
    await confirmRegistration(ctx(fake), 'r1', { choice: 'existing', athleteId: 'a1', groupId: 'g-pp', makeMain: true, updateFields: [] });
    expect(fake.state.memberships.find((m) => m.id === 'm0')?.isMain).toBe(false);
    expect(fake.state.memberships.find((m) => m.id === 'm9')?.isMain).toBe(true);

    expect(await undoConfirmation(ctx(fake), 'r1')).toEqual({ ok: true, data: { status: 'Contactat', athleteDeleted: false } });
    expect(fake.state.memberships).toEqual([
      { id: 'm0', athleteId: 'a1', groupId: 'g-ib', seasonId: 's26', isMain: true, from: '2026-10-01' },
      { id: 'm9', athleteId: 'a1', groupId: 'g-pp', seasonId: 's26', isMain: false, from: '2026-10-01' },
    ]);
  });

  it('scopes the restored main to the confirmation season only: an older season main is left alone (Critical)', async () => {
    const fake = fakeClubStore({
      athletes: [athleteRow({ id: 'a1', name: 'Maria Pop', birthDate: '2016-03-14', phone: '0722111222', contactName: 'Ana Pop', email: 'ana@example.com', status: 'activ' })],
      registrations: [registrationRow({ id: 'r1', status: 'Contactat', membershipAnswer: 'nu' })],
      memberships: [
        { id: 'm-old', athleteId: 'a1', groupId: 'g-pro', seasonId: 's25', isMain: true, from: '2025-10-01' },
        { id: 'm0', athleteId: 'a1', groupId: 'g-ib', seasonId: 's26', isMain: true, from: '2026-10-01' },
        { id: 'm9', athleteId: 'a1', groupId: 'g-pp', seasonId: 's26', isMain: false, from: '2026-10-01' },
      ],
    });
    await confirmRegistration(ctx(fake), 'r1', { choice: 'existing', athleteId: 'a1', groupId: 'g-pp', makeMain: true, updateFields: [] });

    expect(await undoConfirmation(ctx(fake), 'r1')).toEqual({ ok: true, data: { status: 'Contactat', athleteDeleted: false } });
    const s26Mains = fake.state.memberships.filter((m) => m.seasonId === 's26' && m.isMain).map((m) => m.id);
    expect(s26Mains).toEqual(['m0']);
    expect(fake.state.memberships.find((m) => m.id === 'm-old')).toMatchObject({ seasonId: 's25', isMain: true });
  });
  describe('after the registration moved to another season (final review I1)', () => {
    const maria = athleteRow({ id: 'a1', name: 'Maria Pop', birthDate: '2016-03-14', phone: '0722111222', contactName: 'Ana Pop', email: 'ana@example.com', status: 'activ' });
    const D = { id: 'm-d', athleteId: 'a1', groupId: 'g-ib', seasonId: 's26', isMain: true, from: '2026-10-01' };
    const X = { id: 'm-x', athleteId: 'a1', groupId: 'g-pp', seasonId: 's26', isMain: false, from: '2026-10-01' };
    const Z = { id: 'm-z', athleteId: 'a1', groupId: 'g-pro', seasonId: 's25', isMain: true, from: '2025-10-01' };
    const mains = (fake: Fake, seasonId: string) => fake.state.memberships.filter((m) => m.seasonId === seasonId && m.isMain).map((m) => m.id);
    const moveTo25 = (fake: Fake) => Object.assign(fake.state.registrations[0], { seasonId: 's25', season: '2025-2026' });
    const confirmIn26 = (fake: Fake) => confirmRegistration(ctx(fake), 'r1', { choice: 'existing', athleteId: 'a1', groupId: 'g-pp', makeMain: true, updateFields: [] });
    const registration = registrationRow({ id: 'r1', status: 'Contactat', membershipAnswer: 'nu' });

    it('a promotion is undone in its own season: one main again, the old one; the other season untouched', async () => {
      const fake = fakeClubStore({ athletes: [maria], registrations: [registration], memberships: [D, X, Z] });
      await confirmIn26(fake);
      moveTo25(fake);
      expect(await undoConfirmation(ctx(fake), 'r1')).toMatchObject({ ok: true });
      expect(mains(fake, 's26')).toEqual(['m-d']);
      expect(fake.state.memberships.find((m) => m.id === 'm-z')).toEqual(Z);
    });

    it('a new main is undone in its own season: the old main restored; the other season main left alone', async () => {
      const fake = fakeClubStore({ athletes: [maria], registrations: [registration], memberships: [D, Z] });
      await confirmIn26(fake);
      moveTo25(fake);
      expect(await undoConfirmation(ctx(fake), 'r1')).toMatchObject({ ok: true });
      expect(fake.state.memberships.filter((m) => m.seasonId === 's26')).toEqual([D]);
      expect(fake.state.memberships.find((m) => m.id === 'm-z')).toEqual(Z);
    });

    it('a record written before the season was stored falls back to the season of the rows it names', async () => {
      const fake = fakeClubStore({ athletes: [maria], registrations: [registration], memberships: [D, Z] });
      await confirmIn26(fake);
      delete fake.state.registrations[0].confirmation?.seasonId;
      moveTo25(fake);
      await undoConfirmation(ctx(fake), 'r1');
      expect(fake.state.memberships.filter((m) => m.seasonId === 's26')).toEqual([D]);
      expect(mains(fake, 's25')).toEqual(['m-z']);
    });
  });
});
