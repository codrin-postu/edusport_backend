import { describe, expect, it } from 'vitest';
import { athleteRow, member } from '../../../groups/__tests__/fake-group-store';
import { attendanceRow, lessonRow, sessionRow } from '../../../presence/__tests__/fake-store';
import { PORTAL_ERRORS } from '../../copy';
import { addMembers, addNewAthlete, readCard, searchAthletes } from '../athletes';
import { forbiddenKeysIn } from '../views';
import { coachCtx } from './coach-seed';

const ME = 'tm-andreea';
const NO_ACCESS = { ok: false, status: 403, error: PORTAL_ERRORS.noAccess };
const extra = (n: number) => athleteRow({ id: `a-x${n}`, name: `Anamaria Nr${n}`, phone: '0721000000' });

describe('searchAthletes', () => {
  it('answers nothing under 3 letters, at most 8 rows, no inactive, nobody already in the group', async () => {
    const c = coachCtx(ME, '2026-11-20', { group: { athletes: [
      ...Array.from({ length: 10 }, (_, i) => extra(i)), athleteRow({ id: 'a-in', name: 'Ana Inactiva', status: 'inactiv' }),
      athleteRow({ id: 'a-club-1', name: 'Ana Club' }), athleteRow({ id: 'a-free', name: 'Ana Libera' }),
    ] } });
    expect(await searchAthletes(c, { q: 'an' })).toEqual({ ok: true, data: [] });
    const all = await searchAthletes(c, { q: 'ana' });
    expect(all.ok && all.data.length).toBe(8);
    const inGroup = await searchAthletes(c, { q: 'ana', group: 'g-club-a' });
    const names = inGroup.ok ? inGroup.data.map((r) => r.name) : [];
    expect(names).not.toContain('Ana Club');
    expect(names).not.toContain('Ana Inactiva');
    expect(forbiddenKeysIn(all)).toEqual([]);
  });

  it('a group of another coach, an inactive one or an unknown one filters nothing and reveals no roster', async () => {
    const c = coachCtx(ME, '2026-11-20', { group: { athletes: [extra(1), athleteRow({ id: 'a-free', name: 'Ana Libera' })] } });
    const plain = await searchAthletes(c, { q: 'ana' });
    expect(plain.ok && plain.data.map((r) => r.name)).toContain('Ana Libera');
    for (const group of ['g-club-b', 'g-old', 'nope']) expect(await searchAthletes(c, { q: 'ana', group })).toEqual(plain);
    const other = await searchAthletes(c, { q: 'eva', group: 'g-club-b' });
    expect(other).toEqual(await searchAthletes(c, { q: 'eva' }));
  });

  it('does not match a phone number', async () => {
    const c = coachCtx(ME, '2026-11-20', { group: { athletes: [extra(1)] } });
    expect(await searchAthletes(c, { q: '0721' })).toEqual({ ok: true, data: [] });
  });
});

describe('addMembers', () => {
  it('refuses another coach group, a past start and a non-existing or inactive child', async () => {
    const c = coachCtx(ME);
    expect(await addMembers(c, 'g-club-b', { athleteIds: ['a-free'], from: '2026-11-20' })).toEqual(NO_ACCESS);
    expect(await addMembers(c, 'g-club-a', { athleteIds: ['a-free'], from: '2026-11-19' })).toMatchObject({ ok: false, status: 400 });
    expect(await addMembers(c, 'g-club-a', { athleteIds: ['nope'], from: '2026-11-20' })).toMatchObject({ ok: false, status: 400 });
    expect(c.fake.group.memberships.some((m) => m.athleteId === 'a-free')).toBe(false);
  });

  it('adds from the given date, without undo', async () => {
    const c = coachCtx(ME);
    const out = await addMembers(c, 'g-club-a', { athleteIds: ['a-free'], from: '2026-11-25' });
    expect(out).toEqual({ ok: true, data: { added: 1, athleteNames: ['Fără Grupă'], groupName: 'Club A' } });
    expect(c.fake.group.memberships.find((m) => m.athleteId === 'a-free')).toMatchObject({ groupId: 'g-club-a', from: '2026-11-25' });
  });
});

