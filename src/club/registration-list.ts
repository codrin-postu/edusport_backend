import { ageFromText, type DateParts } from './birth-date';

/** What the Înscrieri list adds to each registration row (spec 3.1, 3.6), and what it never sends. */
export type RegistrationListExtras = {
  age: number | null;
  existingAthlete: boolean;
  athleteId: string | null;
  athleteName: string | null;
  /** The linked athlete is anonymized (3C spec 4): the Înscrieri panel shows the registration read-only. */
  athleteAnonymized: boolean;
  canUndo: boolean;
  schoolId: string | null;
  schoolName: string | null;
};

const HIDDEN = ['confirmation', 'matchAthlete', 'matchLevel', 'submissionKey', 'athlete', 'section', 'childBirthDateParsed'] as const;

const rel = (v: unknown): Record<string, unknown> | null => (v && typeof v === 'object' ? (v as Record<string, unknown>) : null);
const relText = (v: unknown, key: string): string | null => {
  const value = rel(v)?.[key];
  return typeof value === 'string' && value ? value : null;
};

export function listRowExtras(row: Record<string, unknown>, today: DateParts): RegistrationListExtras {
  const athleteId = relText(row.athlete, 'documentId');
  return {
    age: ageFromText(row.childBirthDate, today),
    existingAthlete: athleteId === null && (row.matchLevel === 'sigur' || row.matchLevel === 'probabil'),
    athleteId,
    athleteName: relText(row.athlete, 'name'),
    athleteAnonymized: relText(row.athlete, 'status') === 'anonimizat',
    canUndo: athleteId !== null && relText(row.confirmation, 'athleteId') === athleteId,
    schoolId: relText(row.section, 'documentId'),
    schoolName: relText(row.section, 'name'),
  };
}

export function publicListRow(row: Record<string, unknown>, today: DateParts): Record<string, unknown> {
  const out: Record<string, unknown> = { ...row };
  for (const key of HIDDEN) delete out[key];
  return { ...out, ...listRowExtras(row, today) };
}

type SectionLike = { documentId?: unknown; name?: unknown; kind?: unknown; publicPage?: unknown; order?: unknown };

/** Registration schools: sections of kind school with a public page (spec 3.6), in their order. */
export function registrationSchools(sections: SectionLike[]): { documentId: string; name: string }[] {
  return sections
    .filter((s) => s.kind === 'school' && s.publicPage === true && typeof s.documentId === 'string')
    .sort((a, b) => (typeof a.order === 'number' ? a.order : 9999) - (typeof b.order === 'number' ? b.order : 9999))
    .map((s) => ({ documentId: String(s.documentId), name: typeof s.name === 'string' ? s.name : '' }));
}
