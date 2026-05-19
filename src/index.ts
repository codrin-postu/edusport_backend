import type { Core } from '@strapi/strapi';

// Admin layout overrides - applied on every bootstrap so they survive DB resets.
// Each key is the strapi_core_store_settings key for that component/content-type.
// `edit` defines field order and column width (12 = full row, 6 = half).
// Settings overrides (mainField etc.) - keyed by the same store key.
const SETTINGS_OVERRIDES: Record<string, Record<string, unknown>> = {
  'plugin_content_manager_configuration_content_types::api::homepage.homepage': {
    mainField: 'id',
  },
  'plugin_content_manager_configuration_content_types::api::cursuri-page.cursuri-page': {
    mainField: 'id',
  },
  'plugin_content_manager_configuration_content_types::api::pricing.pricing': {
    mainField: 'id',
  },
  'plugin_content_manager_configuration_content_types::api::program-page.program-page': {
    mainField: 'id',
  },
  'plugin_content_manager_configuration_content_types::api::site-settings.site-settings': {
    mainField: 'id',
  },
  'plugin_content_manager_configuration_content_types::api::course-regulations.course-regulations': {
    mainField: 'id',
  },
  'plugin_content_manager_configuration_content_types::api::team-page.team-page': {
    mainField: 'id',
  },
  'plugin_content_manager_configuration_content_types::api::team-member.team-member': {
    mainField: 'name',
  },
  'plugin_content_manager_configuration_content_types::api::historic-page.historic-page': {
    mainField: 'id',
  },
  'plugin_content_manager_configuration_content_types::api::history-milestone.history-milestone': {
    mainField: 'title',
  },
  'plugin_content_manager_configuration_content_types::api::realizari-page.realizari-page': {
    mainField: 'id',
  },
  'plugin_content_manager_configuration_content_types::api::competition.competition': {
    mainField: 'name',
  },
  'plugin_content_manager_configuration_components::shared.disclaimer': {
    mainField: 'text',
  },
};

// Field label overrides - keyed by store key, value is { fieldName: label }
const METADATA_LABEL_OVERRIDES: Record<string, Record<string, string>> = {
  'plugin_content_manager_configuration_content_types::api::program-page.program-page': {
    banner:          'Banner Pagină',
    pageInfo:        'Sezon & Orar',
    scheduleGroups:  'Grupe & ore',
    calendarEvents:  'Calendar sezon',
    disclaimers:     'Notificări importante',
  },
  'plugin_content_manager_configuration_components::shared.disclaimer': {
    text: 'Text notificare',
  },
  'plugin_content_manager_configuration_content_types::api::course-regulations.course-regulations': {
    banner:     'Banner Pagină',
    categories: 'Categorii regulament',
  },
  'plugin_content_manager_configuration_content_types::api::team-page.team-page': {
    banner:      'Banner Pagină',
    pageInfo:    'Introducere Echipă',
    teamMembers: 'Membri echipă',
  },
  'plugin_content_manager_configuration_content_types::api::team-member.team-member': {
    name:   'Nume',
    role:   'Rol / Titlu',
    bio:    'Biografie',
    photo:  'Fotografie',
    groups: 'Grupe predate',
    order:  'Ordine afișare',
  },
  'plugin_content_manager_configuration_content_types::api::historic-page.historic-page': {
    banner:             'Banner Pagină',
    pageInfo:           'Texte Secțiune Principală',
    stats:              'Statistici (valoare + etichetă)',
    milestones:         'Momente cheie (Timeline)',
    eventsOrganized:    'Evenimente organizate de ACS EduSport',
    eventsParticipated: 'Participări ale sportivilor EduSport',
  },
  'plugin_content_manager_configuration_content_types::api::history-milestone.history-milestone': {
    year:        'An',
    title:       'Titlu moment',
    description: 'Descriere',
    order:       'Ordine afișare',
  },
  'plugin_content_manager_configuration_content_types::api::realizari-page.realizari-page': {
    banner:               'Banner Pagină',
    notableAchievements:  'Realizări notabile (Palmares)',
    galleryImages:        'Galerie foto competiții',
    competitions:         'Competiții & Rezultate',
  },
  'plugin_content_manager_configuration_content_types::api::competition.competition': {
    name:         'Numele competiției',
    date:         'Data',
    location:     'Locația',
    level:        'Nivel (Național / Internațional)',
    season:       'Sezon (ex: 2024-2025)',
    participants: 'Participanți & Rezultate',
  },
  'plugin_content_manager_configuration_components::competition.participant': {
    athleteName: 'Nume sportiv',
    category:    'Categorie',
    placement:   'Loc obținut',
    score:       'Punctaj',
  },
};

