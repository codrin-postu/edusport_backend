import { describe, expect, it, vi } from 'vitest';
import { ADMIN_ERRORS } from '../errors';
import { moveToSchool, readMoveSchool } from '../school-move';
import { fakeClubStore, registrationRow, SECTIONS, type Fake } from './fake-store';

const ctx = (fake: Fake) => ({ store: fake.store, actor: 'ana@club.ro', today: { year: 2026, month: 10, day: 26 }, log: vi.fn() });
const twoSchools = [...SECTIONS, { id: 'p2', name: 'Patinoar 2', kind: 'school' as const, publicPage: true, order: 3 }];
const choice = { priceItemName: 'Abonament 8 ședințe grup', price: 770 };

describe('Mută la altă școală (spec 3.6, r4 e12)', () => {
  it('moves unconfirmed registrations, keeps number and subscription choice, logs "Mutată la"; confirmed/already-in-target/unknown mix counts only the confirmed one as skipped', async () => {
    const fake = fakeClubStore({
      sections: twoSchools,
      registrations: [registrationRow({ id: 'r1', subscriptionChoice: choice }), registrationRow({ id: 'r2', athleteId: 'a1' }), registrationRow({ id: 'r3', sectionId: 'p2' })],
    });
    expect(await moveToSchool(ctx(fake), ['r1', 'r2', 'r3', 'nope'], 'p2')).toEqual({ ok: true, data: { moved: 1, skipped: 1 } });
    expect(fake.state.registrations[0]).toMatchObject({ sectionId: 'p2', number: '2026-0142', subscriptionChoice: choice });
    expect(fake.state.registrations[1].sectionId).toBe('afi');
    expect(fake.state.history.map((h) => [h.subjectId, h.action, h.changes])).toEqual([['r1', 'school-moved', { schoolName: 'Patinoar 2' }]]);
  });

  it('does not count already-in-target or unknown ids as "deja confirmate"', async () => {
    const fake = fakeClubStore({ sections: twoSchools, registrations: [registrationRow({ id: 'r1', sectionId: 'p2' })] });
    expect(await moveToSchool(ctx(fake), ['r1', 'nope'], 'p2')).toEqual({ ok: true, data: { moved: 0, skipped: 0 } });
  });

  it('only with 2+ schools, only to a school', async () => {
    const one = fakeClubStore({ registrations: [registrationRow({ id: 'r1' })] });
    expect(await moveToSchool(ctx(one), ['r1'], 'afi')).toEqual({ ok: false, status: 400, error: ADMIN_ERRORS.invalid });
    const two = fakeClubStore({ sections: twoSchools, registrations: [registrationRow({ id: 'r1' })] });
    expect(await moveToSchool(ctx(two), ['r1'], 'club')).toEqual({ ok: false, status: 400, error: ADMIN_ERRORS.invalid });
  });

  it('reads the bulk body', () => {
    expect(readMoveSchool({ documentIds: ['r1', '', 3], sectionId: ' p2 ' })).toEqual({ ids: ['r1'], sectionId: 'p2' });
    expect(readMoveSchool({ documentIds: [], sectionId: 'p2' })).toBeNull();
  });
});
