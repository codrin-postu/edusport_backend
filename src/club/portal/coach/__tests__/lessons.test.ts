import { describe, expect, it } from 'vitest';
import { lessonRow } from '../../../presence/__tests__/fake-store';
import { PORTAL_ERRORS } from '../../copy';
import { createCoachLesson, deleteCoachLesson, readCoachLesson, saveCoachLesson } from '../lessons';
import { forbiddenKeysIn } from '../views';
import { coachCtx } from './coach-seed';

const TODAY = '2026-11-20';
const ME = 'tm-andreea';
const NO_ACCESS = { ok: false, status: 403, error: PORTAL_ERRORS.noAccess };
const ARCHIVED = { ok: false, status: 403, error: PORTAL_ERRORS.archived };
const NOT_FOUND = { ok: false, status: 404, error: PORTAL_ERRORS.notFound };
const newBody = (over = {}) => ({ athleteId: 'a-club-1', date: '2026-11-25', startTime: '16:00', durationMin: 50, coachIds: [ME], ...over });
const patch = (over = {}) => ({ present: true, durationMin: 50, coachIds: [ME], ...over });

describe('create and read', () => {
  it('needs the coach among the coaches, refuses an inactive or unknown athlete', async () => {
    const c = coachCtx(ME);
    expect(await createCoachLesson(c, newBody({ coachIds: ['tm-virgil'] }))).toEqual(NO_ACCESS);
    expect(await createCoachLesson(c, newBody({ athleteId: 'nope' }))).toMatchObject({ ok: false, status: 400 });
    c.fake.group.athletes.find((a) => a.id === 'a-club-2')!.status = 'inactiv';
    expect(await createCoachLesson(c, newBody({ athleteId: 'a-club-2' }))).toMatchObject({ ok: false, status: 400 });
    expect(c.fake.state.lessons).toEqual([]);
  });

  it('refuses a date older than 7 days like presence, allows exactly 7 days back and the future', async () => {
    const c = coachCtx(ME);
    expect(await createCoachLesson(c, newBody({ date: '2026-11-12' }))).toEqual(ARCHIVED);
    expect(c.fake.state.lessons).toEqual([]);
    expect(await createCoachLesson(c, newBody({ date: '2026-11-13' }))).toMatchObject({ ok: true });
    expect(await createCoachLesson(c, newBody({ date: '2027-01-10' }))).toMatchObject({ ok: true });
  });

  it('creates with the coach name, answers without undo, and reads back without money keys', async () => {
    const c = coachCtx(ME);
    const made = await createCoachLesson(c, newBody());
    expect(made).toMatchObject({ ok: true, data: { changed: true } });
    expect(JSON.stringify(made)).not.toContain('actionId');
    const id = c.fake.state.lessons[0].id;
    expect(c.fake.state.lessons[0].createdByName).toBe('Antrenor Andreea Pascu');
    expect(c.fake.group.history.at(-1)?.actor).toBe('Antrenor Andreea Pascu');
    const read = await readCoachLesson(c, id);
    expect(read).toMatchObject({ ok: true, data: { athleteName: 'Ana Club', state: 'planned', editable: true, deletable: true } });
    expect(forbiddenKeysIn(read)).toEqual([]);
    expect(forbiddenKeysIn(made)).toEqual([]);
  });
});

describe('window and ownership', () => {
  const seeded = (today: string, date: string, over = {}) => {
    const c = coachCtx(ME, today);
    c.fake.state.lessons.push(lessonRow({ id: 'l1', athleteId: 'a-club-1', date, coachIds: [ME], state: 'saved', present: true, savedBy: 'x', savedAt: `${date}T10:00:00.000Z`, ...over }));
    return c;
  };

  it('a planned lesson is deleted any time', async () => {
    const c = seeded(TODAY, '2026-09-01', { state: 'planned', present: null, savedBy: null, savedAt: null });
    expect(await deleteCoachLesson(c, 'l1')).toMatchObject({ ok: true, data: { deleted: true } });
    expect(c.fake.state.lessons).toEqual([]);
  });

  it('a recorded lesson saves on day 7 and is refused on day 8, as is its delete', async () => {
    const ok = seeded('2026-10-13', '2026-10-06');
    expect(await saveCoachLesson(ok, 'l1', patch({ present: false }))).toMatchObject({ ok: true });
    expect(ok.fake.state.lessons[0].present).toBe(false);
    const late = seeded('2026-10-14', '2026-10-06');
    expect(await saveCoachLesson(late, 'l1', patch({ present: false }))).toEqual(ARCHIVED);
    expect(await deleteCoachLesson(late, 'l1')).toEqual(ARCHIVED);
    expect(late.fake.state.lessons[0].present).toBe(true);
    expect(await readCoachLesson(late, 'l1')).toMatchObject({ ok: true, data: { archived: true, editable: false, deletable: false } });
  });

  it('the patch must keep the coach, and a paid lesson stays 409', async () => {
    const c = seeded(TODAY, TODAY);
    expect(await saveCoachLesson(c, 'l1', patch({ coachIds: ['tm-virgil'] }))).toEqual(NO_ACCESS);
    c.fake.state.payments.push({
      id: 'p1', athleteId: 'a-club-1', amount: 80, method: 'numerar', paidOn: TODAY, purpose: 'lectie', subscriptionId: null, lessonId: 'l1', clubMonth: null, seasonId: 's26',
      collectedAtRink: false, note: null, sendEmail: false, emailJobId: null, acsBefore: null, recordedBy: 'x', recordedAt: `${TODAY}T10:00:00.000Z`, cancelled: false, cancelledAt: null, cancelledBy: null,
    } as never);
    expect(await deleteCoachLesson(c, 'l1')).toMatchObject({ ok: false, status: 409 });
    expect(await readCoachLesson(c, 'l1')).toMatchObject({ data: { deletable: false } });
  });

  it('another coach lesson answers 404 on every route', async () => {
    const c = seeded(TODAY, TODAY, { coachIds: ['tm-virgil'] });
    expect(await readCoachLesson(c, 'l1')).toEqual(NOT_FOUND);
    expect(await saveCoachLesson(c, 'l1', patch())).toEqual(NOT_FOUND);
    expect(await deleteCoachLesson(c, 'l1')).toEqual(NOT_FOUND);
    expect(await readCoachLesson(c, 'nope')).toEqual(NOT_FOUND);
  });
});
