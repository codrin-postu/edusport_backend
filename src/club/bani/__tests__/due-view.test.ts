import { describe, expect, it } from 'vitest';
import type { ClubDueRow, DuePage, SchoolDueRow } from '../../presence/money-api';
import { schoolCode, payFor } from '../due-view';

const schoolRow = (o: Partial<SchoolDueRow>): SchoolDueRow => ({
  subscriptionId: 's1', athleteId: 'a1', itemName: 'Abonament', startsOn: '2026-10-01', price: 0, paid: 0, left: 0, athleteName: 'Ana Ionescu', groupName: null, ...o,
});
const clubRow = (o: Partial<ClubDueRow>): ClubDueRow => ({
  athleteId: 'a2', athleteName: 'David Stan', groupNames: 'Avansați', grup: 0, uscat: 0, lessons: 0, due: 0, paid: 0, left: 0, ...o,
});
const duePage = (o: Partial<DuePage>): DuePage => ({ month: '2026-10', school: [], club: [], groupsWithoutList: 0, ...o });

describe('De încasat view', () => {
  it('"+ Plată" preselects the abonament or the month (5.11, C33)', () => {
    expect(payFor(schoolRow({ subscriptionId: 'sub1' }), '2026-10')).toEqual({ kind: 'abonament', subscriptionId: 'sub1' });
    expect(payFor(clubRow({}), '2026-10')).toEqual({ kind: 'club_luna', month: '2026-10' });
  });
});

describe('De încasat Școala code (11-5 5.7)', () => {
  it('the code goes before the item name; none when the abonament has none', () => {
    expect(schoolCode(schoolRow({ code: 'A-0124' }))).toBe('A-0124');
    expect(schoolCode(schoolRow({ code: null }))).toBeNull();
  });
});
