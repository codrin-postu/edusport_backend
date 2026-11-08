import type { CatalogSubject, GROUP_LABELS } from './catalog';
import type { SavedViewRow, Subject } from './types';

export type CatalogAnswer = {
  subjects: Record<Subject, CatalogSubject>;
  groupLabels: typeof GROUP_LABELS;
  seasons: { id: string; label: string; startMonth: string; endMonth: string; isCurrent: boolean }[];
  sections: { id: string; name: string }[];
  groups: { id: string; name: string; sectionId: string | null; active: boolean }[];
  readyMade: SavedViewRow[];
  defaultViewId: string;
  today: string;
  maxRows: number;
};
