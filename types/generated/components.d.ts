import type { Schema, Struct } from '@strapi/strapi';

export interface AnnouncementCallToAction extends Struct.ComponentSchema {
  collectionName: 'components_announcement_call_to_actions';
  info: {
    description: 'Butonul op\u021Bional care redirec\u021Bioneaz\u0103 utilizatorul spre mai multe informa\u021Bii';
    displayName: 'Call to Action';
    icon: 'cursor';
  };
  attributes: {
    ctaLabel: Schema.Attribute.String;
    ctaUrl: Schema.Attribute.String;
  };
}

export interface AnnouncementMessageContent extends Struct.ComponentSchema {
  collectionName: 'components_announcement_message_contents';
  info: {
    description: 'Textul \u0219i tipul anun\u021Bului afi\u0219at vizitatorilor';
    displayName: 'Con\u021Binut Anun\u021B';
    icon: 'bell';
  };
  attributes: {
    message: Schema.Attribute.Text & Schema.Attribute.Required;
    type: Schema.Attribute.Enumeration<
      ['info', 'warning', 'success', 'error']
    > &
      Schema.Attribute.DefaultTo<'info'>;
  };
}

export interface CompetitionParticipant extends Struct.ComponentSchema {
  collectionName: 'components_competition_participants';
  info: {
    description: 'Rezultatul unui sportiv \u00EEn competi\u021Bie';
    displayName: 'Participant';
    icon: 'user';
  };
  attributes: {
    athleteName: Schema.Attribute.String & Schema.Attribute.Required;
    category: Schema.Attribute.String;
    placement: Schema.Attribute.Enumeration<
      [
        '1',
        '2',
        '3',
        '4',
        '5',
        '6',
        '7',
        '8',
        '9',
        '10',
        '11',
        '12',
        '13',
        '14',
        '15',
        '16',
        '17',
        '18',
        '19',
        '20',
        '21',
        '22',
        '23',
        '24',
        '25',
        '26',
        '27',
        '28',
        '29',
        '30',
        '31',
        '32',
        '33',
        '34',
        '35',
        '36',
        '37',
        '38',
        '39',
        '40',
        '41',
        '42',
        '43',
        '44',
        '45',
        '46',
        '47',
        '48',
        '49',
        '50',
      ]
    >;
    score: Schema.Attribute.Decimal;
    sportsperson: Schema.Attribute.Relation<
      'oneToOne',
      'api::sportsperson.sportsperson'
    >;
  };
}

export interface CursuriAbout extends Struct.ComponentSchema {
  collectionName: 'components_cursuri_abouts';
  info: {
    description: 'Sec\u021Biunea despre \u0219coala de patinaj';
    displayName: 'Despre noi';
  };
  attributes: {
    coachesBullet: Schema.Attribute.String;
    content: Schema.Attribute.Text;
    eyebrow: Schema.Attribute.String;
    heading: Schema.Attribute.String;
    levelsBullet: Schema.Attribute.String;
    locationBullet: Schema.Attribute.String;
    videoLabel: Schema.Attribute.String;
    videoUrl: Schema.Attribute.String;
  };
}

export interface CursuriBanner extends Struct.ComponentSchema {
  collectionName: 'components_cursuri_banners';
  info: {
    description: 'Sec\u021Biunea hero din partea de sus a paginii /cursuri';
    displayName: 'Banner';
  };
  attributes: {
    locationName: Schema.Attribute.String;
    locationUrl: Schema.Attribute.String;
    scheduleDays: Schema.Attribute.String;
    scheduleTimes: Schema.Attribute.String;
    title: Schema.Attribute.String;
  };
}

export interface CursuriInfoSection extends Struct.ComponentSchema {
  collectionName: 'components_cursuri_info_sections';
  info: {
    description: 'Sfaturi \u0219i reguli afi\u0219ate \u00EEn partea de jos a paginii /cursuri';
    displayName: 'Sectiunea Informatii';
  };
  attributes: {
    closingLine: Schema.Attribute.String;
    sectionLabel: Schema.Attribute.String;
    tips: Schema.Attribute.JSON &
      Schema.Attribute.CustomField<'plugin::component-preview.info-tips'>;
  };
}

