/**
 * Custom pages that replace the content-manager views of the "Pagini site",
 * "Sistem", "Sportivi și echipă" and "Articole și media" entries
 * (docs/admin-ui/CUSTOM-PAGES.md, route table).
 *
 * This file is the ONE central list: menu.tsx registers every entry of
 * CUSTOM_PAGES as an admin route, and lib/legacyRedirects.ts sends the old
 * content-manager URLs of the same content types here. Page authors never
 * edit this file or menu.tsx; they only fill their own src/admin/pages/<Name>Page.tsx.
 *
 * No React, no @strapi/* imports here: EdusportShell (mounted outside Strapi's
 * providers) and the redirect listener import it too.
 *
 * Routes are admin routes without the /admin basename (like DASHBOARD_TO).
 */

// ---- route constants --------------------------------------------------------
export const SETARI_SITE_TO = '/plugins/edusport-setari';
export const PAGINA_ECHIPA_TO = '/plugins/edusport-pagina-echipa';
export const ISTORIC_TO = '/plugins/edusport-istoric';
export const PAGINA_PARTENERI_TO = '/plugins/edusport-pagina-parteneri';
export const DISCIPLINE_TO = '/plugins/edusport-discipline';
export const MOMENTE_ISTORIC_TO = '/plugins/edusport-momente-istoric';
export const CURSURI_TO = '/plugins/edusport-cursuri';
export const PRETURI_TO = '/plugins/edusport-preturi';
export const REGULAMENT_TO = '/plugins/edusport-regulament';
export const PAGINA_PROGRAM_TO = '/plugins/edusport-pagina-program';
export const REALIZARI_TO = '/plugins/edusport-realizari';
export const EVENIMENTE_COLABORARE_TO = '/plugins/edusport-evenimente-colaborare';
/** Edit page; `?id=<documentId>` edits, no id creates. */
export const EVENIMENT_COLABORARE_EDIT_TO = '/plugins/edusport-evenimente-colaborare-edit';
/** Articole: route only for now, the sidebar keeps the Strapi editor and nothing redirects (last step). */
export const ARTICOLE_TO = '/plugins/edusport-articole';
/** Edit page; `?id=<documentId>` edits, no id creates. */
export const ARTICOL_EDIT_TO = '/plugins/edusport-articole-edit';

// ---- content types ----------------------------------------------------------
export const UID = {
  siteSettings: 'api::site-settings.site-settings',
  teamPage: 'api::team-page.team-page',
  historicPage: 'api::historic-page.historic-page',
  partnersPage: 'api::partners-page.partners-page',
  discipline: 'api::discipline.discipline',
  historyMilestone: 'api::history-milestone.history-milestone',
  cursuriPage: 'api::cursuri-page.cursuri-page',
  pricing: 'api::pricing.pricing',
  courseRegulations: 'api::course-regulations.course-regulations',
  programPage: 'api::program-page.program-page',
  realizariPage: 'api::realizari-page.realizari-page',
  collaborationEvent: 'api::collaboration-event.collaboration-event',
  article: 'api::article.article',
} as const;

export type ContentKind = 'single' | 'collection';

/**
 * The old Strapi editor for a type (full browser path, /admin included), with
 * `?strapi=1` so the redirect lets it through. For LinkOutCard / plain links.
 */
export function strapiEditorUrl(uid: string, kind: ContentKind, documentId?: string): string {
  const base = kind === 'single' ? `/admin/content-manager/single-types/${uid}` : `/admin/content-manager/collection-types/${uid}`;
  return `${base}${documentId ? `/${documentId}` : ''}?strapi=1`;
}

// ---- registry ---------------------------------------------------------------
type PageModule = { default: unknown };

export interface CustomPageRoute {
  /** Admin route, e.g. PAGINA_ECHIPA_TO. */
  to: string;
  /** Content type the page edits. */
  uid: string;
  kind: ContentKind;
  /**
   * 'main': the entry's page (single-type editor or collection list).
   * 'edit': a collection's own edit page (`?id=<documentId>`; no id = new).
   */
  role: 'main' | 'edit';
  /** Lazy page module; its default export is the page component. */
  load: () => Promise<PageModule>;
  /** Old content-manager URLs of `uid` land here. False for Articole until it is built. */
  redirect: boolean;
}

export const CUSTOM_PAGES: CustomPageRoute[] = [
  { to: SETARI_SITE_TO, uid: UID.siteSettings, kind: 'single', role: 'main', redirect: true, load: () => import('./SetariSitePage') },
  { to: PAGINA_ECHIPA_TO, uid: UID.teamPage, kind: 'single', role: 'main', redirect: true, load: () => import('./PaginaEchipaPage') },
  { to: ISTORIC_TO, uid: UID.historicPage, kind: 'single', role: 'main', redirect: true, load: () => import('./IstoricPage') },
  { to: PAGINA_PARTENERI_TO, uid: UID.partnersPage, kind: 'single', role: 'main', redirect: true, load: () => import('./PaginaParteneriPage') },
  { to: DISCIPLINE_TO, uid: UID.discipline, kind: 'collection', role: 'main', redirect: true, load: () => import('./DisciplinePage') },
  { to: MOMENTE_ISTORIC_TO, uid: UID.historyMilestone, kind: 'collection', role: 'main', redirect: true, load: () => import('./MomenteIstoricPage') },
  { to: CURSURI_TO, uid: UID.cursuriPage, kind: 'single', role: 'main', redirect: true, load: () => import('./CursuriPage') },
  { to: PRETURI_TO, uid: UID.pricing, kind: 'single', role: 'main', redirect: true, load: () => import('./PreturiPage') },
  { to: REGULAMENT_TO, uid: UID.courseRegulations, kind: 'single', role: 'main', redirect: true, load: () => import('./RegulamentPage') },
  { to: PAGINA_PROGRAM_TO, uid: UID.programPage, kind: 'single', role: 'main', redirect: true, load: () => import('./PaginaProgramPage') },
  { to: REALIZARI_TO, uid: UID.realizariPage, kind: 'single', role: 'main', redirect: true, load: () => import('./RealizariPage') },
  { to: EVENIMENTE_COLABORARE_TO, uid: UID.collaborationEvent, kind: 'collection', role: 'main', redirect: true, load: () => import('./EvenimenteColaborarePage') },
  { to: EVENIMENT_COLABORARE_EDIT_TO, uid: UID.collaborationEvent, kind: 'collection', role: 'edit', redirect: true, load: () => import('./EvenimentColaborareEditPage') },
  { to: ARTICOLE_TO, uid: UID.article, kind: 'collection', role: 'main', redirect: false, load: () => import('./ArticolePage') },
  { to: ARTICOL_EDIT_TO, uid: UID.article, kind: 'collection', role: 'edit', redirect: false, load: () => import('./ArticolEditPage') },
];