const LAYOUT_OVERRIDES: Record<string, { name: string; size: number }[][]> = {
  // ── Cursuri Page components ──
  'plugin_content_manager_configuration_components::cursuri.banner': [
    [{ name: 'title', size: 12 }],
    [{ name: 'scheduleDays', size: 12 }],
    [{ name: 'scheduleTimes', size: 12 }],
    [{ name: 'locationName', size: 12 }],
    [{ name: 'locationUrl', size: 12 }],
  ],
  'plugin_content_manager_configuration_components::cursuri.about': [
    [{ name: 'eyebrow', size: 12 }],
    [{ name: 'heading', size: 12 }],
    [{ name: 'content', size: 12 }],
    [{ name: 'locationBullet', size: 12 }],
    [{ name: 'levelsBullet', size: 12 }],
    [{ name: 'coachesBullet', size: 12 }],
    [{ name: 'videoUrl', size: 12 }],
    [{ name: 'videoLabel', size: 12 }],
  ],
  'plugin_content_manager_configuration_components::cursuri.promo-card': [
    [{ name: 'eyebrow', size: 12 }],
    [{ name: 'title', size: 12 }],
    [{ name: 'description', size: 12 }],
    [{ name: 'subscriptionInfoTitle', size: 12 }],
    [{ name: 'subscriptionBullets', size: 12 }],
  ],
  'plugin_content_manager_configuration_components::cursuri.info-section': [
    [{ name: 'sectionLabel', size: 12 }],
    [{ name: 'tips', size: 12 }],
    [{ name: 'closingLine', size: 12 }],
  ],

  // ── Homepage ──
  'plugin_content_manager_configuration_content_types::api::homepage.homepage': [
    [{ name: 'hero', size: 12 }],
    [{ name: 'registration', size: 12 }],
    [{ name: 'registrationClosed', size: 12 }],
    [{ name: 'about', size: 12 }],
  ],

  // ── Pricing ──
  'plugin_content_manager_configuration_content_types::api::pricing.pricing': [
    [{ name: 'banner', size: 12 }],
    [{ name: 'tiers', size: 12 }],
    [{ name: 'footerNotes', size: 12 }],
  ],

  // ── Program Page ──
  'plugin_content_manager_configuration_content_types::api::program-page.program-page': [
    [{ name: 'banner', size: 12 }],
    [{ name: 'pageInfo', size: 12 }],
    [{ name: 'scheduleGroups', size: 12 }],
    [{ name: 'calendarEvents', size: 12 }],
    [{ name: 'disclaimers', size: 12 }],
  ],
  'plugin_content_manager_configuration_components::shared.disclaimer': [
    [{ name: 'text', size: 12 }],
  ],

  // ── Team Page ──
  'plugin_content_manager_configuration_content_types::api::team-page.team-page': [
    [{ name: 'banner', size: 12 }],
    [{ name: 'pageInfo', size: 12 }],
    [{ name: 'teamMembers', size: 12 }],
  ],
  // ── Team Member (collection) ──
  'plugin_content_manager_configuration_content_types::api::team-member.team-member': [
    [{ name: 'name', size: 6 }, { name: 'order', size: 6 }],
    [{ name: 'role', size: 12 }],
    [{ name: 'photo', size: 12 }],
    [{ name: 'bio', size: 12 }],
    [{ name: 'groups', size: 12 }],
  ],

  // ── Historic Page ──
  'plugin_content_manager_configuration_content_types::api::historic-page.historic-page': [
    [{ name: 'banner', size: 12 }],
    [{ name: 'pageInfo', size: 12 }],
    [{ name: 'stats', size: 12 }],
    [{ name: 'milestones', size: 12 }],
    [{ name: 'eventsOrganized', size: 12 }],
    [{ name: 'eventsParticipated', size: 12 }],
  ],
  // ── History Milestone (collection) ──
  'plugin_content_manager_configuration_content_types::api::history-milestone.history-milestone': [
    [{ name: 'year', size: 4 }, { name: 'order', size: 4 }],
    [{ name: 'title', size: 12 }],
    [{ name: 'description', size: 12 }],
  ],

  // ── Realizări Page ──
  'plugin_content_manager_configuration_content_types::api::realizari-page.realizari-page': [
    [{ name: 'banner', size: 12 }],
    [{ name: 'notableAchievements', size: 12 }],
    [{ name: 'galleryImages', size: 12 }],
    [{ name: 'competitions', size: 12 }],
  ],
  // ── Competition (collection) ──
  'plugin_content_manager_configuration_content_types::api::competition.competition': [
    [{ name: 'name', size: 12 }],
    [{ name: 'date', size: 6 }, { name: 'level', size: 6 }],
    [{ name: 'location', size: 8 }, { name: 'season', size: 4 }],
    [{ name: 'participants', size: 12 }],
  ],
  'plugin_content_manager_configuration_components::competition.participant': [
    [{ name: 'athleteName', size: 6 }, { name: 'placement', size: 6 }],
    [{ name: 'category', size: 8 }, { name: 'score', size: 4 }],
  ],

  // ── Regulament (Course Regulations) ──
  'plugin_content_manager_configuration_content_types::api::course-regulations.course-regulations': [
    [{ name: 'banner', size: 12 }],
    [{ name: 'categories', size: 12 }],
  ],
  'plugin_content_manager_configuration_components::regulations.regulation-category': [
    [{ name: 'title', size: 12 }],
    [{ name: 'icon', size: 12 }],
    [{ name: 'rules', size: 12 }],
  ],
  'plugin_content_manager_configuration_components::regulations.regulation-rule': [
    [{ name: 'label', size: 12 }],
    [{ name: 'text', size: 12 }],
    [{ name: 'highlight', size: 12 }],
  ],
};