describe('addNewAthlete', () => {
  const body = { groupId: 'g-club-b', name: 'Mara Nouă', birthDate: '14.03.2016', contactName: 'Mama', phone: '0722333444', email: 'm@x.ro' };

  it('creates a "nou" child and a membership from today, not in her own rosters', async () => {
    const c = coachCtx(ME);
    const out = await addNewAthlete(c, body);
    expect(out).toMatchObject({ ok: true, data: { toast: 'Salvat.' } });
    const id = out.ok ? out.data.athleteId : '';
    expect(c.clubFake.state.athletes.find((a) => a.id === id)).toMatchObject({ status: 'nou', name: 'Mara Nouă', birthDate: '2016-03-14' });
    expect(c.fake.group.memberships.find((m) => m.athleteId === id)).toMatchObject({ groupId: 'g-club-b', from: '2026-11-20' });
    expect(c.clubFake.state.history.find((h) => h.subjectId === id)?.actor).toBe('Antrenor Andreea Pascu');
    expect(c.fake.group.memberships.filter((m) => m.athleteId === id).map((m) => m.groupId)).toEqual(['g-club-b']);
    expect(await addNewAthlete(c, { ...body, birthDate: null, name: 'Fără Data' })).toMatchObject({ ok: true });
  });

  it('a name is required, an unknown group is 404', async () => {
    const c = coachCtx(ME);
    expect(await addNewAthlete(c, { ...body, name: '  ' })).toMatchObject({ ok: false, status: 400 });
    expect(await addNewAthlete(c, { ...body, groupId: 'g-old' })).toMatchObject({ ok: false, status: 404 });
  });

  it('a failing join leaves no athlete', async () => {
    const c = coachCtx(ME);
    c.fake.failOn('createMembership');
    expect(await addNewAthlete(c, body)).toMatchObject({ ok: false });
    expect(c.clubFake.state.athletes.some((a) => a.name === 'Mara Nouă')).toBe(false);
    expect(c.fake.group.athletes.some((a) => a.name === 'Mara Nouă')).toBe(false);
  });
});

describe('readCard', () => {
  it('an own child has the contact, the Școala one its abonament text', async () => {
    const c = coachCtx(ME);
    const club = await readCard(c, 'a-club-1');
    expect(club).toMatchObject({ ok: true, data: { athleteId: 'a-club-1', name: 'Ana Club', age: 14, groups: ['Club A'], school: null, contact: { name: 'Părinte Secret', phone: '0722000111' }, abonament: null } });
    expect(await readCard(c, 'a-scoala-1')).toMatchObject({ data: { school: '0/8', contact: { phone: '0722000111' } } });
    expect(forbiddenKeysIn(club)).toEqual([]);
  });

  it('a stand-in child from a listed session 3 days ago has no contact, an unrelated child is refused', async () => {
    const c = coachCtx(ME);
    expect(await readCard(c, 'a-b-1')).toEqual(NO_ACCESS);
    c.fake.state.sessions.push(sessionRow({ id: 's-b', groupId: 'g-club-b', date: '2026-11-17', startTime: '18:00', coachIds: [ME, 'tm-virgil'] }));
    c.fake.state.attendances.push(attendanceRow({ id: 't-b', sessionId: 's-b', athleteId: 'a-b-1', uniqueKey: 's-b|a-b-1' }));
    const card = await readCard(c, 'a-b-1');
    expect(card).toMatchObject({ ok: true, data: { name: 'Eva Cealaltă', contact: null, groups: ['Club B'] } });
    expect(JSON.stringify(card)).not.toMatch(/0722000111|copil@example/);
    expect(await readCard(c, 'a-free')).toEqual(NO_ACCESS);
  });

  it('a child added to an own group with a future "Din data" opens, as the roster already lists it', async () => {
    const c = coachCtx(ME);
    c.fake.group.memberships.push(member({ id: 'gm-fut', athleteId: 'a-free', groupId: 'g-club-a', from: '2026-11-30' }));
    expect(await readCard(c, 'a-free')).toMatchObject({ ok: true, data: { name: 'Fără Grupă', contact: { phone: '0722000111' } } });
  });

  it('a membership that ended yesterday gives no own right', async () => {
    const c = coachCtx(ME);
    c.fake.group.memberships.push(member({ id: 'gm-old', athleteId: 'a-free', groupId: 'g-club-a', to: '2026-11-19' }));
    expect(await readCard(c, 'a-free')).toEqual(NO_ACCESS);
    expect(await readCard(c, 'nope')).toMatchObject({ status: 404 });
  });
});

