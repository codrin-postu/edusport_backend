import type { StrapiApp } from '@strapi/strapi/admin';

export default {
  register(app: StrapiApp) {
    app.customFields.register({
      name: 'rules-table',
      pluginId: 'component-preview',
      type: 'json',
      intlLabel: {
        id: 'component-preview.rules-table.label',
        defaultMessage: 'Tabel regulament',
      },
      intlDescription: {
        id: 'component-preview.rules-table.description',
        defaultMessage: 'Tabel editabil cu regulile din regulament',
      },
      components: {
        Input: async () => import('./RulesTable').then(m => ({ default: m.default as any })),
      },
    });

    app.customFields.register({
      name: 'pricing-tiers',
      pluginId: 'component-preview',
      type: 'json',
      intlLabel: {
        id: 'component-preview.pricing-tiers.label',
        defaultMessage: 'Tarife cursuri',
      },
      intlDescription: {
        id: 'component-preview.pricing-tiers.description',
        defaultMessage: 'Tabel editabil cu tarifele pentru membri și non-membri',
      },
      components: {
        Input: async () => import('./PricingTiersEditor').then(m => ({ default: m.default as any })),
      },
    });

    app.customFields.register({
      name: 'footer-notes',
      pluginId: 'component-preview',
      type: 'json',
      intlLabel: {
        id: 'component-preview.footer-notes.label',
        defaultMessage: 'Notițe subsol',
      },
      intlDescription: {
        id: 'component-preview.footer-notes.description',
        defaultMessage: 'Note bullet afișate sub cardurile de prețuri',
      },
      components: {
        Input: async () => import('./FooterNotesEditor').then(m => ({ default: m.default as any })),
      },
    });


    app.customFields.register({
      name: 'subscription-bullets',
      pluginId: 'component-preview',
      type: 'json',
      intlLabel: {
        id: 'component-preview.subscription-bullets.label',
        defaultMessage: 'Puncte abonament',
      },
      intlDescription: {
        id: 'component-preview.subscription-bullets.description',
        defaultMessage: 'Lista de informații despre abonamente afișată pe cardul promo (durata ședinței, valabilitate, politica de recuperare etc.).',
      },
      components: {
        Input: async () => import('./FooterNotesEditor').then(m => ({ default: m.default as any })),
      },
    });

    app.customFields.register({
      name: 'info-tips',
      pluginId: 'component-preview',
      type: 'json',
      intlLabel: {
        id: 'component-preview.info-tips.label',
        defaultMessage: 'Sfaturi & reguli',
      },
      intlDescription: {
        id: 'component-preview.info-tips.description',
        defaultMessage: 'Lista de informații practice afișată la finalul paginii (Ce trebuie să știi).',
      },
      components: {
        Input: async () => import('./FooterNotesEditor').then(m => ({ default: m.default as any })),
      },
    });

    app.customFields.register({
      name: 'calendar-events',
      pluginId: 'component-preview',
      type: 'json',
      intlLabel: {
        id: 'component-preview.calendar-events.label',
        defaultMessage: 'Calendar sezonal',
      },
      intlDescription: {
        id: 'component-preview.calendar-events.description',
        defaultMessage: 'Editor vizual pentru weekendurile de curs, weekenduri libere și zile speciale (vacanțe, sărbători).',
      },
      components: {
        Input: async () => import('./CalendarEventsEditor').then(m => ({ default: m.default as any })),
      },
    });

    app.customFields.register({
      name: 'historic-stats',
      pluginId: 'component-preview',
      type: 'json',
      intlLabel: { id: 'component-preview.historic-stats.label', defaultMessage: 'Statistici club' },
      intlDescription: { id: 'component-preview.historic-stats.description', defaultMessage: 'Valorile afișate în grilă (valoare|etichetă).' },
      components: { Input: async () => import('./FooterNotesEditor').then(m => ({ default: m.default as any })) },
    });

    app.customFields.register({
      name: 'historic-events-organized',
      pluginId: 'component-preview',
      type: 'json',
      intlLabel: { id: 'component-preview.historic-events-organized.label', defaultMessage: 'Evenimente organizate' },
      intlDescription: { id: 'component-preview.historic-events-organized.description', defaultMessage: 'Lista evenimentelor organizate de ACS EduSport.' },
      components: { Input: async () => import('./FooterNotesEditor').then(m => ({ default: m.default as any })) },
    });

    app.customFields.register({
      name: 'historic-events-participated',
      pluginId: 'component-preview',
      type: 'json',
      intlLabel: { id: 'component-preview.historic-events-participated.label', defaultMessage: 'Participări sportivi' },
      intlDescription: { id: 'component-preview.historic-events-participated.description', defaultMessage: 'Lista participărilor sportivilor EduSport.' },
      components: { Input: async () => import('./FooterNotesEditor').then(m => ({ default: m.default as any })) },
    });

    app.customFields.register({
      name: 'history-milestones-link',
      pluginId: 'component-preview',
      type: 'json',
      intlLabel: { id: 'component-preview.history-milestones-link.label', defaultMessage: 'Momente cheie (Timeline)' },
      intlDescription: { id: 'component-preview.history-milestones-link.description', defaultMessage: 'Link rapid către colecția de momente istorice.' },
      components: { Input: async () => import('./HistoryMilestonesLink').then(m => ({ default: m.default as any })) },
    });

    app.customFields.register({
      name: 'team-members-link',
      pluginId: 'component-preview',
      type: 'json',
      intlLabel: {
        id: 'component-preview.team-members-link.label',
        defaultMessage: 'Membri echipă',
      },
      intlDescription: {
        id: 'component-preview.team-members-link.description',
        defaultMessage: 'Link rapid către colecția de membri ai echipei.',
      },
      components: {
        Input: async () => import('./TeamMembersLink').then(m => ({ default: m.default as any })),
      },
    });

    app.customFields.register({
      name: 'schedule-groups',
      pluginId: 'component-preview',
      type: 'json',
      intlLabel: {
        id: 'component-preview.schedule-groups.label',
        defaultMessage: 'Grupe orar',
      },
      intlDescription: {
        id: 'component-preview.schedule-groups.description',
        defaultMessage: 'Editor vizual pentru intervalele orare și grupele de cursanți afișate în caietul de program.',
      },
      components: {
        Input: async () => import('./ScheduleGroupsEditor').then(m => ({ default: m.default as any })),
      },
    });

    app.customFields.register({
      name: 'realizari-achievements',
      pluginId: 'component-preview',
      type: 'json',
      intlLabel: {
        id: 'component-preview.realizari-achievements.label',
        defaultMessage: 'Realizări notabile',
      },
      intlDescription: {
        id: 'component-preview.realizari-achievements.description',
        defaultMessage: 'Lista realizărilor importante ale clubului afișată în secțiunea Palmares.',
      },
      components: {
        Input: async () => import('./FooterNotesEditor').then(m => ({ default: m.default as any })),
      },
    });

    app.customFields.register({
      name: 'competitions-link',
      pluginId: 'component-preview',
      type: 'json',
      intlLabel: {
        id: 'component-preview.competitions-link.label',
        defaultMessage: 'Competiții & Rezultate',
      },
      intlDescription: {
        id: 'component-preview.competitions-link.description',
        defaultMessage: 'Link rapid către colecția de competiții și rezultate.',
      },
      components: {
        Input: async () => import('./CompetitionsLink').then(m => ({ default: m.default as any })),
      },
    });

    app.customFields.register({
      name: 'site-settings-registration',
      pluginId: 'component-preview',
      type: 'json',
      intlLabel: {
        id: 'component-preview.site-settings-registration.label',
        defaultMessage: 'Înscrieri & Sezon',
      },
      intlDescription: {
        id: 'component-preview.site-settings-registration.description',
        defaultMessage: 'Starea înscrierilor, sezonul curent și date relevante.',
      },
      components: {
        Input: async () => import('./SiteSettingsRegistrationEditor').then(m => ({ default: m.default as any })),
      },
    });

    app.customFields.register({
      name: 'site-settings-contact',
      pluginId: 'component-preview',
      type: 'json',
      intlLabel: {
        id: 'component-preview.site-settings-contact.label',
        defaultMessage: 'Date de Contact & Rețele Sociale',
      },
      intlDescription: {
        id: 'component-preview.site-settings-contact.description',
        defaultMessage: 'Telefon, email, link-uri social media și adresă afișate pe tot site-ul.',
      },
      components: {
        Input: async () => import('./SiteSettingsContactEditor').then(m => ({ default: m.default as any })),
      },
    });

    app.customFields.register({
      name: 'homepage-hero',
      pluginId: 'component-preview',
      type: 'json',
      intlLabel: {
        id: 'component-preview.homepage-hero.label',
        defaultMessage: 'Secțiunea Hero',
      },
      intlDescription: {
        id: 'component-preview.homepage-hero.description',
        defaultMessage: 'Motto-ul mare și butonul de acțiune principal din prima secțiune a paginii.',
      },
      components: {
        Input: async () => import('./HomepageHeroEditor').then(m => ({ default: m.default as any })),
      },
    });

    app.customFields.register({
      name: 'homepage-registration',
      pluginId: 'component-preview',
      type: 'json',
      intlLabel: {
        id: 'component-preview.homepage-registration.label',
        defaultMessage: 'Secțiunea Înscrieri (Sezon Activ)',
      },
      intlDescription: {
        id: 'component-preview.homepage-registration.description',
        defaultMessage: 'Conținutul afișat când înscrierile sunt deschise: sezon, orar, locație, butoane.',
      },
      components: {
        Input: async () => import('./HomepageRegistrationEditor').then(m => ({ default: m.default as any })),
      },
    });

    app.customFields.register({
      name: 'homepage-registration-closed',
      pluginId: 'component-preview',
      type: 'json',
      intlLabel: {
        id: 'component-preview.homepage-registration-closed.label',
        defaultMessage: 'Secțiunea Înscrieri Închise',
      },
      intlDescription: {
        id: 'component-preview.homepage-registration-closed.description',
        defaultMessage: 'Conținutul afișat când înscrierile sunt închise: mesaj și butoane de contact.',
      },
      components: {
        Input: async () => import('./HomepageRegistrationClosedEditor').then(m => ({ default: m.default as any })),
      },
    });

    app.customFields.register({
      name: 'homepage-about',
      pluginId: 'component-preview',
      type: 'json',
      intlLabel: {
        id: 'component-preview.homepage-about.label',
        defaultMessage: 'Secțiunea Cine Suntem',
      },
      intlDescription: {
        id: 'component-preview.homepage-about.description',
        defaultMessage: 'Prezentarea asociației cu eyebrow, titlu, text descriptiv și link spre Despre noi.',
      },
      components: {
        Input: async () => import('./HomepageAboutEditor').then(m => ({ default: m.default as any })),
      },
    });

    app.customFields.register({
      name: 'cursuri-page-banner',
      pluginId: 'component-preview',
      type: 'json',
      intlLabel: { id: 'component-preview.cursuri-page-banner.label', defaultMessage: 'Banner Pagina Cursuri' },
      intlDescription: { id: 'component-preview.cursuri-page-banner.description', defaultMessage: 'Titlul și informațiile de orar afișate în header-ul paginii /cursuri.' },
      components: { Input: async () => import('./CursuriPageBannerEditor').then(m => ({ default: m.default as any })) },
    });

    app.customFields.register({
      name: 'cursuri-page-about',
      pluginId: 'component-preview',
      type: 'json',
      intlLabel: { id: 'component-preview.cursuri-page-about.label', defaultMessage: 'Secțiunea Despre Cursuri' },
      intlDescription: { id: 'component-preview.cursuri-page-about.description', defaultMessage: 'Prezentarea școlii: titlu, text, puncte cheie, video.' },
      components: { Input: async () => import('./CursuriPageAboutEditor').then(m => ({ default: m.default as any })) },
    });

    app.customFields.register({
      name: 'cursuri-page-promo-card',
      pluginId: 'component-preview',
      type: 'json',
      intlLabel: { id: 'component-preview.cursuri-page-promo-card.label', defaultMessage: 'Card Promo Abonament' },
      intlDescription: { id: 'component-preview.cursuri-page-promo-card.description', defaultMessage: 'Cardul albastru cu informații despre abonamentul de club.' },
      components: { Input: async () => import('./CursuriPagePromoCardEditor').then(m => ({ default: m.default as any })) },
    });

    app.customFields.register({
      name: 'cursuri-page-info-section',
      pluginId: 'component-preview',
      type: 'json',
      intlLabel: { id: 'component-preview.cursuri-page-info-section.label', defaultMessage: 'Secțiunea Informații Practice' },
      intlDescription: { id: 'component-preview.cursuri-page-info-section.description', defaultMessage: 'Sfaturi și reguli afișate la finalul paginii /cursuri.' },
      components: { Input: async () => import('./CursuriPageInfoSectionEditor').then(m => ({ default: m.default as any })) },
    });

    app.customFields.register({
      name: 'announcement-content',
      pluginId: 'component-preview',
      type: 'json',
      intlLabel: { id: 'component-preview.announcement-content.label', defaultMessage: 'Conținut Anunț Popup' },
      intlDescription: { id: 'component-preview.announcement-content.description', defaultMessage: 'Mesajul, tipul și butonul de acțiune pentru popup-ul de anunț.' },
      components: { Input: async () => import('./AnnouncementEditor').then(m => ({ default: m.default as any })) },
    });

    app.customFields.register({
      name: 'team-page-info',
      pluginId: 'component-preview',
      type: 'json',
      intlLabel: { id: 'component-preview.team-page-info.label', defaultMessage: 'Pagina Echipă — Texte' },
      intlDescription: { id: 'component-preview.team-page-info.description', defaultMessage: 'Titlul bannerului și textele de introducere pentru pagina echipei.' },
      components: { Input: async () => import('./TeamPageInfoEditor').then(m => ({ default: m.default as any })) },
    });

    app.customFields.register({
      name: 'historic-page-info',
      pluginId: 'component-preview',
      type: 'json',
      intlLabel: { id: 'component-preview.historic-page-info.label', defaultMessage: 'Pagina Istoric — Texte' },
      intlDescription: { id: 'component-preview.historic-page-info.description', defaultMessage: 'Titluri și texte pentru pagina /despre-noi/istoric.' },
      components: { Input: async () => import('./HistoricPageInfoEditor').then(m => ({ default: m.default as any })) },
    });

    app.customFields.register({
      name: 'realizari-page-banner',
      pluginId: 'component-preview',
      type: 'json',
      intlLabel: { id: 'component-preview.realizari-page-banner.label', defaultMessage: 'Pagina Realizări — Banner' },
      intlDescription: { id: 'component-preview.realizari-page-banner.description', defaultMessage: 'Titlul și subtitlul bannerului pentru pagina realizărilor.' },
      components: { Input: async () => import('./RealizariPageBannerEditor').then(m => ({ default: m.default as any })) },
    });

    app.customFields.register({
      name: 'program-page-info',
      pluginId: 'component-preview',
      type: 'json',
      intlLabel: { id: 'component-preview.program-page-info.label', defaultMessage: 'Pagina Program — Texte & Sezon' },
      intlDescription: { id: 'component-preview.program-page-info.description', defaultMessage: 'Banner și informații sezon pentru pagina /cursuri/program.' },
      components: { Input: async () => import('./ProgramPageInfoEditor').then(m => ({ default: m.default as any })) },
    });

    app.customFields.register({
      name: 'course-regs-banner',
      pluginId: 'component-preview',
      type: 'json',
      intlLabel: { id: 'component-preview.course-regs-banner.label', defaultMessage: 'Regulament Cursuri — Banner' },
      intlDescription: { id: 'component-preview.course-regs-banner.description', defaultMessage: 'Titlul și subtitlul bannerului pentru pagina regulamentului.' },
      components: { Input: async () => import('./CourseRegsBannerEditor').then(m => ({ default: m.default as any })) },
    });

    app.customFields.register({
      name: 'page-banner',
      pluginId: 'component-preview',
      type: 'json',
      intlLabel: { id: 'component-preview.page-banner.label', defaultMessage: 'Banner Pagină' },
      intlDescription: { id: 'component-preview.page-banner.description', defaultMessage: 'Titlul și subtitlul afișate în banner-ul din partea de sus a paginii.' },
      components: { Input: async () => import('./PageBannerEditor').then(m => ({ default: m.default as any })) },
    });
  },
};
