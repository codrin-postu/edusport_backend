import { describe, expect, it } from 'vitest';
import type { ClubDueRow, DuePage, SchoolDueRow } from '../../presence/money-api';
import { clubCells, dueParts, dueSections, payFor, schoolCells } from '../due-view';

const schoolRow = (o: Partial<SchoolDueRow>): SchoolDueRow => ({
  subscriptionId: 's1', athleteId: 'a1', itemName: 'Abonament', startsOn: '2026-10-01', price: 0, paid: 0, left: 0, athleteName: 'Ana Ionescu', groupName: null, ...o,
});
const clubRow = (o: Partial<ClubDueRow>): ClubDueRow => ({
  athleteId: 'a2', athleteName: 'David Stan', groupNames: 'Avansați', grup: 0, uscat: 0, lessons: 0, due: 0, paid: 0, left: 0, ...o,
});
const duePage = (o: Partial<DuePage>): DuePage => ({ month: '2026-10', school: [], club: [], groupsWithoutList: 0, ...o });

describe('De încasat view', () => {
  it('Școala and Club cells (5.11, p5 scr 7)', () => {
    expect(schoolCells(schoolRow({ athleteName: 'Ana Ionescu', groupName: 'Intermediari Bronze', itemName: 'Abonament 8 ședințe', startsOn: '2026-10-27', price: 320, paid: 0, left: 320 })))
      .toEqual({ athlete: 'Ana Ionescu', group: 'Intermediari Bronze', item: 'Abonament 8 ședințe', from: 'din 27 oct', price: '320 RON', paid: '0 RON', left: '320 RON' });
    expect(clubCells(clubRow({ athleteName: 'David Stan', groupNames: 'Avansați', grup: 5, uscat: 2, lessons: 0, due: 260, paid: 100, left: 160 })))
      .toEqual({ athlete: 'David Stan', group: 'Avansați', sessions: '7 (5 grup, 2 uscat)', due: '260 RON', paid: '100 RON', left: '160 RON' });
    expect(clubCells(clubRow({ left: -20 })).left).toBe('-20 RON');
  });
  it('parts hidden when empty; both empty: the empty text (C76)', () => {
    expect(dueParts(duePage({ school: [], club: [clubRow({})] }))).toEqual({ school: false, club: true, empty: false });
    expect(dueParts(duePage({ school: [], club: [] }))).toEqual({ school: false, club: false, empty: true });
  });
  it('"+ Plată" preselects the abonament or the month (5.11, C33)', () => {
    expect(payFor(schoolRow({ subscriptionId: 'sub1' }), '2026-10')).toEqual({ kind: 'abonament', subscriptionId: 'sub1' });
    expect(payFor(clubRow({}), '2026-10')).toEqual({ kind: 'club_luna', month: '2026-10' });
  });
  it('the "Luna" filter lists the Plăți months (5.11)', () => {
    const [m] = dueSections('2026-10', '2026-11-20');
    expect([m.label, m.options[0].value, m.selected]).toEqual(['Luna', '2026-11', ['2026-10']]);
  });
});
