import { describe, expect, it } from 'vitest';
import type { Occurrence } from '../../../api/calendar-event/services/expand';
import type { ProgramRow } from '../../groups/program-read';
import { changeBody, dateBody, dateFormOf, dateKey, dateToast, formFromRow, groupChip, isBreak, isOneOffClass, newProgramForm, programBody, programFormError } from '../program-view';

const occ = (over: Partial<Occurrence>): Occurrence => ({
  eventId: 1, documentId: 'e1', title: 'Intermediari Bronze', type: 'scoala', label: null, color: null, order: 0, date: '2026-11-14', startTime: '11:00', endTime: '11:50',
  endsNextDay: false, endDate: '2026-11-14', status: 'scheduled', cancelReason: null, state: 'curs', note: null, groupId: 'g-ib', groupName: 'Intermediari Bronze', oneOff: false, originalDate: null, originalStartTime: null, ...over,
});

describe('chips of the group calendar (6.3, W12)', () => {
  it('normal, cancelled, moved and break dates', () => {
    expect(groupChip(occ({}))).toMatchObject({ cat: 'scoala', time: '11:00', text: '', struck: false });
    expect(groupChip(occ({ status: 'cancelled', cancelReason: 'exception', note: 'Competiție la Brașov' }))).toMatchObject({ cat: 'anulat', text: 'Anulată: Competiție la Brașov', struck: true });
    expect(groupChip(occ({ status: 'cancelled', cancelReason: 'exception' })).text).toBe('Anulată');
    expect(groupChip(occ({ status: 'override', date: '2026-11-21', startTime: '12:00', originalDate: '2026-11-21', originalStartTime: '11:00' })).text).toBe('Mutată de la 11:00');
    expect(groupChip(occ({ status: 'override', date: '2026-11-22', startTime: '12:00', originalDate: '2026-11-21', originalStartTime: '11:00' })).text).toBe('Mutată de la 21 noiembrie');
    expect(groupChip(occ({ status: 'cancelled', cancelReason: 'blackout', note: 'Vacanța de iarnă' }))).toMatchObject({ cat: 'liber', text: 'Vacanța de iarnă', struck: true });
    expect(groupChip(occ({ type: 'curs' })).cat).toBe('antrenament');
  });

  it('a break opens read-only; a moved date is addressed by its series date', () => {
    expect(isBreak(occ({ status: 'cancelled', cancelReason: 'blackout' }))).toBe(true);
    expect(dateKey(occ({ status: 'override', date: '2026-11-22', originalDate: '2026-11-21' }))).toBe('2026-11-21');
    expect(dateKey(occ({}))).toBe('2026-11-14');
  });
});

describe('"Program nou" and "Schimbă programul" (W10, decided 5)', () => {
  it('starts as a weekly series of 50 min from today', () => {
    expect(newProgramForm('2026-11-20')).toMatchObject({ repeat: true, freq: 'weekly', days: [], durationMin: 50, from: '2026-11-20', date: '2026-11-20' });
  });

  it('needs a day; builds the series or one-class body', () => {
    const f = { ...newProgramForm('2026-11-20'), days: ['sun', 'sat'] as ('sun' | 'sat')[], startTime: '11:00' };
    expect(programFormError({ ...f, days: [] })).toBe('Alege cel puțin o zi.');
    expect(programFormError(f)).toBeNull();
    expect(programBody(f)).toEqual({ repeat: true, freq: 'weekly', weekOfMonth: null, days: ['sat', 'sun'], startTime: '11:00', durationMin: 50, from: '2026-11-20' });
    expect(programBody({ ...f, repeat: false, note: ' x ' })).toEqual({ repeat: false, date: '2026-11-20', startTime: '11:00', durationMin: 50, note: 'x' });
  });

  it('"Schimbă" keeps the series and starts on its next date', () => {
    const row: ProgramRow = { eventId: 'e1', freq: 'monthly', days: ['sat'], weekOfMonth: 'last', startTime: '11:00', durationMin: 50, from: '2026-10-04', to: '2027-05-31', text: '', fromText: '', nextDate: '2026-11-28' };
    const f = formFromRow(row, '2026-11-20');
    expect(f).toMatchObject({ freq: 'monthly', weekOfMonth: 'last', days: ['sat'], from: '2026-11-28' });
    expect(changeBody(f)).toEqual({ freq: 'monthly', weekOfMonth: 'last', days: ['sat'], startTime: '11:00', durationMin: 50, from: '2026-11-28' });
    expect(formFromRow({ ...row, nextDate: null }, '2026-11-20').from).toBe('2026-11-20');
  });
});

describe('the date panel (6.3, decided 4)', () => {
  it('opens on the date\'s current state, the e-mail box unticked', () => {
    expect(dateFormOf(occ({}))).toMatchObject({ mode: 'keep', notify: false });
    expect(dateFormOf(occ({ status: 'cancelled', cancelReason: 'exception', note: 'x' }))).toMatchObject({ mode: 'cancel', reason: 'x', notify: false });
    expect(dateFormOf(occ({ status: 'override', date: '2026-11-22', startTime: '12:00', originalDate: '2026-11-21' }))).toMatchObject({ mode: 'move', newDate: '2026-11-22', newStartTime: '12:00' });
  });

  it('sends the e-mail box only for Anulează and Mută; toasts per mode', () => {
    const f = { mode: 'keep' as const, newDate: '', newStartTime: '', reason: 'x', notify: true };
    expect(dateBody(f)).toEqual({ mode: 'keep', newDate: null, newStartTime: null, reason: null, notifyParents: false });
    expect(dateBody({ ...f, mode: 'cancel' })).toEqual({ mode: 'cancel', newDate: null, newStartTime: null, reason: 'x', notifyParents: true });
    expect([dateToast('cancel', '2026-11-14'), dateToast('move', '2026-11-21'), dateToast('keep', '2026-11-14')]).toEqual([
      'Ședința din 14 noiembrie a fost anulată.', 'Ședința din 21 noiembrie a fost mutată.', 'Ședința din 14 noiembrie se ține.',
    ]);
  });
});

describe('"Șterge ședința" (final review)', () => {
  it('only a one-off class offers it, never a date of an ended or split series', () => {
    expect(isOneOffClass(occ({ oneOff: true }))).toBe(true);
    expect(isOneOffClass(occ({ oneOff: false }))).toBe(false);
    expect(isOneOffClass({})).toBe(false);
  });
});
