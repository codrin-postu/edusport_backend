import { describe, expect, it } from 'vitest';
import { countedPins, type CountedInput } from '../counted';
import { FRIENDSHIP_MESSAGES, pinLabel } from '../catalog';

const base: CountedInput = { presenceDates: [], results: null, firstMembershipStart: null, perfectMonths: [], firstPinGivenOn: null, today: '2026-11-17' };
const pin = (list: { pin: string }[], id: string) => list.find((p) => p.pin === id) as ReturnType<typeof countedPins>['insigne'][number];
const day = (n: number) => new Date(Date.UTC(2025, 0, n)).toISOString().slice(0, 10);

describe('countedPins', () => {
  it('lists 5 unearned antrenamente pins without presences', () => {
    const { antrenamente } = countedPins(base);
    expect(antrenamente.map((p) => p.pin)).toEqual(['prima-lectie', 'antrenamente-25', 'antrenamente-50', 'antrenamente-100', 'antrenamente-250']);
    expect(antrenamente.every((p) => p.earnedOn === null)).toBe(true);
  });

  it('dates milestones by the unit that crossed them', () => {
    const presenceDates = Array.from({ length: 30 }, (_, k) => day(30 - k));
    const { antrenamente } = countedPins({ ...base, presenceDates });
    expect(pin(antrenamente, 'prima-lectie').earnedOn).toBe(day(1));
    expect(pin(antrenamente, 'antrenamente-25').earnedOn).toBe(day(25));
    expect(pin(antrenamente, 'antrenamente-50').earnedOn).toBeNull();
  });

  it('keeps concursuri unearned and counts zero when results are unavailable', () => {
    const r = countedPins(base);
    expect(r.concursuri.map((p) => p.pin)).toEqual(['concursuri-1', 'concursuri-2', 'concursuri-5', 'concursuri-10', 'concursuri-25']);
    expect(r.concursuri.every((p) => p.earnedOn === null)).toBe(true);
    expect(pin(r.insigne, 'locul-1').count).toBe(0);
    expect(pin(r.insigne, 'podium').count).toBe(0);
  });

  it('counts wins and podiums from placements', () => {
    const results = [
      { date: '2026-01-01', placement: 1 }, { date: '2026-02-01', placement: 3 }, { date: '2026-03-01', placement: 2 },
      { date: '2026-04-01', placement: null }, { date: '2026-05-01', placement: 5 },
    ];
    const r = countedPins({ ...base, results });
    expect(pin(r.insigne, 'locul-1').count).toBe(1);
    expect(pin(r.insigne, 'locul-1').earnedOn).toBe('2026-01-01');
    expect(pin(r.insigne, 'podium').count).toBe(3);
    expect(pin(r.insigne, 'podium').earnedOn).toBe('2026-03-01');
    expect(pin(r.concursuri, 'concursuri-5').earnedOn).toBe('2026-05-01');
    expect(pin(r.concursuri, 'concursuri-10').earnedOn).toBeNull();
  });

  it('earns membru years on each anniversary', () => {
    const { membru } = countedPins({ ...base, firstMembershipStart: '2023-09-15' });
    expect(membru.filter((p) => p.earnedOn).map((p) => p.earnedOn)).toEqual(['2024-09-15', '2025-09-15', '2026-09-15']);
    expect(pin(membru, 'membru-4').earnedOn).toBeNull();
  });

  it('caps membru at 15 years', () => {
    const { membru } = countedPins({ ...base, firstMembershipStart: '2006-01-01' });
    expect(membru).toHaveLength(15);
    expect(membru.every((p) => p.earnedOn)).toBe(true);
    expect(membru.some((p) => p.pin === 'membru-16')).toBe(false);
  });

  it('earns nothing in membru without a membership', () => {
    expect(countedPins(base).membru.every((p) => p.earnedOn === null)).toBe(true);
  });

  it('counts perfect months and dates the latest at its last day', () => {
    const r = countedPins({ ...base, perfectMonths: ['2026-10', '2026-12'] });
    expect(pin(r.insigne, 'prezenta').count).toBe(2);
    expect(pin(r.insigne, 'prezenta').earnedOn).toBe('2026-12-31');
  });

  it('earns manusi on the first pin given', () => {
    const r = countedPins({ ...base, firstPinGivenOn: '2026-12-05' });
    expect(pin(r.insigne, 'manusi').earnedOn).toBe('2026-12-05');
    expect(pin(countedPins(base).insigne, 'manusi').earnedOn).toBeNull();
  });
});

describe('pinLabel', () => {
  it('names pins in Romanian', () => {
    expect(pinLabel('membru-1')).toBe('Membru 1 an');
    expect(pinLabel('membru-2')).toBe('Membru 2 ani');
    expect(pinLabel('saritura-2lz')).toBe('Dublu Lutz');
    expect(pinLabel('saritura-3t')).toBe('Triplu Toe loop');
    expect(pinLabel('manusi')).toBe('Prima prietenie');
    expect(pinLabel('prima-lectie')).toBe('Prima lecție');
    expect(pinLabel('antrenamente-25')).toBe('25 de antrenamente');
    expect(pinLabel('concursuri-1')).toBe('Primul concurs');
    expect(pinLabel('concursuri-2')).toBe('2 concursuri');
    expect(pinLabel('concursuri-25')).toBe('25 de concursuri');
  });

  it('has 15 friendship messages', () => {
    expect(FRIENDSHIP_MESSAGES).toHaveLength(15);
  });
});
