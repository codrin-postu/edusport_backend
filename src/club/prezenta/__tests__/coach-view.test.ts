import { describe, expect, it } from 'vitest';
import { COACH_COPY, PANEL_LINKS } from '../../presence/copy/prezenta-ui';
import { backTarget, coachPageAddress, coachRowDate, durationText, readCoachQuery } from '../coach-view';
import { coachIdFromSplat, coachPageTo, prezentaTo } from '../routes';

describe('coach view', () => {
  it('reads the address: Lună and Ședințe by default (S45, S46)', () => {
    expect(readCoachQuery('', '2026-11-06')).toEqual({ view: 'luna', date: '2026-11-06', show: 'sedinte' });
    expect(readCoachQuery('?view=zi&date=2026-11-04&show=ore', '2026-11-06')).toEqual({ view: 'zi', date: '2026-11-04', show: 'ore' });
    expect(readCoachQuery('?view=saptamana&date=nope&show=x', '2026-11-06')).toEqual({ view: 'saptamana', date: '2026-11-06', show: 'sedinte' });
    expect(readCoachQuery('?show=lectii', '2026-11-06').show).toBe('lectii');
  });

  it('row dates and durations', () => {
    expect(coachRowDate('2026-11-04', '2026-11-06')).toBe('Mie 4 noi');
    expect(coachRowDate('2025-12-29', '2026-11-06')).toBe('Lun 29 dec 2025');
    expect(durationText(50)).toBe('50 min');
  });

  it('goes back to where the admin came from, else to Prezență with Antrenori', () => {
    const fallback = prezentaTo({ show: 'antrenori' });
    expect(backTarget({ from: '/plugins/edusport-prezenta?view=luna&show=antrenori' })).toBe('/plugins/edusport-prezenta?view=luna&show=antrenori');
    expect(backTarget({ from: 'https://evil' })).toBe(fallback);
    expect(backTarget({ from: '//evil.com' })).toBe(fallback);
    expect(backTarget(null)).toBe(fallback);
    expect(backTarget(undefined)).toBe(fallback);
    expect(backTarget({ from: 7 })).toBe(fallback);
  });

  it('copy is exact', () => {
    expect(COACH_COPY.tiles).toEqual({ sessions: 'Ședințe grup', lessons: 'Lecții individuale', hours: 'Ore' });
    expect(COACH_COPY.back).toBe('Înapoi');
    expect(PANEL_LINKS).toEqual({ coaches: 'Antrenori: ', openGroup: 'Deschide grupa' });
  });

  it('the page address matches what the Antrenori rows link to (S45)', () => {
    expect(coachPageAddress('tm 1', { view: 'luna', date: '2026-11-02', show: 'ore' })).toBe('/plugins/edusport-prezenta/antrenor/tm%201?view=luna&date=2026-11-02&show=ore');
    expect(coachIdFromSplat(coachPageTo('tm 1', 'luna', '2026-11-02').split('/plugins/edusport-prezenta/')[1].split('?')[0])).toBe('tm 1');
    expect(coachIdFromSplat(undefined)).toBeNull();
    expect(coachIdFromSplat('')).toBeNull();
    expect(coachIdFromSplat('antrenor')).toBeNull();
    expect(coachIdFromSplat('altceva/x')).toBeNull();
    expect(coachIdFromSplat('antrenor/%E0%A4%A')).toBeNull();
  });
});
