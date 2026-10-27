import { recordIdFromSplat } from '../sportivi/routes';

/** Admin addresses of Grupe (spec 5.1, decided 1). Pure: the admin bundle and the tests import it. */
export const GRUPE_PATH = '/plugins/edusport-grupe';
export type GrupeQuery = { season: string | null; section: string | null; tab: string | null };

function query(values: Record<string, string | null | undefined>): string {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(values)) if (v) p.set(k, v);
  const s = p.toString();
  return s ? `?${s}` : '';
}

export const grupeListTo = (season: string | null, section: string | null): string => `${GRUPE_PATH}${query({ season, section })}`;
export const groupPageTo = (documentId: string, season: string | null, tab: 'program' | null = null): string =>
  `${GRUPE_PATH}/${encodeURIComponent(documentId)}${query({ season, tab })}`;
export const groupIdFromSplat = recordIdFromSplat;

export function readGrupeQuery(search: string): GrupeQuery {
  const p = new URLSearchParams(search);
  const get = (k: string): string | null => p.get(k)?.trim() || null;
  return { season: get('season'), section: get('section'), tab: get('tab') };
}
