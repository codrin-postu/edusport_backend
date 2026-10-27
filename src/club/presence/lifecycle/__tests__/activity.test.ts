import { describe, expect, it } from 'vitest';
import { G_SEASONS } from '../../../groups/__tests__/fake-group-store';
import { inactiveAthleteIds, lastActiveYears } from '../../../personal-data/inactivity';
import { attendanceRow, fakePresenceStore, paymentRow, sessionRow } from '../../__tests__/fake-store';
import { loadPresenceActivity, presenceActivity, type ActivitySource } from '../activity';

const src = (over: Partial<ActivitySource>): ActivitySource => ({ seasons: G_SEASONS, attendances: [], lessons: [], payments: [], subscriptions: [], ...over });

const SEASONS = [
  { id: 's20', label: '2020-2021', isCurrent: false },
  { id: 's25', label: '2025-2026', isCurrent: false },
  { id: 's26', label: '2026-2027', isCurrent: true },
];
const NOW = new Date('2026-10-27T09:00:00.000Z');
const athlete = (id: string) => ({ id, status: 'activ', createdAt: '2020-09-01T10:00:00.000Z' });
const member = (athleteId: string, seasonId: string) => ({ athleteId, seasonId });

describe('presence activity (4.20, 3.9)', () => {
  it('turns attendance, present lessons, live payments and abonamente into seasons (4.20, 3.9)', () => {
    expect(presenceActivity(src({
      attendances: [{ athleteId: 'a1', sessionDate: '2026-11-07' }, { athleteId: 'a1', sessionDate: '2026-11-08' }],
      lessons: [{ athleteId: 'a2', date: '2026-03-10', present: true }, { athleteId: 'a3', date: '2026-11-10', present: false }, { athleteId: 'a3', date: '2026-11-11', present: null }],
      payments: [{ athleteId: 'a4', paidOn: '2026-07-15', cancelled: false }, { athleteId: 'a5', paidOn: '2026-11-01', cancelled: true }],
      subscriptions: [{ athleteId: 'a6', startsOn: '2026-10-27' }],
    }))).toEqual([{ athleteId: 'a1', seasonId: 's26' }, { athleteId: 'a2', seasonId: 's25' }, { athleteId: 'a4', seasonId: 's25' }, { athleteId: 'a6', seasonId: 's26' }]);
  });

  it('drops a date before every season', () => {
    expect(presenceActivity(src({ attendances: [{ athleteId: 'a1', sessionDate: '2024-01-01' }] }))).toEqual([]);
  });

  it('loads every source from the store', async () => {
    const { store } = fakePresenceStore({
      sessions: [sessionRow({ id: 's1', date: '2026-11-07' })], attendances: [attendanceRow({ id: 't1', sessionId: 's1', athleteId: 'a1' })],
      payments: [paymentRow({ id: 'p1', athleteId: 'a2', paidOn: '2026-10-27' })],
    });
    expect(await loadPresenceActivity(store)).toEqual([{ athleteId: 'a1', seasonId: 's26' }, { athleteId: 'a2', seasonId: 's26' }]);
  });

  it('phase 5 activity keeps a child off the inactive list (4.20)', () => {
    const base = { athletes: [athlete('a1'), athlete('a2')], memberships: [member('a1', 's20'), member('a2', 's20')], registrations: [], seasons: SEASONS, retentionYears: 5, now: NOW };
    expect([...inactiveAthleteIds(base)]).toEqual(['a1', 'a2']);
    expect([...inactiveAthleteIds({ ...base, activity: [{ athleteId: 'a1', seasonId: 's26' }] })]).toEqual(['a2']);
    expect(lastActiveYears({ ...base, activity: [{ athleteId: 'a2', seasonId: 's25' }] }).get('a2')).toBe(2025);
  });
});
