import { describe, expect, it } from 'vitest';
import type { GroupRecord, SectionRecord } from '../../../groups/types';
import { levelOf, promotionFor } from '../level';

const SECTIONS: SectionRecord[] = [
  { id: 'afi', name: 'Școala de Patinaj - AFI Cotroceni', kind: 'school', publicPage: true, order: 1, slug: 'scoala-afi', locationName: 'AFI Cotroceni' },
  { id: 'club', name: 'Club', kind: 'club', publicPage: false, order: 2, slug: 'club', locationName: 'Patinoar Nord' },
];
const g = (id: string, name: string, sectionId: string, order: number | null): GroupRecord => ({ id, name, sectionId, order, active: true, priceListId: null, coachIds: [], programPublic: true });
const BRONZE = g('G1', 'Intermediari Bronze', 'afi', 2);
const SILVER = g('G2', 'Intermediari Silver', 'afi', 3);
const CLUB = g('G3', 'Club Performanță', 'club', 1);
const GROUPS = [BRONZE, SILVER, CLUB];

describe('levelOf', () => {
  it('names the group, its section and the location', () => {
    expect(levelOf(BRONZE, SECTIONS[0], 'AFI Cotroceni')).toEqual({ groupId: 'G1', groupName: 'Intermediari Bronze', sectionName: 'Școala de Patinaj - AFI Cotroceni', section: 'school', location: 'AFI Cotroceni' });
  });
});

describe('promotionFor', () => {
  it('the first read stores the group silently', () => {
    expect(promotionFor(null, BRONZE, GROUPS, SECTIONS)).toEqual({ promotion: null, store: 'G1' });
  });

  it('nothing changed: nothing to do', () => {
    expect(promotionFor('G1', BRONZE, GROUPS, SECTIONS)).toEqual({ promotion: null, store: null });
  });

  it('a higher order in the same section is a promotion and is not stored until it was shown', () => {
    expect(promotionFor('G1', SILVER, GROUPS, SECTIONS)).toEqual({ promotion: { from: 'Intermediari Bronze', to: 'Intermediari Silver' }, store: null });
  });

  it('a lower order is stored silently', () => {
    expect(promotionFor('G2', BRONZE, GROUPS, SECTIONS)).toEqual({ promotion: null, store: 'G1' });
  });

  it('Școala to Club is a promotion, Club to Școala is not', () => {
    expect(promotionFor('G2', CLUB, GROUPS, SECTIONS)).toEqual({ promotion: { from: 'Intermediari Silver', to: 'Club Performanță' }, store: null });
    expect(promotionFor('G3', SILVER, GROUPS, SECTIONS)).toEqual({ promotion: null, store: 'G2' });
  });

  it('a seen group that no longer exists, or no main group today, is not a promotion', () => {
    expect(promotionFor('gone', SILVER, GROUPS, SECTIONS)).toEqual({ promotion: null, store: 'G2' });
    expect(promotionFor('G1', null, GROUPS, SECTIONS)).toEqual({ promotion: null, store: null });
  });
});
