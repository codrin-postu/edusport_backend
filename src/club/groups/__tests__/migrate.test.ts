import { describe, expect, it } from 'vitest';
import { planCoachLinks } from '../migrate/coaches';
import { planGroupNames } from '../migrate/group-names';
import { planMainsViolations } from '../migrate/mains';
import { linkLine, planEventLinks } from '../migrate/link-events';
import { planProgramPublic } from '../migrate/program-public';
import { planRetire } from '../migrate/retire';
import { planSchoolSeries, slotStart } from '../migrate/school-series';
import type { EventRecord, GroupRecord, Recurrence, SectionRecord } from '../types';
import { G_SEASONS } from './fake-group-store';

/** The production shape read on 2026-10-27 (.superpowers/phase4/research.md). */
const SECTIONS: SectionRecord[] = [
  { id: 'afi', name: 'Școala de Patinaj - AFI Cotroceni', kind: 'school', publicPage: true, order: 1, slug: 'scoala-afi' },
  { id: 'club', name: 'Club', kind: 'club', publicPage: false, order: 2, slug: 'club' },
];
const grp = (id: string, name: string, sectionId: string, order: number): GroupRecord => ({ id, name, sectionId, order, active: true, priceListId: null, coachIds: [], programPublic: true });
const GROUPS: GroupRecord[] = [
  grp('gold', 'Avansați Gold', 'afi', 1), grp('pp', 'Primii Pași', 'afi', 2), grp('inc', 'Începători', 'afi', 3), grp('is', 'Intermediari Silver', 'afi', 4),
  grp('ib', 'Intermediari Bronze', 'afi', 5), grp('as', 'Avansați Silver', 'afi', 6), grp('ab', 'Avansați Bronze', 'afi', 7), grp('pro', 'Profesioniști', 'club', 1), grp('av', 'Avansați', 'club', 2),
];
const SLOTS = [
  { timeSlot: '09:00 - 09:50', courses: ['Avansați Gold'] },
  { timeSlot: '10:00 - 10:50', courses: ['Primii Paşi', 'Intermediari Silver', 'Avansați Silver'] },
  { timeSlot: '11:00 - 11:50', courses: ['Începători', 'Intermediari Bronze', 'Avansați Bronze'] },
];
const rec = (over: Partial<Recurrence>): Recurrence => ({ freq: 'weekly', days: ['sat', 'sun'], weekOfMonth: null, startTime: '10:00', endTime: '12:50', singleDate: null, seasonStart: '2026-10-03', seasonEnd: '2027-05-30', ...over });
const ev = (id: string, title: string, type: string, recurrence: Recurrence, over: Partial<EventRecord> = {}): EventRecord => ({ id, title, type, description: null, groupId: null, recurrence, exceptions: [], ...over });
const EVENTS: EventRecord[] = [
  ev('e-av', 'Antrenament: Avansati', 'curs', rec({ days: ['tue', 'thu'], startTime: '18:00', endTime: '19:30', seasonStart: '2026-10-01', seasonEnd: '2027-05-31' })),
  ev('e-titlu', 'Titlu', 'curs', rec({ freq: 'none', days: [], singleDate: '2026-11-03', startTime: '10:00', endTime: '11:00', seasonStart: null, seasonEnd: null })),
  ev('e-old', 'Școala de patinaj', 'scoala', rec({ seasonStart: '2025-10-04', seasonEnd: '2026-05-31' })),
  ev('e-now', 'Școala de patinaj', 'scoala', rec({}), { exceptions: [
    { date: '2026-10-31', kind: 'liber', newDate: null, newStartTime: null, newEndTime: null, newTitle: 'Vacanța de toamnă', reason: null },
    { date: '2026-11-14', kind: 'anulat', newDate: null, newStartTime: null, newEndTime: null, newTitle: 'Patinoar închis', reason: null },
    { date: '2026-11-21', kind: 'cancel', newDate: null, newStartTime: null, newEndTime: null, newTitle: null, reason: null },
  ] }),
  ev('e-cupa', 'Cupa Primaverii', 'concurs', rec({ freq: 'none', days: [], singleDate: '2027-04-10' })),
  ev('e-test', 'Curs Grupa A', 'curs', rec({ days: ['mon'] })),
];
const SEASON = G_SEASONS[1];

describe('step 1 group-names', () => {
  it('rewrites cedilla letters with comma letters and nothing else', () => {
    expect(planGroupNames([{ id: 'pp', name: 'Primii Paşi' }, { id: 'ib', name: 'Intermediari Bronze' }, { id: 'x', name: 'Ţarc Ş' }])).toEqual([
      { id: 'pp', from: 'Primii Paşi', to: 'Primii Pași' }, { id: 'x', from: 'Ţarc Ş', to: 'Țarc Ș' },
    ]);
  });
});

