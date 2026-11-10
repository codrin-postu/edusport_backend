import { describe, expect, it } from 'vitest';
import { PORTAL_ERRORS } from '../../copy';
import { readCoachGroupPage, readGroups } from '../groups';
import { forbiddenKeysIn } from '../views';
import { removeMembershipFrom } from '../../../groups/members';
import { member } from '../../../groups/__tests__/fake-group-store';
import { removeMember } from '../members';
import { sessionRow } from '../../../presence/__tests__/fake-store';
import { coachCtx } from './coach-seed';

const TODAY = '2026-11-20';

describe('readGroups', () => {
  it('own groups with program and children, the others with coach names only', async () => {
    const out = await readGroups(coachCtx('tm-andreea'));
    expect(out).toEqual({
      ok: true,
      data: {
        mine: [
          { groupId: 'g-scoala-a', name: 'Școala A', kind: 'school', program: ['Sâ, Du 11:00'], children: 2, next: { date: '2026-11-21', startTime: '11:00' } },
          { groupId: 'g-club-a', name: 'Club A', kind: 'club', program: ['Vi 17:00'], children: 2, next: { date: '2026-11-20', startTime: '17:00' } },
        ],
        others: [{ groupId: 'g-club-b', name: 'Club B', coaches: ['Virgil Pascu'], program: ['Mi, Vi 18:00'], children: 1, next: { date: '2026-11-20', startTime: '18:00' } }],
      },
    });
    expect(forbiddenKeysIn(out)).toEqual([]);
  });

  it('an inactive group is in neither list', async () => {
    const out = await readGroups(coachCtx('tm-andreea'));
    expect(JSON.stringify(out)).not.toContain('g-old');
  });
});

