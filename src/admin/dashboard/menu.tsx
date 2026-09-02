import type { StrapiApp } from '@strapi/strapi/admin';
import {
  House, Book, Cursor, Feather, Calendar, User, Star, GridFour,
  Clock, Bell, Duplicate, Pencil, ChartCircle, Mail,
} from '@strapi/icons';

/**
 * EduSport admin navigation model.
 *
 * The same link list feeds two consumers:
 *   - the custom navy sidebar (EdusportShell), which renders its own grouped
 *     layout and navigates to these (native content-manager) routes directly;
 *   - the in-context dashboard page, which shows a subset as "Scurtături".
 *
 * Only the dashboard itself is registered as an admin route (addMenuLink with a
 * Component) so it renders inside Strapi's providers and can use hooks / data.
 * The content routes already exist natively, so they are not re-registered.
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

// Admin route for the custom "Editor formular" page (?type=inscriere|contact).
export const FORM_EDITOR_TO = '/plugins/edusport-form-editor';

// Admin routes for the custom Sportivi (sportsperson) list + edit pages.
export const SPORTIVI_TO = '/plugins/edusport-sportivi';
export const SPORTIV_EDIT_TO = '/plugins/edusport-sportiv-edit';

// Admin route for the custom "Pagina principală" single-type editor.
export const HOMEPAGE_EDIT_TO = '/plugins/edusport-homepage';

// Admin route for the custom "Program" single-type editor (calendar + serii).
export const PROGRAM_EDIT_TO = '/plugins/edusport-program';

// Admin routes for the custom Competiții (competition) list + edit pages.
export const COMPETITII_TO = '/plugins/edusport-competitii';
export const COMPETITIE_EDIT_TO = '/plugins/edusport-competitie-edit';

// Umami analytics dashboard URL. Leave empty until connected; the UI degrades
// gracefully and shows a "coming soon" state rather than a broken link.
export const UMAMI_URL = '';

const single = (uid: string) => `/content-manager/single-types/${uid}`;
const collection = (uid: string) => `/content-manager/collection-types/${uid}`;

export const EDUSPORT_LINKS: EdusportLink[] = [
  // Formulare (hub + results)
  { to: FORMULARE_TO, label: 'Formulare', icon: Feather, group: 'forms', featured: true },
  { to: INSCRIERI_TO, label: 'Înscrieri', icon: Mail, group: 'forms', featured: true },

  // Program și calendar
  { to: PROGRAM_EDIT_TO, label: 'Calendar și serii', icon: Calendar, group: 'program', featured: true },

  // Sportivi și echipă
  { to: SPORTIVI_TO, label: 'Sportivi', icon: User, group: 'team', featured: true },
  { to: collection('api::team-member.team-member'), label: 'Membri echipă', icon: GridFour, group: 'team', featured: true },
  { to: COMPETITII_TO, label: 'Competiții', icon: Star, group: 'team', featured: true },
  { to: collection('api::discipline.discipline'), label: 'Discipline', icon: ChartCircle, group: 'team' },

  // Pagini site
  { to: HOMEPAGE_EDIT_TO, label: 'Pagina principală', icon: House, group: 'pages', featured: true },
  { to: single('api::cursuri-page.cursuri-page'), label: 'Cursuri', icon: Book, group: 'pages', featured: true },
  { to: single('api::pricing.pricing'), label: 'Prețuri', icon: Cursor, group: 'pages', featured: true },
  { to: single('api::course-regulations.course-regulations'), label: 'Regulament', icon: Feather, group: 'pages' },
  { to: single('api::program-page.program-page'), label: 'Pagina Program', icon: Calendar, group: 'pages' },
  { to: single('api::team-page.team-page'), label: 'Pagina Echipă', icon: GridFour, group: 'pages' },
  { to: single('api::historic-page.historic-page'), label: 'Istoric', icon: Clock, group: 'pages' },
  { to: single('api::realizari-page.realizari-page'), label: 'Realizări', icon: Star, group: 'pages' },
  { to: single('api::partners-page.partners-page'), label: 'Parteneri', icon: Duplicate, group: 'pages' },
  { to: single('api::volunteer-page.volunteer-page'), label: 'Voluntariat', icon: Bell, group: 'pages' },

  // Articole și media
  { to: collection('api::article.article'), label: 'Articole', icon: Book, group: 'content', featured: true },
  { to: single('api::announcement.announcement'), label: 'Anunț popup', icon: Bell, group: 'content', pinned: true },
  { to: collection('api::sponsor.sponsor'), label: 'Sponsori', icon: Duplicate, group: 'content' },
  { to: collection('api::collaboration-event.collaboration-event'), label: 'Evenimente colaborare', icon: Calendar, group: 'content' },
  { to: collection('api::history-milestone.history-milestone'), label: 'Momente istoric', icon: Clock, group: 'content' },
  { to: MESAJE_TO, label: 'Mesaje contact', icon: Mail, group: 'content' },

  // Sistem
  { to: '/plugins/upload', label: 'Media', icon: GridFour, group: 'system' },
  { to: single('api::site-settings.site-settings'), label: 'Setări site', icon: Pencil, group: 'system', pinned: true },
];

export function registerEdusportMenu(app: StrapiApp) {
  // Register only the dashboard route (and its default-nav entry). Content routes
  // already exist natively; the custom sidebar links straight to them.
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
    to: COMPETITIE_EDIT_TO,
    icon: Pencil,
    intlLabel: { id: 'edusport.menu.competitieEdit', defaultMessage: 'Editor competiție' },
    Component: () => import('./CompetitieEditPage'),
    permissions: [],
    position: 9,
  });
}
