import type { StrapiApp } from '@strapi/strapi/admin';
import {
  House, Book, Cursor, Feather, Calendar, User, Star, GridFour,
  Clock, Bell, Duplicate, Pencil, ChartCircle, Mail,
} from '@strapi/icons';
import {
  CUSTOM_PAGES,
  SETARI_SITE_TO, PAGINA_ECHIPA_TO, ISTORIC_TO, PAGINA_PARTENERI_TO, DISCIPLINE_TO,
  MOMENTE_ISTORIC_TO, CURSURI_TO, PRETURI_TO, REGULAMENT_TO, PAGINA_PROGRAM_TO,
  REALIZARI_TO, EVENIMENTE_COLABORARE_TO, UID,
} from '../pages/routes';

// Route constants of the custom pages (src/admin/pages), re-exported so every
// *_TO lives behind one import. Defined in ../pages/routes (see there).
export {
  SETARI_SITE_TO, PAGINA_ECHIPA_TO, ISTORIC_TO, PAGINA_PARTENERI_TO, DISCIPLINE_TO,
  MOMENTE_ISTORIC_TO, CURSURI_TO, PRETURI_TO, REGULAMENT_TO, PAGINA_PROGRAM_TO,
  REALIZARI_TO, EVENIMENTE_COLABORARE_TO, EVENIMENT_COLABORARE_EDIT_TO,
  ARTICOLE_TO, ARTICOL_EDIT_TO,
} from '../pages/routes';

/**
 * EduSport admin navigation model.
 *
 * The same link list feeds two consumers:
 *   - the custom navy sidebar (EdusportShell), which renders its own grouped
 *     layout and navigates to these (native content-manager) routes directly;
 *   - the in-context dashboard page, which shows a subset as "Scurtături".
 *
 * Custom pages are registered as admin routes so they render inside Strapi's
 * providers and can use hooks / data: the older ones with addMenuLink, the
 * pages in src/admin/pages (CUSTOM_PAGES in ../pages/routes) with
 * app.router.addRoute, route only, since the EduSport sidebar is their nav.
 */

export type Group = 'forms' | 'program' | 'team' | 'pages' | 'content' | 'system';

export interface EdusportLink {
  to: string;
  label: string;
  icon: React.ComponentType;
  group: Group;
  featured?: boolean; // shown in the dashboard "Scurtături" grid
  pinned?: boolean;   // shown at the top of the sidebar, next to Acasă
}

export const GROUP_LABEL: Record<Group, string> = {
  forms: 'Formulare',
  program: 'Program și calendar',
  team: 'Sportivi și echipă',
  pages: 'Pagini site',
  content: 'Articole și media',
  system: 'Sistem',
};

export const GROUP_ORDER: Group[] = ['forms', 'program', 'team', 'pages', 'content', 'system'];

// Admin route for the custom dashboard page (basename is /admin at runtime).
export const DASHBOARD_TO = '/plugins/edusport-dashboard';

// Admin route for the custom registrations (Înscrieri) results page.
export const INSCRIERI_TO = '/plugins/edusport-inscrieri';

// Admin route for the custom "Formulare" hub page.
export const FORMULARE_TO = '/plugins/edusport-formulare';

// Admin route for the custom "Mesaje" contact inbox page.
export const MESAJE_TO = '/plugins/edusport-mesaje';

// Admin route for the custom "Voluntari" volunteer-results page.
export const VOLUNTARI_TO = '/plugins/edusport-voluntari';

// Admin route for the custom "Parteneri" partnership-results page.
export const PARTENERI_REZULTATE_TO = '/plugins/edusport-parteneri-rezultate';

// Admin route for the custom "Editor formular" page (?type=inscriere|contact).
export const FORM_EDITOR_TO = '/plugins/edusport-form-editor';

// Admin routes for the custom Sportivi (sportsperson) list + edit pages.
export const SPORTIVI_TO = '/plugins/edusport-sportivi';
export const SPORTIV_EDIT_TO = '/plugins/edusport-sportiv-edit';

// Admin route for the custom "Pagina principală" single-type editor.
export const HOMEPAGE_EDIT_TO = '/plugins/edusport-homepage';