describe('readCoachGroupPage', () => {
  it('an own group shows members, never contacts', async () => {
    const c = coachCtx('tm-andreea');
    c.fake.group.athletes.find((a) => a.id === 'a-club-2')!.status = 'nou';
    const out = await readCoachGroupPage(c, 'g-club-a');
    expect(out).toMatchObject({ ok: true, data: { own: true, kind: 'club', coaches: ['Andreea Pascu'], programPublic: true, standIn: [], todayKey: 'ev-g-club-a|2026-11-20|17:00' } });
    if (!out.ok) throw new Error('refused');
    expect(out.data.members).toEqual([
      { athleteId: 'a-club-1', name: 'Ana Club', age: 14, isNew: false, alsoIn: [], leavesOn: null },
      { athleteId: 'a-club-2', name: 'Bogdan Club', age: 16, isNew: true, alsoIn: [], leavesOn: null },
    ]);
    expect(forbiddenKeysIn(out)).toEqual([]);
    expect(JSON.stringify(out)).not.toMatch(/Părinte Secret|0722000111|copil@example/);
  });

  it('a Școala own group has no programPublic', async () => {
    const out = await readCoachGroupPage(coachCtx('tm-andreea'), 'g-scoala-a');
    expect(out).toMatchObject({ ok: true, data: { own: true, kind: 'school', programPublic: null } });
  });

  it('another group has read-only names and ages and only the slots of the last 7 days, newest first', async () => {
    const out = await readCoachGroupPage(coachCtx('tm-andreea'), 'g-club-b');
    expect(out).toEqual({
      ok: true,
      data: {
        groupId: 'g-club-b', name: 'Club B', kind: 'club', own: false, coaches: ['Virgil Pascu'], program: ['Mi, Vi 18:00'], members: [{ name: 'Eva Cealaltă', age: 15 }], membersReadOnly: true, programPublic: null, location: null,
        todayKey: 'ev-g-club-b|2026-11-20|18:00',
        standIn: [
          { occurrenceKey: 'ev-g-club-b|2026-11-20|18:00', date: '2026-11-20', startTime: '18:00' },
          { occurrenceKey: 'ev-g-club-b|2026-11-18|18:00', date: '2026-11-18', startTime: '18:00' },
          { occurrenceKey: 'ev-g-club-b|2026-11-13|18:00', date: '2026-11-13', startTime: '18:00' },
        ],
      },
    });
    expect(forbiddenKeysIn(out)).toEqual([]);
  });

  it('another group lists names and ages only: no ids, contacts or notes, sorted by name, today-running members only', async () => {
    const c = coachCtx('tm-andreea');
    c.fake.group.memberships.push(member({ id: 'gm-b2', athleteId: 'a-club-1', groupId: 'g-club-b' }), member({ id: 'gm-b3', athleteId: 'a-club-2', groupId: 'g-club-b', to: '2026-11-01' }));
    const out = await readCoachGroupPage(c, 'g-club-b');
    if (!out.ok) throw new Error('refused');
    expect(out.data.membersReadOnly).toBe(true);
    expect(out.data.members).toEqual([{ name: 'Ana Club', age: 14 }, { name: 'Eva Cealaltă', age: 15 }]);
    out.data.members.forEach((m) => expect(Object.keys(m).sort()).toEqual(['age', 'name']));
    expect(forbiddenKeysIn(out)).toEqual([]);
    expect(JSON.stringify(out)).not.toMatch(/athleteId|a-b-1|Părinte Secret|0722000111|copil@example/);
  });

  it('an own group is not read only', async () => {
    const out = await readCoachGroupPage(coachCtx('tm-andreea'), 'g-club-a');
    expect(out).toMatchObject({ ok: true, data: { membersReadOnly: false } });
  });

  it('losing the coach link turns the page into another group page, read on each request', async () => {
    const c = coachCtx('tm-andreea');
    expect(await readCoachGroupPage(c, 'g-club-a')).toMatchObject({ data: { own: true } });
    c.fake.group.groups.find((g) => g.id === 'g-club-a')!.coachIds = ['tm-virgil'];
    const out = await readCoachGroupPage(c, 'g-club-a');
    expect(out).toMatchObject({ ok: true, data: { own: false, membersReadOnly: true } });
  });

  it('an unknown or inactive group answers 404', async () => {
    expect(await readCoachGroupPage(coachCtx('tm-andreea'), 'g-old')).toEqual({ ok: false, status: 404, error: PORTAL_ERRORS.notFound });
    expect(await readCoachGroupPage(coachCtx('tm-andreea'), 'nope')).toMatchObject({ status: 404 });
  });

  it('classes the owner already saved are not offered to a stand-in, today included unless she is listed', async () => {
    const c = coachCtx('tm-andreea');
    const saved = (id: string, date: string, coachIds: string[]) => sessionRow({
      id, groupId: 'g-club-b', date, startTime: '18:00', eventId: 'ev-g-club-b', occurrenceKey: `ev-g-club-b|${date}|18:00`, coachIds,
    });
    c.fake.state.sessions.push(saved('s1', '2026-11-18', ['tm-virgil']), saved('s2', '2026-11-20', ['tm-virgil']));
    const out = await readCoachGroupPage(c, 'g-club-b');
    expect(out).toMatchObject({ ok: true, data: { todayKey: null, standIn: [{ date: '2026-11-13' }] } });
    c.fake.state.sessions.find((s) => s.id === 's2')!.coachIds = ['tm-virgil', 'tm-andreea'];
    expect(await readCoachGroupPage(c, 'g-club-b')).toMatchObject({ data: { todayKey: 'ev-g-club-b|2026-11-20|18:00' } });
  });

  it('todayKey looks at every class of today, not only the first', async () => {
    const c = coachCtx('tm-andreea');
    const early = c.fake.state.calendar.events.find((e) => e.documentId === 'ev-g-club-b')!;
    c.fake.state.calendar.events.push({ ...early, id: 99, documentId: 'ev-g-club-b-late', recurrence: { ...early.recurrence, startTime: '20:00', endTime: '21:00' } } as typeof early);
    c.fake.state.sessions.push(sessionRow({
      id: 's-early', groupId: 'g-club-b', date: TODAY, startTime: '18:00', eventId: 'ev-g-club-b', occurrenceKey: `ev-g-club-b|${TODAY}|18:00`, coachIds: ['tm-virgil'],
    }));
    expect(await readCoachGroupPage(c, 'g-club-b')).toMatchObject({ data: { todayKey: `ev-g-club-b-late|${TODAY}|20:00` } });
  });
});

