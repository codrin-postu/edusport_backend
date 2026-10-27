import { ACS_WORDS, type AcsState } from '../acs';
import { ATHLETE_FIELD_LABELS, birthDateForPicker, type AthleteStatus } from '../athlete-data';
import type { DocumentKind } from '../documents/types';
import { LIFECYCLE_PDF } from '../presence/copy/lifecycle';
import { HISTORY_ACTIONS, STATUS_WORDS } from '../history-text';
import { abonamentTabRows, dateTabRows } from '../inscrieri-panel';
import { DOCUMENT_LABELS, formatEmailSentAt } from '../registration-panel';
import { historyWhen } from '../sportivi/record-view';
import { nameKey } from './carried-names';
import { PERSONAL_DATA_COPY } from './copy';

/** "rezumat.pdf" of "Exportă datele" (spec 3) as rows; the PDF only draws them. Pure. */
export type SummaryRow = { label: string; value: string };
export type SummaryBlock = { heading: string | null; rows: SummaryRow[] };
export type SummarySection = { title: string; blocks: SummaryBlock[] };
export type SummaryModel = { title: string; name: string; sections: SummarySection[]; footer: string };

export type SummaryRegistration = { number: string; record: Record<string, unknown>; seasonLabel: string | null; sectionName: string | null; missingDocuments: DocumentKind[] };
/** One Istoric line; `action` and `changes` are the stored row's, read only to leave lines out. */
export type SummaryHistoryLine = { at: string; actor: string; text: string; subject: string; action: string; changes: Record<string, unknown> };
/** Phase 5 lines (attendance, lessons, abonamente, payments), one text per row, newest first. */
export type SummaryPresence = { attendance: string[]; lessons: string[]; subscriptions: string[]; payments: string[] };
export type SummaryInput = {
  athlete: { name: string | null; birthDate: string | null; contactName: string | null; phone: string | null; email: string | null; status: AthleteStatus; notes: string | null };
  groups: { season: string; group: string; main: boolean }[];
  acs: { season: string; state: AcsState }[];
  registrations: SummaryRegistration[];
  history: SummaryHistoryLine[];
  presence: SummaryPresence;
  /** Every name the child has carried, as `nameKey` normalizes it. */
  childNames: ReadonlySet<string>;
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

/** Lines naming the record they link to; a merge's "Unit cu" names the removed record of the same child and is kept. */
const NAMED_RECORD: Readonly<Record<string, string>> = { [HISTORY_ACTIONS.athleteUnlinked]: 'name', [HISTORY_ACTIONS.confirmed]: 'athleteName' };

/**
 * A line only about another child never reaches the parent (user ruling, 2026-10-27): a dismissed duplicate pair,
 * or a link to a record under a name this child never carried.
 */
function aboutAnotherChild(line: SummaryHistoryLine, childNames: ReadonlySet<string>): boolean {
  if (line.action === HISTORY_ACTIONS.duplicateDismissed) return true;
  const key = NAMED_RECORD[line.action];
  const named = key ? nameKey(line.changes[key]) : '';
  return named !== '' && !childNames.has(named);
}

const historyRow = (l: SummaryHistoryLine): SummaryRow =>
  row([historyWhen(l.at), l.actor].filter(Boolean).join(', '), l.subject ? `${P.registration} ${l.subject}: ${l.text}` : l.text);

const lines = (title: string, list: string[]): SummarySection => single(title, list.map((l) => row('', l)));

const presenceSections = (p: SummaryPresence): SummarySection[] => [
  lines(LIFECYCLE_PDF.attendance, p.attendance), lines(LIFECYCLE_PDF.lessons, p.lessons), lines(LIFECYCLE_PDF.subscriptions, p.subscriptions), lines(LIFECYCLE_PDF.payments, p.payments),
];

export function buildSummaryModel(input: SummaryInput): SummaryModel {
  return {
    title: P.title,
    name: input.athlete.name ?? '',
    sections: [
      athleteSection(input.athlete),
      single(P.groups, input.groups.map((g) => row(g.season, g.main ? `${g.group}, ${P.mainGroup}` : g.group))),
      single(P.acs, input.acs.map((a) => row(a.season, ACS_WORDS[a.state]))),
      registrationsSection(input.registrations),
      single(P.history, input.history.filter((l) => !aboutAnotherChild(l, input.childNames)).map(historyRow)),
      ...presenceSections(input.presence),
    ],
    footer: P.generated(formatEmailSentAt(input.generatedAt.toISOString()), input.generatedBy),
  };
}
