import { describe, expect, it } from 'vitest';
import { readGroupHistory } from '../group-history';
import { readGroupOptions, readGroupPage } from '../group-page';
import { readGroupList, readListQuery } from '../list';
import { startDateFor } from '../season-pick';
import { readUnassigned } from '../unassigned';
import { athleteRow, event, fakeGroupStore, member, registrationRow } from './fake-group-store';

const TODAY = '2026-11-20';
const seed = () => fakeGroupStore({
  athletes: [
    athleteRow({ id: 'a1', name: 'Ana Ionescu', birthDate: '2014-05-02' }),
    athleteRow({ id: 'a2', name: 'Daria Stan', birthDate: '2015-03-10' }),
    athleteRow({ id: 'a3', name: 'Elisa Georgescu', birthDate: '2014-09-01', status: 'nou' }),
    athleteRow({ id: 'a4', name: 'Matei Ionescu', birthDate: '2017-02-14' }),
    athleteRow({ id: 'a5', name: 'Sofia Tănase' }),
    athleteRow({ id: 'a6', name: 'Tudor Matei', status: 'inactiv' }),
    athleteRow({ id: 'a7', name: 'Sportiv anonimizat', status: 'anonimizat' }),
  ],
  memberships: [
    member({ id: 'm1', athleteId: 'a1', groupId: 'g-ib' }),
    member({ id: 'm2', athleteId: 'a2', groupId: 'g-av' }),
    member({ id: 'm3', athleteId: 'a2', groupId: 'g-ib', isMain: false }),
    member({ id: 'm4', athleteId: 'a4', groupId: 'g-pp', seasonId: 's25' }),
    member({ id: 'm5', athleteId: 'a1', groupId: 'g-pp', to: '2026-10-31', isMain: false }),
  ],
  registrations: [registrationRow({ id: 'r1', athleteId: 'a3', seasonId: 's26' })],
  events: [event({ id: 'e1' }), event({ id: 'e2', groupId: 'g-av', type: 'curs', title: 'Avansați', recurrence: { freq: 'weekly', days: ['tue', 'thu'], weekOfMonth: null, startTime: '18:00', endTime: '19:30', singleDate: null, seasonStart: '2026-10-01', seasonEnd: '2027-05-31' } })],
});

describe('Grupe list (5.2)', () => {
  it('shows one tab per section, the school one as "Școala de patinaj", with group counts', async () => {
    const page = await readGroupList(seed().store, readListQuery({}), TODAY);
    expect(page.tabs).toEqual([{ documentId: 'afi', slug: 'scoala-afi', label: 'Școala de patinaj', count: 3 }, { documentId: 'club', slug: 'club', label: 'Club', count: 2 }]);
    expect(page.season).toEqual({ documentId: 's26', label: '2026-2027', past: false });
    expect(page.section).toBe('scoala-afi');
  });

  it('lists the groups with program, coaches and current members; the line counts distinct athletes', async () => {
    const page = await readGroupList(seed().store, readListQuery({ section: 'scoala-afi' }), TODAY);
    expect(page.rows).toEqual([
      { documentId: 'g-pp', name: 'Primii Pași', program: [], coaches: [], members: 0 },
      { documentId: 'g-ib', name: 'Intermediari Bronze', program: ['Sâ, Du 11:00'], coaches: ['Virgil Pascu'], members: 2 },
      { documentId: 'g-is', name: 'Intermediari Silver', program: [], coaches: ['Virgil Pascu'], members: 0 },
    ]);
    expect([page.athletes, page.groups]).toEqual([2, 3]);
    expect(page.unassigned).toBe(3);
  });

  it('falls back to the current season for an unknown label and marks a past season', async () => {
    expect((await readGroupList(seed().store, readListQuery({ season: '2019-2020' }), TODAY)).season?.label).toBe('2026-2027');
    expect((await readGroupList(seed().store, readListQuery({ season: '2025-2026' }), TODAY)).season?.past).toBe(true);
  });
});

