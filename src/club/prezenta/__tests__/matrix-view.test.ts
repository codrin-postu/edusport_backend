import { describe, expect, it } from 'vitest';
import type { MatrixColumn, MatrixRow } from '../../presence/attendance/api-types';
import { cellText, columnHeader, totalText } from '../matrix-view';

const col = (date: string, startTime = '18:00'): MatrixColumn => ({ date, startTime, sessionId: null, occurrenceKey: null, state: 'completat' });
const row = (over: Partial<MatrixRow>): MatrixRow => ({ athleteId: 'a', name: 'Ana', visitor: false, cells: [], present: 3, of: 4, ...over });

describe('matrix view', () => {
  it('header is the weekday and day, with the time when a day has two sessions', () => {
    expect(columnHeader(col('2026-11-02'), false)).toBe('Lu 2');
    expect(columnHeader(col('2026-11-07'), false)).toBe('Sâ 7');
    expect(columnHeader(col('2026-11-08'), false)).toBe('Du 8');
    expect(columnHeader(col('2026-11-02'), true)).toBe('Lu 2, 18:00');
  });
  it('cell text for screen readers', () => {
    expect(cellText({ grup: false, uscat: false })).toBe('');
    expect(cellText({ grup: true, uscat: false })).toBe('x');
    expect(cellText({ grup: true, uscat: true })).toBe('x U');
    expect(cellText({ grup: false, uscat: true })).toBe('U');
  });
  it('total is present of listed, a visitor only the count', () => {
    expect(totalText(row({}))).toBe('3/4');
    expect(totalText(row({ visitor: true, of: null }))).toBe('3');
  });
});
