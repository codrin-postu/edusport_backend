import type { Features, FeatureKey } from '../features/features';
import type { CatalogAnswer } from './catalog-api';
import type { SavedViewRow, Subject } from './types';

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

/** The feature that refuses a `query` / `export` body (its `definition.subject`), or null when the subject is on or unknown (other checks refuse it). */
export function offFeatureOfBody(body: unknown, features: Features): FeatureKey | null {
  const definition = typeof body === 'object' && body !== null ? (body as { definition?: unknown }).definition : undefined;
  const subject = typeof definition === 'object' && definition !== null ? (definition as { subject?: unknown }).subject : undefined;
  if (typeof subject !== 'string') return null;
  const feature = tableSubjectFeature(subject as Subject);
  return feature !== null && !features[feature] ? feature : null;
}

/** The catalog without the disabled subjects, their ready-made views included. */
export function gateCatalog(catalog: CatalogAnswer, features: Features): CatalogAnswer {
  const subjects: CatalogAnswer['subjects'] = {};
  for (const key of Object.keys(catalog.subjects) as Subject[]) if (subjectOn(key, features)) subjects[key] = catalog.subjects[key];
  return { ...catalog, subjects, readyMade: catalog.readyMade.filter((v) => subjectOn(v.subject, features)) };
}

/** Saved views of a disabled subject stay stored and are left out of the list. */
export const gateViews = (rows: SavedViewRow[], features: Features): SavedViewRow[] => rows.filter((v) => subjectOn(v.subject, features));
