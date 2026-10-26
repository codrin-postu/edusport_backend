import { describe, expect, it } from 'vitest';
import { groupOptions } from '../cards';
import { confirmContext, registrationMatchView, searchAthletes } from '../confirm-read';
import { athleteRow, fakeClubStore, GROUPS, registrationRow, SECTIONS } from './fake-store';

const TODAY = { year: 2026, month: 10, day: 26 };
const sigur = athleteRow({ id: 'a1', name: 'Maria Pop', birthDate: '2016-03-14', phone: '0711', updatedAt: '2026-01-01T00:00:00.000Z' });
const probabil = athleteRow({ id: 'a2', name: 'Pop Maria', birthDate: null, updatedAt: '2026-09-01T00:00:00.000Z' });
const seed = () => ({
  athletes: [sigur, probabil, athleteRow({ id: 'a3', name: 'Ion Ilie', birthDate: '2014-01-01' })],
  registrations: [registrationRow({ id: 'r1', lastSeason: 'Nu a participat' }), registrationRow({ id: 'r0', athleteId: 'a3', seasonId: 's25', season: '2025-2026' })],
  memberships: [{ id: 'm1', athleteId: 'a1', groupId: 'g-ib', seasonId: 's25', isMain: true, from: '2025-10-01' }],
});

describe('match card and window start (spec 3.3, 4.1)', () => {
  it('proposes the Sigur athlete, preselects it, lists the others', async () => {
    const view = await registrationMatchView(fakeClubStore(seed()).store, 'r1');
    expect(view.ok && view.data).toMatchObject({
      confirmed: false, canConfirm: true, canUndo: false, birthDateReadable: true, notAttendedLastSeason: true, preselect: 'existing',
      existing: { documentId: 'a1', name: 'Maria Pop', birthDate: '14.03.2016', lastGroup: { name: 'Intermediari Bronze', season: '2025-2026' } },
    });
    expect(view.ok && view.data.candidates.map((c) => c.documentId)).toEqual(['a2']);
    expect(view.ok && view.data.comparison.find((r) => r.field === 'phone')).toMatchObject({ differs: true, defaultUpdate: true });
  });

  it('a Probabil match is never preselected (r3 c1)', async () => {
    const fake = fakeClubStore({ ...seed(), athletes: [probabil] });
    const view = await registrationMatchView(fake.store, 'r1');
    expect(view.ok && [view.data.existing?.documentId, view.data.preselect]).toEqual(['a2', null]);
  });

  it('a confirmed registration shows no card', async () => {
    const view = await registrationMatchView(fakeClubStore(seed()).store, 'r0');
    expect(view.ok && [view.data.confirmed, view.data.existing, view.data.athleteId]).toEqual([true, null, 'a3']);
  });

  it('is a 404 for an unknown registration', async () => {
    expect(await registrationMatchView(fakeClubStore().store, 'x')).toMatchObject({ ok: false, status: 404 });
  });
});

describe('confirm window context (spec 4.3, 4.4)', () => {
  it('groups of the school then Club, current main group, A.C.S. change, wish, intent', async () => {
    const fake = fakeClubStore({
      ...seed(),
      registrations: [registrationRow({ id: 'r1', subscriptionChoice: { priceItemName: 'Abonament 8 ședințe grup', price: 770 } })],
      memberships: [{ id: 'm2', athleteId: 'a1', groupId: 'g-pro', seasonId: 's26', isMain: true, from: '2026-10-01' }],
    });
    const result = await confirmContext(fake.store, 'r1', 'a1', TODAY);
    expect(result.ok && result.data).toMatchObject({
      registrationNumber: '2026-0142',
      newAthlete: { name: 'Maria Pop', birthDate: '14.03.2016' },
      season: { label: '2026-2027', running: true, endedText: null },
      mainGroupNow: { name: 'Profesioniști', sectionName: 'Club' },
      acs: { seasonLabel: '2026-2027', current: null, next: 'in_asteptare', wish: 'da' },
      subscriptionIntent: 'Abonament 8 ședințe grup',
      blocked: null,
    });
    expect(result.ok && result.data.groups.map((g) => [g.sectionName, g.groups.map((x) => x.name)])).toEqual([
      ['Școala de Patinaj - AFI Cotroceni', ['Primii Pași', 'Intermediari Bronze']],
      ['Club', ['Profesioniști']],
    ]);
  });

  it('season ended: the line, no A.C.S. change', async () => {
    const fake = fakeClubStore({ ...seed(), registrations: [registrationRow({ id: 'r1', seasonId: 's25', season: '2025-2026' })] });
    const result = await confirmContext(fake.store, 'r1', null, TODAY);
    expect(result.ok && result.data.season).toEqual({ label: '2025-2026', running: false, endedText: 'Sezonul 2025-2026 s-a încheiat. Se leagă doar fișa sportivului.' });
    expect(result.ok && result.data.acs.next).toBeNull();
  });

  it('blocks an unreadable birth date, Respins and a confirmed registration', async () => {
    const regs = [registrationRow({ id: 'u', childBirthDate: 'martie' }), registrationRow({ id: 'x', status: 'Respins' }), registrationRow({ id: 'c', athleteId: 'a3' })];
    const store = fakeClubStore({ ...seed(), registrations: regs }).store;
    const blocked = await Promise.all(['u', 'x', 'c'].map(async (id) => ((await confirmContext(store, id, null, TODAY)) as { data: { blocked: string } }).data.blocked));
    expect(blocked).toEqual(['birth-date', 'not-confirmable', 'confirmed']);
  });

  it('lists only active groups, school first', () => {
    const groups = [...GROUPS, { id: 'old', name: 'Veche', sectionId: 'afi', order: 0, active: false }];
    expect(groupOptions('afi', SECTIONS, groups).map((s) => s.sectionId)).toEqual(['afi', 'club']);
    expect(groupOptions(null, SECTIONS, groups).map((s) => s.sectionId)).toEqual(['club']);
  });
});

describe('Caută alt sportiv / Adaugă sportiv search (spec 4.1, 6.7)', () => {
  it('without text: the proposed athlete first, then the other candidates', async () => {
    const cards = await searchAthletes(fakeClubStore(seed()).store, '', 'r1');
    expect(cards.map((c) => c.documentId)).toEqual(['a1', 'a2']);
  });

  it('with text: matching athletes, candidates first, inactive included', async () => {
    const fake = fakeClubStore({ ...seed(), athletes: [...seed().athletes, athleteRow({ id: 'a4', name: 'Maria Ionescu', status: 'inactiv' })] });
    expect((await searchAthletes(fake.store, 'maria', 'r1')).map((c) => c.documentId)).toEqual(['a1', 'a2', 'a4']);
    expect((await searchAthletes(fake.store, 'maria', null)).map((c) => c.documentId)).toEqual(['a4', 'a1', 'a2']);
  });
});