describe('step 2 coaches (exact key match, W19)', () => {
  it('links the production texts: Club Avansați, never a Școala Avansați <nivel>', () => {
    const team = [{ id: 'andreea', name: 'Andreea Pascu', groups: ['Profesionisti', 'Avansati'] }, { id: 'virgil', name: 'Virgil Pascu', groups: ['Intermediari Silver', 'Intermediari Bronze'] }];
    expect(planCoachLinks(team, GROUPS)).toEqual({
      add: [
        { groupId: 'pro', groupName: 'Profesioniști', teamMemberId: 'andreea', teamMemberName: 'Andreea Pascu' }, { groupId: 'av', groupName: 'Avansați', teamMemberId: 'andreea', teamMemberName: 'Andreea Pascu' },
        { groupId: 'is', groupName: 'Intermediari Silver', teamMemberId: 'virgil', teamMemberName: 'Virgil Pascu' }, { groupId: 'ib', groupName: 'Intermediari Bronze', teamMemberId: 'virgil', teamMemberName: 'Virgil Pascu' },
      ],
      unmatched: [],
    });
  });

  it('lists unknown and ambiguous texts; skips a coach already on the group', () => {
    const groups = [...GROUPS.map((g) => (g.id === 'pro' ? { ...g, coachIds: ['andreea'] } : g)), grp('av2', 'Avansati', 'afi', 9)];
    expect(planCoachLinks([{ id: 'andreea', name: 'Andreea Pascu', groups: ['Profesionisti', 'Avansati', 'Grupa nouă', 3] }], groups)).toEqual({
      add: [], unmatched: [{ teamMemberName: 'Andreea Pascu', text: 'Avansati' }, { teamMemberName: 'Andreea Pascu', text: 'Grupa nouă' }],
    });
  });
});

describe('step 3 program-public (W8)', () => {
  it('lists groups without a value only', () => {
    expect(planProgramPublic([{ id: 'a', name: 'A', programPublic: null }, { id: 'b', name: 'B', programPublic: false }, { id: 'c', name: 'C', programPublic: undefined }])).toEqual([{ id: 'a', name: 'A' }, { id: 'c', name: 'C' }]);
  });
});

describe('step 4 school-series (W14, decided 5 to 7)', () => {
  it('reads the first time of a slot', () => {
    expect([slotStart('09:00 - 09:50'), slotStart('9.30-10.20'), slotStart('dimineața')]).toEqual(['09:00', '09:30', null]);
  });

  it('one weekly series per Școala group: 50 min, the old days, its window, its Liber and Anulat dates as reasons', () => {
    const plan = planSchoolSeries({ slots: SLOTS, groups: GROUPS, sections: SECTIONS, events: EVENTS, season: SEASON });
    expect(plan.create.map((c) => [c.groupName, c.write.recurrence.startTime, c.write.recurrence.endTime])).toEqual([
      ['Avansați Gold', '09:00', '09:50'], ['Primii Pași', '10:00', '10:50'], ['Intermediari Silver', '10:00', '10:50'], ['Avansați Silver', '10:00', '10:50'],
      ['Începători', '11:00', '11:50'], ['Intermediari Bronze', '11:00', '11:50'], ['Avansați Bronze', '11:00', '11:50'],
    ]);
    expect(plan.create[1].write).toMatchObject({ title: 'Primii Pași', type: 'scoala', groupId: 'pp', recurrence: { freq: 'weekly', days: ['sat', 'sun'], seasonStart: '2026-10-03', seasonEnd: '2027-05-31' } });
    expect(plan.create[1].write.exceptions).toEqual([
      { date: '2026-10-31', kind: 'liber', newDate: null, newStartTime: null, newEndTime: null, newTitle: null, reason: 'Vacanța de toamnă' },
      { date: '2026-11-14', kind: 'anulat', newDate: null, newStartTime: null, newEndTime: null, newTitle: null, reason: 'Patinoar închis' },
    ]);
    expect(plan.leftCancels).toEqual(['2026-11-21']);
    expect(plan.create[0].text).toEqual({ freq: 'weekly', days: ['sat', 'sun'], startTime: '09:00', durationMin: 50, from: '2026-10-03' });
  });

  it('lists unknown courses and unreadable slots; skips a group that already has a series; Sat + Sun without an old series', () => {
    const slots = [...SLOTS, { timeSlot: 'dimineața', courses: ['Începători'] }, { timeSlot: '12:00', courses: ['Grupa nouă'] }];
    const events = [...EVENTS.filter((e) => e.id !== 'e-now'), ev('g1', 'Primii Pași', 'scoala', rec({ startTime: '10:00', endTime: '10:50' }), { groupId: 'pp' })];
    const plan = planSchoolSeries({ slots, groups: GROUPS, sections: SECTIONS, events, season: SEASON });
    expect(plan.unreadSlots).toEqual(['dimineața']);
    expect(plan.unmatched).toEqual(['Grupa nouă']);
    expect(plan.skipped).toEqual(['Primii Pași']);
    expect(plan.create).toHaveLength(6);
    expect([plan.days, plan.from]).toEqual([['sat', 'sun'], '2026-10-01']);
  });
});

