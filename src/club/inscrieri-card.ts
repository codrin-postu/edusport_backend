import { shortSchoolName } from './inscrieri-school';

/** The "‹ Înscrieri" link of the full-screen detail on a phone (spec 3). */
export const PHONE_BACK = '‹ Înscrieri';

const MONTHS = ['ian', 'feb', 'mar', 'apr', 'mai', 'iun', 'iul', 'aug', 'sep', 'oct', 'noi', 'dec'];

/** "3 oct": the submitted date without the year, for the phone card. */
export function cardDate(iso: unknown): string {
  if (typeof iso !== 'string') return '';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : `${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

export type CardFacts = { nr: string; age: string; school: string; showSchool: boolean; submittedAt: unknown };

/** Second line of a phone card: nr, age, school (not on a school tab), date; empty ones are left out. */
export function cardFacts(f: CardFacts): string[] {
  const school = f.showSchool ? shortSchoolName(f.school) : '';
  return [f.nr, f.age, school, cardDate(f.submittedAt)].filter((part) => part !== '');
}
