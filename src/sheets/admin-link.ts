/**
 * Links from the Google Sheet back into the admin.
 *
 * The Înscrieri page (src/admin/dashboard/menu.tsx `INSCRIERI_TO`, under the `/admin` basename) reads
 * `?q=` into its search box and `?season=` into its season filter when it loads
 * (src/admin/dashboard/SubmissionTable.tsx `initialQuery`). The search matches the registration number,
 * so the list holds that one registration and the compact view opens it.
 */

export const INSCRIERI_ADMIN_PATH = '/admin/plugins/edusport-inscrieri';

/** The CMS public origin, e.g. `https://cms.example.com`; empty when not configured. */
export function cmsPublicUrl(env: NodeJS.ProcessEnv = process.env): string {
  return String(env.CMS_PUBLIC_URL ?? '').trim().replace(/\/+$/, '');
}

/** Link to the admin Înscrieri page with this registration open, or '' without an origin or a number. */
export function registrationAdminUrl(origin: string, registrationNumber: unknown): string {
  const nr = typeof registrationNumber === 'string' ? registrationNumber.trim() : '';
  if (!origin || !nr) return '';
  const query = new URLSearchParams({ q: nr, season: 'all' });
  return `${origin}${INSCRIERI_ADMIN_PATH}?${query.toString()}`;
}
