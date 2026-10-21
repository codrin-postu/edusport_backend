import { describe, expect, it } from 'vitest';
import {
  LAST_SEASON_OPTIONS,
  MEMBERSHIP_OPTIONS,
  RELATIONSHIP_OPTIONS,
  RELATIONSHIP_OTHER,
  RELATIONSHIP_OTHER_LABEL,
  SOURCE_OPTIONS,
  SOURCE_OTHER,
  SOURCE_OTHER_LABEL,
  isMembershipAnswer,
  isRelationship,
} from '../registration-form-options';

describe('script form options', () => {
  it('match the live script form word for word', () => {
    expect(LAST_SEASON_OPTIONS).toEqual(['Nu a participat', 'Începători', 'Intermediari', 'Avansați']);
    expect(SOURCE_OPTIONS).toEqual(['Facebook', 'Instagram', 'Recomandare', 'Căutare Google', 'Altele']);
    expect(RELATIONSHIP_OPTIONS.map((o) => o.label)).toEqual(['Părinte', 'Tutore Legal', 'Alta (Vă rugăm specificați)']);
    expect(MEMBERSHIP_OPTIONS.map((o) => o.label)).toEqual([
      'Da, doresc să devin membru',
      'Nu, optez pentru tarife neafiliați',
    ]);
    expect(RELATIONSHIP_OTHER_LABEL).toBe('Specificați calitatea (ex: Bunic, Frate):');
    expect(SOURCE_OTHER_LABEL).toBe('Vă rugăm să specificați de unde ați aflat de noi:');
  });

  it('stores the spec enum values', () => {
    expect(RELATIONSHIP_OPTIONS.map((o) => o.value)).toEqual(['parinte', 'tutore', 'alta']);
    expect(MEMBERSHIP_OPTIONS.map((o) => o.value)).toEqual(['da', 'nu']);
  });

  it('the free-text answers are among the options', () => {
    expect(SOURCE_OPTIONS).toContain(SOURCE_OTHER);
    expect(RELATIONSHIP_OPTIONS.map((o) => o.value)).toContain(RELATIONSHIP_OTHER);
  });

  it('uses comma-below ș and ț, never the cedilla', () => {
    const all = JSON.stringify([LAST_SEASON_OPTIONS, SOURCE_OPTIONS, RELATIONSHIP_OPTIONS, MEMBERSHIP_OPTIONS]);
    expect(all).not.toMatch(/[şţŞŢ]/);
  });

  it('recognises stored values only', () => {
    expect(isRelationship('tutore')).toBe(true);
    expect(isRelationship('Părinte')).toBe(false);
    expect(isMembershipAnswer('da')).toBe(true);
    expect(isMembershipAnswer('Da')).toBe(false);
  });
});