export default {
  register({ strapi }: { strapi: Core.Strapi }) {
    strapi.customFields.register({
      name: 'rules-table',
      plugin: 'component-preview',
      type: 'json',
    });
    strapi.customFields.register({
      name: 'historic-stats',
      plugin: 'component-preview',
      type: 'json',
    });
    strapi.customFields.register({
      name: 'historic-events-organized',
      plugin: 'component-preview',
      type: 'json',
    });
    strapi.customFields.register({
      name: 'historic-events-participated',
      plugin: 'component-preview',
      type: 'json',
    });
    strapi.customFields.register({
      name: 'realizari-achievements',
      plugin: 'component-preview',
      type: 'json',
    });
    strapi.customFields.register({
      name: 'competitions-link',
      plugin: 'component-preview',
      type: 'json',
    });
  },
  async bootstrap({ strapi }: { strapi: Core.Strapi }) {
    for (const [key, edit] of Object.entries(LAYOUT_OVERRIDES)) {
      const existing = await strapi.db.query('strapi::core-store').findOne({ where: { key } });
      if (existing) {
        const val = typeof existing.value === 'string' ? JSON.parse(existing.value) : existing.value;
        val.layouts.edit = edit;
        if (SETTINGS_OVERRIDES[key]) {
          Object.assign(val.settings, SETTINGS_OVERRIDES[key]);
        }
        await strapi.db.query('strapi::core-store').update({
          where: { key },
          data: { value: JSON.stringify(val) },
        });
      }
    }

    // Apply metadata label overrides
    for (const [key, labels] of Object.entries(METADATA_LABEL_OVERRIDES)) {
      const existing = await strapi.db.query('strapi::core-store').findOne({ where: { key } });
      if (existing) {
        const val = typeof existing.value === 'string' ? JSON.parse(existing.value) : existing.value;
        for (const [field, label] of Object.entries(labels)) {
          if (val.metadatas?.[field]?.edit) {
            val.metadatas[field].edit.label = label;
          }
        }
        await strapi.db.query('strapi::core-store').update({
          where: { key },
          data: { value: JSON.stringify(val) },
        });
      }
    }

    // Apply settings-only overrides (no layout change)
    for (const [key, settings] of Object.entries(SETTINGS_OVERRIDES)) {
      if (LAYOUT_OVERRIDES[key]) continue; // already handled above
      const existing = await strapi.db.query('strapi::core-store').findOne({ where: { key } });
      if (existing) {
        const val = typeof existing.value === 'string' ? JSON.parse(existing.value) : existing.value;
        Object.assign(val.settings, settings);
        await strapi.db.query('strapi::core-store').update({
          where: { key },
          data: { value: JSON.stringify(val) },
        });
      }
    }
  },
};
