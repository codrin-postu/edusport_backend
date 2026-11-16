import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { clubStats, clubStatsByEvent } from '../club-stats';

const club = (placement: number | null) => ({ athleteIsClub: true, placement });

describe('clubStats', () => {
  it('has nothing without club results', () => {
    expect(clubStats([])).toEqual({ podiums: 0, bestPlacement: null });
  });
  it('counts podiums (1 to 3) and the best placement', () => {
    expect(clubStats([club(4), club(2), club(1)])).toEqual({ podiums: 2, bestPlacement: 1 });
  });
  it('ignores a non-club athlete and a null placement', () => {
    expect(clubStats([{ athleteIsClub: false, placement: 1 }, club(null), club(5)])).toEqual({ podiums: 0, bestPlacement: 5 });
  });
});

describe('clubStatsByEvent', () => {
  it('groups the club results per event', () => {
    const by = clubStatsByEvent([{ eventId: 1, placement: 3 }, { eventId: 2, placement: 7 }, { eventId: 1, placement: 9 }]);
    expect(by.get(1)).toEqual({ podiums: 1, bestPlacement: 3 });
    expect(by.get(2)).toEqual({ podiums: 0, bestPlacement: 7 });
    expect(by.get(3)).toBeUndefined();
  });
});

describe('Competiții page columns', () => {
  it('has Podiumuri and Cel mai bun loc after Rezultate', () => {
    const src = readFileSync('src/admin/dashboard/CompetitiiPage.tsx', 'utf8');
    const at = (s: string) => src.indexOf(`header: '${s}'`);
    expect(at('Rezultate')).toBeGreaterThan(-1);
    expect(at('Podiumuri')).toBeGreaterThan(at('Rezultate'));
    expect(at('Cel mai bun loc')).toBeGreaterThan(at('Podiumuri'));
  });
});
