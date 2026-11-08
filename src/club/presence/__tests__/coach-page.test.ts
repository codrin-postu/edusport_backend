import { describe, expect, it } from 'vitest';
import { readCoachPage } from '../coaches/page';
import { attendanceRow, lessonRow, sessionRow, type FakePresenceContext } from './fake-store';
import { attendanceSeed, cancelDate, ok } from './attendance-seed';

const VIRGIL = 'tm-virgil';
const P = { from: '2026-11-01', to: '2026-11-30' };
const NOW = { date: '2026-11-20', time: '20:00' };

/** Virgil: a saved 60 min session on the 14th with a1 present, an unsaved Friday club session on the 20th, a saved session on the 17th he was removed from, a present 50 min lesson and an absent one. */
function coachFixture(): FakePresenceContext {
  const f = attendanceSeed('2026-11-20');
  f.state.startDate = '2026-11-14';
  const [ib, club] = f.state.calendar.events;
  if (ib.recurrence) ib.recurrence = { ...ib.recurrence, sun: false };
  for (const d of ['2026-11-21', '2026-11-28']) cancelDate(f, 'ev-ib', d);
  cancelDate(f, club.documentId, '2026-11-27');
  f.state.sessions.push(
    sessionRow({ id: 's14', groupId: 'g-ib', date: '2026-11-14', startTime: '11:00', durationMin: 60, eventId: 'ev-ib', occurrenceKey: 'ev-ib|2026-11-14|11:00', coachIds: [VIRGIL] }),
    sessionRow({ id: 's17', groupId: 'g-ib', date: '2026-11-17', startTime: '18:00', durationMin: 60, source: 'added', eventId: null, coachIds: ['tm-andreea'] }),
  );
  f.state.attendances.push(
    attendanceRow({ id: 't14', sessionId: 's14', athleteId: 'a1', uniqueKey: 's14|a1' }),
    attendanceRow({ id: 't17', sessionId: 's17', athleteId: 'a2', uniqueKey: 's17|a2' }),
  );
  f.state.lessons.push(
    lessonRow({ id: 'l18', date: '2026-11-18', coachIds: [VIRGIL], state: 'saved', present: true }),
    lessonRow({ id: 'l19', date: '2026-11-19', coachIds: [VIRGIL], state: 'saved', present: false }),
    lessonRow({ id: 'l12', date: '2026-11-12', coachIds: ['tm-andreea'], state: 'saved', present: true }),
  );
  return f;
}

describe('coach page read (5.2, 4.3)', () => {
  it('lists the coach sessions by the 5.2 rule and counts hours as 4.3', async () => {
    const f = coachFixture();
    const page = ok(await readCoachPage(f.store, VIRGIL, P, NOW));
    expect(page.name).toBe('Virgil Pascu');
    expect(page.sessions.map((r) => [r.date, r.adminState])).toEqual([['2026-11-20', 'necompletat'], ['2026-11-14', 'completat']]);
    expect(page.lessons.map((l) => l.lessonId)).toEqual(['l19', 'l18']);
    expect(page.totals).toEqual({ sessions: 1, lessons: 1, hours: '1,8' });
    expect(page.days).toEqual([
      { date: '2026-11-14', sessions: 1, lessons: 0, hours: '1,0' },
      { date: '2026-11-18', sessions: 0, lessons: 1, hours: '0,8' },
    ]);
  });

  it('a team member who coaches nothing gets an empty page, not a 404', async () => {
    const f = coachFixture();
    f.group.teamMembers.push({ id: 'tm-dan', name: 'Dan Toma' });
    const page = ok(await readCoachPage(f.store, 'tm-dan', P, NOW));
    expect(page).toEqual({ name: 'Dan Toma', totals: { sessions: 0, lessons: 0, hours: '0,0' }, days: [], sessions: [], lessons: [] });
  });

  it('answers 404 for an unknown coach', async () => {
    const f = coachFixture();
    expect(await readCoachPage(f.store, 'nope', P, NOW)).toEqual({ ok: false, status: 404, error: 'Antrenorul nu există.' });
  });
});
