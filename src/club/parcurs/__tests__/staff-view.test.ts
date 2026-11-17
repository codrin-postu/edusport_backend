import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { awardBody, awardLine, friendshipCell, pinCell, pinSrc } from '../staff-view';

describe('staff-view', () => {
  it('a pin cell shows the count only above 1 and greys an unearned pin', () => {
    const base = { pin: 'steaua', label: 'Steaua antrenorului' };
    expect(pinCell({ ...base, earnedOn: '2026-12-05', count: 1 })).toMatchObject({ count: null, earned: true, date: '05/12/2026', src: '/parcurs/steaua.png' });
    expect(pinCell({ ...base, earnedOn: '2026-12-05', count: 3 }).count).toBe(3);
    expect(pinCell({ ...base, earnedOn: null, count: 0 })).toMatchObject({ earned: false, date: '', count: null });
  });

  it('the award body needs a code and level for a jump only', () => {
    expect(awardBody({ kind: '', jump: '', level: '' })).toBeNull();
    expect(awardBody({ kind: 'steaua', jump: 'lz', level: '2' })).toEqual({ kind: 'steaua' });
    expect(awardBody({ kind: 'jump', jump: '', level: '2' })).toBeNull();
    expect(awardBody({ kind: 'jump', jump: 'lz', level: '' })).toBeNull();
    expect(awardBody({ kind: 'jump', jump: 'zz', level: '2' })).toBeNull();
    expect(awardBody({ kind: 'jump', jump: 'lz', level: '2' })).toEqual({ kind: 'jump', jump: 'lz', level: 2 });
  });

  it('friendship pins use the design number and name the other side', () => {
    const p = { id: 'x1', design: 7, message: 'Te susțin!', from: 'Ana Pop', givenOn: '2026-12-01' };
    expect(friendshipCell(p)).toMatchObject({ src: pinSrc('prietenie-07'), who: 'De la Ana Pop', date: '01/12/2026' });
    expect(friendshipCell({ ...p, to: 'Ion Vlad' }).who).toBe('Către Ion Vlad');
  });

  it('an award line reads label, date, giver', () => {
    expect(awardLine({ pin: 'saritura-2lz', givenOn: '2026-12-01', givenBy: 'Ana Pop' })).toBe('Dublu Lutz, 01/12/2026, Ana Pop');
  });

  it('the tab is wired to the staff routes and removes with buttons labelled from the copy', () => {
    const api = readFileSync(join(__dirname, '../../../admin/dashboard/sportivi/api.ts'), 'utf8');
    expect(api).toContain('/parcurs');
    const tab = readFileSync(join(__dirname, '../../../admin/dashboard/sportivi/ParcursTab.tsx'), 'utf8');
    expect(tab).toContain('copy.remove');
    expect(tab).not.toMatch(/Salvează|Publică/);
  });
});
