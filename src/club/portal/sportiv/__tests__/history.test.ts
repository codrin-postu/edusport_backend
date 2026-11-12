import { describe, expect, it } from 'vitest';
import { attendanceRow, lessonRow, sessionRow } from '../../../presence/__tests__/fake-store';
import { forbiddenPathsIn } from '../../forbidden-keys';
import { readHistory, readProfile } from '../history';
import { SPORTIV_ALLOWED_PATHS, SPORTIV_FORBIDDEN_KEYS } from '../views';
import { A_ANA, A_MATEI, sportivCtx, type SportivSeed } from './sportiv-seed';

/** The day `i` after 2 October 2026, as ISO text. */
const dayOf = (i: number): string => new Date(Date.UTC(2026, 9, 2 + i)).toISOString().slice(0, 10);

/**
 * Ana's season: 22 group presences (two uscat, the last one a visitor at Club Performanță), 4 present lessons,
 * one planned lesson that does not count, and a presence in the 2025-2026 season that must not count.
 * Store rows carry forbidden keys too, so the answers are checked for them.
 */
function seedHistory(c: SportivSeed): void {
  const st = c.fake.state;
  st.sessions.push(sessionRow({ id: 'old', groupId: 'g-ib', seasonId: 's25', date: '2026-05-10', startTime: '11:00' }));
  st.attendances.push(attendanceRow({ id: 'old-t', sessionId: 'old', athleteId: A_ANA, uniqueKey: 'old|ana' }));
  for (let i = 0; i < 22; i++) {
    const id = `s-${i}`;
    const visitor = i === 21;
    st.sessions.push(sessionRow({ id, groupId: visitor ? 'g-perf' : 'g-ib', date: dayOf(i * 2), startTime: '11:00', coachIds: visitor ? ['tm-andreea'] : ['tm-virgil'] }));
    st.attendances.push(attendanceRow({ id: `t-${i}`, sessionId: id, athleteId: A_ANA, uniqueKey: `${id}|ana`, grup: i >= 2, uscat: i < 2, visitor }));
  }
  for (const [id, date, coach] of [['l-1', '2026-10-13', 'tm-virgil'], ['l-2', '2026-10-27', 'tm-andreea'], ['l-3', '2026-11-10', 'tm-virgil'], ['l-4', '2026-11-17', 'tm-virgil']] as const) {
    st.lessons.push(lessonRow({ id, athleteId: A_ANA, date, startTime: '17:00', coachIds: [coach], state: 'saved', present: true }));
  }
  st.lessons.push(lessonRow({ id: 'l-plan', athleteId: A_ANA, date: '2026-11-18', state: 'planned', present: null }));
  st.lessons.push(lessonRow({ id: 'l-other', athleteId: A_MATEI, date: '2026-11-03', state: 'saved', present: true }));
}

describe('readHistory', () => {
  it('counts the current season: total, group (uscat included) and individual', async () => {
    const c = sportivCtx('parinte1@example.invalid');
    seedHistory(c);
    const h = await readHistory(c, A_ANA, 1);
    expect(h.seasonLabel).toBe('2026-2027');
    expect(h.total).toBe(26);
    expect(h.group).toBe(22);
    expect(h.individual).toBe(4);
    expect(h.pageSize).toBe(20);
  });

  it('page 1 is the 20 newest rows, with start times, a lesson and a visitor row on its own group', async () => {
    const c = sportivCtx('parinte1@example.invalid');
    seedHistory(c);
    const h = await readHistory(c, A_ANA, 1);
    expect(h.page).toBe(1);
    expect(h.rows).toHaveLength(20);
    expect(h.rows.every((r) => r.startTime !== null)).toBe(true);
    const dates = h.rows.map((r) => r.date);
    expect(dates).toEqual([...dates].sort().reverse());
    expect(h.rows[0]).toEqual({ date: '2026-11-17', startTime: '17:00', kind: 'Individual', groupName: null, coaches: ['Virgil Pascu'] });
    expect(h.rows[1]).toEqual({ date: '2026-11-13', startTime: '11:00', kind: 'Grup', groupName: 'Club Performanță', coaches: ['Andreea Pascu'] });
    expect(h.rows.filter((r) => r.kind === 'Individual')).toHaveLength(4);
  });

  it('page 2 has the other 6 rows, page 3 none, and a page that is not a number is page 1', async () => {
    const c = sportivCtx('parinte1@example.invalid');
    seedHistory(c);
    const second = await readHistory(c, A_ANA, '2');
    expect(second.page).toBe(2);
    expect(second.rows).toHaveLength(6);
    const third = await readHistory(c, A_ANA, 3);
    expect(third.page).toBe(3);
    expect(third.rows).toEqual([]);
    expect(third.total).toBe(26);
    expect((await readHistory(c, A_ANA, 'x')).page).toBe(1);
    expect((await readHistory(c, A_ANA, undefined)).rows).toHaveLength(20);
  });

  it('an athlete with no presence in the season has an empty history', async () => {
    const c = sportivCtx('parinte1@example.invalid');
    const h = await readHistory(c, A_ANA, 1);
    expect(h).toMatchObject({ total: 0, group: 0, individual: 0, rows: [] });
  });

  it('coach names only, no ids, and no store field leaves', async () => {
    const c = sportivCtx('parinte1@example.invalid');
    seedHistory(c);
    const leak = { recordedBy: 'secret-recordedBy', notes: 'secret-notes', note: 'secret-note', history: 'secret-history', charges: [{ price: 9 }] };
    Object.assign(c.fake.state.sessions.find((s) => s.id === 's-21')!, leak);
    Object.assign(c.fake.state.attendances.find((a) => a.id === 't-0')!, leak);
    Object.assign(c.fake.state.lessons.find((l) => l.id === 'l-4')!, leak);
    const h = await readHistory(c, A_ANA, 1);
    expect(JSON.stringify(h)).not.toContain('tm-');
    expect(JSON.stringify(h)).not.toContain('secret-');
    expect(forbiddenPathsIn(h, SPORTIV_FORBIDDEN_KEYS, SPORTIV_ALLOWED_PATHS)).toEqual([]);
    expect(Object.keys(h.rows[0]).sort()).toEqual(['coaches', 'date', 'groupName', 'kind', 'startTime']);
  });
});

describe('readProfile', () => {
  it('returns the six fields and nothing else', async () => {
    const c = sportivCtx('parinte1@example.invalid');
    const p = await readProfile(c, A_ANA);
    expect(p).toEqual({ name: 'Ana Ionescu', birthDate: '2017-04-02', age: 9, contactName: 'Părinte Secret', phone: '0722000111', email: 'parinte1@example.invalid' });
    expect(Object.keys(p).sort()).toEqual(['age', 'birthDate', 'contactName', 'email', 'name', 'phone']);
    expect(JSON.stringify(p)).not.toContain('Alergie');
    expect(forbiddenPathsIn(p, SPORTIV_FORBIDDEN_KEYS)).toEqual([]);
  });

  it('an anonymized athlete is not found', async () => {
    const c = sportivCtx('parinte1@example.invalid');
    c.fake.group.athletes.find((a) => a.id === A_ANA)!.status = 'anonimizat';
    await expect(readProfile(c, A_ANA)).rejects.toThrow('athlete not found');
  });
});
