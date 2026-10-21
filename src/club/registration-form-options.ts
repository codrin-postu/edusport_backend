/**
 * Options of the club's script form (live Apps Script form, read 2026-10-19), word for word.
 * The registry `inscriere` and the submit validation read these lists; change them only here.
 */

export const RELATIONSHIP_OPTIONS = [
  { value: 'parinte', label: 'Părinte' },
  { value: 'tutore', label: 'Tutore Legal' },
  { value: 'alta', label: 'Alta (Vă rugăm specificați)' },
] as const;
export type Relationship = (typeof RELATIONSHIP_OPTIONS)[number]['value'];
export const RELATIONSHIP_OTHER: Relationship = 'alta';
export const RELATIONSHIP_OTHER_LABEL = 'Specificați calitatea (ex: Bunic, Frate):';

/** Stored as the spec enum `da` / `nu`; the script form submits "Da" / "Nu" with these labels. */
export const MEMBERSHIP_OPTIONS = [
  { value: 'da', label: 'Da, doresc să devin membru' },
  { value: 'nu', label: 'Nu, optez pentru tarife neafiliați' },
] as const;
export type MembershipAnswer = (typeof MEMBERSHIP_OPTIONS)[number]['value'];
export const MEMBERSHIP_YES: MembershipAnswer = 'da';
export const MEMBERSHIP_NO: MembershipAnswer = 'nu';

/** "Sezonul trecut ..." answers, stored as the text itself. */
export const LAST_SEASON_OPTIONS = ['Nu a participat', 'Începători', 'Intermediari', 'Avansați'] as const;

/** "De unde ați aflat ..." answers, stored as the text itself. */
export const SOURCE_OPTIONS = ['Facebook', 'Instagram', 'Recomandare', 'Căutare Google', 'Altele'] as const;
export const SOURCE_OTHER = 'Altele';
export const SOURCE_OTHER_LABEL = 'Vă rugăm să specificați de unde ați aflat de noi:';

export function isRelationship(v: string): v is Relationship {
  return RELATIONSHIP_OPTIONS.some((o) => o.value === v);
}

export function isMembershipAnswer(v: string): v is MembershipAnswer {
  return MEMBERSHIP_OPTIONS.some((o) => o.value === v);
}
