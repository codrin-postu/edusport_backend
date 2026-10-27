import { countWords } from '../../ro-count';
import { athletesText, groupsText, seriesCountText } from './core';

/** "Începe sezonul <next>" (spec 10.2) and the per-group copies (10.6). */
export const NEW_SEASON_COPY = {
  button: (next: string) => `Începe sezonul ${next}`,
  title: (next: string) => `Începe sezonul ${next}`,
  stepOf: (n: number) => `Pasul ${n} din 3`,
  cancel: 'Anulează',
  next: 'Continuă',
  back: 'Înapoi',
  apply: (next: string) => `Începe sezonul ${next}`,
  lead1: (next: string) => `${next} devine sezonul curent. Se aplică abia la ultimul pas.`,
  onSite: 'Pe site',
  inPanel: 'În panou',
  lead2: (next: string, current: string) => `Toate grupele trec în ${next}. Alege ce copiezi din ${current}.`,
  colGroup: 'Grupă',
  colIn: (current: string) => `În ${current}`,
  colMembers: 'Copiază sportivii',
  colProgram: 'Copiază programul',
  inactiveSuffix: (k: number) => (k === 1 ? ', 1 inactiv' : `, ${k} inactivi`),
  seeAthletes: 'Vezi sportivii',
  hide: 'Ascunde',
  hideAthletes: 'Ascunde sportivii',
  noProgram: 'Fără program',
  hasProgram: (next: string) => `Are program în ${next}`,
  childHeader: 'Sportiv',
  childMainHeader: (next: string) => `Grupa principală în ${next}`,
  childInactive: 'Inactiv, nu se copiază',
  childNoGroup: 'Fără grupă',
  childKept: (current: string) => `ca în ${current}`,
  childChanged: (current: string, group: string) => `în ${current}: ${group}, care nu se copiază`,
  childMainShort: (group: string) => `Principală: ${group}`,
  phoneAllMembers: 'Sportivii, toate',
  phoneAllProgram: 'Programul, toate',
  phoneCard: (n: number, current: string) => `${athletesText(n)} în ${current}`,
  mainRule: 'Grupa principală rămâne aceeași dacă se copiază și ea. Altfel devine principală grupa copiată.',
  tileGroups: 'Grupe',
  tileGroupsHint: (next: string) => `toate trec în ${next}`,
  tileAthletes: 'Sportivi copiați',
  tileAthletesHint: (groups: number, section: string | null) => `în ${groupsText(groups)}${section ? ` ${section}` : ''}`,
  tileSeries: 'Programe copiate',
  tileSeriesHint: (from: string) => `din ${from}`,
  tileUnassigned: 'Fără grupă',
  tileUnassignedHint: (current: string) => `grupa din ${current} propusă`,
  mainChangesBold: (n: number) => `Grupa principală se schimbă pentru ${athletesText(n)}.`,
  mainKeptBold: (n: number) => `Rămâne aceeași pentru ${athletesText(n)}`,
  mainKeptRest: (name: string, group: string) => `, de exemplu ${name}: ${group}.`,
  inactiveBold: (n: number) => (n === 1 ? '1 sportiv inactiv nu se copiază:' : `${athletesText(n)} inactivi nu se copiază:`),
  unassignedBold: (n: number) => (n === 1 ? '1 sportiv intră la Fără grupă' : `${athletesText(n)} intră la Fără grupă`),
  unassignedRest: (next: string, current: string) => ` în ${next}, cu grupa principală din ${current} propusă.`,
  programBold: 'Programul se repetă',
  programRest: (from: string, to: string) => ` din ${from} până pe ${to}. Pauzele nu se copiază: adaugă vacanțele în Calendar și serii.`,
  acsBold: 'Membru A.C.S. nu se copiază.',
  acsRest: (next: string) => ` În ${next} toți pornesc de la Nu.`,
  schoolWarning: (next: string) => `Grupele Școlii nu au program în ${next}: pagina Program arată textul vechi până îl adaugi.`,
  emptyMembers: (season: string) => `Niciun sportiv în ${season}.`,
  copyMembers: (season: string) => `Copiază sportivii din ${season}`,
  copyMembersHint: (n: number, season: string, inactive: number) =>
    `${athletesText(n)} în ${season}${inactive ? `, ${inactive === 1 ? '1 inactiv nu se copiază' : `${inactive} inactivi nu se copiază`}` : ''}.`,
  emptyProgram: (season: string) => `Niciun program în ${season}.`,
  copyProgram: (season: string) => `Copiază programul din ${season}`,
  copyProgramHint: (season: string, program: string, from: string) => `În ${season}: ${program}. Se repetă din ${from}.`,
  membersCopiedToast: (n: number, season: string) => (n === 1 ? `1 sportiv copiat din ${season}.` : `${athletesText(n)} copiați din ${season}.`),
  programCopiedToast: (season: string) => `Program copiat din ${season}.`,
  seasonChanged: 'Sezonul curent s-a schimbat. Reîncarcă pagina.',
} as const;

