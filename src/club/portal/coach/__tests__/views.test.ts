import { describe, expect, it } from 'vitest';
import type { LessonPanel, SessionPanel } from '../../../presence/attendance/api-types';
import { FORBIDDEN_KEYS, forbiddenKeysIn, toCoachLesson, toCoachMember, toCoachSession } from '../views';
import { C_TEAM } from './coach-seed';

const right = { read: true, write: true, archived: false, mustIncludeMe: false };
const panel: SessionPanel & { price: number; history: string[] } = {
  sessionId: 's1', occurrenceKey: 'ev|2026-11-20|17:00', added: null, groupId: 'g-scoala-a', groupName: 'Școala A', kind: 'school',
  date: '2026-11-20', startTime: '17:00', durationMin: 50, outsideSchedule: false, coachIds: ['tm-andreea'],
  rows: [{ athleteId: 'a1', name: 'Ana', visitor: false, inactive: false, mainGroup: 'Școala A', abonament: 'Abonament 8 ședințe', grup: true, uscat: false, noSubscription: false }],
  savedLine: 'Salvat de Andreea', history: ['linie de istoric'], price: 320,
};
const lesson: LessonPanel & { amount: number; itemName: string } = {
  lessonId: 'l1', athleteId: 'a1', athleteName: 'Ana', date: '2026-11-20', startTime: '17:00', durationMin: 50, coachIds: ['tm-andreea'],
  state: 'saved', present: true, savedLine: null, deletable: true, amount: 80, itemName: 'Lecție individuală',
};

describe('views drop every forbidden key', () => {
  it('forbiddenKeysIn walks objects and arrays', () => {
    expect(forbiddenKeysIn({ a: [{ price: 1 }] })).toEqual(['price']);
    expect(forbiddenKeysIn({ email: 'x' }, ['email'])).toEqual([]);
    expect(forbiddenKeysIn({ ok: { deeper: [{ fine: 1 }] } })).toEqual([]);
    expect(FORBIDDEN_KEYS).toContain('registrations');
  });

  it('a session answer is built by name, with the school abonament as text', () => {
    const view = toCoachSession(panel, { ages: new Map([['a1', 9]]), slots: new Map([['a1', { used: 2, total: 8 }]]), team: C_TEAM, right, standIn: false });
    expect(forbiddenKeysIn(view)).toEqual([]);
    expect(view.rows).toEqual([{ athleteId: 'a1', name: 'Ana', age: 9, inactive: false, visitor: false, grup: true, uscat: false, abonament: '2/8' }]);
    expect(view.editable).toBe(true);
    expect(JSON.stringify(view)).not.toContain('Abonament 8');
  });

  it('a lesson is deletable only when the right allows it and nothing was paid', () => {
    const allowed = { ...right, delete: true };
    expect(forbiddenKeysIn(toCoachLesson(lesson, { team: C_TEAM, right: allowed, paid: false }))).toEqual([]);
    expect(toCoachLesson(lesson, { team: C_TEAM, right: allowed, paid: false }).deletable).toBe(true);
    expect(toCoachLesson(lesson, { team: C_TEAM, right: allowed, paid: true }).deletable).toBe(false);
    expect(toCoachLesson(lesson, { team: C_TEAM, right: { ...allowed, delete: false }, paid: false }).deletable).toBe(false);
  });

  it('a member shows new status and the other group names only', () => {
    const view = toCoachMember({ membershipId: 'm', athleteId: 'a1', name: 'Ana', age: 9, isMain: true, others: [{ name: 'Club B', isMain: false }] }, 'nou');
    expect(view).toEqual({ athleteId: 'a1', name: 'Ana', age: 9, isNew: true, alsoIn: ['Club B'] });
    expect(forbiddenKeysIn(view)).toEqual([]);
  });
});
