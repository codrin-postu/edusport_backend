import type { SeasonRecord } from '../types';

type Labelled = { label: string; isCurrent: boolean };
const year = (label: string): number => Number(label.slice(0, 4));

/** The label of the season "Începe sezonul" applies to: one year after the current one, not current itself (10.1, W23). Pure. */
export function startableLabel(seasons: Labelled[]): string | null {
  const current = [...seasons].filter((s) => s.isCurrent).sort((a, b) => b.label.localeCompare(a.label))[0];
  if (!current) return null;
  return seasons.find((s) => !s.isCurrent && year(s.label) === year(current.label) + 1)?.label ?? null;
}

export function nextSeasonOf(seasons: SeasonRecord[]): SeasonRecord | null {
  const label = startableLabel(seasons);
  return label ? seasons.find((s) => s.label === label) ?? null : null;
}
