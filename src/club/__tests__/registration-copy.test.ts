import { describe, expect, it } from 'vitest';
import {
  checkSeasonAgainstLegacy,
  planCustomQuestionRemoval,
  planPriceNotesCopy,
  planSchoolPublicPage,
  planTooltipCopy,
} from '../migrate/registration-copy';

const TOOLTIP_6 = 'Disponibil pentru cei care știu că vor lipsi un weekend din cele 4 aferente abonamentului.';
// Shape of the live pricing.tiers (scripts/seed-pricing.js).
const tiers = {
  memberTiers: [
    { label: 'Abonament 6 ședințe grup', price: '520 RON', tooltip: TOOLTIP_6 },
    { label: 'Abonament 8 ședințe grup', price: '590 RON' },
  ],
  nonMemberTiers: [
    { label: '1 ședință grup', price: '150 RON', note: 'Disponibil doar pentru prima ședință' },
    { label: 'Abonament 6 ședințe grup', price: '720 RON', tooltip: TOOLTIP_6 },
    { label: 'Abonament 8 ședințe grup', price: '790 RON' },
  ],
  memberFeeLabel: 'Taxa de membru (o dată/sezon)',
  memberFeePrice: '250 RON',
};
const standard = () => ({
  documentId: 'list-standard',
  name: 'Standard',
  items: [
    { id: 1, name: 'Abonament 6 ședințe grup', kind: 'subscription', sessions: 6, memberPrice: 520, nonMemberPrice: 720, tooltip: null },
    { id: 2, name: 'Abonament 8 ședințe grup', kind: 'subscription', sessions: 8, memberPrice: 590, nonMemberPrice: 790, tooltip: null },
    { id: 3, name: '1 ședință grup', kind: 'session', sessions: null, memberPrice: null, nonMemberPrice: 150, tooltip: null },
  ],
});
const gold = () => ({ documentId: 'list-gold', name: 'Avansați Gold', items: [{ id: 4, name: 'Abonament Avansați Gold 8 ședințe', tooltip: null }] });

describe('planTooltipCopy', () => {
  it('copies tooltips and turns the note into the tooltip of 1 ședință grup', () => {
    const plan = planTooltipCopy({ tiers, lists: [standard(), gold()] });
    expect(plan.updates).toHaveLength(1);
    const [u] = plan.updates;
    expect(u).toMatchObject({ documentId: 'list-standard', filled: ['Abonament 6 ședințe grup', '1 ședință grup'] });
    expect(u.items).toEqual([
      { ...standard().items[0], tooltip: TOOLTIP_6 },
      standard().items[1],
      { ...standard().items[2], tooltip: 'Disponibil doar pentru prima ședință' },
    ]);
    expect(plan).toMatchObject({ unmatched: [], droppedNotes: [], conflicts: [] });
  });

  it('matches names regardless of case, spaces and diacritics', () => {
    const plan = planTooltipCopy({ tiers: { memberTiers: [{ label: ' abonament 6 sedinte GRUP', tooltip: 'x' }] }, lists: [standard()] });
    expect(plan.updates[0].filled).toEqual(['Abonament 6 ședințe grup']);
  });

  it('never overwrites a tooltip and changes nothing on a second run', () => {
    const first = planTooltipCopy({ tiers, lists: [standard()] });
    const again = planTooltipCopy({ tiers, lists: [{ ...standard(), items: first.updates[0].items }] });
    expect(again.updates).toEqual([]);
  });

  it('reports what it cannot place', () => {
    const plan = planTooltipCopy({
      tiers: {
        memberTiers: [
          { label: 'Lecție individuală', tooltip: 'Doar cu programare' },
          { label: 'Abonament 6 ședințe grup', tooltip: 'A', note: 'Notă veche' },
        ],
        nonMemberTiers: [{ label: 'Abonament 6 ședințe grup', tooltip: 'B' }],
      },
      lists: [standard()],
    });
    expect(plan.unmatched).toEqual(['Lecție individuală']);
    expect(plan.droppedNotes).toEqual(['Abonament 6 ședințe grup: Notă veche']);
    expect(plan.conflicts).toEqual(['Abonament 6 ședințe grup']);
    expect(plan.updates[0].items[0].tooltip).toBe('A');
  });
});

