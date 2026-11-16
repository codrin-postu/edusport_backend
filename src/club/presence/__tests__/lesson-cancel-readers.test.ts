import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { cancelCoachLesson, readCoachLesson } from '../../portal/coach/lessons';
import { readClubToday } from '../../portal/coach/club-today';
import { readCoachHistory } from '../../portal/coach/history';
import { readToday } from '../../portal/coach/today';
import { coachCtx } from '../../portal/coach/__tests__/coach-seed';
import { clubMonths } from '../due/settlement';
import { readCoachPage } from '../coaches/page';
import { listLessons, readLesson } from '../lessons/read';
import { lessonRow } from './fake-store';

const ME = 'tm-andreea';
const TODAY = '2026-11-20';

async function seeded(date = TODAY) {
  const c = coachCtx(ME, TODAY);
  const past = date < TODAY;
  c.fake.state.lessons.push(
    lessonRow({ id: 'l-x', athleteId: 'a-club-1', date, startTime: '16:00', coachIds: [ME] }),
    lessonRow({ id: 'l-y', athleteId: 'a-club-2', date, startTime: '17:00', coachIds: [ME] }),
  );
  if (past) {
    Object.assign(c.fake.state.lessons[0], { cancelledAt: '2026-11-01T10:00:00.000Z', cancelReason: 'bolnav' });
    return c;
  }
  const r = await cancelCoachLesson(c, 'l-x', { reason: 'bolnav' });
  if (!r.ok) throw new Error(String(r.status));
  return c;
}

describe('a cancelled lesson in every list that shows lessons', () => {
  it('Azi lists it cancelled with the reason, not done, and the week counts skip it', async () => {
    const c = await seeded();
    const r = await readToday(c, TODAY);
    if (!r.ok) throw new Error('refused');
    expect(r.data.lessons.map((l) => [l.lessonId, l.cancelled, l.reason, l.done])).toEqual([['l-x', true, 'bolnav', false], ['l-y', false, null, false]]);
    expect(r.data.week.lessonsLeft + r.data.week.lessonsHeld).toBe(1);
  });

  it('the club-wide today list marks it cancelled', async () => {
    const c = await seeded();
    const r = await readClubToday(c);
    if (!r.ok) throw new Error('refused');
    const rows = r.data.rows.filter((x) => x.kind === 'lesson');
    expect(rows.map((x) => x.kind === 'lesson' && [x.lessonId, x.cancelled, x.reason])).toEqual([['l-x', true, 'bolnav'], ['l-y', false, null]]);
  });

  it('a cancelled lesson of another coach shows cancelled but never its reason', async () => {
    const c = await seeded();
    c.fake.state.lessons[0].coachIds = ['tm-virgil'];
    const r = await readClubToday(c);
    if (!r.ok) throw new Error('refused');
    const row = r.data.rows.find((x) => x.kind === 'lesson' && x.startTime === '16:00');
    expect(row).toMatchObject({ cancelled: true, reason: null, own: false, lessonId: null });
  });

  it('the coach lesson page is cancelled and not editable', async () => {
    const c = await seeded();
    const r = await readCoachLesson(c, 'l-x');
    if (!r.ok) throw new Error('refused');
    expect(r.data).toMatchObject({ cancelled: true, cancelReason: 'bolnav', editable: false, planEditable: false });
    const other = await readCoachLesson(c, 'l-y');
    expect(other.ok && other.data).toMatchObject({ cancelled: false, cancelReason: null });
  });

  it('the admin lesson list, panel and coach page carry the mark', async () => {
    const c = await seeded();
    const store = c.presence.store;
    const list = await listLessons(store, { from: TODAY, to: TODAY }, { date: TODAY, time: '10:00' });
    expect(list.ok && list.data.map((l) => [l.lessonId, l.cancelled, l.cancelReason])).toEqual([['l-x', true, 'bolnav'], ['l-y', false, null]]);
    const panel = await readLesson(store, 'l-x');
    expect(panel.ok && panel.data).toMatchObject({ cancelled: true, cancelReason: 'bolnav' });
    const page = await readCoachPage(store, ME, { from: TODAY, to: TODAY }, { date: TODAY, time: '10:00' });
    expect(page.ok && page.data.lessons.map((l) => [l.lessonId, l.cancelled])).toEqual([['l-y', false], ['l-x', true]]);
    expect(page.ok && page.data.totals.lessons).toBe(0);
  });

  it('it owes nothing and never counts as held', async () => {
    const c = await seeded('2026-11-10');
    const lessons = await c.presence.store.lessons({ athleteId: 'a-club-1' });
    expect(clubMonths({ attendances: [], lessons, payments: [], groupNames: new Map(), startDate: null })).toEqual([]);
  });

  it('it is no history row for the coach or the athlete', async () => {
    const c = await seeded('2026-11-10');
    const mine = await readCoachHistory(c, '2026-11');
    expect(mine.ok && mine.data.rows.filter((r) => r.lessonId === 'l-x')).toEqual([]);
    expect(mine.ok && mine.data.lessons).toBe(0);
  });

  it('the admin screens render the cancelled state and Tabele counts held lessons only', () => {
    const src = (p: string): string => readFileSync(p, 'utf8');
    for (const f of ['LessonsList', 'CoachPage']) expect(src(`src/admin/dashboard/prezenta/${f}.tsx`)).toContain('lessonStateLabel');
    expect(src('src/admin/dashboard/prezenta/LessonPanel.tsx')).toContain('lesson.cancelled');
    expect(src('src/club/tables/rows-prezenta.ts')).toContain("l.state === 'saved' && l.present === true");
  });
});
