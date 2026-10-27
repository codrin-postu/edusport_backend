import { describe, expect, it } from 'vitest';
import type { MembershipRow } from '../../athletes/store';
import type { HistoryEntryRow } from '../types';
import { membershipUndo, readUndoRecord, undoLockTargets, undoRefusal, type UndoRecord } from '../undo';

const row: MembershipRow = { id: 'm1', athleteId: 'a1', groupId: 'g-ib', seasonId: 's26', isMain: true, from: '2026-10-01', to: null };
const RECORD: UndoRecord = { kind: 'group', steps: [{ op: 'deleteMembership', id: 'm9', athleteId: 'a1' }], subjects: [{ type: 'group', id: 'g-ib' }], revalidate: false };
const entry = (over: Partial<HistoryEntryRow> = {}): HistoryEntryRow => ({
  id: 'h1', seq: 10, subjectType: 'group', subjectId: 'g-ib', action: 'member-allocated', changes: { athleteId: 'a1', undo: RECORD }, actor: 'admin@example.com', at: '2026-11-20T10:00:00.000Z', ...over,
});

describe('the step that takes back one membership write', () => {
  it('deletes a created row', () => {
    expect(membershipUndo({ op: 'create', athleteId: 'a1', groupId: 'g-ib', seasonId: 's26', isMain: true, from: '2026-11-20' }, null, 'm9'))
      .toEqual({ op: 'deleteMembership', id: 'm9', athleteId: 'a1' });
  });

  it('reopens an ended row with its main flag', () => {
    expect(membershipUndo({ op: 'end', id: 'm1', to: '2026-11-19' }, row, null)).toEqual({ op: 'setMembership', id: 'm1', athleteId: 'a1', isMain: true, to: null });
  });

  it('re-creates a deleted row exactly', () => {
    expect(membershipUndo({ op: 'delete', id: 'm1' }, row, null)).toEqual({
      op: 'createMembership', row: { athleteId: 'a1', groupId: 'g-ib', seasonId: 's26', isMain: true, from: '2026-10-01', to: null },
    });
  });

  it('flips a main flag back', () => {
    expect(membershipUndo({ op: 'main', id: 'm1', isMain: true }, { ...row, isMain: false }, null)).toEqual({ op: 'setMembership', id: 'm1', athleteId: 'a1', isMain: false, to: null });
  });

  it('refuses a delete or a flag change without the row as it was', () => {
    expect(() => membershipUndo({ op: 'delete', id: 'm1' }, null, null)).toThrow();
  });
});

describe('refusal (W15, decided 3)', () => {
  it('lets the undo run when nothing else was written on its subjects', () => {
    const own = entry({ id: 'h2', seq: 11, subjectType: 'athlete', subjectId: 'a1', changes: { actionId: 'h1' } });
    expect(undoRefusal(entry(), [own])).toBeNull();
  });

  it('refuses after a later line by another action, after an undo, and for an unknown action', () => {
    const other = entry({ id: 'h5', seq: 15, changes: { athleteId: 'a2' } });
    expect(undoRefusal(entry(), [other])).toBe('changed');
    expect(undoRefusal(entry({ changes: { undo: RECORD, undone: true } }), [])).toBe('changed');
    expect(undoRefusal(entry({ changes: {} }), [])).toBe('changed');
    expect(undoRefusal(null, [])).toBe('missing');
  });

  it('reads only a record with steps, subjects and a kind', () => {
    expect(readUndoRecord(RECORD)).toEqual(RECORD);
    expect(readUndoRecord({ steps: [] })).toBeNull();
    expect(readUndoRecord('x')).toBeNull();
  });
});

describe('locks an undo takes', () => {
  it('lists seasons, athletes, groups and events, sorted and once each', () => {
    expect(undoLockTargets([
      { op: 'setMembership', id: 'm2', athleteId: 'b', isMain: true, to: null },
      { op: 'createMembership', row: { athleteId: 'a', groupId: 'g2', seasonId: 's26', isMain: false, from: null, to: null } },
      { op: 'deleteMembership', id: 'm3', athleteId: 'a' },
      { op: 'setEvent', id: 'e2', recurrence: { freq: 'weekly', days: [], weekOfMonth: null, startTime: null, endTime: null, singleDate: null, seasonStart: null, seasonEnd: null }, exceptions: [] },
      { op: 'deleteEvent', id: 'e1' },
      { op: 'setCurrentSeason', id: 's26', otherId: 's27' },
      { op: 'cancelEmails' },
    ])).toEqual({ seasons: ['s26', 's27'], athletes: ['a', 'b'], groups: ['g2'], events: ['e1', 'e2'] });
  });
});
