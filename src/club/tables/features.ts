import type { Features, FeatureKey } from '../features/features';
import type { CatalogAnswer } from './catalog-api';
import type { SavedViewRow, Subject, TableDefinition } from './types';

/** The switch a table subject depends on: attendance subjects need `prezenta`, money subjects `abonamente`, Sportivi none. */
export function tableSubjectFeature(subject: Subject): FeatureKey | null {
  switch (subject) {
    case 'prezenta':
    case 'sedinte':
      return 'prezenta';
    case 'plati':
    case 'abonamente':
      return 'abonamente';
    default:
      return null;
  }
}

export const subjectOn = (subject: Subject, features: Features): boolean => {
  const feature = tableSubjectFeature(subject);
  return feature === null || features[feature];
};

/** The feature that refuses a `query` / `export` body: its subject, or a Sportivi column, is switched off. Null when allowed or malformed (other checks refuse it). */
export function offFeatureOfBody(body: unknown, features: Features): FeatureKey | null {
  const definition = typeof body === 'object' && body !== null ? (body as { definition?: unknown }).definition : undefined;
  if (typeof definition !== 'object' || definition === null) return null;
  const d = definition as { subject?: unknown; columns?: unknown; filters?: unknown; sort?: unknown };
  if (typeof d.subject !== 'string') return null;
  const subject = d.subject as Subject;
  const feature = tableSubjectFeature(subject);
  if (feature !== null && !features[feature]) return feature;
  if (subject !== 'sportivi') return null;
  const names = [...stringList(d.columns), ...columnsOf(d.filters), ...columnsOf([d.sort])];
  const hit = names.find((c) => !columnOn(subject, c, features));
  return hit === undefined ? null : SPORTIVI_COLUMN_FEATURE[hit];
}

const stringList = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []);
const columnsOf = (v: unknown): string[] =>
  Array.isArray(v) ? v.flatMap((x) => (typeof x === 'object' && x !== null && typeof (x as { column?: unknown }).column === 'string' ? [(x as { column: string }).column] : [])) : [];

/** Columns of the Sportivi table that belong to a switch (money and abonament, attendance count). */
const SPORTIVI_COLUMN_FEATURE: Record<string, FeatureKey> = {
  abonament: 'abonamente', expira: 'abonamente', dePlatit: 'abonamente', platit: 'abonamente', ramas: 'abonamente', starePlata: 'abonamente',
  prezente: 'prezenta',
};

/** True when the column may be shown: other subjects keep every column, Sportivi drops those of a disabled feature. */
export function columnOn(subject: Subject, column: string, features: Features): boolean {
  const feature = subject === 'sportivi' ? SPORTIVI_COLUMN_FEATURE[column] : undefined;
  return feature === undefined || features[feature];
}

/** A definition is usable when its subject is on and every column, filter, sort and group it names is on. */
export function definitionOn(d: TableDefinition, features: Features): boolean {
  if (!subjectOn(d.subject, features)) return false;
  const used = [...d.columns, ...d.filters.map((f) => f.column), ...(d.sort ? [d.sort.column] : [])];
  return used.every((c) => columnOn(d.subject, c, features));
}

const viewOn = (v: SavedViewRow, features: Features): boolean => subjectOn(v.subject, features) && (v.definition === null || definitionOn(v.definition, features));

/** The catalog without the disabled subjects and columns, the ready-made views that need them included. */
export function gateCatalog(catalog: CatalogAnswer, features: Features): CatalogAnswer {
  const subjects: CatalogAnswer['subjects'] = {};
  for (const key of Object.keys(catalog.subjects) as Subject[]) {
    const subject = catalog.subjects[key];
    if (subject && subjectOn(key, features)) subjects[key] = { ...subject, columns: subject.columns.filter((c) => columnOn(key, c.key, features)) };
  }
  return { ...catalog, subjects, readyMade: catalog.readyMade.filter((v) => viewOn(v, features)) };
}

/** Saved views of a disabled subject stay stored and are left out of the list. */
export const gateViews = (rows: SavedViewRow[], features: Features): SavedViewRow[] => rows.filter((v) => viewOn(v, features));