describe('planPriceNotesCopy', () => {
  const footerNotes = ['Nota 1', ' Nota 2 '];
  const school = { documentId: 'sec-school', name: 'Școala de Patinaj - AFI Cotroceni', kind: 'school', priceNotes: null };
  const club = { documentId: 'sec-club', name: 'Club', kind: 'club', priceNotes: null };

  it('copies the footer notes onto the school section', () =>
    expect(planPriceNotesCopy({ footerNotes, sections: [school, club] })).toEqual({
      update: { documentId: 'sec-school', priceNotes: ['Nota 1', 'Nota 2'] },
      report: [],
    }));

  it('does nothing when the notes are already there', () =>
    expect(planPriceNotesCopy({ footerNotes, sections: [{ ...school, priceNotes: ['Nota 1', 'Nota 2'] }] })).toEqual({ update: null, report: [] }));

  it('reports, without overwriting, notes an admin already changed', () => {
    const plan = planPriceNotesCopy({ footerNotes, sections: [{ ...school, priceNotes: ['Altă notă'] }] });
    expect(plan.update).toBeNull();
    expect(plan.report).toHaveLength(1);
  });

  it('reports when there is not exactly one school section', () => {
    expect(planPriceNotesCopy({ footerNotes, sections: [club] }).report).toHaveLength(1);
    expect(planPriceNotesCopy({ footerNotes, sections: [school, { ...school, documentId: 'sec-2' }] }).report).toHaveLength(1);
  });

  it('does nothing without old notes', () => expect(planPriceNotesCopy({ footerNotes: null, sections: [school] })).toEqual({ update: null, report: [] }));
});

describe('planSchoolPublicPage', () => {
  const school = { documentId: 'sec-school', name: 'Școala de Patinaj - AFI Cotroceni', kind: 'school', publicPage: false };
  const club = { documentId: 'sec-club', name: 'Club', kind: 'club', publicPage: false };

  it('switches on the public page of the school section, never of Club', () =>
    expect(planSchoolPublicPage([school, club])).toEqual({
      update: { documentId: 'sec-school', name: 'Școala de Patinaj - AFI Cotroceni' },
      report: [],
    }));

  it('does nothing once it is on (second run)', () =>
    expect(planSchoolPublicPage([{ ...school, publicPage: true }, club])).toEqual({ update: null, report: [] }));

  it('reports, without changing anything, when there is not exactly one school section', () => {
    expect(planSchoolPublicPage([club])).toEqual({ update: null, report: ['expected one school section, found 0; publicPage not set'] });
    expect(planSchoolPublicPage([school, { ...school, documentId: 'sec-2' }]).update).toBeNull();
  });
});

describe('planCustomQuestionRemoval', () => {
  const overlay = {
    q: { email: { label: 'E-mail' } },
    removed: { level: true },
    order: { date: ['email', 'c_ab12', 'parentName'], finalizare: ['source'] },
    custom: [{ key: 'c_ab12', type: 'text', step: 'date', label: 'Ce școală frecventează?', required: true }],
  };

  it('removes the custom questions and their places in the order, keeping everything else', () =>
    expect(planCustomQuestionRemoval(overlay)).toEqual({
      removed: ['Ce școală frecventează?'],
      overlay: {
        q: { email: { label: 'E-mail' } },
        removed: { level: true },
        order: { date: ['email', 'parentName'], finalizare: ['source'] },
      },
    }));

  it('does nothing when there are none (second run, empty or missing overlay)', () => {
    const first = planCustomQuestionRemoval(overlay);
    expect(planCustomQuestionRemoval(first.overlay)).toEqual({ removed: [], overlay: null });
    expect(planCustomQuestionRemoval({ custom: [] })).toEqual({ removed: [], overlay: null });
    expect(planCustomQuestionRemoval(null)).toEqual({ removed: [], overlay: null });
  });
});

describe('checkSeasonAgainstLegacy', () => {
  const season = { documentId: 's', label: '2026-2027', startMonth: '2026-10-01', endMonth: '2027-05-31', membershipFee: 250 };
  const settings = { currentSeason: '2026–2027', seasonStartDate: '2026-10-01', seasonEndDate: '2027-05-31' };

  it('is silent when the Sezon matches the old settings', () =>
    expect(checkSeasonAgainstLegacy({ season, settings, memberFeePrice: '250 RON' })).toEqual([]));

  it('reports every difference', () =>
    expect(
      checkSeasonAgainstLegacy({
        season,
        settings: { currentSeason: '2025-2026', seasonStartDate: '2025-10-04', seasonEndDate: '2026-05-30' },
        memberFeePrice: '300 RON',
      }),
    ).toEqual([
      'season: Sezon 2026-2027, settings 2025-2026',
      'start month: Sezon 2026-10, settings 2025-10',
      'end month: Sezon 2027-05, settings 2026-05',
      'membership fee: Sezon 250, pricing 300',
    ]));

  it('ignores old values that are missing', () => expect(checkSeasonAgainstLegacy({ season, settings: {}, memberFeePrice: undefined })).toEqual([]));

  it('says so when there is no current Sezon', () =>
    expect(checkSeasonAgainstLegacy({ season: null, settings, memberFeePrice: '250 RON' })).toEqual([
      'no current Sezon: registrations will be refused',
    ]));
});