// Admin route for the custom "Meniu site" page. The navigation single type is
// hidden from the content-manager, so this route is the only way in.
export const NAVIGATION_TO = '/plugins/edusport-meniu';

// Admin route for the custom "Program" single-type editor (calendar + serii).
export const PROGRAM_EDIT_TO = '/plugins/edusport-program';

// Admin routes for the custom Competiții (competition) list + edit pages.
export const COMPETITII_TO = '/plugins/edusport-competitii';
export const COMPETITIE_EDIT_TO = '/plugins/edusport-competitie-edit';

// Admin routes for the custom Anunțuri (announcement) list + edit pages.
// The announcement content type is a hidden collection: it has no
// content-manager view at all, so these two routes are the only way in.
export const ANUNTURI_TO = '/plugins/edusport-anunturi';
export const ANUNT_EDIT_TO = '/plugins/edusport-anunt-edit';

// Admin route for the custom "Pagina Voluntariat" single-type editor.
export const VOLUNTARIAT_EDIT_TO = '/plugins/edusport-voluntariat';

// Admin route for the custom "Membri echipă" page. Create / edit runs in a
// modal on the page itself, so there is no separate edit route.
export const MEMBRI_TO = '/plugins/edusport-membri';

// Admin route for the custom Sponsori (sponsor) list page. Create / edit runs
// in a modal on the list itself, so there is no separate edit route.
export const SPONSORI_TO = '/plugins/edusport-sponsori';

// Hidden reference page for the shared admin UI (src/admin/ui): every component
// in every state, for light / dark screenshots. Registered with addRoute, so it
// appears in no sidebar or menu. Open it by URL: /admin/plugins/edusport-ui.
export const UI_REFERENCE_TO = '/plugins/edusport-ui';

// Umami analytics dashboard URL. Leave empty until connected; the UI degrades
// gracefully and shows a "coming soon" state rather than a broken link.
export const UMAMI_URL = '';

const collection = (uid: string) => `/content-manager/collection-types/${uid}`;

export const EDUSPORT_LINKS: EdusportLink[] = [
  // Formulare (hub + results)
  { to: FORMULARE_TO, label: 'Formulare', icon: Feather, group: 'forms', featured: true },
  { to: INSCRIERI_TO, label: 'Înscrieri', icon: Mail, group: 'forms', featured: true },
  { to: VOLUNTARI_TO, label: 'Voluntari', icon: User, group: 'forms' },
  { to: PARTENERI_REZULTATE_TO, label: 'Parteneri', icon: Duplicate, group: 'forms' },
  { to: MESAJE_TO, label: 'Contact', icon: Mail, group: 'forms' },

  // Program și calendar
  { to: PROGRAM_EDIT_TO, label: 'Calendar și serii', icon: Calendar, group: 'program', featured: true },

  // Sportivi și echipă
  { to: SPORTIVI_TO, label: 'Sportivi', icon: User, group: 'team', featured: true },
  // Re-pointed from collection('api::team-member.team-member'): team members are
  // now edited on the custom Membri echipă page.
  { to: MEMBRI_TO, label: 'Membri echipă', icon: GridFour, group: 'team', featured: true },
  { to: COMPETITII_TO, label: 'Competiții', icon: Star, group: 'team', featured: true },
  { to: DISCIPLINE_TO, label: 'Discipline', icon: ChartCircle, group: 'team' },

  // Pagini site
  { to: HOMEPAGE_EDIT_TO, label: 'Pagina principală', icon: House, group: 'pages', featured: true },
  { to: CURSURI_TO, label: 'Cursuri', icon: Book, group: 'pages', featured: true },
  { to: PRETURI_TO, label: 'Prețuri', icon: Cursor, group: 'pages', featured: true },
  { to: REGULAMENT_TO, label: 'Regulament', icon: Feather, group: 'pages' },
  { to: PAGINA_PROGRAM_TO, label: 'Pagina Program', icon: Calendar, group: 'pages' },
  { to: PAGINA_ECHIPA_TO, label: 'Pagina Echipă', icon: GridFour, group: 'pages' },
  { to: ISTORIC_TO, label: 'Istoric', icon: Clock, group: 'pages' },
  { to: REALIZARI_TO, label: 'Realizări', icon: Star, group: 'pages' },
  { to: PAGINA_PARTENERI_TO, label: 'Parteneri', icon: Duplicate, group: 'pages' },
  // Re-pointed from single('api::volunteer-page.volunteer-page'): the page is
  // now edited on the custom, compact Voluntariat editor.
  { to: VOLUNTARIAT_EDIT_TO, label: 'Voluntariat', icon: Bell, group: 'pages' },

  // Articole și media
  // Stays on the Strapi editor until the Articole page is built (ARTICOLE_TO
  // exists as a route already, see CUSTOM-PAGES.md).
  { to: collection(UID.article), label: 'Articole', icon: Book, group: 'content', featured: true },
  // Re-pointed from single('api::announcement.announcement'): that single-type
  // route is dead — announcements are now a hidden collection driven by the
  // custom Anunțuri page.
  { to: ANUNTURI_TO, label: 'Anunțuri', icon: Bell, group: 'content', pinned: true },
  // Re-pointed from collection('api::sponsor.sponsor'): sponsors are now edited
  // on the custom Sponsori list page.
  { to: SPONSORI_TO, label: 'Sponsori', icon: Duplicate, group: 'content' },
  { to: EVENIMENTE_COLABORARE_TO, label: 'Evenimente colaborare', icon: Calendar, group: 'content' },
  { to: MOMENTE_ISTORIC_TO, label: 'Momente istoric', icon: Clock, group: 'content' },

  // Sistem
  { to: '/plugins/upload', label: 'Media', icon: GridFour, group: 'system' },
  { to: SETARI_SITE_TO, label: 'Setări site', icon: Pencil, group: 'system', pinned: true },
  { to: NAVIGATION_TO, label: 'Meniu site', icon: GridFour, group: 'system', pinned: true },
];