describe('step 5 link-events', () => {
  it('links "Antrenament: Avansati" to Club Avansați; leaves "Titlu", test names and other types alone', () => {
    const plan = planEventLinks(EVENTS, GROUPS);
    expect(plan.link).toEqual([{ eventId: 'e-av', title: 'Antrenament: Avansati', groupId: 'av', groupName: 'Avansați' }]);
    expect(plan.skipped).toEqual(['Curs Grupa A']);
    expect(plan.unmatched).toEqual(['Titlu']);
  });

  it('writes the line the group page would write (decided 1)', () => {
    expect(linkLine(EVENTS[0])).toEqual({ action: 'program-added', changes: { series: { freq: 'weekly', days: ['tue', 'thu'], startTime: '18:00', durationMin: 90, from: '2026-10-01' } } });
    expect(linkLine(EVENTS[1])).toEqual({ action: 'class-added', changes: { date: '2026-11-03', startTime: '10:00', durationMin: 60 } });
  });
});

describe('step 6 retire-old-series', () => {
  it('lists the unlinked Școala series of the current season with their dates and exceptions; the old season\'s stays', () => {
    expect(planRetire(EVENTS, SEASON)).toEqual([{
      eventId: 'e-now', title: 'Școala de patinaj', from: '2026-10-03', to: '2027-05-30',
      exceptions: [{ date: '2026-10-31', kind: 'liber', note: 'Vacanța de toamnă' }, { date: '2026-11-14', kind: 'anulat', note: 'Patinoar închis' }, { date: '2026-11-21', kind: 'cancel', note: null }],
    }]);
  });
});

describe('idempotency and the mains guard', () => {
  it('a group named in two slots, or a coach text twice, is planned once', () => {
    const slots = [...SLOTS, { timeSlot: '12:00', courses: ['Primii Pași'] }];
    expect(planSchoolSeries({ slots, groups: GROUPS, sections: SECTIONS, events: EVENTS, season: SEASON }).create.filter((c) => c.groupId === 'pp')).toHaveLength(1);
    expect(planCoachLinks([{ id: 't', name: 'T', groups: ['Avansati', 'avansați'] }], GROUPS).add).toHaveLength(1);
  });

  it('a second run after the writes finds nothing to do', () => {
    const plan = planSchoolSeries({ slots: SLOTS, groups: GROUPS, sections: SECTIONS, events: EVENTS, season: SEASON });
    const written = plan.create.map((c, i) => ({ id: `n${i}`, ...c.write }));
    const again = planSchoolSeries({ slots: SLOTS, groups: GROUPS, sections: SECTIONS, events: [...EVENTS, ...written], season: SEASON });
    expect(again.create).toEqual([]);
    expect(again.skipped).toHaveLength(7);
    const linked = EVENTS.map((e) => (e.id === 'e-av' ? { ...e, groupId: 'av' } : e));
    expect(planEventLinks(linked, GROUPS).link).toEqual([]);
  });

  it('mains: the steps write no memberships; the guard lists any athlete without exactly one current main in the season', () => {
    const m = (id: string, athleteId: string, groupId: string, isMain: boolean, to: string | null = null, seasonId = 's26') => ({ id, athleteId, groupId, seasonId, isMain, from: null, to });
    const rows = [
      m('1', 'ok', 'gold', true), m('2', 'ok', 'pp', false),
      m('3', 'two', 'gold', true), m('4', 'two', 'pp', true),
      m('5', 'zero', 'gold', false), m('6', 'zero', 'pp', false),
      m('7', 'ended', 'gold', true, '2026-12-01'), m('8', 'ended', 'pp', false, '2026-12-01'),
      m('9', 'other', 'gold', false, null, 's25'),
    ];
    expect(planMainsViolations(rows, 's26')).toEqual([{ athleteId: 'two', reason: 'many' }, { athleteId: 'zero', reason: 'none' }]);
    expect(planMainsViolations(rows.filter((r) => r.athleteId === 'ok' || r.athleteId === 'ended'), 's26')).toEqual([]);
  });
});
