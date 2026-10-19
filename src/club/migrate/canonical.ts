export const CANONICAL_SECTIONS = [
  { name: 'Școala de Patinaj - AFI Cotroceni', kind: 'school' as const, slug: 'afi-cotroceni', registrationsOpen: true },
  { name: 'Club', kind: 'club' as const, slug: 'club', registrationsOpen: false },
];

export const CANONICAL_PRICE_LISTS = ['Standard', 'Avansați Gold'] as const;

export const CANONICAL_GROUPS: { name: string; sectionKind: 'school' | 'club'; priceList: string | null }[] = [
  { name: 'Avansați Gold', sectionKind: 'school', priceList: 'Avansați Gold' },
  { name: 'Primii Pași', sectionKind: 'school', priceList: 'Standard' },
  { name: 'Intermediari Silver', sectionKind: 'school', priceList: 'Standard' },
  { name: 'Avansați Silver', sectionKind: 'school', priceList: 'Standard' },
  { name: 'Începători', sectionKind: 'school', priceList: 'Standard' },
  { name: 'Intermediari Bronze', sectionKind: 'school', priceList: 'Standard' },
  { name: 'Avansați Bronze', sectionKind: 'school', priceList: 'Standard' },
  { name: 'Profesioniști', sectionKind: 'club', priceList: null },
  { name: 'Avansați', sectionKind: 'club', priceList: null },
];
