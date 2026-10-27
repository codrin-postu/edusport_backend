import { describe, expect, it } from 'vitest';
import type { MembershipRow } from '../../athletes/store';
import { mainGroupOn, rosterOn } from '../attendance/roster';
import { defaultDuration, isDuration, isTime, outsideFor, presentCounts, savedLine, typesText } from '../attendance/view';
import { ATTENDANCE_ERRORS, LESSON_COPY, REACTIVATE_DIALOG, sessionSavedToast } from '../copy/attendance';
import { attendanceSeed } from './attendance-seed';
import { member } from './fake-store';

describe('attendance view helpers', () => {
  it('membership on a date (3.9)', () => {
    const ms: MembershipRow[] = [
      member({ id: 'm1', athleteId: 'a1', groupId: 'g-ib', seasonId: 's26', isMain: true, from: '2026-11-15' }),
      member({ id: 'm2', athleteId: 'a2', groupId: 'g-ib', seasonId: 's26', isMain: true, from: null, to: '2026-11-10' }),
      member({ id: 'm3', athleteId: 'a3', groupId: 'g-ib', seasonId: 's26', isMain: false, from: null }),
    ];
    expect(rosterOn(ms, 'g-ib', 's26', '2026-11-14')).toEqual(['a3']);
    expect(rosterOn(ms, 'g-ib', 's26', '2026-11-15')).toEqual(['a1', 'a3']);
    expect(mainGroupOn(ms, 'a1', 's26', '2026-11-20')).toBe('g-ib');
    expect(mainGroupOn(ms, 'a3', 's26', '2026-11-20')).toBeNull();
  });

  it('saved line in Bucharest time (5.3)', () => {
    expect(savedLine('Ana Admin', '2026-10-27T15:52:00.000Z')).toBe('Salvată de Ana Admin, 27 oct 2026 17:52');
    expect(savedLine('Ana Admin', '2026-07-01T15:52:00.000Z')).toBe('Salvată de Ana Admin, 1 iul 2026 18:52');
  });

  it('types, toast and dialogs (5.3, 4.22, p5 Q42)', () => {
    expect([typesText({ grup: true, uscat: false }), typesText({ grup: false, uscat: true }), typesText({ grup: true, uscat: true })]).toEqual(['Grup', 'Uscat', 'Grup, Uscat']);
    expect(sessionSavedToast('Intermediari Bronze', '2026-10-27')).toBe('Prezență salvată: Intermediari Bronze, 27 oct.');
    expect(REACTIVATE_DIALOG.text('Ana Ionescu')).toBe('Ana Ionescu are statusul Inactiv. Reactivezi sportivul?');
    expect(LESSON_COPY.deleteConfirm('2026-10-28')).toBe('Ștergi lecția din 28 oct?');
    expect(ATTENDANCE_ERRORS.noCoach).toBe('Alege antrenorul.');
  });

  it('default duration from the series of that weekday, else 50 (C20)', () => {
    const { state } = attendanceSeed();
    expect(defaultDuration(state.calendar, 'g-club', '2026-11-20')).toBe(90);
    expect(defaultDuration(state.calendar, 'g-ib', '2026-11-14')).toBe(50);
    expect(defaultDuration(state.calendar, 'g-club', '2026-11-17')).toBe(50);
    expect(defaultDuration(state.calendar, 'g-club', '2026-09-25')).toBe(50);
  });

  it('outside the schedule: added by date, schedule by date and time (decided 7)', () => {
    const held = [{ key: 'ev-ib|2026-11-14|11:00', eventId: 'ev-ib', groupId: 'g-ib', date: '2026-11-14', startTime: '11:00', endTime: '11:50', durationMin: 50 }];
    expect(outsideFor({ source: 'added', groupId: 'g-ib', date: '2026-11-14', startTime: '15:00' }, held)).toBe(false);
    expect(outsideFor({ source: 'added', groupId: 'g-ib', date: '2026-11-17', startTime: '15:00' }, held)).toBe(true);
    expect(outsideFor({ source: 'schedule', groupId: 'g-ib', date: '2026-11-14', startTime: '12:00' }, held)).toBe(true);
  });

  it('counts present on the list and visitors apart (C42)', () => {
    expect(presentCounts([{ athleteId: 'a1', visitor: false }, { athleteId: 'a7', visitor: true }], ['a1', 'a2', 'a3'])).toEqual({ present: 1, visitors: 1 });
  });

  it('times and durations', () => {
    expect([isTime('17:00'), isTime('7:00'), isTime('24:00'), isTime(1700)]).toEqual([true, false, false, false]);
    expect([isDuration(50), isDuration(5), isDuration(600), isDuration(52), isDuration(0), isDuration(605), isDuration('50')]).toEqual([true, true, true, false, false, false, false]);
  });
});
