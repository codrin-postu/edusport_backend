import { describe, expect, it } from 'vitest';
import { changedStartTime, nextClass, recipients, schedulePayload, scheduleJobs } from '../schedule-mail';
import { athleteRow, event, member } from './fake-group-store';

const ATHLETES = [
  athleteRow({ id: 'a1', email: ' Parinte.Ionescu@Example.com ' }), athleteRow({ id: 'a2', email: 'parinte.ionescu@example.com' }),
  athleteRow({ id: 'a3', email: 'stan@example.com', status: 'inactiv' }), athleteRow({ id: 'a4', email: 'anon@example.com', status: 'anonimizat' }),
  athleteRow({ id: 'a5', email: 'ended@example.com' }), athleteRow({ id: 'a6', email: '' }), athleteRow({ id: 'a7', email: 'other@example.com' }),
];
const ROWS = [
  member({ id: 'm1', athleteId: 'a1', groupId: 'g-ib' }), member({ id: 'm2', athleteId: 'a2', groupId: 'g-ib', isMain: false }),
  member({ id: 'm3', athleteId: 'a3', groupId: 'g-ib' }), member({ id: 'm4', athleteId: 'a4', groupId: 'g-ib' }),
  member({ id: 'm5', athleteId: 'a5', groupId: 'g-ib', to: '2026-10-31' }), member({ id: 'm6', athleteId: 'a6', groupId: 'g-ib' }),
  member({ id: 'm7', athleteId: 'a7', groupId: 'g-ib', seasonId: 's25' }),
];

describe('recipients (6.5, W7)', () => {
  const NONE = new Set<string>();

  it('current members of the season, Nou and Activ, trimmed, lower case, each address once', () => {
    expect(recipients(ATHLETES, ROWS, 'g-ib', 's26', NONE)).toEqual(['parinte.ionescu@example.com']);
  });

  it('leaves out the athletes whose holder switched schedule mail off', () => {
    const two = [athleteRow({ id: 'p1', email: 'one@example.com' }), athleteRow({ id: 'p2', email: 'two@example.com' })];
    const rows = [member({ id: 'k1', athleteId: 'p1', groupId: 'g-ib' }), member({ id: 'k2', athleteId: 'p2', groupId: 'g-ib' })];
    expect(recipients(two, rows, 'g-ib', 's26', new Set(['p1']))).toEqual(['two@example.com']);
    expect(recipients(two, rows, 'g-ib', 's26', new Set(['p1', 'p2']))).toEqual([]);
  });

  it('a muted athlete is left out; the address stays while another unmuted member shares it; muting every member empties the list', () => {
    expect(recipients(ATHLETES, ROWS, 'g-ib', 's26', new Set(['a2']))).toEqual(['parinte.ionescu@example.com']);
    expect(recipients(ATHLETES, ROWS, 'g-ib', 's26', new Set(['a1', 'a2']))).toEqual([]);
    expect(recipients(ATHLETES, ROWS, 'g-ib', 's26', new Set(['a7']))).toEqual(['parinte.ionescu@example.com']);
    expect(recipients(ATHLETES, ROWS, 'g-ib', 's26', new Set())).toEqual(['parinte.ionescu@example.com']);
  });
});