export interface CursuriPromoCard extends Struct.ComponentSchema {
  collectionName: 'components_cursuri_promo_cards';
  info: {
    description: 'Card albastru de promovare a abonamentului de club';
    displayName: 'Card Promo Membru';
  };
  attributes: {
    description: Schema.Attribute.Text;
    eyebrow: Schema.Attribute.String;
    subscriptionBullets: Schema.Attribute.JSON &
      Schema.Attribute.CustomField<'plugin::component-preview.subscription-bullets'>;
    subscriptionInfoTitle: Schema.Attribute.String;
    title: Schema.Attribute.String;
  };
}

export interface HomepageAbout extends Struct.ComponentSchema {
  collectionName: 'components_homepage_abouts';
  info: {
    description: "Sec\u021Biunea 'Cine suntem' din pagina principal\u0103";
    displayName: 'Sec\u021Biune Despre Noi';
  };
  attributes: {
    body: Schema.Attribute.Text;
    ctaLabel: Schema.Attribute.String &
      Schema.Attribute.DefaultTo<'Despre noi'>;
    ctaUrl: Schema.Attribute.String &
      Schema.Attribute.DefaultTo<'/despre-noi/istoric'>;
    eyebrow: Schema.Attribute.String &
      Schema.Attribute.DefaultTo<'Cine suntem'>;
    heading: Schema.Attribute.String &
      Schema.Attribute.DefaultTo<'Asocia\u021Bie non-profit pentru sport \u0219i educa\u021Bie'>;
  };
}

export interface HomepageHero extends Struct.ComponentSchema {
  collectionName: 'components_homepage_heroes';
  info: {
    description: 'Sec\u021Biunea hero din pagina principal\u0103';
    displayName: 'Hero Section';
  };
  attributes: {
    ctaLabel: Schema.Attribute.String &
      Schema.Attribute.DefaultTo<'Descoper\u0103 Cursurile'>;
    ctaUrl: Schema.Attribute.String & Schema.Attribute.DefaultTo<'/cursuri'>;
    motto: Schema.Attribute.String &
      Schema.Attribute.DefaultTo<'Educa\u021Bie prin sport'>;
  };
}

export interface HomepageRegistration extends Struct.ComponentSchema {
  collectionName: 'components_homepage_registrations';
  info: {
    description: 'Sec\u021Biunea de \u00EEnscrieri din pagina principal\u0103 (c\u00E2nd sunt deschise)';
    displayName: 'Sec\u021Biune \u00CEnscrieri';
  };
  attributes: {
    body: Schema.Attribute.Text;
    bodySecondary: Schema.Attribute.Text;
    ctaPrimaryLabel: Schema.Attribute.String &
      Schema.Attribute.DefaultTo<'\u00CEnscrie-te'>;
    ctaPrimaryUrl: Schema.Attribute.String &
      Schema.Attribute.DefaultTo<'/inscrieri'>;
    ctaSecondaryLabel: Schema.Attribute.String &
      Schema.Attribute.DefaultTo<'Afl\u0103 mai mult'>;
    ctaSecondaryUrl: Schema.Attribute.String &
      Schema.Attribute.DefaultTo<'/inscrieri'>;
    heading: Schema.Attribute.String &
      Schema.Attribute.DefaultTo<'Sezonul a \u00EEnceput!'>;
    locationMapUrl: Schema.Attribute.String;
    locationName: Schema.Attribute.String &
      Schema.Attribute.DefaultTo<'AFI Cotroceni'>;
    pricesLinkLabel: Schema.Attribute.String &
      Schema.Attribute.DefaultTo<'Vezi pre\u021Burile'>;
    pricesLinkUrl: Schema.Attribute.String &
      Schema.Attribute.DefaultTo<'/inscrieri#preturi'>;
    scheduleDays: Schema.Attribute.String &
      Schema.Attribute.DefaultTo<'S\u00E2mb\u0103t\u0103 & Duminic\u0103'>;
    scheduleTimes: Schema.Attribute.String &
      Schema.Attribute.DefaultTo<'10:00\u201310:50 & 11:00\u201311:50'>;
  };
}

