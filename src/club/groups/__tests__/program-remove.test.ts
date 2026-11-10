import { describe, expect, it } from 'vitest';
import { expandOccurrences } from '../../../api/calendar-event/services/expand';
import { heldOccurrences } from '../../presence/sessions';
import { adminWindow, publicWindow } from '../occurrences';
import { asCalendarRow } from '../program-plan';
import { setDate } from '../program-dates';
import { undoAction } from '../undo-service';
import type { EventRecord } from '../types';
import { event, fakeContext } from './fake-group-store';

const FRIDAY: EventRecord['recurrence'] = { freq: 'weekly', days: ['fri'], weekOfMonth: null, startTime: '17:30', endTime: '18:30', singleDate: null, seasonStart: '2026-10-02', seasonEnd: '2027-05-31' };
const STERS = { date: '2026-11-13', kind: 'sters' as const, newDate: null, newStartTime: null, newEndTime: null, newTitle: null, reason: null };
const seed = () => fakeContext({ events: [event({ id: 'ev-g-club-a', type: 'curs', groupId: 'g-av', title: 'Avansați', recurrence: FRIDAY })] }, '2026-11-10');
const rows = (events: EventRecord[]) => events.map((e) => asCalendarRow(e, 'Avansați'));
const dates = (events: EventRecord[], from = '2026-11-01', to = '2026-11-30') => expandOccurrences(rows(events), [], from, to).map((o) => o.date);
const window = (events: EventRecord[]) => ({ events: rows(events), blackouts: [] });

describe('expansion of a removed date', () => {
  const removed = [event({ id: 'e', groupId: 'g-av', type: 'curs', recurrence: FRIDAY, exceptions: [STERS] })];

  it('drops the date and keeps its neighbours, in every window', () => {
    expect(dates(removed)).toEqual(['2026-11-06', '2026-11-20', '2026-11-27']);
    expect(publicWindow(window(removed), { from: '2026-11-01', to: '2026-11-30' }).data.map((o) => o.date)).toEqual(['2026-11-06', '2026-11-20', '2026-11-27']);
    expect(adminWindow(window(removed), { from: '2026-11-01', to: '2026-11-30' }, 'g-av').data.map((o) => o.date)).toEqual(['2026-11-06', '2026-11-20', '2026-11-27']);
  });

  it('removes the only date of a one-off class', () => {
    const one = event({ id: 'o', groupId: 'g-av', type: 'curs', recurrence: { ...FRIDAY, freq: 'none', days: [], singleDate: '2026-11-13', seasonStart: null, seasonEnd: null }, exceptions: [STERS] });
    expect(dates([one])).toEqual([]);
  });

  it('leaves no held occurrence, so no presence row', () => {
    const groups = [{ id: 'g-av', name: 'Avansați', sectionId: 'club', order: 1, active: true, priceListId: null, coachIds: [], programPublic: true }];
    const held = heldOccurrences(window(removed), groups, '2026-11-01', '2026-11-30').map((h) => h.date);
    expect(held).toEqual(['2026-11-06', '2026-11-20', '2026-11-27']);
  });
});

describe('setDate remove', () => {
  it('writes one sters exception and one Istoric line', async () => {
    const { ctx, state } = seed();
    const res = await setDate(ctx, 'ev-g-club-a', '2026-11-13', { mode: 'remove' });
    expect(res).toMatchObject({ ok: true, data: { value: { mode: 'remove', date: '2026-11-13', emails: 0 } } });
    expect(state.events[0].exceptions).toEqual([STERS]);
    expect(state.history).toHaveLength(1);
    expect(state.history[0]).toMatchObject({ action: 'date-removed', changes: { date: '2026-11-13' } });
  });

  it('queues no e-mail even when asked', async () => {
    const { ctx, state, emailed } = seed();
    await setDate(ctx, 'ev-g-club-a', '2026-11-13', { mode: 'remove', notifyParents: true });
    expect([state.jobs, emailed]).toEqual([[], []]);
  });

  it('"Ține" brings the date back', async () => {
    const { ctx, state } = seed();
    await setDate(ctx, 'ev-g-club-a', '2026-11-13', { mode: 'remove' });
    expect(dates(state.events)).not.toContain('2026-11-13');
    await setDate(ctx, 'ev-g-club-a', '2026-11-13', { mode: 'keep' });
    expect(state.events[0].exceptions).toEqual([]);
    expect(dates(state.events)).toContain('2026-11-13');
  });

  it('replaces a cancel on the date', async () => {
    const { ctx, state } = seed();
    await setDate(ctx, 'ev-g-club-a', '2026-11-13', { mode: 'cancel', reason: 'x' });
    await setDate(ctx, 'ev-g-club-a', '2026-11-13', { mode: 'remove' });
    expect(state.events[0].exceptions).toEqual([STERS]);
  });

  it('refuses a date with a saved session (409) and writes nothing', async () => {
    const { ctx, state, sessions } = seed();
    sessions.push({ id: 's1', eventId: 'ev-g-club-a', date: '2026-11-13', startTime: '17:30', key: 'ev-g-club-a|2026-11-13|17:30' });
    const res = await setDate(ctx, 'ev-g-club-a', '2026-11-13', { mode: 'remove' });
    expect(res).toMatchObject({ ok: false, status: 409, error: 'Data are prezența salvată. Poți doar să o anulezi.' });
    expect([state.events[0].exceptions, state.history]).toEqual([[], []]);
  });

  it('refuses a date that is not a class date (400)', async () => {
    const { ctx } = seed();
    expect(await setDate(ctx, 'ev-g-club-a', '2026-11-14', { mode: 'remove' })).toMatchObject({ ok: false, status: 400 });
  });

  it('the Istoric text is "Ședința din 13 noi 2026 ștearsă din program." and undo restores the date', async () => {
    const { ctx, state } = seed();
    const res = await setDate(ctx, 'ev-g-club-a', '2026-11-13', { mode: 'remove' });
    const { groupHistoryTexts } = await import('../history-lines');
    expect(groupHistoryTexts(state.history[0].action, state.history[0].changes, {})).toEqual(['Ședința din 13 noi 2026 ștearsă din program.']);
    await undoAction(ctx, { actionId: (res.ok && res.data.actionId) || '' });
    expect(state.events[0].exceptions).toEqual([]);
  });
});