describe('readCard additions', () => {
  const seedPresence = (c: ReturnType<typeof coachCtx>) => {
    for (const [id, date] of [['s-1', '2026-11-07'], ['s-2', '2026-11-08'], ['s-3', '2026-11-14']]) {
      c.fake.state.sessions.push(sessionRow({ id, groupId: 'g-scoala-a', date, startTime: '11:00', coachIds: [ME] }));
      c.fake.state.attendances.push(attendanceRow({ id: `t-${id}`, sessionId: id, athleteId: 'a-scoala-1', uniqueKey: `${id}|a-scoala-1`, subscriptionId: 'sub-s1' }));
    }
    c.fake.state.sessions.push(sessionRow({ id: 's-4', groupId: 'g-scoala-a', date: '2026-11-15', startTime: '11:00', coachIds: [ME] }));
    c.fake.state.lessons.push(lessonRow({ id: 'l-1', athleteId: 'a-scoala-1', date: '2026-11-10', state: 'saved', present: true }));
  };

  it('an own child has presence numbers, abonament, groups and section', async () => {
    const c = coachCtx(ME);
    seedPresence(c);
    const out = await readCard(c, 'a-scoala-1');
    expect(out).toMatchObject({ ok: true, data: {
      presence: { season: 4, lessons: 1, last: '2026-11-14', missedThisMonth: 1 },
      abonament: { code: null, next: 4, slots: 8, validUntil: '2026-11-28', location: null },
      groupRows: [{ groupId: 'g-scoala-a', name: 'Școala A' }], sectionName: 'Școala de Patinaj - AFI Cotroceni', competitions: { available: false },
    } });
    expect(Array.isArray(out.ok && out.data.groupRows[0].program)).toBe(true);
    expect(forbiddenKeysIn(out)).toEqual([]);
    expect(JSON.stringify(out)).not.toMatch(/Alergie|copil@example/);
  });

  it('the abonament location is the section location of its group', async () => {
    const c = coachCtx(ME);
    c.fake.group.sections.find((x) => x.id === 'afi')!.locationName = 'AFI Cotroceni';
    expect(await readCard(c, 'a-scoala-1')).toMatchObject({ data: { abonament: { location: 'AFI Cotroceni' } } });
  });

  it('a stand-in child has presence only: no contact, no abonament', async () => {
    const c = coachCtx(ME);
    c.fake.state.sessions.push(sessionRow({ id: 's-b', groupId: 'g-club-b', date: '2026-11-17', startTime: '18:00', coachIds: [ME, 'tm-virgil'] }));
    c.fake.state.attendances.push(attendanceRow({ id: 't-b', sessionId: 's-b', athleteId: 'a-b-1', uniqueKey: 's-b|a-b-1' }));
    const out = await readCard(c, 'a-b-1');
    expect(out).toMatchObject({ ok: true, data: { contact: null, abonament: null, presence: { season: 1, lessons: 0, last: '2026-11-17' }, competitions: { available: false } } });
    expect(JSON.stringify(out)).not.toMatch(/0722000111/);
    expect(forbiddenKeysIn(out)).toEqual([]);
  });

  it('an anonymized child is not found', async () => {
    const c = coachCtx(ME);
    c.fake.group.athletes.find((a) => a.id === 'a-scoala-1')!.status = 'anonimizat';
    expect(await readCard(c, 'a-scoala-1')).toMatchObject({ ok: false, status: 404 });
  });
});
