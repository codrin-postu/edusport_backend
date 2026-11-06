import { describe, expect, it } from 'vitest';
import { cardRight, lessonRight, presenceRight, programRight } from '../rules';
import { coachAbonamentText } from '../views';

const base = { date: '2026-10-06', today: '2026-10-13', scheduled: true, added: false, saved: true, listed: false };

describe('presenceRight', () => {
  it('own group: read always, write within the correction window, first save without a deadline', () => {
    expect(presenceRight({ ...base, access: 'own' })).toEqual({ read: true, write: true, archived: false, mustIncludeMe: false });
    expect(presenceRight({ ...base, access: 'own', today: '2026-10-14' })).toMatchObject({ read: true, write: false, archived: true });
    expect(presenceRight({ ...base, access: 'own', saved: false, today: '2026-11-30' })).toMatchObject({ write: true });
    expect(presenceRight({ ...base, access: 'own', date: '2026-10-14' })).toMatchObject({ write: false });
  });

  it('stand-in: the 7 days of a scheduled class, himself in the list', () => {
    expect(presenceRight({ ...base, access: 'other', saved: false })).toMatchObject({ read: true, write: true, mustIncludeMe: true });
    expect(presenceRight({ ...base, access: 'other', saved: false, date: '2026-10-05' })).toMatchObject({ read: false, write: false });
    expect(presenceRight({ ...base, access: 'other', saved: false, date: '2026-10-06', today: '2026-10-13' })).toMatchObject({ read: true });
    expect(presenceRight({ ...base, access: 'other', saved: true, listed: false })).toMatchObject({ write: false });
    expect(presenceRight({ ...base, access: 'other', saved: true, listed: true })).toMatchObject({ read: true, write: true });
    expect(presenceRight({ ...base, access: 'other', saved: true, listed: true, today: '2026-10-14' })).toMatchObject({ read: true, write: false, archived: true });
  });

  it('stand-in: an added session, an unscheduled one and a future date give nothing to write', () => {
    expect(presenceRight({ ...base, access: 'other', added: true, saved: false })).toMatchObject({ read: false, write: false });
    expect(presenceRight({ ...base, access: 'other', scheduled: false, saved: false })).toMatchObject({ read: false, write: false });
    expect(presenceRight({ ...base, access: 'other', saved: false, date: '2026-10-14' })).toMatchObject({ write: false });
  });

  it('none: nothing', () => {
    expect(presenceRight({ ...base, access: 'none', listed: true })).toMatchObject({ read: false, write: false });
  });
});

describe('lessonRight, programRight, cardRight', () => {
  it('lessons: nothing unless listed, correction window once recorded', () => {
    expect(lessonRight({ listed: false, date: '2026-10-06', today: '2026-10-06', recorded: false })).toMatchObject({ read: false, write: false, delete: false });
    expect(lessonRight({ listed: true, date: '2026-10-06', today: '2026-10-14', recorded: true })).toMatchObject({ write: false, delete: false, archived: true });
    expect(lessonRight({ listed: true, date: '2026-09-01', today: '2026-10-14', recorded: false })).toMatchObject({ write: true, delete: true });
    expect(lessonRight({ listed: true, date: '2026-10-06', today: '2026-10-13', recorded: true })).toMatchObject({ write: true, delete: true });
  });

  it('program: read own and other, write only an own Club group', () => {
    expect(programRight('own', 'school')).toEqual({ read: true, write: false });
    expect(programRight('other', 'club')).toEqual({ read: true, write: false });
    expect(programRight('own', 'club')).toEqual({ read: true, write: true });
    expect(programRight('none', 'club')).toEqual({ read: false, write: false });
  });

  it('card: contact only for an own athlete', () => {
    expect(cardRight(true, false)).toEqual({ read: true, contact: true });
    expect(cardRight(false, true)).toEqual({ read: true, contact: false });
    expect(cardRight(false, false)).toEqual({ read: false, contact: false });
  });

  it('abonament text', () => {
    expect(coachAbonamentText('school', { used: 3, total: 8 })).toBe('3/8');
    expect(coachAbonamentText('school', null)).toBe('Fără abonament');
    expect(coachAbonamentText('club', { used: 3, total: 8 })).toBeNull();
  });
});
