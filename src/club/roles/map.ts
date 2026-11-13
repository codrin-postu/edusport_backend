import { ADMIN_AREAS, type AdminArea } from '../admin-area';

/** Role codes (6b spec 9.2). Strapi's Editor and Author roles stay unmapped. */
export const ROLE_CODES = { superAdmin: 'strapi-super-admin', clubAdmin: 'edusport-club-admin', siteEditor: 'edusport-site-editor' } as const;
export const ROLE_NAMES = { clubAdmin: 'Administrator club', siteEditor: 'Editor site' } as const;

const NOT_SUPER_ADMIN = ADMIN_AREAS.filter((a) => a !== 'superAdmin');

/** Who may use which area (spec 9.2). */
export const ROLE_AREAS: Readonly<Record<string, readonly AdminArea[]>> = {
  [ROLE_CODES.superAdmin]: ADMIN_AREAS,
  [ROLE_CODES.clubAdmin]: NOT_SUPER_ADMIN,
  [ROLE_CODES.siteEditor]: ['any', 'website'],
};

/** Union of the areas of every role; `any` always, unknown codes add nothing. */
export function areasFor(roleCodes: readonly string[]): Set<AdminArea> {
  const areas = new Set<AdminArea>(['any']);
  for (const code of roleCodes) for (const area of ROLE_AREAS[code] ?? []) areas.add(area);
  return areas;
}

/** Areas of the signed-in admin from the answer of GET /admin/users/me (`{ data: <user with roles> }`); an unreadable answer gives `any` only. */
export function areasOfMe(body: unknown): Set<AdminArea> {
  const data = typeof body === 'object' && body !== null ? (body as { data?: unknown }).data : null;
  return areasFor(roleCodesOf(data));
}

export const canUse = (roleCodes: readonly string[], area: AdminArea): boolean => areasFor(roleCodes).has(area);

/** `roles[].code` of an admin user row or of the `data` of `/admin/users/me`; anything malformed gives []. */
export function roleCodesOf(user: unknown): string[] {
  const roles = typeof user === 'object' && user !== null ? (user as { roles?: unknown }).roles : null;
  if (!Array.isArray(roles)) return [];
  return roles.flatMap((r) => {
    const code = typeof r === 'object' && r !== null ? (r as { code?: unknown }).code : null;
    return typeof code === 'string' ? [code] : [];
  });
}

/** Content types both EduSport roles may edit in the Content Manager (index ruling 11). */
export const WEBSITE_UIDS: readonly string[] = [
  'api::article.article',
  'api::announcement.announcement',
  'api::collaboration-event.collaboration-event',
  'api::competition.competition',
  'api::course-regulations.course-regulations',
  'api::cursuri-page.cursuri-page',
  'api::discipline.discipline',
  'api::historic-page.historic-page',
  'api::history-milestone.history-milestone',
  'api::homepage.homepage',
  'api::club-figures.club-figures',
  'api::navigation.navigation',
  'api::partners-page.partners-page',
  'api::pricing.pricing',
  'api::program.program',
  'api::program-page.program-page',
  'api::realizari-page.realizari-page',
  'api::sponsor.sponsor',
  'api::sportsperson.sportsperson',
  'api::team-member.team-member',
  'api::team-page.team-page',
  'api::volunteer-page.volunteer-page',
];

/** Content types only "Administrator club" may edit: site settings and the contact inbox the club pages read through the Content Manager. */
export const CLUB_ADMIN_UIDS: readonly string[] = ['api::site-settings.site-settings', 'api::contact-submission.contact-submission'];

/** Matrix content types hidden from the Content Manager (`pluginOptions.content-manager.visible: false`, edited on their own admin pages). Strapi 5.52.1 registers such a type as a subject of `explorer.read` only; any other action on it fails `validatePermissionsExist` and the whole grant is refused. */
export const HIDDEN_FROM_CM_UIDS: readonly string[] = ['api::announcement.announcement', 'api::club-figures.club-figures', 'api::navigation.navigation'];

export const CM_ACTIONS: readonly string[] = [
  'plugin::content-manager.explorer.create',
  'plugin::content-manager.explorer.read',
  'plugin::content-manager.explorer.update',
  'plugin::content-manager.explorer.delete',
  'plugin::content-manager.explorer.publish',
];

/** Strapi 5.52.1 Media Library actions (@strapi/upload): read, upload, update plus delete, download, copy link. */
export const MEDIA_ACTIONS: readonly string[] = [
  'plugin::upload.read',
  'plugin::upload.assets.create',
  'plugin::upload.assets.update',
  'plugin::upload.assets.download',
  'plugin::upload.assets.copy-link',
];

type Permission = { action: string; subject: string | null };

const READ_ACTION = 'plugin::content-manager.explorer.read';

const contentManager = (uids: readonly string[]): Permission[] =>
  uids.flatMap((subject) =>
    CM_ACTIONS.filter((action) => action === READ_ACTION || !HIDDEN_FROM_CM_UIDS.includes(subject)).map((action) => ({ action, subject })),
  );

/** Native Strapi permissions given to a new EduSport role (spec 9.1). */
export function nativePermissions(code: 'edusport-club-admin' | 'edusport-site-editor'): Permission[] {
  const uids = code === ROLE_CODES.clubAdmin ? [...WEBSITE_UIDS, ...CLUB_ADMIN_UIDS] : WEBSITE_UIDS;
  return [...contentManager(uids), ...MEDIA_ACTIONS.map((action) => ({ action, subject: null }))];
}
