/**
 * Admin addresses of the Sportivi pages (spec 5, 6, 7). Pure: the admin bundle and the tests import it.
 * The record is a full page under the list's route: Strapi registers every menu-link page as
 * `${to}/*`, so `/plugins/edusport-sportivi/<documentId>` needs no route of its own.
 */
export const SPORTIVI_PATH = '/plugins/edusport-sportivi';
/** The old profile editor's address; it only redirects now (gaps #42). */
export const OLD_EDITOR_PATH = '/plugins/edusport-sportiv-edit';
const INSCRIERI_PATH = '/plugins/edusport-inscrieri';
export const ADD_PARAM = 'adauga';

/** The athlete record, opened in the same tab (gaps #33). Plan 3-4 links here. */
export const athleteRecordTo = (documentId: string): string => `${SPORTIVI_PATH}/${encodeURIComponent(documentId)}`;

/** The Sportivi list with "Adaugă sportiv" open (dashboard quick action). */
export const addAthleteTo = `${SPORTIVI_PATH}?${ADD_PARAM}=1`;

export const wantsAddAthlete = (search: string): boolean => new URLSearchParams(search).get(ADD_PARAM) === '1';

export const INACTIVE_PARAM = 'inactivi';

/** The Sportivi list with "Inactivi de peste N ani" on (dashboard notice "Vezi lista", 3C spec 5). */
export const inactiveListTo = `${SPORTIVI_PATH}?${INACTIVE_PARAM}=1`;

export const wantsInactiveList = (search: string): boolean => new URLSearchParams(search).get(INACTIVE_PARAM) === '1';

/** One registration's Înscrieri panel, from the record's "Înscrieri" block (spec 6.2; Needs decision 9, option A). */
export const registrationPanelTo = (documentId: string): string => `${INSCRIERI_PATH}?open=${encodeURIComponent(documentId)}`;

/** The record id in the route splat after `/plugins/edusport-sportivi/`: its first segment, decoded; null means the list. */
export function recordIdFromSplat(splat: string | undefined): string | null {
  const first = (splat ?? '').split('/')[0].trim();
  if (!first) return null;
  try {
    return decodeURIComponent(first);
  } catch {
    return null;
  }
}

/** The public profile id of an old editor link (`?id=<sportsperson documentId>`), or null. */
export function oldEditorProfileId(search: string): string | null {
  const id = (new URLSearchParams(search).get('id') ?? '').trim();
  return id || null;
}
