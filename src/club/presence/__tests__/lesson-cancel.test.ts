import { describe, expect, it } from 'vitest';
import { PORTAL_ERRORS } from '../../portal/copy';
import { readCoachCalendar } from '../../portal/coach/calendar';
import { nullCoachCompetitions, type CoachContexts } from '../../portal/coach/context';
import { cancelCoachLesson, createCoachLesson, planCoachLesson, saveCoachLesson } from '../../portal/coach/lessons';
import { autoPlan } from '../../portal/notices/auto';
import { ownItems } from '../../portal/sportiv/calendar';
import { A_ANA, sportivCtx, type SportivSeed } from '../../portal/sportiv/__tests__/sportiv-seed';
import { deleteLesson } from '../lessons/delete';
import { readCancelReason } from '../lessons/cancel';
import { lessonRow } from './fake-store';

const PARENT = 'parinte1@example.invalid';
const STALE = { ok: false, status: 409, error: 'Datele s-au schimbat. Reîncarcă.' };

const coachOf = (c: SportivSeed, teamMemberId = 'tm-virgil'): CoachContexts => ({
  coach: { accountId: 'acc-c', userId: 2, sessionId: 'ses-c', teamMemberId, name: 'Virgil Pascu' },
  today: c.today, presence: c.presence, groups: c.groups, club: c.club, portal: c.portal, competitions: nullCoachCompetitions,
});

function seeded(over: Partial<Parameters<typeof lessonRow>[0]> = {}) {
  const c = sportivCtx(PARENT);
  c.fake.state.lessons.push(lessonRow({ id: 'l-c', athleteId: A_ANA, date: '2026-11-24', startTime: '16:00', coachIds: ['tm-virgil'], ...over }));
  return c;
}
const lessonItems = async (c: SportivSeed) => (await ownItems(c, A_ANA, '2026-11-20', '2026-12-31')).filter((i) => i.kind === 'individual');

describe('readCancelReason', () => {
  it('trims, nulls an empty reason and refuses a long or non-text one', () => {
    expect([readCancelReason({}), readCancelReason({ reason: '  ' }), readCancelReason({ reason: ' bolnav ' })]).toEqual([null, null, 'bolnav']);
    expect([readCancelReason({ reason: 5 }), readCancelReason({ reason: 'x'.repeat(121) })]).toEqual([undefined, undefined]);
  });
});

describe('cancelCoachLesson', () => {
  it('keeps the row marked cancelled with the reason and a history line', async () => {
    const c = seeded();
    expect(await cancelCoachLesson(coachOf(c), 'l-c', { reason: ' bolnav ' })).toEqual({ ok: true, data: { cancelled: true } });
    expect(c.fake.state.lessons).toHaveLength(1);
    expect(c.fake.state.lessons[0]).toMatchObject({ cancelReason: 'bolnav', cancelledAt: expect.any(String) });
    expect(c.fake.group.history.some((h) => h.action === 'lesson-cancelled')).toBe(true);
  });

  it('an empty reason stores null', async () => {
    const c = seeded();
    await cancelCoachLesson(coachOf(c), 'l-c', { reason: '' });
    expect(c.fake.state.lessons[0].cancelReason).toBeNull();
  });

  it('cancelling twice answers 409 and writes once', async () => {
    const c = seeded();
    await cancelCoachLesson(coachOf(c), 'l-c', { reason: 'a' });
    const at = c.fake.state.lessons[0].cancelledAt;
    const lines = c.fake.group.history.length;
    expect(await cancelCoachLesson(coachOf(c), 'l-c', { reason: 'b' })).toEqual(STALE);
    expect(c.fake.state.lessons[0]).toMatchObject({ cancelledAt: at, cancelReason: 'a' });
    expect(c.fake.group.history).toHaveLength(lines);
  });

  it('a lesson with saved presence and a past one are refused with the stale answer', async () => {
    expect(await cancelCoachLesson(coachOf(seeded({ state: 'saved', present: true })), 'l-c', {})).toEqual(STALE);
    expect(await cancelCoachLesson(coachOf(seeded({ date: '2026-11-01' })), 'l-c', {})).toEqual(STALE);
  });

  it('another coach and an unknown id answer 404; a bad reason 400', async () => {
    const c = seeded();
    expect(await cancelCoachLesson(coachOf(c, 'tm-other'), 'l-c', {})).toEqual({ ok: false, status: 404, error: PORTAL_ERRORS.notFound });
    expect(await cancelCoachLesson(coachOf(c), 'nope', {})).toMatchObject({ status: 404 });
    expect(await cancelCoachLesson(coachOf(c), 'l-c', { reason: 7 })).toMatchObject({ status: 400 });
    expect(c.fake.state.lessons[0].cancelledAt).toBeNull();
  });

  it('a cancelled lesson refuses presence and plan edits and frees its slot', async () => {
    const c = seeded();
    await cancelCoachLesson(coachOf(c), 'l-c', {});
    expect(await saveCoachLesson(coachOf(c), 'l-c', { present: true, durationMin: 50, coachIds: ['tm-virgil'] })).toMatchObject({ ok: false, status: expect.any(Number) });
    expect(await planCoachLesson(coachOf(c), 'l-c', { date: '2026-11-25', startTime: '16:00', durationMin: 50, coachIds: ['tm-virgil'], scope: 'one' })).toEqual(STALE);
    const again = await createCoachLesson(coachOf(c), { athleteId: A_ANA, date: '2026-11-24', startTime: '16:00', durationMin: 50, coachIds: ['tm-virgil'] });
    expect(again.ok).toBe(true);
  });
});

describe('calendars and the notice after a cancel', () => {
  it('the coach calendar lists it cancelled with the reason; the athlete sees it cancelled, not removed', async () => {
    const c = seeded();
    await cancelCoachLesson(coachOf(c), 'l-c', { reason: 'bolnav' });
    const days = await readCoachCalendar(coachOf(c), '2026-11');
    const item = days.ok ? days.data.days.flatMap((d) => d.items).find((i) => i.lessonId === 'l-c') : undefined;
    expect(item).toMatchObject({ cancelled: true, reason: 'bolnav', kind: 'individual' });
    expect(await lessonItems(c)).toEqual([expect.objectContaining({ date: '2026-11-24', startTime: '16:00', cancelled: true, reason: 'bolnav' })]);
  });

  it('the automatic notice names it once, with the reason', async () => {
    const c = seeded();
    await cancelCoachLesson(coachOf(c), 'l-c', { reason: 'bolnav' });
    const source = (await lessonItems(c)).map((item) => ({ athleteFirstName: 'Ana', item }));
    const plan = autoPlan(source, false, c.today);
    expect(plan.rows).toEqual([{ date: '2026-11-24', text: '16:00 lecție individuală', reason: 'bolnav' }]);
  });

  it('deleting a cancelled lesson removes it for the family too', async () => {
    const c = seeded();
    await cancelCoachLesson(coachOf(c), 'l-c', { reason: 'bolnav' });
    await deleteLesson(c.presence, 'l-c');
    expect(c.fake.state.lessons).toEqual([]);
    expect(c.fake.state.lessonCancels).toEqual([]);
    expect(await lessonItems(c)).toEqual([]);
  });
});