export function registerEdusportMenu(app: StrapiApp) {
  // Route only, no menu link (see UI_REFERENCE_TO).
  app.router.addRoute({
    path: `${UI_REFERENCE_TO.slice(1)}/*`,
    lazy: async () => {
      const mod = await import('./UiReferencePage');
      return { Component: mod.default };
    },
  });

  // Custom pages in src/admin/pages: route only, one per CUSTOM_PAGES entry.
  // The list is complete (all rows of CUSTOM-PAGES.md), so page authors never
  // edit this file.
  for (const page of CUSTOM_PAGES) {
    app.router.addRoute({
      path: `${page.to.slice(1)}/*`,
      lazy: async () => {
        const mod = await page.load();
        return { Component: mod.default as React.ComponentType };
      },
    });
  }

  // Dashboard route (and its default-nav entry).
  app.addMenuLink({
    to: DASHBOARD_TO,
    icon: House,
    intlLabel: { id: 'edusport.menu.dashboard', defaultMessage: 'Panou EduSport' },
    Component: () => import('./DashboardPage'),
    permissions: [],
    position: 1,
  });

  app.addMenuLink({
    to: FORMULARE_TO,
    icon: Feather,
    intlLabel: { id: 'edusport.menu.formulare', defaultMessage: 'Formulare' },
    Component: () => import('./FormularePage'),
    permissions: [],
    position: 2,
  });

  app.addMenuLink({
    to: INSCRIERI_TO,
    icon: Mail,
    intlLabel: { id: 'edusport.menu.inscrieri', defaultMessage: 'Înscrieri' },
    Component: () => import('./InscrieriPage'),
    permissions: [],
    position: 3,
  });

  app.addMenuLink({
    to: MESAJE_TO,
    icon: Mail,
    intlLabel: { id: 'edusport.menu.mesaje', defaultMessage: 'Mesaje contact' },
    Component: () => import('./MesajePage'),
    permissions: [],
    position: 4,
  });

  app.addMenuLink({
    to: VOLUNTARI_TO,
    icon: User,
    intlLabel: { id: 'edusport.menu.voluntari', defaultMessage: 'Voluntari' },
    Component: () => import('./VoluntariPage'),
    permissions: [],
    position: 12,
  });

  app.addMenuLink({
    to: PARTENERI_REZULTATE_TO,
    icon: Duplicate,
    intlLabel: { id: 'edusport.menu.parteneriRezultate', defaultMessage: 'Parteneri' },
    Component: () => import('./ParteneriRezultatePage'),
    permissions: [],
    position: 13,
  });

  app.addMenuLink({
    to: FORM_EDITOR_TO,
    icon: Pencil,
    intlLabel: { id: 'edusport.menu.formEditor', defaultMessage: 'Editor formular' },
    Component: () => import('./FormEditorPage'),
    permissions: [],
    position: 5,
  });

  app.addMenuLink({
    to: SPORTIVI_TO,
    icon: User,
    intlLabel: { id: 'edusport.menu.sportivi', defaultMessage: 'Sportivi' },
    Component: () => import('./SportiviPage'),
    permissions: [],
    position: 6,
  });

  app.addMenuLink({
    to: SPORTIV_EDIT_TO,
    icon: Pencil,
    intlLabel: { id: 'edusport.menu.sportivEdit', defaultMessage: 'Editor sportiv' },
    Component: () => import('./SportivEditPage'),
    permissions: [],
    position: 7,
  });

  app.addMenuLink({
    to: COMPETITII_TO,
    icon: Star,
    intlLabel: { id: 'edusport.menu.competitii', defaultMessage: 'Competiții' },
    Component: () => import('./CompetitiiPage'),
    permissions: [],
    position: 8,
  });

  app.addMenuLink({
    to: PROGRAM_EDIT_TO,
    icon: Calendar,
    intlLabel: { id: 'edusport.menu.program', defaultMessage: 'Calendar și serii' },
    Component: () => import('./ProgramEditPage'),
    permissions: [],
    position: 11,
  });

  app.addMenuLink({
    to: HOMEPAGE_EDIT_TO,
    icon: House,
    intlLabel: { id: 'edusport.menu.homepage', defaultMessage: 'Pagina principală' },
    Component: () => import('./HomepageEditPage'),
    permissions: [],
    position: 10,
  });

  app.addMenuLink({
    to: NAVIGATION_TO,
    icon: GridFour,
    intlLabel: { id: 'edusport.menu.meniuSite', defaultMessage: 'Meniu site' },
    Component: () => import('./NavigationPage'),
    permissions: [],
    position: 16,
  });

  app.addMenuLink({
    to: ANUNTURI_TO,
    icon: Bell,
    intlLabel: { id: 'edusport.menu.anunturi', defaultMessage: 'Anunțuri' },
    Component: () => import('./AnunturiPage'),
    permissions: [],
    position: 14,
  });

  app.addMenuLink({
    to: ANUNT_EDIT_TO,
    icon: Pencil,
    intlLabel: { id: 'edusport.menu.anuntEdit', defaultMessage: 'Editor anunț' },
    Component: () => import('./AnuntEditPage'),
    permissions: [],
    position: 15,
  });

  app.addMenuLink({
    to: SPONSORI_TO,
    icon: Duplicate,
    intlLabel: { id: 'edusport.menu.sponsori', defaultMessage: 'Sponsori' },
    Component: () => import('./SponsoriPage'),
    permissions: [],
    position: 17,
  });

  app.addMenuLink({
    to: MEMBRI_TO,
    icon: GridFour,
    intlLabel: { id: 'edusport.menu.membri', defaultMessage: 'Membri echipă' },
    Component: () => import('./MembriEchipaPage'),
    permissions: [],
    position: 19,
  });

  app.addMenuLink({
    to: VOLUNTARIAT_EDIT_TO,
    icon: Bell,
    intlLabel: { id: 'edusport.menu.voluntariat', defaultMessage: 'Pagina Voluntariat' },
    Component: () => import('./VoluntariatEditPage'),
    permissions: [],
    position: 18,
  });

  app.addMenuLink({
    to: COMPETITIE_EDIT_TO,
    icon: Pencil,
    intlLabel: { id: 'edusport.menu.competitieEdit', defaultMessage: 'Editor competiție' },
    Component: () => import('./CompetitieEditPage'),
    permissions: [],
    position: 9,
  });
}