describe('next class (W33)', () => {
  const e = event({ id: 'e1', exceptions: [{ date: '2026-11-15', kind: 'anulat', newDate: null, newStartTime: null, newEndTime: null, newTitle: null, reason: null }] });

  it('a break the group is excepted from does not hide its dates', () => {
    const brk = { id: 'b', label: 'Pauză', startDate: '2026-11-21', endDate: '2026-11-22', exceptGroupIds: ['g-ib'] };
    expect(nextClass([e], [brk], 'g-ib', '2026-11-14', '2027-05-31')).toEqual({ date: '2026-11-21', startTime: '11:00' });
    expect(nextClass([e], [{ ...brk, exceptGroupIds: ['other'] }], 'g-ib', '2026-11-14', '2027-05-31')).toEqual({ date: '2026-11-28', startTime: '11:00' });
  });

  it('is the first held class after the date, skipping cancelled dates and breaks', () => {
    expect(nextClass([e], [], 'g-ib', '2026-11-14', '2027-05-31')).toEqual({ date: '2026-11-21', startTime: '11:00' });
    expect(nextClass([e], [{ id: 'b', label: 'Pauză', startDate: '2026-11-21', endDate: '2026-11-22' }], 'g-ib', '2026-11-14', '2027-05-31')).toEqual({ date: '2026-11-28', startTime: '11:00' });
  });

  it('a later date moved before the cancelled one is not the next class; one moved in from before the window is', () => {
    const row = (date: string, newDate: string) => ({ date, kind: 'override' as const, newDate, newStartTime: '09:00', newEndTime: '09:50', newTitle: null, reason: null });
    const earlier = event({ id: 'e2', exceptions: [row('2026-11-21', '2026-11-13')] });
    expect(nextClass([earlier], [], 'g-ib', '2026-11-14', '2027-05-31')).toEqual({ date: '2026-11-15', startTime: '11:00' });
    const movedIn = event({ id: 'e3', exceptions: [row('2026-11-07', '2026-11-16')] });
    expect(nextClass([movedIn], [], 'g-ib', '2026-11-14', '2027-05-31')).toEqual({ date: '2026-11-15', startTime: '11:00' });
    const movedInLate = event({ id: 'e4', exceptions: [row('2026-11-08', '2026-11-14')] });
    expect(nextClass([movedInLate], [], 'g-ib', '2026-11-13', '2027-05-31')).toEqual({ date: '2026-11-14', startTime: '09:00' });
  });

  it('is null after the season\'s last class', () => {
    expect(nextClass([e], [], 'g-ib', '2027-05-31', '2027-05-31')).toBeNull();
  });
});

describe('payload and jobs', () => {
  const e = event({ id: 'e1', exceptions: [{ date: '2026-11-21', kind: 'override', newDate: '2026-11-22', newStartTime: '12:00', newEndTime: '12:50', newTitle: null, reason: null }] });

  it('the changed date keeps the time it had (decided 3)', () => {
    expect(changedStartTime(e, '2026-11-21')).toBe('12:00');
    expect(changedStartTime(e, '2026-11-14')).toBe('11:00');
  });

  it('a date already moved names the day and time the parents were last told (I4)', () => {
    const moved = { mode: 'move' as const, newDate: '2026-11-29', newStartTime: '13:00', reason: null };
    expect(schedulePayload('Intermediari Bronze', e, '2026-11-21', { mode: 'cancel', reason: null }, null)).toMatchObject({ date: '2026-11-22', startTime: '12:00' });
    expect(schedulePayload('Intermediari Bronze', e, '2026-11-21', moved, null)).toMatchObject({ mode: 'move', date: '2026-11-22', startTime: '12:00', newDate: '2026-11-29' });
    expect(schedulePayload('Intermediari Bronze', e, '2026-11-14', moved, null)).toMatchObject({ date: '2026-11-14', startTime: '11:00' });
  });

  it('a cancel carries the next class, a move does not', () => {
    expect(schedulePayload('Intermediari Bronze', e, '2026-11-14', { mode: 'cancel', reason: null }, { date: '2026-11-15', startTime: '11:00' })).toEqual({
      groupName: 'Intermediari Bronze', date: '2026-11-14', startTime: '11:00', mode: 'cancel', newDate: null, newStartTime: null, nextDate: '2026-11-15', nextStartTime: '11:00', reason: null,
    });
    expect(schedulePayload('Intermediari Bronze', e, '2026-11-14', { mode: 'move', newDate: '2026-11-15', newStartTime: '12:00', reason: 'Gheață' }, null))
      .toMatchObject({ mode: 'move', newDate: '2026-11-15', newStartTime: '12:00', nextDate: null, reason: 'Gheață' });
  });

  it('one job per address, held 15 seconds, keyed by the change', () => {
    const payload = schedulePayload('Intermediari Bronze', e, '2026-11-14', { mode: 'cancel', reason: null }, null);
    expect(scheduleJobs(['a@example.com', 'b@example.com'], payload, 'g-ib', 'h7', new Date('2026-11-20T10:00:00.000Z'))).toEqual([
      { recipient: 'a@example.com', subject: 'Intermediari Bronze: ședința de sâmbătă, 14 noiembrie, se anulează', groupId: 'g-ib', changeKey: 'h7', notBefore: '2026-11-20T10:00:15.000Z', payload },
      { recipient: 'b@example.com', subject: 'Intermediari Bronze: ședința de sâmbătă, 14 noiembrie, se anulează', groupId: 'g-ib', changeKey: 'h7', notBefore: '2026-11-20T10:00:15.000Z', payload },
    ]);
  });
});