export type Step1Row = { label: string; value: string };

/** Step 1 (10.2): "Pe site" rows then "În panou" rows; the fee part left out without a fee (W29). */
export function step1Rows(current: string, next: string, fee: number | null): Step1Row[] {
  const feePart = fee === null ? '' : `, taxa de membru ${fee} RON`;
  return [
    { label: 'Înscrieri', value: `Formularul trece pe ${next}${feePart}. Deschis sau închis din Setări site, ca acum.` },
    { label: 'Formular pe hârtie', value: `Sezonul ${next}.` },
    { label: 'Program', value: `Orarul Școlii se ia din programul grupelor în ${next}.` },
    { label: 'Calendar', value: 'Nu se schimbă. Arată fiecare dată din programul grupelor, din ambele sezoane.' },
    { label: 'Grupe, Sportivi', value: `Se deschid pe ${next}.` },
    { label: current, value: 'Rămâne de citit în Grupe, nu se mai modifică.' },
    { label: 'Membru A.C.S.', value: `Pe sezon, nu se copiază. În ${next} toți pornesc de la Nu.` },
  ];
}

export type SummaryCounts = { athletes: number; groups: number; programGroups: number; unassigned: number; inactive: number };

export type SummaryPart = { text: string; bold?: boolean };

function copiedParts(c: SummaryCounts): SummaryPart[] {
  const groups: SummaryPart[][] = [];
  if (c.athletes > 0) groups.push([{ text: athletesText(c.athletes), bold: true }, { text: ` în ${groupsText(c.groups)}` }]);
  if (c.programGroups > 0) groups.push([{ text: `programul a ${groupsText(c.programGroups)}`, bold: true }]);
  if (!groups.length) return [{ text: 'Nu se copiază nimic.' }];
  return [{ text: 'Se copiază ' }, ...groups.flatMap((g, i) => (i ? [{ text: ' și ' }, ...g] : g)), { text: '.' }];
}

/** The summary box under the tables (10.2, decided 2), in parts so the counts can be bold. */
export function summaryParts(c: SummaryCounts): SummaryPart[] {
  const rest = [
    c.unassigned === 1 ? '1 sportiv rămâne fără grupă' : c.unassigned > 0 ? `${athletesText(c.unassigned)} rămân fără grupă` : '',
    c.inactive === 1 ? '1 inactiv nu se copiază' : c.inactive > 0 ? `${countWords(c.inactive, 'inactiv', 'inactivi')} nu se copiază` : '',
  ].filter(Boolean);
  const copied = copiedParts(c);
  return rest.length ? [...copied, { text: ` ${rest.join(', ')}.` }] : copied;
}

export const summaryText = (c: SummaryCounts): string => summaryParts(c).map((p) => p.text).join('');

/** The toast after applying (10.5, W29, decided 1). */
export function startToast(next: string, athletes: number, series: number): string {
  const lead = `${next} este sezonul curent.`;
  if (athletes > 0 && series > 0) return `${lead} ${athletesText(athletes)} și ${seriesCountText(series)} copiate.`;
  if (athletes > 0) return `${lead} ${athletes === 1 ? '1 sportiv copiat' : `${athletesText(athletes)} copiați`}.`;
  if (series > 0) return `${lead} ${series === 1 ? '1 program copiat' : `${seriesCountText(series)} copiate`}.`;
  return lead;
}
