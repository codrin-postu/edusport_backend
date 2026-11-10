import type { PresenceStore } from '../store';
import type { LessonSeriesWrite, LessonWrite } from '../types';

/** The same store walk for the fake and for Postgres (the parity tests): each store must answer exactly `SERIES_EXPECTED`. */
export const seriesRule = (athleteId: string, coachId: string, over: Partial<LessonSeriesWrite> = {}): LessonSeriesWrite => ({
  athleteId, coachIds: [coachId], freq: 'weekly', days: ['tue', 'thu'], weekOfMonth: null, startTime: '17:30', durationMin: 45, from: '2026-11-10', to: '2026-12-03',
  createdByName: 'Ana', ...over,
});

export const lessonOf = (athleteId: string, coachId: string, date: string, seriesId: string | null): LessonWrite => ({
  athleteId, date, startTime: '17:30', durationMin: 45, coachIds: [coachId], state: 'planned', present: null, priceListId: null, itemName: null, price: null,
  audience: null, amount: 0, createdByName: 'Ana', recordedAt: '2026-11-10T10:00:00.000Z', savedBy: null, savedAt: null, seriesId,
});

export type SeriesWalk = {
  created: unknown; ofAthlete: unknown; afterUpdate: unknown; bySeries: string[]; oldLessonSeries: (string | null)[]; seriesOfNew: (string | null)[]; ordered: string[];
  afterDelete: unknown; missing: unknown;
};

/** `athleteId` and `coachId` are existing rows; the store is inside no transaction (no locks are taken). */
export async function walkSeries(store: PresenceStore, athleteId: string, coachId: string): Promise<SeriesWalk> {
  const late = await store.createLessonSeries(seriesRule(athleteId, coachId, { from: '2027-01-12', to: '2027-02-02', days: ['tue'] }));
  const id = await store.createLessonSeries(seriesRule(athleteId, coachId));
  const created = { ...(await store.lessonSeries(id)), id: 'new' };
  const old = await store.createLesson(lessonOf(athleteId, coachId, '2026-11-09', null));
  const l1 = await store.createLesson(lessonOf(athleteId, coachId, '2026-11-10', id));
  const l2 = await store.createLesson(lessonOf(athleteId, coachId, '2026-11-12', id));
  await store.createLesson(lessonOf(athleteId, coachId, '2027-01-12', late));
  const ofAthlete = (await store.lessonSeriesOf(athleteId)).map((s) => ({ ...s, id: s.id === id ? 'new' : 'late' }));
  await store.updateLessonSeries(id, { to: '2026-11-11' });
  const afterUpdate = { ...(await store.lessonSeries(id)), id: 'new' };
  const bySeries = (await store.lessons({ seriesId: id })).map((l) => l.date).sort();
  const oldLessonSeries = [(await store.lesson(old))?.seriesId ?? null];
  const seriesOfNew = [(await store.lesson(l1))?.seriesId === id ? 'ok' : null, (await store.lesson(l2))?.seriesId === id ? 'ok' : null];
  const ordered = (await store.lessonSeriesOf(athleteId)).map((s) => (s.id === id ? 'new' : 'late'));
  await store.updateLesson(l2, { seriesId: null });
  await store.deleteLesson(l1);
  await store.deleteLesson(l2);
  await store.deleteLessonSeries(id);
  return { created, ofAthlete, afterUpdate, bySeries, oldLessonSeries, seriesOfNew, ordered, afterDelete: await store.lessonSeries(id), missing: (await store.lessonSeriesOf(athleteId)).length };
}

export const walkExpected = (athleteId: string, coachId: string): SeriesWalk => ({
  created: { ...seriesRule(athleteId, coachId), id: 'new' }, ofAthlete: [
    { ...seriesRule(athleteId, coachId), id: 'new' }, { ...seriesRule(athleteId, coachId, { from: '2027-01-12', to: '2027-02-02', days: ['tue'] }), id: 'late' },
  ],
  afterUpdate: { ...seriesRule(athleteId, coachId, { to: '2026-11-11' }), id: 'new' }, bySeries: ['2026-11-10', '2026-11-12'], oldLessonSeries: [null], seriesOfNew: ['ok', 'ok'],
  ordered: ['new', 'late'], afterDelete: null, missing: 1,
});
