import { describe, expect, it } from 'vitest';
import type { CalendarEventRow } from '../../../api/calendar-event/services/expand';
import type { CalendarWindow } from '../../groups/occurrences';
import type { GroupRecord, SectionRecord } from '../../groups/types';
import { breakImpact, breakListLine, groupLine, impactTitle, type BreakImpact } from '../break-impact';

const grp = (id: string, sectionId: string, order: number, active = true): GroupRecord => ({ id, name: `Grupa ${id}`, sectionId, order, active, priceListId: null, coachIds: [], programPublic: true });
const section = (id: string, order: number, kind: 'school' | 'club'): SectionRecord => ({ id, name: `Sectia ${id}`, kind, publicPage: true, order, slug: id });
const event = (id: number, groupId: string, extra: Partial<CalendarEventRow> = {}): CalendarEventRow => ({
  id, documentId: `ev${id}`, title: `E${id}`, type: 'grupa',
  recurrence: { freq: 'weekly', sat: true, startTime: '10:00', endTime: '10:50', seasonStart: '2026-10-01' },
  exceptions: [], group: { documentId: groupId, name: `Grupa ${groupId}`, active: true, programPublic: true }, ...extra,
});
// 2026-11-14 and 2026-11-21 are Saturdays.
const FROM = '2026-11-14';
const TO = '2026-11-21';
const sections = [section('s2', 2, 'club'), section('s1', 1, 'school'), section('s3', 3, 'club')];
const groups = [grp('g2', 's1', 2), grp('g1', 's1', 1), grp('g3', 's2', 1), grp('gx', 's2', 2, false)];

const impact: BreakImpact = {
  sections: [
    { id: 's1', name: 'A', kind: 'school', groups: [1, 2, 3, 4].map((n) => ({ id: `g${n}`, name: `G${n}`, sessions: 2 })) },
    { id: 's2', name: 'B', kind: 'club', groups: [5, 6].map((n) => ({ id: `g${n}`, name: `G${n}`, sessions: n === 5 ? 0 : 2 })) },
  ],
};

describe('break impact texts', () => {
  it('titles and lines follow the ticks', () => {
    expect(impactTitle(impact, [])).toBe('Se anulează 10 ședințe la 6 din 6 grupe');
    expect(impactTitle(impact, ['g6'])).toBe('Se anulează 8 ședințe la 5 din 6 grupe');
    expect(groupLine({ id: 'g1', name: 'A', sessions: 2 }, true)).toBe('2 ședințe');
    expect(groupLine({ id: 'g1', name: 'A', sessions: 1 }, true)).toBe('1 ședință');
    expect(groupLine({ id: 'g1', name: 'A', sessions: 0 }, true)).toBe('nicio ședință');
    expect(groupLine({ id: 'g1', name: 'A', sessions: 2 }, false)).toBe('rămâne');
    expect(breakListLine(impact, [])).toBe('10 ședințe, toate grupele');
    expect(breakListLine(impact, ['g6'])).toBe('8 ședințe, 5 din 6 grupe');
  });
});

describe('breakImpact', () => {
  const window: CalendarWindow = { events: [event(1, 'g1'), event(2, 'g1'), event(3, 'g3')], blackouts: [] };

  it('orders sections and groups, counts the sessions per group and leaves out sections without an active group', () => {
    const r = breakImpact(window, groups, sections, FROM, TO);
    expect(r.sections.map((s) => [s.id, s.kind, s.groups.map((g) => [g.id, g.sessions])])).toEqual([
      ['s1', 'school', [['g1', 4], ['g2', 0]]],
      ['s2', 'club', [['g3', 2]]],
    ]);
  });

  it('counts the held dates although a break already covers them (the 0-sessions bug)', () => {
    const covered: CalendarWindow = { ...window, blackouts: [{ label: 'Vacanta', startDate: FROM, endDate: TO }] };
    expect(breakImpact(covered, groups, sections, FROM, TO)).toEqual(breakImpact(window, groups, sections, FROM, TO));
    expect(breakImpact(covered, groups, sections, FROM, TO).sections[1].groups[0].sessions).toBe(2);
  });

  it('a moved date counts, an exception-cancelled date does not, an inactive group is left out', () => {
    const w: CalendarWindow = {
      events: [
        event(1, 'g1', { exceptions: [{ date: FROM, kind: 'cancel' }] }),
        event(3, 'g3', { exceptions: [{ date: FROM, kind: 'override', newDate: '2026-11-16', newStartTime: '17:00', newEndTime: '17:50' }] }),
        event(4, 'gx'),
      ],
      blackouts: [],
    };
    const r = breakImpact(w, groups, sections, FROM, TO);
    expect(r.sections.flatMap((s) => s.groups).map((g) => [g.id, g.sessions])).toEqual([['g1', 1], ['g2', 0], ['g3', 2]]);
  });
});
