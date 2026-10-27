import { ATHLETE_FIELDS, ATHLETE_FIELD_LABELS, type AthleteField } from '../athlete-data';
import type { MergePreview, MergeSideView } from '../athletes/api-types';

/**
 * The merge window (spec 6.6): which record is kept and, per differing field, whose value stays.
 * Side `a` is the record the window was opened from (the preview's `kept`), `b` the other one.
 */

export type Side = 'a' | 'b';
export const SIDES: readonly Side[] = ['a', 'b'];
export type MergeState = { kept: Side; picks: Partial<Record<AthleteField, Side>> };

export const MERGE_COPY = {
  title: 'Unește cu alt sportiv',
  kept: 'Rămâne',
  submit: 'Unește',
  cancel: 'Anulează',
  profile: 'Profil public',
  registrations: 'Înscrieri',
  confirmTitle: 'Unești cele două fișe?',
  confirmMessage: (name: string) => `Rămâne fișa "${name}". Cealaltă se șterge. Acțiunea nu poate fi anulată.`,
  confirmLabel: 'Unește',
} as const;

/** Needs decision 3c, option A: the current record is kept until the admin switches. */
export const initialMerge = (): MergeState => ({ kept: 'a', picks: {} });
export const withKept = (kept: Side): MergeState => ({ kept, picks: {} });
export const withPick = (s: MergeState, field: AthleteField, side: Side): MergeState => ({ ...s, picks: { ...s.picks, [field]: side } });
export const pickOf = (s: MergeState, field: AthleteField): Side => s.picks[field] ?? s.kept;
export const sides = (p: MergePreview): Record<Side, MergeSideView> => ({ a: p.kept, b: p.removed });

/** Body of POST /api/club/athletes/merge: `take` = differing fields whose chosen value lives on the removed record. */
export function mergeRequest(p: MergePreview, s: MergeState): { keptId: string; removedId: string; take: AthleteField[] } {
  const v = sides(p);
  const removed: Side = s.kept === 'a' ? 'b' : 'a';
  return { keptId: v[s.kept].documentId, removedId: v[removed].documentId, take: p.differing.filter((f) => pickOf(s, f) === removed) };
}

export const keptName = (p: MergePreview, s: MergeState): string => sides(p)[s.kept].name;

export type MergeRow = { field: AthleteField; label: string; a: string; b: string; differs: boolean };
export const mergeRows = (p: MergePreview): MergeRow[] =>
  ATHLETE_FIELDS.map((field) => ({
    field, label: ATHLETE_FIELD_LABELS[field], a: p.kept.fields[field] ?? '', b: p.removed.fields[field] ?? '', differs: p.differing.includes(field),
  }));
