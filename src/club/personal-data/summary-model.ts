import { ACS_WORDS, type AcsState } from '../acs';
import { ATHLETE_FIELD_LABELS, birthDateForPicker, type AthleteStatus } from '../athlete-data';
import type { DocumentKind } from '../documents/types';
import { STATUS_WORDS } from '../history-text';
import { abonamentTabRows, dateTabRows } from '../inscrieri-panel';
import { DOCUMENT_LABELS, formatEmailSentAt } from '../registration-panel';
import { historyWhen } from '../sportivi/record-view';
import { PERSONAL_DATA_COPY } from './copy';

/** "rezumat.pdf" of "Exportă datele" (spec 3) as rows; the PDF only draws them. Pure. */
export type SummaryRow = { label: string; value: string };
export type SummaryBlock = { heading: string | null; rows: SummaryRow[] };
export type SummarySection = { title: string; blocks: SummaryBlock[] };
export type SummaryModel = { title: string; name: string; sections: SummarySection[]; footer: string };

export type SummaryRegistration = { number: string; record: Record<string, unknown>; seasonLabel: string | null; sectionName: string | null; missingDocuments: DocumentKind[] };
export type SummaryInput = {
  athlete: { name: string | null; birthDate: string | null; contactName: string | null; phone: string | null; email: string | null; status: AthleteStatus; notes: string | null };
  groups: { season: string; group: string; main: boolean }[];
  acs: { season: string; state: AcsState }[];
  registrations: SummaryRegistration[];
  history: { at: string; actor: string; text: string; subject: string }[];
  generatedAt: Date;
  generatedBy: string;
};

const P = PERSONAL_DATA_COPY.pdf;
const row = (label: string, value: string | null | undefined): SummaryRow => ({ label, value: value ?? '' });
const orNone = (rows: SummaryRow[]): SummaryRow[] => (rows.length ? rows : [row('', P.none)]);
const single = (title: string, rows: SummaryRow[]): SummarySection => ({ title, blocks: [{ heading: null, rows: orNone(rows) }] });
const isoText = (v: unknown): string => (v instanceof Date ? v.toISOString() : typeof v === 'string' ? v : '');

function athleteSection(a: SummaryInput['athlete']): SummarySection {
  return single(P.athlete, [
    row(ATHLETE_FIELD_LABELS.name, a.name), row(ATHLETE_FIELD_LABELS.birthDate, birthDateForPicker(a.birthDate)),
    row(ATHLETE_FIELD_LABELS.contactName, a.contactName), row(ATHLETE_FIELD_LABELS.phone, a.phone), row(ATHLETE_FIELD_LABELS.email, a.email),
    row(P.status, STATUS_WORDS[a.status]), row(P.notes, a.notes),
  ]);
}

function registrationBlock(r: SummaryRegistration): SummaryBlock {
  const submitted = isoText(r.record.submittedAt);
  return {
    heading: `${P.registration} ${r.number}`.trim(),
    rows: [
      row(P.season, r.seasonLabel), row(P.school, r.sectionName), row(P.status, typeof r.record.status === 'string' ? r.record.status : ''),
      ...dateTabRows(r.record).map((x) => row(x.label, x.value)),
      ...abonamentTabRows(r.record).map((x) => row(x.label, x.value)),
      row(P.submittedAt, submitted ? formatEmailSentAt(submitted) : ''),
      ...r.missingDocuments.map((kind) => row(DOCUMENT_LABELS[kind], PERSONAL_DATA_COPY.missingDocument)),
    ],
  };
}

function registrationsSection(list: SummaryRegistration[]): SummarySection {
  return list.length ? { title: P.registrations, blocks: list.map(registrationBlock) } : single(P.registrations, []);
}

const historyRow = (l: SummaryInput['history'][number]): SummaryRow =>
  row([historyWhen(l.at), l.actor].filter(Boolean).join(', '), l.subject ? `${P.registration} ${l.subject}: ${l.text}` : l.text);

export function buildSummaryModel(input: SummaryInput): SummaryModel {
  return {
    title: P.title,
    name: input.athlete.name ?? '',
    sections: [
      athleteSection(input.athlete),
      single(P.groups, input.groups.map((g) => row(g.season, g.main ? `${g.group}, ${P.mainGroup}` : g.group))),
      single(P.acs, input.acs.map((a) => row(a.season, ACS_WORDS[a.state]))),
      registrationsSection(input.registrations),
      single(P.history, input.history.map(historyRow)),
    ],
    footer: P.generated(formatEmailSentAt(input.generatedAt.toISOString()), input.generatedBy),
  };
}
