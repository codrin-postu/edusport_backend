import { describe, expect, it } from 'vitest';
import { gateDecision, tablesVisible, visibleLinks } from '../visible';
import type { FeatureKey } from '../features';

const links = [
  { label: 'Sportivi', area: 'club' as const },
  { label: 'Prezență', area: 'club' as const, feature: 'prezenta' as const },
  { label: 'Contabilitate', area: 'club' as const, feature: 'abonamente' as const },
  { label: 'Tabele', area: 'money' as const, show: tablesVisible },
];
const all = () => true;
const except = (...off: FeatureKey[]) => (k: FeatureKey) => !off.includes(k);
const labels = (on: (k: FeatureKey) => boolean) => visibleLinks(links, all, on).map((l) => l.label);

describe('visibleLinks', () => {
  it('shows everything while every switch is on', () => {
    expect(labels(all)).toEqual(['Sportivi', 'Prezență', 'Contabilitate', 'Tabele']);
  });
  it('hides Prezență when prezenta is off, keeps links without a feature', () => {
    expect(labels(except('prezenta'))).toEqual(['Sportivi', 'Contabilitate', 'Tabele']);
  });
  it('hides Contabilitate when abonamente is off', () => {
    expect(labels(except('abonamente'))).toEqual(['Sportivi', 'Prezență', 'Tabele']);
  });
  it('still filters by area', () => {
    expect(visibleLinks(links, (a) => a === 'money', all).map((l) => l.label)).toEqual(['Tabele']);
  });
});

describe('tablesVisible', () => {
  it('is on when either switch is on', () => {
    expect(tablesVisible(all)).toBe(true);
    expect(tablesVisible(except('prezenta'))).toBe(true);
    expect(tablesVisible(except('abonamente'))).toBe(true);
  });
  it('is off when both are off', () => {
    expect(tablesVisible(except('prezenta', 'abonamente'))).toBe(false);
  });
});

describe('gateDecision', () => {
  it('shows only when area and feature allow', () => {
    expect(gateDecision(true, true)).toBe('show');
    expect(gateDecision(true, false)).toBe('noAccess');
    expect(gateDecision(false, true)).toBe('noAccess');
  });
});
