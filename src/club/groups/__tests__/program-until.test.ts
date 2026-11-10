import { describe, expect, it } from 'vitest';
import { addProgram } from '../program';
import { readGroupProgram } from '../program-read';
import { currentSeries } from '../series';
import { fakeContext, G_SEASONS } from './fake-group-store';

const base = { freq: 'weekly', days: ['tue', 'thu'], startTime: '17:30', durationMin: 60, from: '2026-11-11' };
const seed = () => fakeContext({}, '2026-11-10');

describe('"Până la" on a new series', () => {
  it('ends the series on the given day and says so in the line', async () => {
    const { ctx, state } = seed();
    expect((await addProgram(ctx, 'g-av', { ...base, until: '2027-03-31' })).ok).toBe(true);
    expect(state.events[0].recurrence).toMatchObject({ seasonStart: '2026-11-11', seasonEnd: '2027-03-31' });
    const { groupHistoryTexts } = await import('../history-lines');
    expect(groupHistoryTexts(state.history[0].action, state.history[0].changes, {})).toEqual(['Program adăugat: Ma și Jo, 17:30, 60 min, din 11 noi 2026, până pe 31 mar 2027.']);
  });

  it('without "Până la" the season end and the old line', async () => {
    const { ctx, state } = seed();
    await addProgram(ctx, 'g-av', base);
    await addProgram(ctx, 'g-av', { ...base, until: null });
    expect(state.events.map((e) => e.recurrence.seasonEnd)).toEqual(['2027-05-31', '2027-05-31']);
    const { groupHistoryTexts } = await import('../history-lines');
    expect(groupHistoryTexts(state.history[0].action, state.history[0].changes, {})).toEqual(['Program adăugat: Ma și Jo, 17:30, 60 min, din 11 noi 2026.']);
  });

  it('refuses a date before from, after the season end, or not ISO (400), writing nothing', async () => {
    const { ctx, state } = seed();
    for (const until of ['2026-11-10', '2027-06-01', '31.03.2027', 5]) {
      expect(await addProgram(ctx, 'g-av', { ...base, until })).toMatchObject({ ok: false, status: 400 });
    }
    expect([state.events, state.history]).toEqual([[], []]);
  });

  it('is listed with `to` and gone from currentSeries after it', async () => {
    const { ctx, state } = seed();
    await addProgram(ctx, 'g-av', { ...base, until: '2027-03-31' });
    const program = await readGroupProgram(ctx.store, 'g-av', null, '2026-11-10');
    expect(program?.series.map((s) => s.to)).toEqual(['2027-03-31']);
    expect(currentSeries(state.events, 'g-av', G_SEASONS[1], '2027-04-01')).toEqual([]);
    expect(currentSeries(state.events, 'g-av', G_SEASONS[1], '2027-03-31')).toHaveLength(1);
  });
});