export interface HomepageRegistrationClosed extends Struct.ComponentSchema {
  collectionName: 'components_homepage_registration_closeds';
  info: {
    description: 'Sec\u021Biunea afi\u0219at\u0103 c\u00E2nd \u00EEnscrierile sunt \u00EEnchise';
    displayName: 'Sec\u021Biune \u00CEnscrieri \u00CEnchise';
  };
  attributes: {
    body: Schema.Attribute.Text;
    contactLabel: Schema.Attribute.String &
      Schema.Attribute.DefaultTo<'Contacteaz\u0103-ne'>;
    contactUrl: Schema.Attribute.String &
      Schema.Attribute.DefaultTo<'/contact'>;
    heading: Schema.Attribute.String &
      Schema.Attribute.DefaultTo<'Ne vedem \u00EEn urm\u0103torul sezon!'>;
    whatsappLabel: Schema.Attribute.String &
      Schema.Attribute.DefaultTo<'Al\u0103tur\u0103-te pe WhatsApp'>;
    whatsappUrl: Schema.Attribute.String;
  };
}

export interface PricingFooterNote extends Struct.ComponentSchema {
  collectionName: 'components_pricing_footer_notes';
  info: {
    description: 'O singur\u0103 not\u0103 bullet afi\u0219at\u0103 sub cardurile de pre\u021Buri';
    displayName: 'Not\u0103 subsol';
    icon: 'file-alt';
  };
  attributes: {
    text: Schema.Attribute.Text & Schema.Attribute.Required;
  };
}

export interface PricingPricingTier extends Struct.ComponentSchema {
  collectionName: 'components_pricing_pricing_tiers';
  info: {
    description: 'Un singur r\u00E2nd de tarif';
    displayName: 'Tarif';
    icon: 'money-bill';
  };
  attributes: {
    label: Schema.Attribute.String & Schema.Attribute.Required;
    note: Schema.Attribute.String;
    price: Schema.Attribute.String & Schema.Attribute.Required;
    tooltip: Schema.Attribute.String;
  };
}

export interface RegulationsRegulationCategory extends Struct.ComponentSchema {
  collectionName: 'components_regulations_regulation_categories';
  info: {
    description: 'Un grup de reguli sub un titlu de categorie';
    displayName: 'Categorie regulament';
    icon: 'folder';
  };
  options: {
    mainField: 'title';
  };
  attributes: {
    icon: Schema.Attribute.Enumeration<
      ['Users', 'CalendarCheck', 'Layers', 'ShieldAlert', 'MessageCircle']
    >;
    rules: Schema.Attribute.JSON &
      Schema.Attribute.CustomField<'plugin::component-preview.rules-table'>;
    title: Schema.Attribute.String & Schema.Attribute.Required;
  };
}

export interface RegulationsRegulationRule extends Struct.ComponentSchema {
  collectionName: 'components_regulations_regulation_rules';
  info: {
    description: 'O singur\u0103 regul\u0103';
    displayName: 'Regul\u0103';
    icon: 'list';
  };
  options: {
    mainField: 'label';
  };
  attributes: {
    highlight: Schema.Attribute.Boolean & Schema.Attribute.DefaultTo<false>;
    label: Schema.Attribute.String & Schema.Attribute.Required;
    text: Schema.Attribute.Text & Schema.Attribute.Required;
  };
}

export interface SharedDisclaimer extends Struct.ComponentSchema {
  collectionName: 'components_shared_disclaimers';
  info: {
    description: 'A single disclaimer/notice text entry';
    displayName: 'Disclaimer';
    icon: 'information';
  };
  options: {
    mainField: 'text';
  };
  attributes: {
    text: Schema.Attribute.Text & Schema.Attribute.Required;
  };
}