describe('next class, location and leave date', () => {
  it('today counts while its start time is later than now, else the next class', async () => {
    const c = coachCtx('tm-andreea');
    const next = async () => { const o = await readGroups(c); return o.ok ? o.data.mine.find((g) => g.groupId === 'g-club-a')!.next : 'refused'; };
    expect(await next()).toEqual({ date: '2026-11-20', startTime: '17:00' });
    c.presence.now = () => new Date('2026-11-20T16:00:00.000Z');
    expect(await next()).toEqual({ date: '2026-11-27', startTime: '17:00' });
  });

  it('a group with no class in 60 days has next null', async () => {
    const c = coachCtx('tm-andreea');
    c.fake.group.groups.push({ id: 'g-empty', name: 'Fără program', sectionId: 'club', order: 9, active: true, priceListId: 'pl-club', coachIds: ['tm-andreea'], programPublic: true });
    const o = await readGroups(c);
    expect(o.ok && o.data.mine.find((g) => g.groupId === 'g-empty')?.next).toBeNull();
  });

  it('other groups carry no member names', async () => {
    const o = await readGroups(coachCtx('tm-andreea'));
    expect(JSON.stringify(o.ok && o.data.others)).not.toMatch(/Eva/);
  });

  it('the group page has the section location, null without one', async () => {
    const c = coachCtx('tm-andreea');
    expect(await readCoachGroupPage(c, 'g-club-a')).toMatchObject({ data: { location: null } });
    c.fake.group.sections.find((s) => s.id === 'club')!.locationName = 'Patinoar Club';
    expect(await readCoachGroupPage(c, 'g-club-a')).toMatchObject({ data: { location: 'Patinoar Club' } });
  });

  it('a member with a scheduled removal stays listed with leavesOn until the day before it', async () => {
    const c = coachCtx('tm-andreea', '2026-11-09');
    expect((await removeMembershipFrom(c.groups, 'gm-1', '2026-11-20')).ok).toBe(true);
    const page = await readCoachGroupPage(c, 'g-club-a');
    if (!page.ok) throw new Error('refused');
    expect(page.data.members?.map((m) => [m.athleteId, m.leavesOn])).toEqual([['a-club-1', '2026-11-20'], ['a-club-2', null]]);
    const later = coachCtx('tm-andreea', '2026-11-20');
    later.fake.group.memberships.find((m) => m.id === 'gm-1')!.to = '2026-11-19';
    const gone = await readCoachGroupPage(later, 'g-club-a');
    expect(gone.ok && gone.data.members?.map((m) => m.athleteId)).toEqual(['a-club-2']);
  });

  it('the heir row of a split shows no leave date, the group she leaves does; counts include her until the date', async () => {
    const c = coachCtx('tm-andreea', '2026-11-20');
    c.fake.group.memberships.push(member({ id: 'gm-extra', athleteId: 'a-club-1', groupId: 'g-scoala-a', isMain: false, from: '2026-10-01' }));
    expect((await removeMember(c, 'g-club-a', 'a-club-1', { from: '2026-11-25' })).ok).toBe(true);
    const heir = await readCoachGroupPage(c, 'g-scoala-a');
    const left = await readCoachGroupPage(c, 'g-club-a');
    if (!heir.ok || !left.ok) throw new Error('refused');
    expect(heir.data.members?.filter((m) => m.athleteId === 'a-club-1').map((m) => m.leavesOn)).toEqual([null]);
    expect(left.data.members?.find((m) => m.athleteId === 'a-club-1')?.leavesOn).toBe('2026-11-25');
    const list = await readGroups(c);
    expect(list.ok && list.data.mine.map((g) => [g.groupId, g.children])).toEqual([['g-scoala-a', 3], ['g-club-a', 2]]);
  });

  it('a change dated before the start of the later main row is refused until the split date', async () => {
    const c = coachCtx('tm-andreea', '2026-11-20');
    c.fake.group.memberships.push(member({ id: 'gm-extra', athleteId: 'a-club-1', groupId: 'g-scoala-a', isMain: false, from: '2026-10-01' }));
    c.fake.group.memberships.forEach((m, i) => { m.id = `seed-${i}`; });
    await removeMember(c, 'g-club-a', 'a-club-1', { from: '2026-11-25' });
    expect(await removeMember(c, 'g-scoala-a', 'a-club-1', { from: '2026-11-21' })).toMatchObject({ ok: false, status: 400 });
    expect((await removeMember(c, 'g-scoala-a', 'a-club-1', { from: '2026-11-25' })).ok).toBe(true);
  });
});
