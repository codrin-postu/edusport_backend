import type { PinView } from './api-types';
import { lastDayOfMonth } from './month';
import { ANTRENAMENTE_THRESHOLDS, CONCURSURI_THRESHOLDS, MEMBRU_MAX_YEARS, pinLabel } from './catalog';

export type CountedInput = {
  /** Every presence ever, in any order. */
  presenceDates: string[];
  /** Null when results are not available: the Concursuri pins stay unearned and Locul 1 / Podium count 0. */
  results: { date: string; placement: number | null }[] | null;
  /** Start date of the athlete's first membership. */
  firstMembershipStart: string | null;
  /** Months (`YYYY-MM`) with at least 4 saved sessions and no absence. */
  perfectMonths: string[];
  /** Date the athlete gave their first friendship pin. */
  firstPinGivenOn: string | null;
  today: string;
};

export type CountedPins = { antrenamente: PinView[]; concursuri: PinView[]; membru: PinView[]; insigne: PinView[] };

const view = (pin: string, earnedOn: string | null, count = earnedOn ? 1 : 0): PinView => ({ pin, label: pinLabel(pin), earnedOn, count });

/** `dates` oldest first: a milestone is earned on the date of the unit that crossed it. */
const milestone = (pin: string, threshold: number, dates: string[]): PinView => view(pin, dates[threshold - 1] ?? null);

/** Same month and day `years` later; 29 Feb falls back to 28 Feb in a non-leap year. */
function addYears(date: string, years: number): string {
  const year = Number(date.slice(0, 4)) + years;
  const monthDay = date.slice(5);
  const leap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
  return `${String(year).padStart(4, '0')}-${monthDay === '02-29' && !leap ? '02-28' : monthDay}`;
}

function membru(start: string | null, today: string): PinView[] {
  return Array.from({ length: MEMBRU_MAX_YEARS }, (_, k) => {
    const anniversary = start ? addYears(start, k + 1) : null;
    return view(`membru-${k + 1}`, anniversary && anniversary <= today ? anniversary : null);
  });
}

function insigne(i: CountedInput): PinView[] {
  const results = [...(i.results ?? [])].sort((a, b) => a.date.localeCompare(b.date));
  const wins = results.filter((r) => r.placement === 1);
  const podiums = results.filter((r) => r.placement !== null && r.placement >= 1 && r.placement <= 3);
  const months = [...i.perfectMonths].sort();
  const lastMonth = months.at(-1);
  return [
    view('locul-1', wins.at(-1)?.date ?? null, wins.length),
    view('podium', podiums.at(-1)?.date ?? null, podiums.length),
    view('prezenta', lastMonth ? lastDayOfMonth(lastMonth) : null, months.length),
    view('manusi', i.firstPinGivenOn),
  ];
}

/** Counted pins of the Parcurs, computed on read from presences, results, membership and perfect months. */
export function countedPins(i: CountedInput): CountedPins {
  const presences = [...i.presenceDates].sort();
  const resultDates = (i.results ?? []).map((r) => r.date).sort();
  return {
    antrenamente: [
      view('prima-lectie', presences[0] ?? null),
      ...ANTRENAMENTE_THRESHOLDS.map((n) => milestone(`antrenamente-${n}`, n, presences)),
    ],
    concursuri: CONCURSURI_THRESHOLDS.map((n) => milestone(`concursuri-${n}`, n, resultDates)),
    membru: membru(i.firstMembershipStart, i.today),
    insigne: insigne(i),
  };
}
