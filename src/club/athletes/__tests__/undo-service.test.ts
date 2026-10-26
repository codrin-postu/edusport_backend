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
});
