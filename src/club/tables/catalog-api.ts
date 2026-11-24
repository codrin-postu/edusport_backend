import type { CatalogSubject, GROUP_LABELS } from './catalog';
import type { SavedViewRow, Subject } from './types';

export type SeasonChoice = { id: string; label: string; startMonth: string; endMonth: string; isCurrent: boolean };

export type CatalogAnswer = {
  subjects: Partial<Record<Subject, CatalogSubject>>;
  groupLabels: typeof GROUP_LABELS;
  seasons: SeasonChoice[];
  sections: { id: string; name: string }[];
  groups: { id: string; name: string; sectionId: string | null; active: boolean }[];
  /** The coaches of the groups, for the "Antrenor" filter. */
  coaches: { id: string; name: string }[];
  readyMade: SavedViewRow[];
  defaultViewId: string;
  today: string;
  maxRows: number;
};
