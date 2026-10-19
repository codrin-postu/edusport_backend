import { describe, expect, it } from 'vitest';
import { planAthletes, planGroups, planPriceLists, planSeasons } from '../migrate/plan';

describe('planSeasons', () => {
  it('creates each season once, marks the current one, uses settings dates for it', () => {
    const plan = planSeasons({
      registrationSeasons: ['2025–2026', '2025-2026', '2026-2027', null, 'x'],
      settings: { currentSeason: '2026–2027', seasonStartDate: '2026-10-01', seasonEndDate: '2027-05-31' },
      memberFee: 270,
      existing: [],
    });
    expect(plan.create).toEqual([
      { label: '2025-2026', startMonth: '2025-10-01', endMonth: '2026-05-31', membershipFee: null, isCurrent: false, needsReview: true },
      { label: '2026-2027', startMonth: '2026-10-01', endMonth: '2027-05-31', membershipFee: 270, isCurrent: true, needsReview: false },
    ]);
  });
  it('skips seasons that already exist', () => {
    const plan = planSeasons({ registrationSeasons: ['2026-2027'], settings: { currentSeason: '2026-2027' }, memberFee: null, existing: ['2026-2027'] });
    expect(plan.create).toEqual([]);
  });
});

describe('planGroups', () => {
  it('creates the canonical groups, links coaches by name, reports unknown text', () => {
    const plan = planGroups({
      seriesCourses: ['Avansați Gold', 'Primii Paşi', 'Intermediari Silver', 'Avansați Silver', 'Începători', 'Intermediari Bronze', 'Avansați Bronze'],
      coachGroups: [
        { coachId: 'andreea', groups: ['Profesionisti', 'Avansati'] },
        { coachId: 'virgil', groups: ['Intermediari Silver', 'Intermediari Bronze', 'Grupa Veche'] },
      ],
      existing: [],
    });
    const byName = Object.fromEntries(plan.create.map((g) => [g.name, g]));
    expect(Object.keys(byName).sort()).toEqual(
      ['Avansați', 'Avansați Bronze', 'Avansați Gold', 'Avansați Silver', 'Intermediari Bronze', 'Intermediari Silver', 'Începători', 'Primii Pași', 'Profesioniști'].sort(),
    );
    expect(byName['Avansați']).toEqual({ name: 'Avansați', sectionKind: 'club', priceList: null, coachIds: ['andreea'] });
    expect(byName['Avansați Gold'].priceList).toBe('Avansați Gold');
    expect(byName['Începători'].priceList).toBe('Standard');
    expect(byName['Intermediari Silver'].coachIds).toEqual(['virgil']);
    expect(plan.unknown).toEqual(['Grupa Veche']);
  });
  it('does not recreate existing groups (any spelling)', () => {
    const plan = planGroups({ seriesCourses: ['Primii Paşi'], coachGroups: [], existing: ['Primii Pași'] });
    expect(plan.create.find((g) => g.name === 'Primii Pași')).toBeUndefined();
  });
  it('deduplicates unknown groups by nameKey', () => {
    const plan = planGroups({
      seriesCourses: [],
      coachGroups: [{ coachId: 'c1', groups: ['Grupa Veche', 'grupa veche'] }],
      existing: [],
    });
    expect(plan.unknown).toEqual(['Grupa Veche']);
  });
});

describe('planPriceLists', () => {
  it('builds Standard and Avansați Gold items from the tiers', () => {
    const plan = planPriceLists({
      memberTiers: [
        { label: 'Abonament 8 ședințe', price: '770 RON' },
        { label: 'Abonament 6 ședințe', price: '600 RON' },
        { label: '1 ședință', price: '110 RON' },
        { label: 'Abonament Avansați Gold 8 ședințe', price: '900 RON' },
      ],
      nonMemberTiers: [
        { label: 'Abonament 8 ședințe', price: '890 RON' },
        { label: 'Abonament 6 ședințe', price: '690 RON' },
        { label: '1 ședință', price: '130 RON' },
        { label: 'Abonament Avansați Gold 8 ședințe', price: '1020 RON' },
        { label: 'Taxă specială', price: '50 RON' },
      ],
      existing: [],
    });
    const standard = plan.create.find((l) => l.name === 'Standard')!;
    expect(standard.items).toContainEqual({ name: 'Abonament 8 ședințe', kind: 'subscription', sessions: 8, memberPrice: 770, nonMemberPrice: 890 });
    expect(standard.items).toContainEqual({ name: '1 ședință', kind: 'session', sessions: null, memberPrice: 110, nonMemberPrice: 130 });
    const gold = plan.create.find((l) => l.name === 'Avansați Gold')!;
    expect(gold.items).toEqual([
      { name: 'Abonament Avansați Gold 8 ședințe', kind: 'subscription', sessions: 8, memberPrice: 900, nonMemberPrice: 1020 },
    ]);
    expect(plan.unmatched).toEqual(['Taxă specială']);
  });
  it('skips lists that already exist', () => {
    const plan = planPriceLists({ memberTiers: [], nonMemberTiers: [], existing: ['Standard', 'Avansați Gold'] });
    expect(plan.create).toEqual([]);
  });
});

describe('planAthletes', () => {
  it('creates one athlete per public profile not linked yet', () => {
    const plan = planAthletes({
      sportspeople: [
        { documentId: 'p1', name: 'Maria Dumitrescu' },
        { documentId: 'p2', name: 'Ana Bălan' },
      ],
      linkedProfileIds: ['p2'],
    });
    expect(plan.create).toEqual([{ firstName: 'Maria', lastName: 'Dumitrescu', publicProfileId: 'p1', dataIncomplete: true }]);
  });
});
