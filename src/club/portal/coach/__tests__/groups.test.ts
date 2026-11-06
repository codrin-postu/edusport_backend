import { describe, expect, it } from 'vitest';
import { PORTAL_ERRORS } from '../../copy';
import { readCoachGroupPage, readGroups } from '../groups';
import { forbiddenKeysIn } from '../views';
import { sessionRow } from '../../../presence/__tests__/fake-store';
import { coachCtx } from './coach-seed';

describe('readGroups', () => {
  it('own groups with program and children, the others with coach names only', async () => {
    const out = await readGroups(coachCtx('tm-andreea'));
    expect(out).toEqual({
      ok: true,
      data: {
        mine: [
          { groupId: 'g-scoala-a', name: 'Școala A', kind: 'school', program: ['Sâ, Du 11:00'], children: 2 },
          { groupId: 'g-club-a', name: 'Club A', kind: 'club', program: ['Vi 17:00'], children: 2 },
        ],
        others: [{ groupId: 'g-club-b', name: 'Club B', coaches: ['Virgil Pascu'] }],
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
      { athleteId: 'a-club-1', name: 'Ana Club', age: 14, isNew: false, alsoIn: [] },
      { athleteId: 'a-club-2', name: 'Bogdan Club', age: 16, isNew: true, alsoIn: [] },
    ]);
    expect(forbiddenKeysIn(out)).toEqual([]);
    expect(JSON.stringify(out)).not.toMatch(/Părinte Secret|0722000111|copil@example/);
  });

  it('a Școala own group has no programPublic', async () => {
    const out = await readCoachGroupPage(coachCtx('tm-andreea'), 'g-scoala-a');
    expect(out).toMatchObject({ ok: true, data: { own: true, kind: 'school', programPublic: null } });
  });

  it('another group has members null and only the slots of the last 7 days, newest first', async () => {
    const out = await readCoachGroupPage(coachCtx('tm-andreea'), 'g-club-b');
    expect(out).toEqual({
      ok: true,
      data: {
        groupId: 'g-club-b', name: 'Club B', kind: 'club', own: false, coaches: ['Virgil Pascu'], program: ['Mi, Vi 18:00'], members: null, programPublic: null,
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

  it('losing the coach link turns the page into another group page, read on each request', async () => {
    const c = coachCtx('tm-andreea');
    expect(await readCoachGroupPage(c, 'g-club-a')).toMatchObject({ data: { own: true } });
    c.fake.group.groups.find((g) => g.id === 'g-club-a')!.coachIds = ['tm-virgil'];
    const out = await readCoachGroupPage(c, 'g-club-a');
    expect(out).toMatchObject({ ok: true, data: { own: false, members: null } });
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
});