describe('"Fără grupă" (5.3, W6, W30)', () => {
  it('lists Nou and Activ athletes without a current group, anonymized and inactive never', async () => {
    const page = await readUnassigned(seed().store, null, TODAY);
    expect(page.rows).toEqual([
      { athleteId: 'a3', name: 'Elisa Georgescu', source: 'Înscriere Școală, 12 ani', proposedGroupId: null },
      { athleteId: 'a4', name: 'Matei Ionescu', source: 'Din 2025-2026, 9 ani', proposedGroupId: 'g-pp' },
      { athleteId: 'a5', name: 'Sofia Tănase', source: 'Adăugat în Sportivi', proposedGroupId: null },
    ]);
  });

  it('offers every active group, school first, the section as hint', async () => {
    const page = await readUnassigned(seed().store, null, TODAY);
    expect(page.groups.map((g) => `${g.name} / ${g.sectionName}`)).toEqual([
      'Primii Pași / Școala de patinaj', 'Intermediari Bronze / Școala de patinaj', 'Intermediari Silver / Școala de patinaj', 'Profesioniști / Club', 'Avansați / Club',
    ]);
  });

  it('proposes nothing when last season\'s group is no longer active', async () => {
    const fake = seed();
    fake.state.groups[0].active = false;
    expect((await readUnassigned(fake.store, null, TODAY)).rows[1].proposedGroupId).toBeNull();
  });
});

describe('group page (6.1, 6.2)', () => {
  it('reads the header and the roster, other groups with the main one marked', async () => {
    const page = await readGroupPage(seed().store, 'g-ib', null, TODAY);
    expect(page?.section).toEqual({ documentId: 'afi', name: 'Școala de patinaj', kind: 'school' });
    expect(page?.priceList).toEqual({ documentId: 'pl-std', name: 'Standard' });
    expect(page?.coaches).toEqual([{ documentId: 'tm-virgil', name: 'Virgil Pascu' }]);
    expect(page?.members).toEqual([
      { membershipId: 'm1', athleteId: 'a1', name: 'Ana Ionescu', age: 12, isMain: true, others: [] },
      { membershipId: 'm3', athleteId: 'a2', name: 'Daria Stan', age: 11, isMain: false, others: [{ name: 'Avansați', isMain: true }] },
    ]);
    expect(page?.deletable).toBe(false);
  });

  it('a group that never had a member or an event can be deleted; an unknown one is null', async () => {
    expect((await readGroupPage(seed().store, 'g-is', null, TODAY))?.deletable).toBe(true);
    expect(await readGroupPage(seed().store, 'nope', null, TODAY)).toBeNull();
  });

  it('options carry price lists with their section and the coaches', async () => {
    const options = await readGroupOptions(seed().store);
    expect(options.priceLists).toEqual([{ documentId: 'pl-std', name: 'Standard', sectionId: 'afi' }, { documentId: 'pl-club', name: 'Club', sectionId: 'club' }]);
    expect(options.coaches.map((c) => c.name)).toEqual(['Andreea Pascu', 'Virgil Pascu']);
  });
});

describe('group Istoric (6.4, decided 2)', () => {
  it('shows the athlete\'s current name, newest first, "Migrare" for migration rows', async () => {
    const fake = seed();
    await fake.store.record({ subjectType: 'group', subjectId: 'g-ib', action: 'group-created', actor: 'migrare' });
    await fake.store.record({ subjectType: 'group', subjectId: 'g-ib', action: 'member-allocated', changes: { athleteId: 'a7' }, actor: 'admin@example.com' });
    const lines = await readGroupHistory(fake.store, 'g-ib');
    expect(lines.map((l) => [l.actor, l.text])).toEqual([['admin@example.com', 'Sportiv alocat: Sportiv anonimizat.'], ['Migrare', 'Grupă creată.']]);
  });

  it('shows "Sportiv șters" for an athlete that no longer exists (F9)', async () => {
    const fake = seed();
    await fake.store.record({ subjectType: 'group', subjectId: 'g-ib', action: 'member-added', changes: { athleteId: 'gone' }, actor: 'migrare' });
    const lines = await readGroupHistory(fake.store, 'g-ib');
    expect(lines.map((l) => l.text)).toEqual(['Sportiv adăugat: Sportiv șters.']);
  });
});

describe('startDateFor (gaps #29)', () => {
  it('is today, or the season start when it has not started', () => {
    const s26 = seed().state.seasons.find((s) => s.id === 's26')!;
    expect(startDateFor(s26, TODAY)).toBe(TODAY);
    expect(startDateFor(s26, '2026-07-01')).toBe(s26.startMonth.slice(0, 10));
  });
});
