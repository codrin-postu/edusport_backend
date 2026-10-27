import { describe, expect, it } from 'vitest';
import { coachesCsv, coachesCsvName } from '../coaches/csv';
import { coachRows, hoursText } from '../coaches/hours';
import { readCoachMonth } from '../coaches/report';
import { attendanceSeed, ok, withSavedClub } from './attendance-seed';

const names = { 'tm-virgil': 'Virgil Pascu', 'tm-andreea': 'Andreea Pascu', 'tm-dan': 'Dan Toma' };
const rows = coachRows({
  names,
  sessions: [{ id: 's1', coachIds: ['tm-virgil'], durationMin: 50 }, { id: 's2', coachIds: ['tm-virgil', 'tm-andreea'], durationMin: 90 }, { id: 's3', coachIds: ['tm-dan'], durationMin: 50 }],
  presentBySession: new Map([['s1', 2], ['s2', 1], ['s3', 0]]),
  lessons: [
    { coachIds: ['tm-virgil'], durationMin: 50, state: 'saved', present: true },
    { coachIds: ['tm-dan'], durationMin: 50, state: 'saved', present: false },
    { coachIds: ['tm-dan'], durationMin: 50, state: 'planned', present: null },
  ],
});

describe('Pe antrenori: hours and CSV', () => {
  it('each coach gets the full duration; empty sessions and absent lessons do not count (4.3, p5 Q25, C18)', () => {
    expect(rows).toEqual([
      { coachId: 'tm-andreea', name: 'Andreea Pascu', sessions: 1, lessons: 0, minutes: 90, hours: '1,5' },
      { coachId: 'tm-virgil', name: 'Virgil Pascu', sessions: 2, lessons: 1, minutes: 190, hours: '3,2' }]);
  });

  it('hours with one decimal and a comma (4.3)', () => {
    expect([hoursText(1290), hoursText(1140), hoursText(50), hoursText(0)]).toEqual(['21,5', '19,0', '0,8', '0,0']);
  });

  it('CSV with BOM, ";" and the screen headers (C43)', () => {
    expect(coachesCsv(rows)).toBe('﻿Antrenor;Ședințe grup;Lecții individuale;Ore\r\nAndreea Pascu;1;0;1,5\r\nVirgil Pascu;2;1;3,2\r\n');
    expect(coachesCsv([{ ...rows[0], name: 'Pop; "Junior"' }])).toContain('"Pop; ""Junior""";1;0;1,5');
    expect(coachesCsvName('2026-11')).toBe('pe-antrenori-2026-11.csv');
  });

  it('reads the month from saved rows only', async () => {
    const f = withSavedClub(attendanceSeed());
    expect(ok(await readCoachMonth(f.store, '2026-11'))).toEqual([{ coachId: 'tm-andreea', name: 'Andreea Pascu', sessions: 1, lessons: 0, minutes: 90, hours: '1,5' }]);
    expect(ok(await readCoachMonth(f.store, '2026-10'))).toEqual([]);
    expect((await readCoachMonth(f.store, 'x')).ok).toBe(false);
  });
});
