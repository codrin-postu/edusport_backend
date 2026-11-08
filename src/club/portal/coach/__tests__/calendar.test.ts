import { describe, expect, it } from 'vitest';
import { lessonRow, sessionRow } from '../../../presence/__tests__/fake-store';
import { PORTAL_ERRORS } from '../../copy';
import { readCoachCalendar } from '../calendar';
import type { CoachCalendar } from '../api-types';
import { forbiddenKeysIn } from '../views';
import { coachCtx } from './coach-seed';

const ME = 'tm-andreea';
const month = async (c: ReturnType<typeof coachCtx>): Promise<CoachCalendar> => {
  const r = await readCoachCalendar(c, '2026-11');
  if (!r.ok) throw new Error('refused');
  return r.data;
};

function seeded() {
  const c = coachCtx(ME);
  c.fake.group.sections.find((s) => s.id === 'club')!.locationName = 'Patinoar Club';
  const ev = c.fake.state.calendar.events.find((e) => e.documentId === 'ev-g-club-a')!;
  ev.exceptions = [{ date: '2026-11-13', kind: 'cancel' }];
  c.fake.state.sessions.push(sessionRow({
    id: 's-b', groupId: 'g-club-b', date: '2026-11-18', startTime: '18:00', durationMin: 90, eventId: 'ev-g-club-b', occurrenceKey: 'ev-g-club-b|2026-11-18|18:00', coachIds: [ME, 'tm-virgil'],
  }));
  c.fake.state.lessons.push(lessonRow({ id: 'l-1', athleteId: 'a-club-1', date: '2026-11-10', startTime: '16:00', coachIds: [ME], state: 'saved', present: true }));
  return c;
}

describe('readCoachCalendar', () => {
  it('lists the own weekly classes with start, duration and location', async () => {
    const out = await month(seeded());
    const all = out.days.flatMap((d) => d.items);
    const club = all.filter((i) => i.title === 'Club A' && !i.cancelled);
    expect(club.map((i) => i.date)).toEqual(['2026-11-06', '2026-11-20', '2026-11-27']);
    expect(club[0]).toMatchObject({ kind: 'grup', startTime: '17:00', durationMin: 90, location: 'Patinoar Club', standIn: false, done: false });
    expect(all.filter((i) => i.title === 'Școala A').map((i) => i.date)).toEqual(['2026-11-01', '2026-11-07', '2026-11-08', '2026-11-14', '2026-11-15', '2026-11-21', '2026-11-22', '2026-11-28', '2026-11-29']);
    expect(forbiddenKeysIn(out)).toEqual([]);
  });

  it('shows a cancelled date, a saved stand-in session and a lesson, not the other coach unsaved classes', async () => {
    const out = await month(seeded());
    const all = out.days.flatMap((d) => d.items);
    expect(all.find((i) => i.date === '2026-11-13')).toMatchObject({ title: 'Club A', cancelled: true, startTime: '17:00' });
    expect(all.filter((i) => i.standIn)).toMatchObject([{ date: '2026-11-18', title: 'Club B', done: true, sessionId: 's-b' }]);
    expect(all.filter((i) => i.title === 'Club B')).toHaveLength(1);
    expect(all.find((i) => i.kind === 'individual')).toMatchObject({ date: '2026-11-10', title: 'Ana Club', done: true, children: null, lessonId: 'l-1' });
    expect(out.days.every((d) => d.items.length > 0)).toBe(true);
    const day = out.days.find((d) => d.date === '2026-11-10')!;
    expect(day.items.map((i) => i.startTime)).toEqual([...day.items.map((i) => i.startTime)].sort());
  });

  it('refuses a bad month', async () => {
    for (const m of ['2026-13', '2026-1', undefined, 5]) expect(await readCoachCalendar(coachCtx(ME), m)).toEqual({ ok: false, status: 400, error: PORTAL_ERRORS.invalid });
  });
});