export interface SharedMedia extends Struct.ComponentSchema {
  collectionName: 'components_shared_media';
  info: {
    displayName: 'Media';
    icon: 'file-video';
  };
  attributes: {
    file: Schema.Attribute.Media<'images' | 'files' | 'videos'>;
  };
}

export interface SharedPageBanner extends Struct.ComponentSchema {
  collectionName: 'components_shared_page_banners';
  info: {
    description: 'Titlul \u0219i subtitlul bannerului de pagin\u0103';
    displayName: 'Page Banner';
    icon: 'layout';
  };
  attributes: {
    subtitle: Schema.Attribute.Text;
    title: Schema.Attribute.String;
  };
}

export interface SharedRichText extends Struct.ComponentSchema {
  collectionName: 'components_shared_rich_texts';
  info: {
    description: '';
    displayName: 'Text formatat';
    icon: 'align-justify';
  };
  attributes: {
    body: Schema.Attribute.RichText;
  };
}

export interface SharedSeo extends Struct.ComponentSchema {
  collectionName: 'components_shared_seos';
  info: {
    description: '';
    displayName: 'SEO';
    icon: 'allergies';
    name: 'SEO';
  };
  attributes: {
    metaDescription: Schema.Attribute.Text & Schema.Attribute.Required;
    metaTitle: Schema.Attribute.String & Schema.Attribute.Required;
    shareImage: Schema.Attribute.Media<'images'>;
  };
}

export interface SportspersonProgram extends Struct.ComponentSchema {
  collectionName: 'components_sportsperson_programs';
  info: {
    description: 'Un program individual (scurt / liber / exhibi\u021Bie) cu titlu \u0219i artist';
    displayName: 'Program muzical';
    icon: 'music';
  };
  attributes: {
    artist: Schema.Attribute.String;
    title: Schema.Attribute.String & Schema.Attribute.Required;
    type: Schema.Attribute.Enumeration<
      ['Program Scurt', 'Program Liber', 'Program Exhibi\u021Bie']
    > &
      Schema.Attribute.Required;
  };
}

export interface SportspersonProgramSeason extends Struct.ComponentSchema {
  collectionName: 'components_sportsperson_program_seasons';
  info: {
    description: 'Un sezon competi\u021Bional cu programele muzicale aferente';
    displayName: 'Sezon programe';
    icon: 'calendar';
  };
  attributes: {
    programs: Schema.Attribute.Component<'sportsperson.program', true>;
    season: Schema.Attribute.String & Schema.Attribute.Required;
  };
}

declare module '@strapi/strapi' {
  export module Public {
    export interface ComponentSchemas {
      'announcement.call-to-action': AnnouncementCallToAction;
      'announcement.message-content': AnnouncementMessageContent;
      'competition.participant': CompetitionParticipant;
      'cursuri.about': CursuriAbout;
      'cursuri.banner': CursuriBanner;
      'cursuri.info-section': CursuriInfoSection;
      'cursuri.promo-card': CursuriPromoCard;
      'homepage.about': HomepageAbout;
      'homepage.hero': HomepageHero;
      'homepage.registration': HomepageRegistration;
      'homepage.registration-closed': HomepageRegistrationClosed;
      'pricing.footer-note': PricingFooterNote;
      'pricing.pricing-tier': PricingPricingTier;
      'regulations.regulation-category': RegulationsRegulationCategory;
      'regulations.regulation-rule': RegulationsRegulationRule;
      'shared.disclaimer': SharedDisclaimer;
      'shared.media': SharedMedia;
      'shared.page-banner': SharedPageBanner;
      'shared.rich-text': SharedRichText;
      'shared.seo': SharedSeo;
      'sportsperson.program': SportspersonProgram;
      'sportsperson.program-season': SportspersonProgramSeason;
    }
  }
}
